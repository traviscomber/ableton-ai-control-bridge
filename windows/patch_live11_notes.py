from pathlib import Path


RECEIVER = Path("max-for-live/bridge_receiver.js")

STABLE_TRACK = '''function createTrack(c, method) {
    var existing = findTrackByName(c.name);
    if (existing >= 0) {
        rememberTrack(c.track_ref, existing, c.name);
        return {track: existing, track_ref: c.track_ref || null, name: String(c.name), existing: true};
    }
    var song = api("live_set");
    var beforeCount = song.getcount("tracks");

    // Use an explicit insertion index. Live can defer collection updates when
    // -1 is used, causing consecutive refs to resolve to the same track.
    var requestedIndex = c.index === undefined ? beforeCount : integer(c.index, "index");
    if (requestedIndex > beforeCount) requestedIndex = beforeCount;
    song.call(method, requestedIndex);

    var afterCount = song.getcount("tracks");
    if (afterCount !== beforeCount + 1)
        throw new Error("Track creation did not increase track count");

    var createdIndex = requestedIndex;
    var created = api("live_set tracks " + createdIndex);
    created.set("name", String(c.name));
    if (nameOf(created) !== String(c.name))
        throw new Error("Created track name verification failed: " + c.name);

    rememberTrack(c.track_ref, createdIndex, c.name);
    return {track: createdIndex, track_ref: c.track_ref || null, name: String(c.name), existing: false};
}
'''

LIVE11_NOTES = '''function createMidiClip(c) {
    var resolvedTrack = track(c);
    var slotPath = "live_set tracks " + resolvedTrack + " clip_slots " + integer(c.clip, "clip");
    var slot = api(slotPath);
    var hasClip = Number(scalar(slot.get("has_clip")));
    if (!hasClip) slot.call("create_clip", Number(c.beats));
    var clip = api(slotPath + " clip");
    var offset = (Number(c.bar) - 1) * 4;

    // Live 11+ note API. Preserve probability and MPE-era metadata defaults.
    clip.call("remove_notes_extended", 0, 128, 0.0, Number(c.beats));
    var payload = {notes: []};
    for (var i = 0; i < c.notes.length; i++) {
        var n = c.notes[i];
        payload.notes.push({
            pitch: Number(n.pitch),
            start_time: offset + Number(n.start),
            duration: Number(n.duration),
            velocity: Number(n.velocity),
            mute: !!n.mute,
            probability: n.probability === undefined ? 1.0 : Number(n.probability),
            velocity_deviation: n.velocity_deviation === undefined ? 0.0 : Number(n.velocity_deviation),
            release_velocity: n.release_velocity === undefined ? 64.0 : Number(n.release_velocity)
        });
    }
    var wrapper = new Dict();
    wrapper.setparse("payload", JSON.stringify(payload));
    clip.call("add_new_notes", wrapper.get("payload"));
    wrapper.freepeer();
    return {track: resolvedTrack, track_ref: c.track_ref || null, clip: c.clip, notes: c.notes.length};
}
'''


def replace_function(source: str, start_marker: str, end_marker: str, replacement: str, label: str) -> str:
    """Replace a whole JS function block using neighboring function markers.

    The receiver may be formatted or compacted. Installer patching must not
    depend on whitespace, local variable names, or previous minification.
    """
    start = source.find(start_marker)
    if start < 0:
        raise RuntimeError(f"Expected {label} start marker was not found")
    end = source.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f"Expected {label} end marker was not found")
    current = source[start:end]
    if replacement.strip() == current.strip():
        return source
    return source[:start] + replacement + "\n" + source[end:]


def main() -> None:
    source = RECEIVER.read_text(encoding="utf-8")
    source = replace_function(
        source,
        "function createTrack(c",
        "function createScene",
        STABLE_TRACK,
        "createTrack",
    )
    source = replace_function(
        source,
        "function createMidiClip(c)",
        "function mixerState",
        LIVE11_NOTES,
        "createMidiClip",
    )
    RECEIVER.write_text(source, encoding="utf-8")


if __name__ == "__main__":
    main()
