from __future__ import annotations

import pytest

from darksco.field_scene_runner import FieldSceneExecutionError, execute_field_section, section_scene_index


def _plan():
    return {
        "schema": "darksco.song-plan/1.0",
        "session": {"mode": "autonomous"},
        "global": {"bpm": 120, "time_signature": [4, 4]},
        "sections": [
            {"id": "morning"},
            {"id": "noon"},
            {"id": "night"},
        ],
        "tracks": [
            {
                "kind": "midi",
                "instrument": "darksco.field",
                "track_ref": "field-main",
                "field_states": {
                    "morning": {"preset": "morning"},
                    "noon": {"preset": "noon"},
                    "night": {"preset": "night", "modifiers": {"deeper": 1.0}},
                },
                "clips": [],
            }
        ],
    }


def test_section_maps_to_zero_based_scene_order():
    plan = _plan()
    assert section_scene_index(plan, "morning") == 0
    assert section_scene_index(plan, "noon") == 1
    assert section_scene_index(plan, "night") == 2


def test_field_cue_completes_before_scene_launch(monkeypatch):
    events = []

    def fake_field(cue, **kwargs):
        events.append(("field", cue["section"]))
        return [{"command": {"status": "acknowledged"}}] * 6

    def fake_scene(command, **kwargs):
        events.append(("scene", command["scene"]))
        return {"command": {"status": "acknowledged"}}

    monkeypatch.setattr("darksco.field_scene_runner.execute_field_cue", fake_field)
    monkeypatch.setattr("darksco.field_scene_runner._submit_ack_gated", fake_scene)

    result = execute_field_section(_plan(), "night")
    assert events == [("field", "night"), ("scene", 2)]
    assert result["scene"] == 2


def test_scene_is_not_launched_when_field_fails(monkeypatch):
    scene_called = False

    def fail_field(cue, **kwargs):
        from darksco.field_cue_runner import FieldCueExecutionError
        raise FieldCueExecutionError("parameter rejected")

    def fake_scene(command, **kwargs):
        nonlocal scene_called
        scene_called = True
        return {}

    monkeypatch.setattr("darksco.field_scene_runner.execute_field_cue", fail_field)
    monkeypatch.setattr("darksco.field_scene_runner._submit_ack_gated", fake_scene)

    with pytest.raises(FieldSceneExecutionError, match="not launched"):
        execute_field_section(_plan(), "night")
    assert scene_called is False
