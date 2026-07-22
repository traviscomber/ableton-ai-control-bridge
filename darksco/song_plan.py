"""Validation and autonomy policy for Darksco song plans."""

from __future__ import annotations


class SongPlanError(ValueError):
    pass


AUTONOMY_MODES = {"copilot", "producer", "autonomous"}
DESTRUCTIVE_COMMANDS = {"delete_scene", "delete_track"}


def validate_song_plan(plan: dict) -> dict:
    if plan.get("schema") != "darksco.song-plan/1.0":
        raise SongPlanError("schema must be darksco.song-plan/1.0")
    mode = plan.get("session", {}).get("mode", "copilot")
    if mode not in AUTONOMY_MODES:
        raise SongPlanError("session.mode must be copilot, producer, or autonomous")
    global_settings = plan.get("global", {})
    bpm = global_settings.get("bpm")
    if not isinstance(bpm, (int, float)) or not 20 <= bpm <= 300:
        raise SongPlanError("global.bpm must be between 20 and 300")
    signature = global_settings.get("time_signature", [4, 4])
    if not (isinstance(signature, list) and len(signature) == 2 and
            isinstance(signature[0], int) and 1 <= signature[0] <= 16 and
            signature[1] in {1, 2, 4, 8, 16}):
        raise SongPlanError("invalid global.time_signature")
    sections = plan.get("sections", [])
    tracks = plan.get("tracks", [])
    if not sections or len(sections) > 8:
        raise SongPlanError("a plan requires 1 to 8 sections")
    if len(tracks) > 12:
        raise SongPlanError("a plan supports at most 12 tracks")
    total_notes = 0
    section_ids = {section.get("id") for section in sections}
    if None in section_ids or len(section_ids) != len(sections):
        raise SongPlanError("section ids must be present and unique")
    for track in tracks:
        if track.get("kind", "midi") not in {"midi", "audio"}:
            raise SongPlanError("track kind must be midi or audio")
        register = track.get("register", [0, 127])
        for clip in track.get("clips", []):
            if clip.get("section") not in section_ids:
                raise SongPlanError("clip references an unknown section")
            length = clip.get("length_beats")
            if not isinstance(length, (int, float)) or length <= 0:
                raise SongPlanError("clip length_beats must be positive")
            notes = clip.get("notes", [])
            total_notes += len(notes)
            for note in notes:
                pitch = note.get("pitch")
                if not isinstance(pitch, int) or not register[0] <= pitch <= register[1]:
                    raise SongPlanError("note pitch is outside the track register")
                if note.get("duration", 0) <= 0:
                    raise SongPlanError("note duration must be positive")
    if total_notes > 4096:
        raise SongPlanError("a plan supports at most 4096 notes")
    return plan


def requires_final_approval(plan: dict) -> bool:
    """Copilot approves blocks, producer approves once, autonomous can dispatch."""
    return plan.get("session", {}).get("mode", "copilot") != "autonomous"
