from __future__ import annotations

import re
from pathlib import Path

from ableton_bridge.commands import COMMANDS


ROOT = Path(__file__).resolve().parents[1]
RECEIVER = ROOT / "max-for-live" / "bridge_receiver.js"


def _receiver_cases() -> set[str]:
    source = RECEIVER.read_text(encoding="utf-8")
    return set(re.findall(r'case\s+"([a-z0-9_]+)"\s*:', source))


def test_public_protocol_matches_max_receiver_dispatch() -> None:
    receiver_commands = _receiver_cases()
    public_receiver_commands = receiver_commands - {"undo"}

    assert public_receiver_commands == set(COMMANDS), (
        "Python protocol and Max receiver command sets diverged. "
        f"Missing in receiver: {sorted(set(COMMANDS) - public_receiver_commands)}; "
        f"missing in protocol: {sorted(public_receiver_commands - set(COMMANDS))}"
    )


def test_receiver_keeps_internal_undo_command() -> None:
    assert "undo" in _receiver_cases()
