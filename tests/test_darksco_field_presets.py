import pytest

from darksco.instruments.field import FIELD_CONTROLS
from darksco.instruments.field_presets import (
    FIELD_PRESETS,
    compile_field_preset,
    get_field_preset,
    randomize_field_controls,
)


def test_daily_cycle_presets_define_exact_field_vocabulary():
    assert set(FIELD_PRESETS) == {"morning", "noon", "night"}
    for preset in FIELD_PRESETS.values():
        assert set(preset.controls) == set(FIELD_CONTROLS)
        assert all(0.0 <= value <= 1.0 for value in preset.controls.values())


def test_daily_cycle_has_intentional_energy_progression():
    morning = FIELD_PRESETS["morning"].controls
    noon = FIELD_PRESETS["noon"].controls
    night = FIELD_PRESETS["night"].controls
    assert morning["density"] < noon["density"] < night["density"]
    assert morning["texture"] < noon["texture"] < night["texture"]
    assert morning["instability"] < noon["instability"] < night["instability"]


def test_randomization_is_seeded_bounded_and_repeatable():
    base = FIELD_PRESETS["night"].controls
    first = randomize_field_controls(base, seed=42, amount=0.75)
    second = randomize_field_controls(base, seed=42, amount=0.75)
    third = randomize_field_controls(base, seed=43, amount=0.75)
    assert first == second
    assert first != third
    assert all(0.0 <= value <= 1.0 for value in first.values())


def test_zero_variation_preserves_preset_exactly():
    base = FIELD_PRESETS["morning"].controls
    assert randomize_field_controls(base, seed=7, amount=0.0) == dict(base)


def test_compile_preset_uses_existing_bridge_contract():
    commands = compile_field_preset("night", track_ref="field-1", seed=9, variation=0.5)
    assert len(commands) == 6
    assert {command["type"] for command in commands} == {"set_device_parameter"}
    assert {command["track_ref"] for command in commands} == {"field-1"}
    assert {command["device"] for command in commands} == {"DARKSCO FIELD"}


def test_unknown_preset_is_rejected():
    with pytest.raises(ValueError, match="Unknown FIELD preset"):
        get_field_preset("sunset")


def test_variation_requires_seed():
    with pytest.raises(ValueError, match="seed is required"):
        compile_field_preset("night", track=0, variation=0.5)
