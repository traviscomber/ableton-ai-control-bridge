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
    case "set_tempo": api("live_set").set("tempo", c.bpm); return {tempo: c.bpm};
    case "launch_scene": api("live_set scenes " + integer(c.scene, "scene")).call("fire"); return {scene: c.scene};
    case "stop_all_clips": api("live_set").call("stop_all_clips"); return {};
    case "set_track_volume": setNormalized("live_set tracks " + track(c) + " mixer_device volume", c.volume); return {track: track(c), volume: c.volume};
    case "set_track_pan": setNative("live_set tracks " + track(c) + " mixer_device panning", c.pan); return {track: track(c), pan: c.pan};
    case "set_macro": return setMacro(c);
    case "create_midi_track": return createTrack(c, "create_midi_track");
    case "create_audio_track": return createTrack(c, "create_audio_track");
    case "arm_track": api("live_set tracks " + track(c)).set("arm", c.armed ? 1 : 0); return {track: track(c), armed: !!c.armed};
    case "set_device_parameter": return setDeviceParameter(c);
    case "create_midi_clip": return createMidiClip(c);
    case "undo": api("live_set").call("undo"); return {target_command_id: c.target_command_id || null};
    case "start_playback": api("live_set").set("is_playing", 1); return {is_playing: true};
    case "stop_playback": api("live_set").set("is_playing", 0); return {is_playing: false};
    case "set_time_signature":
        api("live_set").set("signature_numerator", c.numerator);
        api("live_set").set("signature_denominator", c.denominator);
        return {numerator: c.numerator, denominator: c.denominator};
    case "set_metronome": api("live_set").set("metronome", c.enabled ? 1 : 0); return {enabled: !!c.enabled};
    case "set_song_loop":
        api("live_set").set("loop_start", Number(c.start));
        api("live_set").set("loop_length", Number(c.length));
        api("live_set").set("loop", c.enabled ? 1 : 0);
        return {start: c.start, length: c.length, enabled: !!c.enabled};
    case "create_scene": return createScene(c);
    case "duplicate_scene": api("live_set").call("duplicate_scene", integer(c.scene, "scene")); return {scene: c.scene};
    case "delete_scene": api("live_set").call("delete_scene", integer(c.scene, "scene")); return {scene: c.scene};
    case "duplicate_track": api("live_set").call("duplicate_track", track(c)); return {track: track(c)};
    case "delete_track": api("live_set").call("delete_track", track(c)); return {track: track(c)};
    case "set_track_mute": api("live_set tracks " + track(c)).set("mute", c.muted ? 1 : 0); return {track: track(c), muted: !!c.muted};
    case "set_track_solo": api("live_set tracks " + track(c)).set("solo", c.soloed ? 1 : 0); return {track: track(c), soloed: !!c.soloed};
    case "launch_clip": api(clipSlotPath(c)).call("fire"); return {track: track(c), clip: c.clip};
    case "stop_track_clips": api("live_set tracks " + track(c)).call("stop_all_clips"); return {track: track(c)};
    case "set_clip_name": api(clipPath(c)).set("name", String(c.name)); return {track: track(c), clip: c.clip, name: c.name};
    case "set_clip_color": api(clipPath(c)).set("color", integer(c.color, "color")); return {track: track(c), clip: c.clip, color: c.color};
    case "set_clip_loop": return setClipLoop(c);
    case "create_return_track": return createReturnTrack(c);
    case "set_return_volume": setNormalized("live_set return_tracks " + returnTrack(c) + " mixer_device volume", c.volume); return {return_track: returnTrack(c), volume: c.volume};
    case "set_return_pan": setNative("live_set return_tracks " + returnTrack(c) + " mixer_device panning", c.pan); return {return_track: returnTrack(c), pan: c.pan};
    case "set_track_send": setNormalized("live_set tracks " + track(c) + " mixer_device sends " + returnTrack(c), c.amount); return {track: track(c), return_track: returnTrack(c), amount: c.amount};
    case "set_return_device_parameter": return setReturnDeviceParameter(c);
    default: throw new Error("Unsupported command type: " + c.type);
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

function scalar(value) {
    if (value instanceof Array) return value.length > 1 && value[0] === "id" ? value[1] : value[value.length - 1];
    return value;
}

function nameOf(object) { return String(scalar(object.get("name"))); }

function findTrackByName(name) {
    var desired = String(name).trim().toLowerCase();
    var song = api("live_set");
    var count = song.getcount("tracks");
    for (var i = 0; i < count; i++) {
        if (nameOf(api("live_set tracks " + i)).trim().toLowerCase() === desired) return i;
    }
    return -1;
}

function rememberTrack(ref, index, name) {
    if (ref === undefined || ref === null) return;
    trackRefs[String(ref)] = {index: Number(index), name: String(name)};
}

function track(c) {
    if (c.track_name !== undefined) {
        var namedIndex = findTrackByName(c.track_name);
        if (namedIndex >= 0) return namedIndex;
        throw new Error("Track not found: " + c.track_name);
    }
    if (c.track_ref !== undefined) {
        var ref = String(c.track_ref);
        var saved = trackRefs[ref];
        if (saved === undefined) throw new Error("Unknown track_ref: " + ref);
        if (typeof saved === "number") return saved;
        var song = api("live_set");
        var count = song.getcount("tracks");
        if (saved.index >= 0 && saved.index < count) {
            var currentName = nameOf(api("live_set tracks " + saved.index));
            if (currentName === saved.name) return saved.index;
        }
        var recovered = findTrackByName(saved.name);
        if (recovered >= 0) {
            saved.index = recovered;
            return recovered;
        }
        throw new Error("Track reference no longer resolves: " + ref);
    }
    return integer(c.track, "track");
}

function returnTrack(c) {
    if (c.return_name !== undefined) {
        var desired = String(c.return_name).trim().toLowerCase();
        var song = api("live_set");
        var count = song.getcount("return_tracks");
        for (var i = 0; i < count; i++) {
            if (nameOf(api("live_set return_tracks " + i)).trim().toLowerCase() === desired) return i;
        }
        throw new Error("Return track not found: " + c.return_name);
    }
    return integer(c.return, "return");
}

function clipSlotPath(c) { return "live_set tracks " + track(c) + " clip_slots " + integer(c.clip, "clip"); }
function clipPath(c) { return clipSlotPath(c) + " clip"; }

function setNative(path, value) { api(path).set("value", Number(value)); }

function setNormalized(path, normalized) {
    var parameter = api(path);
    var min = Number(scalar(parameter.get("min")));
    var max = Number(scalar(parameter.get("max")));
    var value = min + (max - min) * Number(normalized);
    parameter.set("value", value);
    return value;
}

function setMacro(c) {
    var trackIndex = track(c);
    var devicePath = "live_set tracks " + trackIndex + " devices 0";
    var device = api(devicePath);
    var count = device.getcount("parameters");
    var target = null;
    var desired = "macro " + integer(c.macro, "macro");
    for (var i = 0; i < count; i++) {
        var parameter = api(devicePath + " parameters " + i);
        if (nameOf(parameter).toLowerCase() === desired) { target = parameter; break; }
    }
    if (!target) throw new Error("Rack macro not found: " + desired);
    var min = Number(scalar(target.get("min"))), max = Number(scalar(target.get("max")));
    target.set("value", min + (max - min) * Number(c.value));
    return {track: trackIndex, track_ref: c.track_ref || null, macro: c.macro, value: c.value};
}

function createTrack(c, method) {
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

function createScene(c) {
    var song = api("live_set");
    var index = c.index === undefined ? -1 : integer(c.index, "index");
    song.call("create_scene", index);
    var createdIndex = index < 0 ? song.getcount("scenes") - 1 : index;
    if (c.name !== undefined) api("live_set scenes " + createdIndex).set("name", String(c.name));
    return {scene: createdIndex, name: c.name || null};
}

function createReturnTrack(c) {
    var desired = String(c.name).trim().toLowerCase();
    var song = api("live_set");
    var beforeCount = song.getcount("return_tracks");
    for (var i = 0; i < beforeCount; i++) {
        if (nameOf(api("live_set return_tracks " + i)).trim().toLowerCase() === desired)
            return {return_track: i, name: String(c.name), existing: true};
    }
    var createdIndex = beforeCount;
    song.call("create_return_track");
    api("live_set return_tracks " + createdIndex).set("name", String(c.name));
    return {return_track: createdIndex, name: String(c.name), existing: false};
}

function setClipLoop(c) {
    var clip = api(clipPath(c));
    clip.set("loop_start", Number(c.start));
    clip.set("loop_end", Number(c.start) + Number(c.length));
    clip.set("looping", c.enabled ? 1 : 0);
    return {track: track(c), clip: c.clip, start: c.start, length: c.length, enabled: !!c.enabled};
}

function setDeviceParameter(c) {
    var trackIndex = track(c);
    var trackPath = "live_set tracks " + trackIndex;
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
    return {track: trackIndex, device: c.device, parameter: c.parameter, value: c.value};
}

function setReturnDeviceParameter(c) {
    var returnIndex = returnTrack(c);
    var trackPath = "live_set return_tracks " + returnIndex;
    var trackApi = api(trackPath), deviceCount = trackApi.getcount("devices"), deviceIndex = -1;
    for (var i = 0; i < deviceCount; i++) {
        if (nameOf(api(trackPath + " devices " + i)) === String(c.device)) { deviceIndex = i; break; }
    }
    if (deviceIndex < 0) throw new Error("Return device not found: " + c.device);
    var devicePath = trackPath + " devices " + deviceIndex;
    var deviceApi = api(devicePath), parameterCount = deviceApi.getcount("parameters"), parameter = null;
    for (var p = 0; p < parameterCount; p++) {
        var candidate = api(devicePath + " parameters " + p);
        if (nameOf(candidate) === String(c.parameter)) { parameter = candidate; break; }
    }
    if (!parameter) throw new Error("Return parameter not found: " + c.parameter);
    var min = Number(scalar(parameter.get("min"))), max = Number(scalar(parameter.get("max")));
    parameter.set("value", min + (max - min) * Number(c.value));
    return {return_track: returnIndex, device: c.device, parameter: c.parameter, value: c.value};
}

function createMidiClip(c) {
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

function acknowledge(id, ok, result, error) {
    var payload = {bridge_id: id, ok: !!ok};
    if (result !== null) payload.result = result;
    if (error !== null) payload.error = error;
    outlet(0, "/bridge_ack", JSON.stringify(payload));
}
