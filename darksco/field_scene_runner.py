from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from ableton_bridge.commands import validate_command
from ableton_bridge.runner import send, wait_for_ack

from .field_cue_runner import FieldCueExecutionError, cue_from_manifest, execute_field_cue
from .field_song_plan import compile_field_cue_manifest
from .song_plan import validate_song_plan


class FieldSceneExecutionError(RuntimeError):
    """Raised when FIELD state or scene launch cannot complete safely."""


def section_scene_index(plan: dict[str, Any], section_id: str) -> int:
    validate_song_plan(plan)
    for index, section in enumerate(plan["sections"]):
        if section.get("id") == section_id:
            return index
    raise FieldSceneExecutionError(f"Unknown SongPlan section: {section_id}")


def _submit_ack_gated(
    command: dict[str, Any],
    *,
    url: str,
    token: str | None,
    auto_approve: bool,
    ack_timeout: float,
) -> dict[str, Any]:
    command = validate_command(command)
    result = send(url, token, command)
    record = result.get("command", {})
    base_url = url.rsplit("/command", 1)[0]

    if auto_approve and record.get("status") == "pending":
        command_id = record.get("id")
        if not command_id:
            raise FieldSceneExecutionError("Pending scene command returned no id.")
        result = send(f"{base_url}/api/commands/{command_id}/approve", token)
        record = result.get("command", {})

    command_id = record.get("id")
    if not command_id:
        raise FieldSceneExecutionError("Scene command returned no command id.")
    try:
        return wait_for_ack(base_url, token, command_id, ack_timeout)
    except (RuntimeError, TimeoutError) as exc:
        raise FieldSceneExecutionError(f"Scene launch failed: {exc}") from exc


def execute_field_section(
    plan: dict[str, Any],
    section_id: str,
    *,
    url: str = "http://127.0.0.1:8765/command",
    token: str | None = None,
    auto_approve: bool = False,
    ack_timeout: float = 20.0,
) -> dict[str, Any]:
    """Apply FIELD state completely, then launch the corresponding scene.

    This ordering is deliberate. A section is never launched when any FIELD
    parameter command failed or timed out. Continuous parameter envelopes are
    outside this function and remain a separate future capability.
    """
    manifest = compile_field_cue_manifest(plan)
    cue = cue_from_manifest(manifest, section_id)
    scene_index = section_scene_index(plan, section_id)

    try:
        field_results = execute_field_cue(
            cue,
            url=url,
            token=token,
            auto_approve=auto_approve,
            wait_ack=True,
            ack_timeout=ack_timeout,
        )
    except FieldCueExecutionError as exc:
        raise FieldSceneExecutionError(
            f"Section {section_id} not launched because FIELD cue failed: {exc}"
        ) from exc

    scene_result = _submit_ack_gated(
        {"type": "launch_scene", "scene": scene_index},
        url=url,
        token=token,
        auto_approve=auto_approve,
        ack_timeout=ack_timeout,
    )
    return {
        "section": section_id,
        "scene": scene_index,
        "field_results": field_results,
        "scene_result": scene_result,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply a DARKSCO FIELD section state and launch its Live scene after ACK."
    )
    parser.add_argument("plan", help="Path to darksco.song-plan/1.0 JSON.")
    parser.add_argument("section", help="Section id to enter.")
    parser.add_argument("--url", default="http://127.0.0.1:8765/command")
    parser.add_argument("--token")
    parser.add_argument("--auto-approve", action="store_true")
    parser.add_argument("--ack-timeout", type=float, default=20.0)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    manifest = compile_field_cue_manifest(plan)
    cue = cue_from_manifest(manifest, args.section)
    scene = section_scene_index(plan, args.section)

    if args.dry_run:
        print(json.dumps({"section": args.section, "scene": scene, "cue": cue}, indent=2, sort_keys=True))
        return

    result = execute_field_section(
        plan,
        args.section,
        url=args.url,
        token=args.token,
        auto_approve=args.auto_approve,
        ack_timeout=args.ack_timeout,
    )
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
