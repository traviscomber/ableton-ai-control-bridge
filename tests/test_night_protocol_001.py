from __future__ import annotations

import json
from pathlib import Path

from ableton_bridge.commands import validate_command
from darksco.compiler import compile_song_plan
from darksco.song_plan import DESTRUCTIVE_COMMANDS, validate_song_plan


ROOT = Path(__file__).resolve().parents[1]
PLAN_PATH = ROOT / "production" / "night-protocol-001" / "song-plan.json"
EXPECTED_REFS = {
    "night_kick",
    "night_sub",
    "night_perc_main",
    "night_perc_detail",
    "night_motif",
    "night_atmos",
    "night_impact",
    "night_texture",
}


def load_plan() -> dict:
    return json.loads(PLAN_PATH.read_text(encoding="utf-8"))


def test_night_protocol_song_plan_validates() -> None:
    plan = validate_song_plan(load_plan())

    assert plan["project"]["id"] == "night-protocol-001"
    assert plan["global"]["bpm"] == 136
    assert len(plan["sections"]) == 6
    assert len(plan["tracks"]) == 8


def test_night_protocol_compiles_to_valid_non_destructive_commands() -> None:
    commands = compile_song_plan(load_plan())

    assert len(commands) == 200
    assert not [command for command in commands if command["type"] in DESTRUCTIVE_COMMANDS]
    for command in commands:
        validate_command(command)


def test_night_protocol_preserves_approved_track_refs() -> None:
    commands = compile_song_plan(load_plan())
    created_refs = {
        command["track_ref"]
        for command in commands
        if command["type"] in {"create_midi_track", "create_audio_track"}
    }

    assert created_refs == EXPECTED_REFS


def test_night_protocol_expected_session_shape() -> None:
    plan = load_plan()
    commands = compile_song_plan(plan)

    assert sum(command["type"] == "create_scene" for command in commands) == 6
    assert sum(command["type"] == "create_midi_track" for command in commands) == 8
    assert sum(command["type"] == "create_midi_clip" for command in commands) == 42
    assert sum(len(command.get("notes", [])) for command in commands) == 118
