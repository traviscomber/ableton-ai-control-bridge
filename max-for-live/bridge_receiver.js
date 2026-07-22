autowatch = 1;
inlets = 1;
outlets = 2;
var trackRefs = {};

function dictionary(name) {
    var source = new Dict(name);
    execute(JSON.parse(source.stringify()));
}

function anything() {
    var raw = arrayfromargs(messagename, arguments).join(" ");
    try { execute(JSON.parse(raw)); }
    catch (error) { acknowledge(null, false, null, "Invalid JSON: " + error.message); }
}

function execute(command) {
    var id = command.bridge_id || null;
    try {
        var result = dispatch(command);
        acknowledge(id, true, result || {}, null);
        outlet(1, "executed", command.type, id || "untracked");
    } catch (error) {
        acknowledge(id, false, null, error.message || String(error));
        outlet(1, "error", command.type || "unknown", error.message || String(error));
    }
}

function dispatch(c) {
    switch (c.type) {
    case "set_tempo":
        api("live_set").set("tempo", c.bpm);
        return {tempo: c.bpm};
    case "launch_scene":
        api("live_set scenes " + integer(c.scene, "scene")).call("fire");
        return {scene: c.scene};
    case "stop_all_clips":
        api("live_set").call("stop_all_clips");
        return {};
    case "set_track_volume":
        setNormalized("live_set tracks " + track(c) + " mixer_device volume", c.volume);
        return {track: c.track, volume: c.volume};
    case "set_track_pan":
        setNative("live_set tracks " + track(c) + " mixer_device panning", c.pan);
        return {track: c.track, pan: c.pan};
    case "set_macro":
        return setMacro(c);
    case "create_midi_track":
        return createTrack(c, "create_midi_track");
    case "create_audio_track":
        return createTrack(c, "create_audio_track");
    case "arm_track":
        api("live_set tracks " + track(c)).set("arm", c.armed ? 1 : 0);
        return {track: c.track, armed: !!c.armed};
    case "set_device_parameter":
        return setDeviceParameter(c);
    case "create_midi_clip":
        return createMidiClip(c);
    case "undo":
        api("live_set").call("undo");
        return {target_command_id: c.target_command_id || null};
    case "start_playback":
        api("live_set").set("is_playing", 1); return {is_playing: true};
    case "stop_playback":
        api("live_set").set("is_playing", 0); return {is_playing: false};
    case "set_time_signature":
        api("live_set").set("signature_numerator", c.numerator);
        api("live_set").set("signature_denominator", c.denominator);
        return {numerator: c.numerator, denominator: c.denominator};
    case "set_metronome":
        api("live_set").set("metronome", c.enabled ? 1 : 0); return {enabled: !!c.enabled};
    case "set_song_loop":
        api("live_set").set("loop_start", Number(c.start));
        api("live_set").set("loop_length", Number(c.length));
        api("live_set").set("loop", c.enabled ? 1 : 0);
        return {start: c.start, length: c.length, enabled: !!c.enabled};
    case "create_scene": return createScene(c);
    case "duplicate_scene":
        api("live_set").call("duplicate_scene", integer(c.scene, "scene")); return {scene: c.scene};
    case "delete_scene":
        api("live_set").call("delete_scene", integer(c.scene, "scene")); return {scene: c.scene};
    case "duplicate_track":
        api("live_set").call("duplicate_track", track(c)); return {track: c.track};
    case "delete_track":
        api("live_set").call("delete_track", track(c)); return {track: c.track};
    case "set_track_mute":
        api("live_set tracks " + track(c)).set("mute", c.muted ? 1 : 0); return {track: c.track, muted: !!c.muted};
    case "set_track_solo":
        api("live_set tracks " + track(c)).set("solo", c.soloed ? 1 : 0); return {track: c.track, soloed: !!c.soloed};
    case "launch_clip":
        api(clipSlotPath(c)).call("fire"); return {track: c.track, clip: c.clip};
    case "stop_track_clips":
        api("live_set tracks " + track(c)).call("stop_all_clips"); return {track: c.track};
    case "set_clip_name":
        api(clipPath(c)).set("name", String(c.name)); return {track: c.track, clip: c.clip, name: c.name};
    case "set_clip_color":
        api(clipPath(c)).set("color", integer(c.color, "color")); return {track: c.track, clip: c.clip, color: c.color};
    case "set_clip_loop": return setClipLoop(c);
    default:
        throw new Error("Unsupported command type: " + c.type);
    }
}

function api(path) {
    var object = new LiveAPI(null, path);
    if (!object || object.id === 0) throw new Error("Live API path not found: " + path);
    return object;
}

function integer(value, name) {
    if (Math.floor(Number(value)) !== Number(value) || Number(value) < 0)
        throw new Error(name + " must be a non-negative integer");
    return Number(value);
}

function track(c) {
    if (c.track_ref !== undefined) {
        var ref = String(c.track_ref);
        if (trackRefs[ref] === undefined) throw new Error("Unknown track_ref: " + ref);
        return trackRefs[ref];
    }
    return integer(c.track, "track");
}

function clipSlotPath(c) {
    return "live_set tracks " + track(c) + " clip_slots " + integer(c.clip, "clip");
}

function clipPath(c) { return clipSlotPath(c) + " clip"; }

function scalar(value) {
    if (value instanceof Array) return value.length > 1 && value[0] === "id" ? value[1] : value[value.length - 1];
    return value;
}

function nameOf(object) { return String(scalar(object.get("name"))); }

function setNative(path, value) {
    api(path).set("value", Number(value));
}

function setNormalized(path, normalized) {
    var parameter = api(path);
    var min = Number(scalar(parameter.get("min")));
    var max = Number(scalar(parameter.get("max")));
    var value = min + (max - min) * Number(normalized);
    parameter.set("value", value);
    return value;
}

function setMacro(c) {
    var device = api("live_set tracks " + track(c) + " devices 0");
    var count = device.getcount("parameters");
    var target = null;
    var desired = "macro " + integer(c.macro, "macro");
    for (var i = 0; i < count; i++) {
        var parameter = api("live_set tracks " + c.track + " devices 0 parameters " + i);
        if (nameOf(parameter).toLowerCase() === desired) { target = parameter; break; }
    }
    if (!target) throw new Error("Rack macro not found: " + desired);
    var min = Number(scalar(target.get("min"))), max = Number(scalar(target.get("max")));
    target.set("value", min + (max - min) * Number(c.value));
    return {track: c.track, macro: c.macro, value: c.value};
}

function createTrack(c, method) {
    var song = api("live_set");
    // Referenced tracks are always appended so the Max receiver track never
    // moves or reloads during an autonomous batch.
    var index = c.track_ref !== undefined ? -1 : (c.index === undefined ? -1 : integer(c.index, "index"));
    song.call(method, index);
    var createdIndex = index < 0 ? song.getcount("tracks") - 1 : index;
    api("live_set tracks " + createdIndex).set("name", String(c.name));
    if (c.track_ref !== undefined) trackRefs[String(c.track_ref)] = createdIndex;
    return {track: createdIndex, track_ref: c.track_ref || null, name: String(c.name)};
}

function createScene(c) {
    var song = api("live_set");
    var index = c.index === undefined ? -1 : integer(c.index, "index");
    song.call("create_scene", index);
    var createdIndex = index < 0 ? song.getcount("scenes") - 1 : index;
    if (c.name !== undefined) api("live_set scenes " + createdIndex).set("name", String(c.name));
    return {scene: createdIndex, name: c.name || null};
}

function setClipLoop(c) {
    var clip = api(clipPath(c));
    clip.set("loop_start", Number(c.start));
    clip.set("loop_end", Number(c.start) + Number(c.length));
    clip.set("looping", c.enabled ? 1 : 0);
    return {track: c.track, clip: c.clip, start: c.start, length: c.length, enabled: !!c.enabled};
}

function setDeviceParameter(c) {
    var trackPath = "live_set tracks " + track(c);
    var trackApi = api(trackPath), deviceCount = trackApi.getcount("devices"), deviceIndex = -1;
    for (var i = 0; i < deviceCount; i++) {
        if (nameOf(api(trackPath + " devices " + i)) === String(c.device)) { deviceIndex = i; break; }
    }
    if (deviceIndex < 0) throw new Error("Device not found: " + c.device);
    var devicePath = trackPath + " devices " + deviceIndex;
    var deviceApi = api(devicePath), parameterCount = deviceApi.getcount("parameters"), parameter = null;
    for (var p = 0; p < parameterCount; p++) {
        var candidate = api(devicePath + " parameters " + p);
        if (nameOf(candidate) === String(c.parameter)) { parameter = candidate; break; }
    }
    if (!parameter) throw new Error("Parameter not found: " + c.parameter);
    var min = Number(scalar(parameter.get("min"))), max = Number(scalar(parameter.get("max")));
    parameter.set("value", min + (max - min) * Number(c.value));
    return {track: c.track, device: c.device, parameter: c.parameter, value: c.value};
}

function createMidiClip(c) {
    var slotPath = "live_set tracks " + track(c) + " clip_slots " + integer(c.clip, "clip");
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
    return {track: c.track, clip: c.clip, notes: c.notes.length};
}

function acknowledge(id, ok, result, error) {
    var payload = {bridge_id: id, ok: !!ok};
    if (result !== null) payload.result = result;
    if (error !== null) payload.error = error;
    outlet(0, "/bridge_ack", JSON.stringify(payload));
}
