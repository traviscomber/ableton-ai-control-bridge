# Command Protocol

The bridge accepts HTTP JSON commands at:

```text
POST /command
```

It validates the command and forwards it as compact JSON over UDP to Max for Live.

## Coordinate System

- Tracks are zero-based: first track is `0`.
- Scenes are zero-based: first scene is `0`.
- Macros are one-based: first rack macro is `1`.
- Normalized parameter values use `0.0` to `1.0`.
- Pan uses `-1.0` left, `0.0` center, `1.0` right.

## Commands

### set_tempo

```json
{"type":"set_tempo","bpm":132}
```

### launch_scene

```json
{"type":"launch_scene","scene":0}
```

### stop_all_clips

```json
{"type":"stop_all_clips"}
```

### set_macro

```json
{"type":"set_macro","track":1,"macro":1,"value":0.72}
```

### set_track_volume

```json
{"type":"set_track_volume","track":1,"volume":0.8}
```

### set_track_pan

```json
{"type":"set_track_pan","track":1,"pan":-0.15}
```

### create_midi_track

```json
{"type":"create_midi_track","name":"NBR Funk Bass","index":1}
```

### create_audio_track

```json
{"type":"create_audio_track","name":"NBR Vocal Hook","index":5}
```

### create_midi_clip

```json
{
  "type": "create_midi_clip",
  "track": 1,
  "clip": 0,
  "bar": 1,
  "beats": 8,
  "notes": [
    {"pitch": 41, "start": 0.0, "duration": 0.5, "velocity": 105},
    {"pitch": 44, "start": 1.0, "duration": 0.5, "velocity": 96}
  ]
}
```

### set_device_parameter

```json
{"type":"set_device_parameter","track":2,"device":"NBR Acid 303","parameter":"Acid Open","value":0.85}
```

## AI Prompt Contract

When asking an AI to control Ableton through this bridge, request JSON commands only:

```text
Return one JSON command per line. Use only command types from docs/protocol.md. Do not include prose.
```

