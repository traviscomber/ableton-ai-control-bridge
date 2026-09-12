import pytest

from darksco.instruments.field import FieldControlError, compile_field_state


def test_field_compiles_semantic_controls_to_existing_bridge_contract():
    commands = compile_field_state(
        {"density": 0.72, "motion": 0.31, "space": 0.65},
        track_ref="field-1",
    )

    assert commands == [
        {
            "type": "set_device_parameter",
            "track_ref": "field-1",
            "device": "DARKSCO FIELD",
            "parameter": "Density",
            "value": 0.72,
        },
        {
            "type": "set_device_parameter",
            "track_ref": "field-1",
            "device": "DARKSCO FIELD",
            "parameter": "Motion",
            "value": 0.31,
        },
        {
            "type": "set_device_parameter",
            "track_ref": "field-1",
            "device": "DARKSCO FIELD",
            "parameter": "Space",
            "value": 0.65,
        },
    ]


def test_field_accepts_track_name_target():
    command = compile_field_state({"texture": 0.5}, track_name="FIELD")[0]
    assert command["track_name"] == "FIELD"
    assert command["parameter"] == "Texture"


@pytest.mark.parametrize("value", [-0.01, 1.01, "high", True])
def test_field_rejects_invalid_normalized_values(value):
    with pytest.raises(FieldControlError):
        compile_field_state({"density": value}, track=0)


def test_field_rejects_unknown_control():
    with pytest.raises(FieldControlError, match="Unsupported FIELD control"):
        compile_field_state({"gravity": 0.5}, track=0)


def test_field_requires_exactly_one_track_target():
    with pytest.raises(FieldControlError, match="exactly one"):
        compile_field_state({"density": 0.5})
    with pytest.raises(FieldControlError, match="exactly one"):
        compile_field_state({"density": 0.5}, track=0, track_ref="field-1")
