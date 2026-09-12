from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from ableton_bridge.runner import send, wait_for_ack

from .field_song_plan import compile_field_cue_manifest


class FieldCueExecutionError(RuntimeError):
    """Raised when a FIELD cue cannot be submitted or acknowledged safely."""


def execute_field_cue(
    cue: dict[str, Any],
    *,
    url: str = "http://127.0.0.1:8765/command",
    token: str | None = None,
    auto_approve: bool = False,
    wait_ack: bool = True,
    ack_timeout: float = 20.0,
) -> list[dict[str, Any]]:
    """Submit one section cue sequentially, optionally gating each command on ACK."""
    commands = cue.get("commands")
    if not isinstance(commands, list) or not commands:
        raise FieldCueExecutionError("FIELD cue requires a non-empty commands list.")

    section = cue.get("section", "unknown")
    base_url = url.rsplit("/command", 1)[0]
    results: list[dict[str, Any]] = []

    for index, command in enumerate(commands, 1):
        result = send(url, token, command)
        record = result.get("command", {})

        if auto_approve and record.get("status") == "pending":
            command_id = record.get("id")
            if not command_id:
                raise FieldCueExecutionError(
                    f"FIELD cue {section} command {index} returned pending without id."
                )
            result = send(f"{base_url}/api/commands/{command_id}/approve", token)
            record = result.get("command", {})

        if wait_ack:
            command_id = record.get("id")
            if not command_id:
                raise FieldCueExecutionError(
                    f"FIELD cue {section} command {index} returned no command id."
                )
            try:
                result = wait_for_ack(base_url, token, command_id, ack_timeout)
            except (RuntimeError, TimeoutError) as exc:
                raise FieldCueExecutionError(
                    f"FIELD cue {section} stopped at command {index}: {exc}"
                ) from exc

        results.append(result)

    return results


def cue_from_manifest(manifest: dict[str, Any], section: str) -> dict[str, Any]:
    if manifest.get("schema") != "darksco.field-cues/1.0":
        raise FieldCueExecutionError("Unsupported FIELD cue manifest schema.")
    matches = [cue for cue in manifest.get("cues", []) if cue.get("section") == section]
    if len(matches) != 1:
        raise FieldCueExecutionError(
            f"Expected exactly one FIELD cue for section {section!r}; found {len(matches)}."
        )
    return matches[0]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compile a DARKSCO SongPlan and execute one FIELD section cue."
    )
    parser.add_argument("plan", help="Path to darksco.song-plan/1.0 JSON.")
    parser.add_argument("section", help="Section id whose FIELD cue should be applied.")
    parser.add_argument("--url", default="http://127.0.0.1:8765/command")
    parser.add_argument("--token")
    parser.add_argument("--auto-approve", action="store_true")
    parser.add_argument("--no-wait-ack", action="store_true")
    parser.add_argument("--ack-timeout", type=float, default=20.0)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the compiled cue without submitting it to the bridge.",
    )
    args = parser.parse_args()

    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    manifest = compile_field_cue_manifest(plan)
    cue = cue_from_manifest(manifest, args.section)

    if args.dry_run:
        print(json.dumps(cue, indent=2, sort_keys=True))
        return

    results = execute_field_cue(
        cue,
        url=args.url,
        token=args.token,
        auto_approve=args.auto_approve,
        wait_ack=not args.no_wait_ack,
        ack_timeout=args.ack_timeout,
    )
    print(json.dumps({"section": args.section, "results": results}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
