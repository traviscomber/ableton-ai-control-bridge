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
