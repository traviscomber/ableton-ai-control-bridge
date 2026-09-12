import pytest

from darksco.field_song_plan import compile_field_cue_manifest, compile_field_section_cues
from darksco.song_plan import SongPlanError


def make_plan():
    return {
        "schema": "darksco.song-plan/1.0",
        "session": {"mode": "producer"},
        "global": {"bpm": 118, "time_signature": [4, 4]},
        "sections": [
            {"id": "morning"},
            {"id": "noon"},
            {"id": "night"},
        ],
        "tracks": [
            {
                "name": "FIELD",
                "kind": "midi",
                "instrument": "darksco.field",
                "track_ref": "field-1",
                "field_states": {
                    "morning": {"preset": "morning", "modifiers": {"lighter": 0.5}},
                    "noon": {"preset": "noon", "modifiers": {"more_motion": 0.35}},
                    "night": {
                        "preset": "night",
                        "modifiers": {"deeper": 1.0, "less_motion": 1.0, "more_space": 1.0},
                    },
                },
                "clips": [],
            }
        ],
    }


def test_compiles_field_cues_in_song_section_order():
    cues = compile_field_section_cues(make_plan())
    assert [cue.section_id for cue in cues] == ["morning", "noon", "night"]
    assert all(cue.track_ref == "field-1" for cue in cues)
    assert all(len(cue.commands) == 6 for cue in cues)
    assert all(command["type"] == "set_device_parameter" for cue in cues for command in cue.commands)


def test_night_cue_reflects_semantic_evolution():
    cues = compile_field_section_cues(make_plan())
    night = {command["parameter"]: command["value"] for command in cues[-1].commands}
    assert night["Density"] > 0.72
    assert night["Motion"] < 0.31
    assert night["Space"] > 0.74


def test_manifest_is_serializable_bridge_boundary():
    manifest = compile_field_cue_manifest(make_plan())
    assert manifest["schema"] == "darksco.field-cues/1.0"
    assert manifest["song_schema"] == "darksco.song-plan/1.0"
    assert len(manifest["cues"]) == 3


def test_field_requires_stable_track_ref():
    plan = make_plan()
    del plan["tracks"][0]["track_ref"]
    with pytest.raises(SongPlanError, match="stable track_ref"):
        compile_field_section_cues(plan)


def test_field_state_cannot_reference_unknown_section():
    plan = make_plan()
    plan["tracks"][0]["field_states"]["sunset"] = {"preset": "night"}
    with pytest.raises(SongPlanError, match="unknown section"):
        compile_field_section_cues(plan)


def test_plan_without_field_is_unchanged_and_emits_no_cues():
    plan = make_plan()
    plan["tracks"] = []
    assert compile_field_section_cues(plan) == []
