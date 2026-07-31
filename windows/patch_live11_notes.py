from pathlib import Path


RECEIVER = Path("max-for-live/bridge_receiver.js")

OLD = '''function createMidiClip(c) {
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

NEW = '''function createMidiClip(c) {
    var resolvedTrack = track(c);
    var slotPath = "live_set tracks " + resolvedTrack + " clip_slots " + integer(c.clip, "clip");
    var slot = api(slotPath);
    var hasClip = Number(scalar(slot.get("has_clip")));
    if (!hasClip) slot.call("create_clip", Number(c.beats));
    var clip = api(slotPath + " clip");
    var offset = (Number(c.bar) - 1) * 4;

    // Live 11+ note API. This preserves MPE-era note metadata defaults and
    // avoids the deprecated replace_selected_notes warning dialog.
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


def main() -> None:
    source = RECEIVER.read_text(encoding="utf-8")
    if NEW in source:
        return
    if OLD not in source:
        raise RuntimeError("Expected legacy createMidiClip implementation was not found")
    RECEIVER.write_text(source.replace(OLD, NEW), encoding="utf-8")


if __name__ == "__main__":
    main()
