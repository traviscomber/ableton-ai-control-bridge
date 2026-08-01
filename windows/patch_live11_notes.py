from pathlib import Path


RECEIVER = Path("max-for-live/bridge_receiver.js")

LEGACY_TRACK = '''function createTrack(c, method) {
    var existing = findTrackByName(c.name);
    if (existing >= 0) {
        rememberTrack(c.track_ref, existing, c.name);
        return {track: existing, track_ref: c.track_ref || null, name: String(c.name), existing: true};
    }
    var song = api("live_set");
    var beforeCount = song.getcount("tracks");
    var requestedIndex = c.track_ref !== undefined ? -1 : (c.index === undefined ? -1 : integer(c.index, "index"));
    var createdIndex = requestedIndex < 0 ? beforeCount : requestedIndex;
    song.call(method, requestedIndex);
    api("live_set tracks " + createdIndex).set("name", String(c.name));
    rememberTrack(c.track_ref, createdIndex, c.name);
    return {track: createdIndex, track_ref: c.track_ref || null, name: String(c.name), existing: false};
}
'''

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

LEGACY_NOTES = '''function createMidiClip(c) {
    var resolvedTrack = track(c);
    var slotPath = "live_set tracks " + resolvedTrack + " clip_slots " + integer(c.clip, "clip");
    var slot = api(slotPath);
    var hasClip = Number(scalar(slot.get("has_clip")));
    if (!hasClip) slot.call("create_clip", Number(c.beats));
    var clip = api(slotPath + " clip");
    var offset = (Number(c.bar) - 1) * 4;
    clip.call("select_all_notes");
    clip.call("replace_selected_notes");
    clip.call("notes", c.notes.length);
    for (var i = 0; i < c.notes.length; i++) {
        var n = c.notes[i];
        clip.call("note", n.pitch, offset + Number(n.start), Number(n.duration), n.velocity, 0);
    }
    clip.call("done");
    return {track: resolvedTrack, track_ref: c.track_ref || null, clip: c.clip, notes: c.notes.length};
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


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if new in source:
        return source
    if old not in source:
        raise RuntimeError(f"Expected {label} implementation was not found")
    return source.replace(old, new, 1)


def main() -> None:
    source = RECEIVER.read_text(encoding="utf-8")
    source = replace_once(source, LEGACY_TRACK, STABLE_TRACK, "legacy createTrack")
    source = replace_once(source, LEGACY_NOTES, LIVE11_NOTES, "legacy createMidiClip")
    RECEIVER.write_text(source, encoding="utf-8")


if __name__ == "__main__":
    main()
