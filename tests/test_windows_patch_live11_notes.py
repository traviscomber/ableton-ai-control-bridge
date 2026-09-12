from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PATCHER_PATH = ROOT / "windows" / "patch_live11_notes.py"


def load_patcher():
    spec = importlib.util.spec_from_file_location("patch_live11_notes", PATCHER_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_replace_function_handles_compact_receiver_source() -> None:
    patcher = load_patcher()
    source = (
        "function before(){}\n"
        "function createTrack(c,method){var before=1;}\n"
        "function createScene(c){}\n"
        "function createMidiClip(c){var ti=track(c);}\n"
        "function mixerState(path){}\n"
    )

    patched = patcher.replace_function(
        source,
        "function createTrack(c",
        "function createScene",
        patcher.STABLE_TRACK,
        "createTrack",
    )
    patched = patcher.replace_function(
        patched,
        "function createMidiClip(c)",
        "function mixerState",
        patcher.LIVE11_NOTES,
        "createMidiClip",
    )

    assert patcher.STABLE_TRACK.strip() in patched
    assert patcher.LIVE11_NOTES.strip() in patched
    assert "function createScene" in patched
    assert "function mixerState" in patched


def test_replace_function_is_idempotent_after_patch() -> None:
    patcher = load_patcher()
    source = patcher.STABLE_TRACK + "\nfunction createScene(c){}\n"

    once = patcher.replace_function(
        source,
        "function createTrack(c",
        "function createScene",
        patcher.STABLE_TRACK,
        "createTrack",
    )
    twice = patcher.replace_function(
        once,
        "function createTrack(c",
        "function createScene",
        patcher.STABLE_TRACK,
        "createTrack",
    )

    assert twice == once
