autowatch = 1;
inlets = 1;
outlets = 2;

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

function track(c) { return integer(c.track, "track"); }

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
    var index = c.index === undefined ? -1 : integer(c.index, "index");
    song.call(method, index);
    var createdIndex = index < 0 ? song.getcount("tracks") - 1 : index;
    api("live_set tracks " + createdIndex).set("name", String(c.name));
    return {track: createdIndex, name: String(c.name)};
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
