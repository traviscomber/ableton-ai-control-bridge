import pytest

from darksco.instruments.field_intent import (
    FIELD_INTENT_DELTAS,
    FieldIntent,
    compile_field_intent,
    parse_field_phrase,
    resolve_field_intent,
)
from darksco.instruments.field_presets import FIELD_PRESETS


def test_night_deeper_less_motion_more_space_is_musically_directional():
    base = FIELD_PRESETS["night"].controls
    intent = FieldIntent(
        preset="night",
        modifiers={"deeper": 1.0, "less_motion": 1.0, "more_space": 1.0},
    )
    state = resolve_field_intent(intent)
    assert state["density"] > base["density"]
    assert state["texture"] > base["texture"]
    assert state["motion"] < base["motion"]
    assert state["space"] > base["space"]


def test_resolved_intent_is_always_normalized():
    for modifier in FIELD_INTENT_DELTAS:
        state = resolve_field_intent(FieldIntent("night", {modifier: 1.0}))
        assert all(0.0 <= value <= 1.0 for value in state.values())


def test_strength_scales_modifier():
    base = FIELD_PRESETS["night"].controls
    half = resolve_field_intent(FieldIntent("night", {"more_space": 0.5}))
    full = resolve_field_intent(FieldIntent("night", {"more_space": 1.0}))
    assert base["space"] < half["space"] < full["space"]


def test_compile_intent_uses_existing_bridge_command_only():
    commands = compile_field_intent(
        FieldIntent("morning", {"wider": 0.5}), track_ref="darksco:field"
    )
    assert len(commands) == 6
    assert {command["type"] for command in commands} == {"set_device_parameter"}
    assert {command["track_ref"] for command in commands} == {"darksco:field"}
    assert {command["device"] for command in commands} == {"DARKSCO FIELD"}


def test_phrase_parser_resolves_daily_cycle_and_modifiers():
    intent = parse_field_phrase("night, deeper, less motion, more space")
    assert intent.preset == "night"
    assert intent.modifiers == {
        "deeper": 1.0,
        "less_motion": 1.0,
        "more_space": 1.0,
    }


def test_phrase_parser_has_deterministic_default():
    assert parse_field_phrase("wide and clean").preset == "night"


def test_unknown_modifier_is_rejected():
    with pytest.raises(ValueError, match="Unknown FIELD intent modifier"):
        resolve_field_intent(FieldIntent("night", {"magic": 1.0}))


def test_modifier_strength_must_be_normalized():
    with pytest.raises(ValueError, match="between 0 and 1"):
        resolve_field_intent(FieldIntent("night", {"deeper": 1.1}))
