from __future__ import annotations

from dataclasses import dataclass
from typing import Any


class CommandError(ValueError):
    """Raised when a command is invalid."""


@dataclass(frozen=True)
class CommandSpec:
    name: str
    required: tuple[str, ...]
    optional: tuple[str, ...] = ()


COMMANDS: dict[str, CommandSpec] = {
    "set_tempo": CommandSpec("set_tempo", ("bpm",)),
    "launch_scene": CommandSpec("launch_scene", ("scene",)),
    "stop_all_clips": CommandSpec("stop_all_clips", ()),
    "set_track_volume": CommandSpec("set_track_volume", ("track", "volume")),
    "set_track_pan": CommandSpec("set_track_pan", ("track", "pan")),
    "set_macro": CommandSpec("set_macro", ("track", "macro", "value")),
    "create_midi_clip": CommandSpec("create_midi_clip", ("track", "clip", "bar", "beats", "notes")),
    "create_audio_track": CommandSpec("create_audio_track", ("name",), ("index",)),
    "create_midi_track": CommandSpec("create_midi_track", ("name",), ("index",)),
    "arm_track": CommandSpec("arm_track", ("track", "armed")),
    "set_device_parameter": CommandSpec("set_device_parameter", ("track", "device", "parameter", "value")),
}


def validate_command(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise CommandError("Command payload must be a JSON object.")

    command_type = payload.get("type")
    if not isinstance(command_type, str):
        raise CommandError("Command field 'type' is required.")

    spec = COMMANDS.get(command_type)
    if spec is None:
        raise CommandError(f"Unsupported command type: {command_type}")

    missing = [field for field in spec.required if field not in payload]
    if missing:
        raise CommandError(f"Missing required field(s): {', '.join(missing)}")

    allowed = set(("type", *spec.required, *spec.optional))
    extra = sorted(set(payload) - allowed)
    if extra:
        raise CommandError(f"Unsupported field(s) for {command_type}: {', '.join(extra)}")

    _validate_ranges(payload)
    return payload


def _validate_ranges(payload: dict[str, Any]) -> None:
    command_type = payload["type"]

    if command_type == "set_tempo":
        bpm = _number(payload["bpm"], "bpm")
        if not 20 <= bpm <= 300:
            raise CommandError("bpm must be between 20 and 300.")

    if "track" in payload:
        track = payload["track"]
        if not isinstance(track, int) or track < 0:
            raise CommandError("track must be a zero-based integer.")

    if command_type == "launch_scene":
        scene = payload["scene"]
        if not isinstance(scene, int) or scene < 0:
            raise CommandError("scene must be a zero-based integer.")

    if command_type == "set_track_volume":
        volume = _number(payload["volume"], "volume")
        if not 0 <= volume <= 1:
            raise CommandError("volume must be between 0 and 1.")

    if command_type == "set_track_pan":
        pan = _number(payload["pan"], "pan")
        if not -1 <= pan <= 1:
            raise CommandError("pan must be between -1 and 1.")

    if command_type == "set_macro":
        macro = payload["macro"]
        value = _number(payload["value"], "value")
        if not isinstance(macro, int) or not 1 <= macro <= 16:
            raise CommandError("macro must be an integer between 1 and 16.")
        if not 0 <= value <= 1:
            raise CommandError("value must be between 0 and 1.")

    if command_type == "create_midi_clip":
        clip = payload["clip"]
        bar = payload["bar"]
        beats = _number(payload["beats"], "beats")
        if not isinstance(clip, int) or clip < 0:
            raise CommandError("clip must be a zero-based integer.")
        if not isinstance(bar, int) or bar < 1:
            raise CommandError("bar must be an integer starting at 1.")
        if beats <= 0:
            raise CommandError("beats must be > 0.")
        notes = payload["notes"]
        if not isinstance(notes, list):
            raise CommandError("notes must be a list.")
        for note in notes:
            _validate_note(note)

    if command_type in ("create_audio_track", "create_midi_track"):
        if not isinstance(payload["name"], str) or not payload["name"].strip():
            raise CommandError("name must be a non-empty string.")
        if "index" in payload and (
            not isinstance(payload["index"], int) or payload["index"] < 0
        ):
            raise CommandError("index must be a zero-based integer.")

    if command_type == "arm_track" and not isinstance(payload["armed"], bool):
        raise CommandError("armed must be a boolean.")

    if command_type == "set_device_parameter":
        for field in ("device", "parameter"):
            if not isinstance(payload[field], str) or not payload[field].strip():
                raise CommandError(f"{field} must be a non-empty string.")
        value = _number(payload["value"], "value")
        if not 0 <= value <= 1:
            raise CommandError("value must be between 0 and 1.")


def _validate_note(note: Any) -> None:
    if not isinstance(note, dict):
        raise CommandError("Each note must be an object.")
    for field in ("pitch", "start", "duration", "velocity"):
        if field not in note:
            raise CommandError(f"Note missing field: {field}")
    pitch = note["pitch"]
    velocity = note["velocity"]
    if not isinstance(pitch, int) or not 0 <= pitch <= 127:
        raise CommandError("note.pitch must be 0-127.")
    if not isinstance(velocity, int) or not 1 <= velocity <= 127:
        raise CommandError("note.velocity must be 1-127.")
    if _number(note["start"], "note.start") < 0:
        raise CommandError("note.start must be >= 0.")
    if _number(note["duration"], "note.duration") <= 0:
        raise CommandError("note.duration must be > 0.")


def _number(value: Any, name: str) -> float:
    if not isinstance(value, (int, float)):
        raise CommandError(f"{name} must be a number.")
    return float(value)
