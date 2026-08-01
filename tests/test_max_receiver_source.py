from pathlib import Path


def receiver_source() -> str:
    return Path("max-for-live/bridge_receiver.js").read_text(encoding="utf-8")


def test_set_macro_uses_resolved_track_path() -> None:
    source = receiver_source()
    start = source.index("function setMacro(c)")
    end = source.index("function createTrack", start)
    implementation = source[start:end]

    assert "var trackIndex = track(c);" in implementation
    assert 'var devicePath = "live_set tracks " + trackIndex + " devices 0";' in implementation
    assert 'api(devicePath + " parameters " + i)' in implementation
    assert '"live_set tracks " + c.track + " devices 0 parameters "' not in implementation
    assert "track_ref: c.track_ref || null" in implementation


def test_track_creation_uses_pre_creation_count_for_appended_index() -> None:
    source = receiver_source()
    start = source.index("function createTrack(c, method)")
    end = source.index("function createScene", start)
    implementation = source[start:end]

    assert 'var beforeCount = song.getcount("tracks");' in implementation
    assert "var createdIndex = requestedIndex < 0 ? beforeCount : requestedIndex;" in implementation
    assert 'song.getcount("tracks") - 1' not in implementation
    assert "rememberTrack(c.track_ref, createdIndex, c.name);" in implementation


def test_track_references_are_verified_and_recovered_by_name() -> None:
    source = receiver_source()
    start = source.index("function track(c)")
    end = source.index("function returnTrack", start)
    implementation = source[start:end]

    assert "var saved = trackRefs[ref];" in implementation
    assert "if (currentName === saved.name) return saved.index;" in implementation
    assert "var recovered = findTrackByName(saved.name);" in implementation
    assert 'throw new Error("Track reference no longer resolves: " + ref);' in implementation


def test_track_creation_is_idempotent_by_exact_name() -> None:
    source = receiver_source()
    start = source.index("function createTrack(c, method)")
    end = source.index("function createScene", start)
    implementation = source[start:end]

    assert "var existing = findTrackByName(c.name);" in implementation
    assert "if (existing >= 0)" in implementation
    assert "existing: true" in implementation


def test_return_creation_is_idempotent_and_uses_pre_creation_count() -> None:
    source = receiver_source()
    start = source.index("function createReturnTrack(c)")
    end = source.index("function setClipLoop", start)
    implementation = source[start:end]

    assert 'var beforeCount = song.getcount("return_tracks");' in implementation
    assert "var createdIndex = beforeCount;" in implementation
    assert "existing: true" in implementation
    assert 'song.getcount("return_tracks") - 1' not in implementation


def test_midi_clip_reports_resolved_track() -> None:
    source = receiver_source()
    start = source.index("function createMidiClip(c)")
    end = source.index("function acknowledge", start)
    implementation = source[start:end]

    assert "var resolvedTrack = track(c);" in implementation
    assert 'var slotPath = "live_set tracks " + resolvedTrack' in implementation
    assert "track_ref: c.track_ref || null" in implementation
