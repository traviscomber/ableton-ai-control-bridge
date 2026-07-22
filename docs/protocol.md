# Command Protocol

The bridge accepts HTTP JSON commands at:

```text
POST /command
```

It validates the command and forwards it as compact JSON over UDP to Max for Live.

When a command is forwarded, the bridge adds transport metadata:

```json
{"bridge_id":"uuid","ack_host":"127.0.0.1","ack_port":9002}
```

The Max receiver returns an acknowledgement over UDP:

```json
{"bridge_id":"uuid","ok":true,"result":{"tempo":132}}
```

or an execution error:

```json
{"bridge_id":"uuid","ok":false,"error":"Device not found: Bass"}
```

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

### arm_track

```json
{"type":"arm_track","track":1,"armed":true}
```

## Command Lifecycle

Stored commands use these states:

- `pending`: waiting for approval.
- `accepted`: validated and ready to dispatch.
- `sent`: sent by UDP and awaiting Max.
- `acknowledged`: Max reports successful execution.
- `error`: transport or execution failed.
- `rejected`: rejected in the approval UI.
- `simulated`: accepted in dry-run mode without UDP.

Undo is a bridge control operation. `POST /api/commands/{id}/undo` sends an
internal `undo` envelope to Max, which invokes Live's undo operation.

## Composition commands (v0.4)

The bridge also supports song-level and clip-level composition operations:

- `start_playback`, `stop_playback`
- `set_time_signature`, `set_metronome`, `set_song_loop`
- `create_scene`, `duplicate_scene`, `delete_scene`
- `duplicate_track`, `delete_track`
- `set_track_mute`, `set_track_solo`, `stop_track_clips`
- `launch_clip`, `set_clip_name`, `set_clip_color`, `set_clip_loop`

Examples:

```json
{"type":"create_scene","name":"DROP","index":2}
{"type":"set_time_signature","numerator":4,"denominator":4}
{"type":"set_song_loop","start":0,"length":32,"enabled":true}
{"type":"set_clip_name","track":0,"clip":0,"name":"Kick — Intro"}
{"type":"launch_clip","track":0,"clip":0}
```

These commands can be combined with `create_midi_track` and `create_midi_clip`
to build an entire Session View arrangement from a reviewed JSONL plan.

## AI Prompt Contract

When asking an AI to control Ableton through this bridge, request JSON commands only:

```text
Return one JSON command per line. Use only command types from docs/protocol.md. Do not include prose.
```
