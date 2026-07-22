"""Deterministically compile a Darksco SongPlan into bridge v0.4 commands."""

from __future__ import annotations

from .song_plan import validate_song_plan


def compile_song_plan(plan: dict) -> list[dict]:
    validate_song_plan(plan)
    commands: list[dict] = []
    global_settings = plan["global"]
    numerator, denominator = global_settings.get("time_signature", [4, 4])
    commands.extend([
        {"type": "set_tempo", "bpm": global_settings["bpm"]},
        {"type": "set_time_signature", "numerator": numerator, "denominator": denominator},
    ])
    section_indexes = {}
    for index, section in enumerate(plan["sections"]):
        section_indexes[section["id"]] = index
        commands.append({"type": "create_scene", "name": section.get("name", section["id"]), "index": index})
    for track_index, track in enumerate(plan.get("tracks", [])):
        commands.append({
            "type": "create_midi_track" if track.get("kind", "midi") == "midi" else "create_audio_track",
            "name": track.get("name", track.get("id", f"Track {track_index + 1}")),
            "index": track_index,
        })
        if "volume" in track:
            commands.append({"type": "set_track_volume", "track": track_index, "volume": track["volume"]})
        if "pan" in track:
            commands.append({"type": "set_track_pan", "track": track_index, "pan": track["pan"]})
        for clip in track.get("clips", []):
            clip_index = section_indexes[clip["section"]]
            length = clip["length_beats"]
            if track.get("kind", "midi") == "midi":
                commands.append({"type": "create_midi_clip", "track": track_index, "clip": clip_index,
                                 "bar": 1, "beats": length, "notes": clip.get("notes", [])})
            commands.append({"type": "set_clip_name", "track": track_index, "clip": clip_index,
                             "name": clip.get("name", clip["section"])})
            if "color" in clip:
                commands.append({"type": "set_clip_color", "track": track_index, "clip": clip_index,
                                 "color": clip["color"]})
            commands.append({"type": "set_clip_loop", "track": track_index, "clip": clip_index,
                             "start": 0, "length": length, "enabled": clip.get("loop", True)})
    return commands
