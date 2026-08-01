from __future__ import annotations

import ast
import re
from pathlib import Path

from ableton_bridge.commands import COMMANDS, REMOTE_SCRIPT_COMMANDS


ROOT = Path(__file__).resolve().parents[1]
RECEIVER = ROOT / "max-for-live" / "bridge_receiver.js"
REMOTE_SCRIPT = ROOT / "remote-scripts" / "AbletonAIControlBridge" / "control_surface.py"


def _receiver_commands() -> set[str]:
    source = RECEIVER.read_text(encoding="utf-8")
    return set(re.findall(r'case\s+"([a-z0-9_]+)"\s*:', source))


def _remote_script_commands() -> set[str]:
    source = REMOTE_SCRIPT.read_text(encoding="utf-8")
    tree = ast.parse(source)
    commands: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Compare):
            continue
        values = [node.left, *node.comparators]
        for value in values:
            if isinstance(value, ast.Constant) and isinstance(value.value, str):
                if value.value in COMMANDS:
                    commands.add(value.value)
    return commands


def test_every_schema_command_has_an_execution_handler() -> None:
    receiver = _receiver_commands()
    remote = _remote_script_commands()
    executable = receiver | remote
    missing = set(COMMANDS) - executable
    assert not missing, f"Commands declared by HTTP schema without Live handler: {sorted(missing)}"


def test_receiver_does_not_expose_undeclared_commands() -> None:
    # `undo` is an internal bridge-generated command and is intentionally not
    # accepted at the public HTTP schema boundary.
    public_receiver = _receiver_commands() - {"undo"}
    undeclared = public_receiver - set(COMMANDS)
    assert not undeclared, f"Receiver handlers missing from HTTP schema: {sorted(undeclared)}"


def test_remote_script_command_registry_matches_implementation() -> None:
    implemented = _remote_script_commands()
    assert REMOTE_SCRIPT_COMMANDS == implemented, (
        "REMOTE_SCRIPT_COMMANDS differs from the Live 11 Remote Script implementation: "
        f"registry={sorted(REMOTE_SCRIPT_COMMANDS)}, implemented={sorted(implemented)}"
    )


def test_execution_layers_are_present() -> None:
    assert RECEIVER.is_file(), "Max for Live receiver JS is missing"
    assert REMOTE_SCRIPT.is_file(), "Live 11 Remote Script is missing"
