from pathlib import Path
import re


def receiver_source() -> str:
    return Path("max-for-live/bridge_receiver.js").read_text(encoding="utf-8")


def function_block(source: str, start_marker: str, end_marker: str) -> str:
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    return source[start:end]


def test_set_macro_uses_resolved_track_path() -> None:
    implementation = function_block(receiver_source(), "function setMacro(c)", "function createTrack")

    assert re.search(r"(?:trackIndex|ti)\s*=\s*track\(c\)", implementation)
    assert re.search(r'"live_set tracks "\s*\+\s*(?:trackIndex|ti)\s*\+\s*" devices 0"', implementation)
    assert "parameters" in implementation
    assert '"live_set tracks " + c.track + " devices 0 parameters "' not in implementation
    assert re.search(r"track_ref\s*:\s*c\.track_ref\s*\|\|\s*null", implementation)


def test_track_creation_uses_pre_creation_count_for_appended_index() -> None:
    implementation = function_block(receiver_source(), "function createTrack(c,method)", "function createScene")

    assert re.search(r'(?:beforeCount|before)\s*=\s*song\.getcount\("tracks"\)', implementation)
    assert re.search(r'(?:createdIndex|created)\s*=\s*(?:requestedIndex|requested)\s*<\s*0\s*\?\s*(?:beforeCount|before)\s*:\s*(?:requestedIndex|requested)', implementation)
    assert 'song.getcount("tracks") - 1' not in implementation
    assert re.search(r"rememberTrack\(c\.track_ref\s*,\s*(?:createdIndex|created)\s*,\s*c\.name\)", implementation)


def test_track_references_are_verified_and_recovered_by_name() -> None:
    implementation = function_block(receiver_source(), "function track(c)", "function returnTrack")

    assert re.search(r"saved\s*=\s*trackRefs\[ref\]", implementation)
    assert re.search(r"nameOf\(api\(\"live_set tracks \"\s*\+\s*saved\.index\)\)\s*===\s*saved\.name", implementation)
    assert re.search(r"recovered\s*=\s*findTrackByName\(saved\.name\)", implementation)
    assert "Track reference no longer resolves:" in implementation


def test_track_creation_is_idempotent_by_exact_name() -> None:
    implementation = function_block(receiver_source(), "function createTrack(c,method)", "function createScene")

    assert re.search(r"existing\s*=\s*findTrackByName\(c\.name\)", implementation)
    assert re.search(r"existing\s*>=\s*0", implementation)
    assert re.search(r"existing\s*:\s*true", implementation)


def test_return_creation_is_idempotent_and_uses_pre_creation_count() -> None:
    implementation = function_block(receiver_source(), "function createReturnTrack(c)", "function setClipLoop")

    assert re.search(r'(?:beforeCount|before)\s*=\s*song\.getcount\("return_tracks"\)', implementation)
    assert re.search(r"existing\s*:\s*true", implementation)
    assert 'song.getcount("return_tracks") - 1' not in implementation
    assert re.search(r'live_set return_tracks .*?(?:beforeCount|before)', implementation)


def test_midi_clip_reports_resolved_track() -> None:
    implementation = function_block(receiver_source(), "function createMidiClip(c)", "function acknowledge")

    assert re.search(r"(?:resolvedTrack|ti)\s*=\s*track\(c\)", implementation)
    assert re.search(r'"live_set tracks "\s*\+\s*(?:resolvedTrack|ti)\s*\+\s*" clip_slots "', implementation)
    assert re.search(r"track_ref\s*:\s*c\.track_ref\s*\|\|\s*null", implementation)


def test_parameter_calculation_uses_live_reported_range_and_quantization() -> None:
    source = receiver_source()
    meta = function_block(source, "function parameterMeta", "function nativeFromNormalized")
    conversion = function_block(source, "function nativeFromNormalized", "function normalizedValue")

    assert 'numberProp(object,"min")' in meta
    assert 'numberProp(object,"max")' in meta
    assert 'numberProp(object,"value")' in meta
    assert 'is_quantized' in meta
    assert 'value_items' in meta
    assert 'clamp01((value-min)/(max-min))' in meta
    assert 'meta.min+(meta.max-meta.min)*n' in conversion
    assert 'if(meta.is_quantized)' in conversion
    assert 'Math.round' in conversion
    assert 'clamp(native,meta.min,meta.max)' in conversion


def test_parameter_writes_are_clamped_and_verified_by_exact_readback() -> None:
    source = receiver_source()
    setter = function_block(source, "function setNormalized", "function findTrackByName")
    device_setter = function_block(source, "function setParameterOnPath", "function setDeviceParameter")

    assert 'clamp01(normalized)' in setter
    assert 'nativeFromNormalized(meta,requested)' in setter
    assert 'p.set("value",native)' in setter
    assert 'readback=parameterMeta(p,null)' in setter
    assert 'readback_native:readback.value' in setter
    assert 'readback_normalized:readback.normalized' in setter
    assert 'if(!meta.is_enabled)' in device_setter


def test_duplicate_device_or_parameter_names_never_silently_bind() -> None:
    source = receiver_source()
    device_lookup = function_block(source, "function findDevice", "function findParameter")
    parameter_lookup = function_block(source, "function findParameter", "function setParameterOnPath")

    assert 'matches.length>1' in device_lookup
    assert 'Ambiguous duplicate device name' in device_lookup
    assert 'matches.length>1' in parameter_lookup
    assert 'Ambiguous duplicate parameter name' in parameter_lookup


def test_device_snapshot_restore_verifies_topology_before_writing() -> None:
    source = receiver_source()
    restore = function_block(source, "function restoreDeviceSnapshot", "function acknowledge")

    assert 'd.index!==s.device_index' in restore
    assert 'count!==s.parameters.length' in restore
    assert 'currentName!==saved.name' in restore
    assert 'setNative' in restore
