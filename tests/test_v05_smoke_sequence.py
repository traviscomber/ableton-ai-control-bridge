from __future__ import annotations

import json
from pathlib import Path

from ableton_bridge.commands import validate_command


ROOT = Path(__file__).resolve().parents[1]
SMOKE_SEQUENCE = ROOT / "examples" / "smoke" / "v0.5-smoke-test.jsonl"


def _commands() -> list[dict[str, object]]:
    commands: list[dict[str, object]] = []
    for line_number, raw_line in enumerate(
        SMOKE_SEQUENCE.read_text(encoding="utf-8").splitlines(), start=1
    ):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        payload = json.loads(line)
        assert isinstance(payload, dict), f"Line {line_number} must contain a JSON object."
        commands.append(payload)
    return commands


def test_smoke_sequence_is_non_empty_and_valid() -> None:
    commands = _commands()
    assert commands, "The v0.5 smoke sequence must contain commands."
    for payload in commands:
        assert validate_command(payload) is payload


def test_smoke_sequence_excludes_destructive_commands() -> None:
    destructive = {"delete_scene", "delete_track"}
    command_types = {str(command["type"]) for command in _commands()}
    assert command_types.isdisjoint(destructive)


def test_smoke_sequence_uses_stable_track_references() -> None:
    commands = _commands()
    created_refs = {
        str(command["track_ref"])
        for command in commands
        if command["type"] in {"create_midi_track", "create_audio_track"}
        and "track_ref" in command
    }
    used_refs = {
        str(command["track_ref"])
        for command in commands
        if command["type"] not in {"create_midi_track", "create_audio_track"}
        and "track_ref" in command
    }
    assert used_refs <= created_refs, f"Unknown track references used: {sorted(used_refs - created_refs)}"
