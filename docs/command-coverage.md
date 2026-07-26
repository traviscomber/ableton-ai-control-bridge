# Command Coverage Matrix

Status: **baseline documented**  
Protocol source: `ableton_bridge/commands.py`  
Max receiver source: `max-for-live/bridge_receiver.js`  
Baseline version: **0.4.2**

This matrix records implementation coverage without changing existing Ableton behavior. Runtime verification inside Ableton remains separate from source-level coverage.

## Summary

- Public protocol commands: **28**
- Commands dispatched by the Max receiver: **28**
- Internal bridge-only command: **undo**
- Source-level protocol/receiver gaps: **0**
- Commands requiring a specific Live Set fixture: **2** (`set_macro`, `set_device_parameter`)
- Commands with destructive effects: **2** (`delete_scene`, `delete_track`)

## Coverage

| Command | Python validation | Max receiver | Verification class | Notes |
|---|---:|---:|---|---|
| `set_tempo` | Yes | Yes | Core smoke | Changes Live Set tempo |
| `launch_scene` | Yes | Yes | Core smoke | Requires an existing scene |
| `stop_all_clips` | Yes | Yes | Core smoke | Non-destructive transport action |
| `set_track_volume` | Yes | Yes | Core smoke | Supports `track` or `track_ref` |
| `set_track_pan` | Yes | Yes | Core smoke | Supports `track` or `track_ref` |
| `set_macro` | Yes | Yes | Fixture | Requires a rack with the requested macro |
| `create_midi_clip` | Yes | Yes | Core smoke | Creates or replaces notes in a clip slot |
| `create_audio_track` | Yes | Yes | Core smoke | Can register a stable `track_ref` |
| `create_midi_track` | Yes | Yes | Core smoke | Can register a stable `track_ref` |
| `arm_track` | Yes | Yes | Core smoke | Supports `track` or `track_ref` |
| `set_device_parameter` | Yes | Yes | Fixture | Requires a named device and parameter |
| `start_playback` | Yes | Yes | Core smoke | Transport action |
| `stop_playback` | Yes | Yes | Core smoke | Transport action |
| `set_time_signature` | Yes | Yes | Core smoke | Numerator 1–16; denominator 1, 2, 4, 8, or 16 |
| `set_metronome` | Yes | Yes | Core smoke | Boolean state |
| `set_song_loop` | Yes | Yes | Core smoke | Sets start, length, and enabled state |
| `create_scene` | Yes | Yes | Core smoke | Optional name and index |
| `duplicate_scene` | Yes | Yes | Extended smoke | Requires an existing scene |
| `delete_scene` | Yes | Yes | Destructive | Execute only in a disposable test Set |
| `duplicate_track` | Yes | Yes | Extended smoke | Supports `track` or `track_ref` |
| `delete_track` | Yes | Yes | Destructive | Execute only in a disposable test Set |
| `set_track_mute` | Yes | Yes | Core smoke | Supports `track` or `track_ref` |
| `set_track_solo` | Yes | Yes | Core smoke | Supports `track` or `track_ref` |
| `launch_clip` | Yes | Yes | Core smoke | Requires an existing clip |
| `stop_track_clips` | Yes | Yes | Core smoke | Supports `track` or `track_ref` |
| `set_clip_name` | Yes | Yes | Core smoke | Requires an existing clip |
| `set_clip_color` | Yes | Yes | Core smoke | Integer color from 0 to 16777215 |
| `set_clip_loop` | Yes | Yes | Core smoke | Requires an existing clip |
| `undo` | Bridge-generated | Yes | Recovery | Not accepted through the public command validator |

## Track Reference Audit

Most track-targeted receiver operations resolve tracks through the shared `track(c)` helper and therefore support both numeric `track` and stable `track_ref` addressing.

One implementation inconsistency is recorded for later controlled correction:

- `setMacro()` resolves the rack device with `track(c)`, but its parameter scan uses `c.track` directly.
- Numeric track addressing is unaffected.
- A `set_macro` command using only `track_ref` may fail while scanning parameters.
- No change is applied in this audit because the current Ableton baseline is preserved unless a focused regression test accompanies the correction.

## Verification Levels

### Source-covered

The command exists in both the Python validator and Max receiver dispatcher.

### Core smoke

Can be verified in a disposable empty Live Set using the deterministic sequence in `examples/smoke/v0.5-smoke-test.jsonl`.

### Extended smoke

Requires setup produced by earlier smoke commands or duplicate-safe state.

### Fixture

Requires a known rack, device, or parameter configuration. These tests should be performed against a dedicated Live Set fixture rather than a user production Set.

### Destructive

Must run only against a disposable test Set with a backup. Destructive commands are excluded from the default smoke sequence.

## v0.5 Evidence Required

For a verification record, capture:

1. Ableton Live version.
2. Max for Live version.
3. Receiver device filename and version.
4. Bridge version.
5. Smoke JSONL file hash.
6. Command count sent.
7. ACK count received.
8. Failed command IDs and errors, if any.
9. Final Live Set state.
10. Operator name and test date.
