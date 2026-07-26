from pathlib import Path


def test_set_macro_uses_resolved_track_path() -> None:
    source = Path("max-for-live/bridge_receiver.js").read_text(encoding="utf-8")
    start = source.index("function setMacro(c)")
    end = source.index("function createTrack", start)
    implementation = source[start:end]

    assert "var trackIndex = track(c);" in implementation
    assert 'var devicePath = "live_set tracks " + trackIndex + " devices 0";' in implementation
    assert 'api(devicePath + " parameters " + i)' in implementation
    assert '"live_set tracks " + c.track + " devices 0 parameters "' not in implementation
    assert "track_ref: c.track_ref || null" in implementation
