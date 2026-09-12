from pathlib import Path


def receiver_source() -> str:
    return Path("max-for-live/bridge_receiver.js").read_text(encoding="utf-8")


def compact(text: str) -> str:
    return "".join(text.split())


def function_slice(source: str, start_marker: str, end_marker: str) -> str:
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    return compact(source[start:end])


def test_set_macro_uses_resolved_track_path() -> None:
    implementation = function_slice(receiver_source(), "function setMacro(c)", "function createTrack")

    assert "track(c)" in implementation
    assert '"live_settracks"+' in implementation
    assert '"devices0"' in implementation
    assert 'api(dp+"parameters"+i)' in implementation
    assert '"live_settracks"+c.track+"devices0parameters"' not in implementation
    assert "track_ref:c.track_ref||null" in implementation


def test_track_creation_uses_pre_creation_count_for_appended_index() -> None:
    implementation = function_slice(receiver_source(), "function createTrack(c,method)", "function createScene")

    assert 'getcount("tracks")' in implementation
    assert "requested<0?before:requested" in implementation
    assert 'getcount("tracks")-1' not in implementation
    assert "rememberTrack(c.track_ref,created,c.name)" in implementation


def test_track_references_are_verified_and_recovered_by_name() -> None:
    implementation = function_slice(receiver_source(), "function track(c)", "function returnTrack")

    assert "saved=trackRefs[ref]" in implementation
    assert "saved.index>=0&&saved.index<count" in implementation
    assert "nameOf(api(\"live_settracks\"+saved.index))===saved.name" in implementation
    assert "recovered=findTrackByName(saved.name)" in implementation
    assert 'thrownewError("Trackreferencenolongerresolves:"+ref)' in implementation


def test_track_creation_is_idempotent_by_exact_name() -> None:
    implementation = function_slice(receiver_source(), "function createTrack(c,method)", "function createScene")

    assert "existing=findTrackByName(c.name)" in implementation
    assert "if(existing>=0)" in implementation
    assert "existing:true" in implementation


def test_return_creation_is_idempotent_and_uses_pre_creation_count() -> None:
    implementation = function_slice(receiver_source(), "function createReturnTrack(c)", "function setClipLoop")

    assert 'getcount("return_tracks")' in implementation
    assert "return_track:before" in implementation
    assert "existing:true" in implementation
    assert 'getcount("return_tracks")-1' not in implementation


def test_midi_clip_reports_resolved_track() -> None:
    implementation = function_slice(receiver_source(), "function createMidiClip(c)", "function mixerState")

    assert "ti=track(c)" in implementation
    assert '"live_settracks"+ti+"clip_slots"' in implementation
    assert "track_ref:c.track_ref||null" in implementation
