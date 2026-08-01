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
    "set_track_volume": CommandSpec("set_track_volume", ("volume",), ("track", "track_ref")),
    "set_track_pan": CommandSpec("set_track_pan", ("pan",), ("track", "track_ref")),
    "set_macro": CommandSpec("set_macro", ("macro", "value"), ("track", "track_ref")),
    "create_midi_clip": CommandSpec("create_midi_clip", ("clip", "bar", "beats", "notes"), ("track", "track_ref")),
    "create_audio_track": CommandSpec("create_audio_track", ("name",), ("index", "track_ref")),
    "create_midi_track": CommandSpec("create_midi_track", ("name",), ("index", "track_ref")),
    "arm_track": CommandSpec("arm_track", ("armed",), ("track", "track_ref")),
    "set_device_parameter": CommandSpec("set_device_parameter", ("device", "parameter", "value"), ("track", "track_ref", "track_name")),
    "start_playback": CommandSpec("start_playback", ()),
    "stop_playback": CommandSpec("stop_playback", ()),
    "set_time_signature": CommandSpec("set_time_signature", ("numerator", "denominator")),
    "set_metronome": CommandSpec("set_metronome", ("enabled",)),
    "set_song_loop": CommandSpec("set_song_loop", ("start", "length", "enabled")),
    "create_scene": CommandSpec("create_scene", (), ("name", "index")),
    "duplicate_scene": CommandSpec("duplicate_scene", ("scene",)),
    "delete_scene": CommandSpec("delete_scene", ("scene",)),
    "duplicate_track": CommandSpec("duplicate_track", (), ("track", "track_ref")),
    "delete_track": CommandSpec("delete_track", (), ("track", "track_ref")),
    "set_track_mute": CommandSpec("set_track_mute", ("muted",), ("track", "track_ref")),
    "set_track_solo": CommandSpec("set_track_solo", ("soloed",), ("track", "track_ref")),
    "launch_clip": CommandSpec("launch_clip", ("clip",), ("track", "track_ref")),
    "stop_track_clips": CommandSpec("stop_track_clips", (), ("track", "track_ref")),
    "set_clip_name": CommandSpec("set_clip_name", ("clip", "name"), ("track", "track_ref")),
    "set_clip_color": CommandSpec("set_clip_color", ("clip", "color"), ("track", "track_ref")),
    "set_clip_loop": CommandSpec("set_clip_loop", ("clip", "start", "length", "enabled"), ("track", "track_ref")),
    "create_return_track": CommandSpec("create_return_track", ("name",)),
    "set_return_volume": CommandSpec("set_return_volume", ("volume",), ("return", "return_name")),
    "set_return_pan": CommandSpec("set_return_pan", ("pan",), ("return", "return_name")),
    "set_track_send": CommandSpec("set_track_send", ("amount",), ("track", "track_ref", "track_name", "return", "return_name")),
    "set_return_device_parameter": CommandSpec("set_return_device_parameter", ("device", "parameter", "value"), ("return", "return_name")),
    "load_native_device": CommandSpec("load_native_device", ("target_kind", "target_name", "category", "device")),
    "get_live_state": CommandSpec("get_live_state", ()),
    "list_tracks": CommandSpec("list_tracks", ()),
    "inspect_track": CommandSpec("inspect_track", (), ("track", "track_ref", "track_name")),
    "list_returns": CommandSpec("list_returns", ()),
    "inspect_device_chain": CommandSpec("inspect_device_chain", ("target_kind",), ("track", "track_ref", "track_name", "return", "return_name")),
    "inspect_device_parameters": CommandSpec("inspect_device_parameters", ("target_kind", "device"), ("track", "track_ref", "track_name", "return", "return_name")),
    "inspect_clip": CommandSpec("inspect_clip", ("clip",), ("track", "track_ref", "track_name")),
    "inspect_master": CommandSpec("inspect_master", ()),
    "capture_mixer_snapshot": CommandSpec("capture_mixer_snapshot", (), ("snapshot_id",)),
    "restore_mixer_snapshot": CommandSpec("restore_mixer_snapshot", ("snapshot_id",)),
    "capture_device_snapshot": CommandSpec("capture_device_snapshot", ("target_kind", "device"), ("snapshot_id", "track", "track_ref", "track_name", "return", "return_name")),
    "restore_device_snapshot": CommandSpec("restore_device_snapshot", ("snapshot_id",)),
    "set_master_volume": CommandSpec("set_master_volume", ("volume",)),
    "set_master_device_parameter": CommandSpec("set_master_device_parameter", ("device", "parameter", "value")),
    "set_master_device_enabled": CommandSpec("set_master_device_enabled", ("device", "enabled")),
}

REMOTE_SCRIPT_COMMANDS = {"load_native_device"}

TRACK_TARGET_COMMANDS = {
    "set_track_volume", "set_track_pan", "set_macro", "create_midi_clip", "arm_track",
    "set_device_parameter", "duplicate_track", "delete_track", "set_track_mute",
    "set_track_solo", "launch_clip", "stop_track_clips", "set_clip_name",
    "set_clip_color", "set_clip_loop", "set_track_send", "inspect_track", "inspect_clip",
}
RETURN_TARGET_COMMANDS = {"set_return_volume", "set_return_pan", "set_track_send", "set_return_device_parameter"}
GENERIC_TARGET_COMMANDS = {"inspect_device_chain", "inspect_device_parameters", "capture_device_snapshot"}


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
    if command_type in TRACK_TARGET_COMMANDS:
        _require_exactly_one(payload, ("track", "track_ref", "track_name"), "track, track_ref, or track_name")
    if command_type in RETURN_TARGET_COMMANDS:
        _require_exactly_one(payload, ("return", "return_name"), "return or return_name")
    if command_type in GENERIC_TARGET_COMMANDS:
        _validate_generic_target(payload)
    _validate_ranges(payload)
    return payload


def _require_exactly_one(payload: dict[str, Any], fields: tuple[str, ...], label: str) -> None:
    if sum(int(field in payload) for field in fields) != 1:
        raise CommandError(f"Provide exactly one of {label}.")


def _validate_generic_target(payload: dict[str, Any]) -> None:
    kind = payload["target_kind"]
    if kind not in {"track", "return", "master"}:
        raise CommandError("target_kind must be track, return, or master.")
    track_fields = ("track", "track_ref", "track_name")
    return_fields = ("return", "return_name")
    if kind == "track":
        _require_exactly_one(payload, track_fields, "track, track_ref, or track_name")
        if any(field in payload for field in return_fields):
            raise CommandError("Return target fields are not valid for target_kind=track.")
    elif kind == "return":
        _require_exactly_one(payload, return_fields, "return or return_name")
        if any(field in payload for field in track_fields):
            raise CommandError("Track target fields are not valid for target_kind=return.")
    elif any(field in payload for field in (*track_fields, *return_fields)):
        raise CommandError("Master target does not accept track or return fields.")


def _validate_ranges(payload: dict[str, Any]) -> None:
    command_type = payload["type"]
    if command_type == "set_tempo" and not 20 <= _number(payload["bpm"], "bpm") <= 300:
        raise CommandError("bpm must be between 20 and 300.")
    if "track" in payload and (not isinstance(payload["track"], int) or payload["track"] < 0):
        raise CommandError("track must be a zero-based integer.")
    if "track_ref" in payload and (not isinstance(payload["track_ref"], str) or not payload["track_ref"].strip()):
        raise CommandError("track_ref must be a non-empty string.")
    if "track_name" in payload and (not isinstance(payload["track_name"], str) or not payload["track_name"].strip()):
        raise CommandError("track_name must be a non-empty string.")
    if "return" in payload and (not isinstance(payload["return"], int) or payload["return"] < 0):
        raise CommandError("return must be a zero-based integer.")
    if "return_name" in payload and (not isinstance(payload["return_name"], str) or not payload["return_name"].strip()):
        raise CommandError("return_name must be a non-empty string.")
    if "snapshot_id" in payload and (not isinstance(payload["snapshot_id"], str) or not payload["snapshot_id"].strip()):
        raise CommandError("snapshot_id must be a non-empty string.")
    if command_type == "launch_scene" and (not isinstance(payload["scene"], int) or payload["scene"] < 0):
        raise CommandError("scene must be a zero-based integer.")
    if command_type in {"set_track_volume", "set_return_volume", "set_master_volume"} and not 0 <= _number(payload["volume"], "volume") <= 1:
        raise CommandError("volume must be between 0 and 1.")
    if command_type in {"set_track_pan", "set_return_pan"} and not -1 <= _number(payload["pan"], "pan") <= 1:
        raise CommandError("pan must be between -1 and 1.")
    if command_type == "set_track_send" and not 0 <= _number(payload["amount"], "amount") <= 1:
        raise CommandError("amount must be between 0 and 1.")
    if command_type == "set_macro":
        if not isinstance(payload["macro"], int) or not 1 <= payload["macro"] <= 16:
            raise CommandError("macro must be an integer between 1 and 16.")
        if not 0 <= _number(payload["value"], "value") <= 1:
            raise CommandError("value must be between 0 and 1.")
    if command_type == "create_midi_clip":
        if not isinstance(payload["clip"], int) or payload["clip"] < 0:
            raise CommandError("clip must be a zero-based integer.")
        if not isinstance(payload["bar"], int) or payload["bar"] < 1:
            raise CommandError("bar must be an integer starting at 1.")
        if _number(payload["beats"], "beats") <= 0:
            raise CommandError("beats must be > 0.")
        if not isinstance(payload["notes"], list):
            raise CommandError("notes must be a list.")
        for note in payload["notes"]:
            _validate_note(note)
    if command_type in {"create_audio_track", "create_midi_track"}:
        if not isinstance(payload["name"], str) or not payload["name"].strip():
            raise CommandError("name must be a non-empty string.")
        if "index" in payload and (not isinstance(payload["index"], int) or payload["index"] < 0):
            raise CommandError("index must be a zero-based integer.")
    if command_type == "arm_track" and not isinstance(payload["armed"], bool):
        raise CommandError("armed must be a boolean.")
    if command_type in {"set_device_parameter", "set_return_device_parameter", "set_master_device_parameter"}:
        _validate_device_parameter(payload)
    if command_type in {"inspect_device_parameters", "capture_device_snapshot"} and (not isinstance(payload["device"], str) or not payload["device"].strip()):
        raise CommandError("device must be a non-empty string.")
    if command_type == "set_master_device_enabled":
        if not isinstance(payload["device"], str) or not payload["device"].strip():
            raise CommandError("device must be a non-empty string.")
        if not isinstance(payload["enabled"], bool):
            raise CommandError("enabled must be a boolean.")
    if command_type == "set_time_signature":
        if not isinstance(payload["numerator"], int) or not 1 <= payload["numerator"] <= 16:
            raise CommandError("numerator must be an integer between 1 and 16.")
        if payload["denominator"] not in (1, 2, 4, 8, 16):
            raise CommandError("denominator must be one of 1, 2, 4, 8, 16.")
    if command_type in {"set_metronome", "set_track_mute", "set_track_solo"}:
        field = {"set_metronome": "enabled", "set_track_mute": "muted", "set_track_solo": "soloed"}[command_type]
        if not isinstance(payload[field], bool):
            raise CommandError(f"{field} must be a boolean.")
    if command_type in {"set_song_loop", "set_clip_loop"}:
        if _number(payload["start"], "start") < 0 or _number(payload["length"], "length") <= 0:
            raise CommandError("start must be >= 0 and length must be > 0.")
        if not isinstance(payload["enabled"], bool):
            raise CommandError("enabled must be a boolean.")
    if command_type == "create_scene":
        if "index" in payload and (not isinstance(payload["index"], int) or payload["index"] < 0):
            raise CommandError("index must be a zero-based integer.")
        if "name" in payload and (not isinstance(payload["name"], str) or not payload["name"].strip()):
            raise CommandError("name must be a non-empty string.")
    if "clip" in payload and (not isinstance(payload["clip"], int) or payload["clip"] < 0):
        raise CommandError("clip must be a zero-based integer.")
    if command_type == "set_clip_name" and (not isinstance(payload["name"], str) or not payload["name"].strip()):
        raise CommandError("name must be a non-empty string.")
    if command_type == "set_clip_color" and (not isinstance(payload["color"], int) or not 0 <= payload["color"] <= 0xFFFFFF):
        raise CommandError("color must be an integer between 0 and 16777215.")
    if command_type == "create_return_track" and (not isinstance(payload["name"], str) or not payload["name"].strip()):
        raise CommandError("name must be a non-empty string.")
    if command_type == "load_native_device":
        if payload["target_kind"] not in {"track", "return", "master"}:
            raise CommandError("target_kind must be track, return, or master.")
        if not isinstance(payload["target_name"], str) or not payload["target_name"].strip():
            raise CommandError("target_name must be a non-empty string.")
        if payload["category"] not in {"instrument", "audio_effect", "midi_effect"}:
            raise CommandError("category must be instrument, audio_effect, or midi_effect.")
        if not isinstance(payload["device"], str) or not payload["device"].strip():
            raise CommandError("device must be a non-empty string.")


def _validate_device_parameter(payload: dict[str, Any]) -> None:
    for field in ("device", "parameter"):
        if not isinstance(payload[field], str) or not payload[field].strip():
            raise CommandError(f"{field} must be a non-empty string.")
    if not 0 <= _number(payload["value"], "value") <= 1:
        raise CommandError("value must be between 0 and 1.")


def _validate_note(note: Any) -> None:
    if not isinstance(note, dict):
        raise CommandError("Each note must be an object.")
    for field in ("pitch", "start", "duration", "velocity"):
        if field not in note:
            raise CommandError(f"Note missing field: {field}")
    if not isinstance(note["pitch"], int) or not 0 <= note["pitch"] <= 127:
        raise CommandError("note.pitch must be 0-127.")
    if not isinstance(note["velocity"], int) or not 1 <= note["velocity"] <= 127:
        raise CommandError("note.velocity must be 1-127.")
    if _number(note["start"], "note.start") < 0:
        raise CommandError("note.start must be >= 0.")
    if _number(note["duration"], "note.duration") <= 0:
        raise CommandError("note.duration must be > 0.")


def _number(value: Any, name: str) -> float:
    if not isinstance(value, (int, float)):
        raise CommandError(f"{name} must be a number.")
    return float(value)
