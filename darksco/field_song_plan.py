from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .instruments import FieldIntent, compile_field_intent
from .song_plan import SongPlanError, validate_song_plan


@dataclass(frozen=True)
class FieldSectionCue:
    section_id: str
    track_ref: str
    commands: tuple[dict[str, Any], ...]


def _field_track(plan: dict[str, Any]) -> dict[str, Any] | None:
    matches = [track for track in plan.get("tracks", []) if track.get("instrument") == "darksco.field"]
    if len(matches) > 1:
        raise SongPlanError("a SongPlan currently supports at most one darksco.field track")
    return matches[0] if matches else None


def validate_field_song_plan(plan: dict[str, Any]) -> dict[str, Any]:
    validate_song_plan(plan)
    track = _field_track(plan)
    if track is None:
        return plan

    if track.get("kind", "midi") != "midi":
        raise SongPlanError("darksco.field must be hosted on a midi track")

    track_ref = track.get("track_ref")
    if not isinstance(track_ref, str) or not track_ref.strip():
        raise SongPlanError("darksco.field track requires a stable track_ref")

    section_ids = {section["id"] for section in plan["sections"]}
    states = track.get("field_states", {})
    if not isinstance(states, dict) or not states:
        raise SongPlanError("darksco.field track requires non-empty field_states")

    unknown_sections = sorted(set(states) - section_ids)
    if unknown_sections:
        raise SongPlanError(f"FIELD state references unknown section(s): {', '.join(unknown_sections)}")

    for section_id, state in states.items():
        if not isinstance(state, dict):
            raise SongPlanError(f"FIELD state for {section_id} must be an object")
        preset = state.get("preset")
        if preset not in {"morning", "noon", "night"}:
            raise SongPlanError(f"FIELD state for {section_id} requires preset morning, noon, or night")
        modifiers = state.get("modifiers", {})
        if not isinstance(modifiers, dict):
            raise SongPlanError(f"FIELD modifiers for {section_id} must be an object")

    return plan


def compile_field_section_cues(plan: dict[str, Any]) -> list[FieldSectionCue]:
    """Compile per-section FIELD states without pretending they are envelopes.

    The existing bridge can set device parameters, but it does not yet expose
    parameter automation envelopes. These cues are therefore dispatch bundles
    to apply at section entry. A later transport/scene hook can consume them.
    """
    validate_field_song_plan(plan)
    track = _field_track(plan)
    if track is None:
        return []

    track_ref = str(track["track_ref"])
    states = track["field_states"]
    cues: list[FieldSectionCue] = []
    for section in plan["sections"]:
        section_id = section["id"]
        state = states.get(section_id)
        if state is None:
            continue
        intent = FieldIntent(
            preset=state["preset"],
            modifiers=state.get("modifiers", {}),
        )
        commands = tuple(compile_field_intent(intent, track_ref=track_ref))
        cues.append(FieldSectionCue(section_id=section_id, track_ref=track_ref, commands=commands))
    return cues


def compile_field_cue_manifest(plan: dict[str, Any]) -> dict[str, Any]:
    cues = compile_field_section_cues(plan)
    return {
        "schema": "darksco.field-cues/1.0",
        "song_schema": plan.get("schema"),
        "cues": [
            {
                "section": cue.section_id,
                "track_ref": cue.track_ref,
                "commands": list(cue.commands),
            }
            for cue in cues
        ],
    }
