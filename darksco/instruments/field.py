from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from ableton_bridge.commands import validate_command

FIELD_DEVICE_NAME = "DARKSCO FIELD"

# Public musical vocabulary. Values are normalized to the same 0..1 contract
# already enforced by set_device_parameter in the bridge.
FIELD_CONTROLS: dict[str, str] = {
    "density": "Density",
    "spread": "Spread",
    "motion": "Motion",
    "instability": "Instability",
    "texture": "Texture",
    "space": "Space",
}


class FieldControlError(ValueError):
    """Raised when a DARKSCO FIELD semantic control request is invalid."""


def compile_field_state(
    controls: Mapping[str, Any],
    *,
    track: int | None = None,
    track_ref: str | None = None,
    device: str = FIELD_DEVICE_NAME,
) -> list[dict[str, Any]]:
    """Compile musical FIELD controls into existing bridge commands.

    FIELD intentionally remains an additive semantic layer over the stable
    ``set_device_parameter`` command. The public bridge boundary supports
    numeric ``track`` or stable ``track_ref`` targeting; names are resolved
    outside this compiler before commands are submitted.
    """
    if not isinstance(controls, Mapping) or not controls:
        raise FieldControlError("controls must be a non-empty mapping.")

    targets = {"track": track, "track_ref": track_ref}
    selected = {key: value for key, value in targets.items() if value is not None}
    if len(selected) != 1:
        raise FieldControlError("Provide exactly one of track or track_ref.")

    unknown = sorted(set(controls) - set(FIELD_CONTROLS))
    if unknown:
        raise FieldControlError(f"Unsupported FIELD control(s): {', '.join(unknown)}")

    commands: list[dict[str, Any]] = []
    for control, value in controls.items():
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise FieldControlError(f"{control} must be a number between 0 and 1.")
        normalized = float(value)
        if not 0.0 <= normalized <= 1.0:
            raise FieldControlError(f"{control} must be between 0 and 1.")
        command: dict[str, Any] = {
            "type": "set_device_parameter",
            **selected,
            "device": device,
            "parameter": FIELD_CONTROLS[control],
            "value": normalized,
        }
        commands.append(validate_command(command))
    return commands
