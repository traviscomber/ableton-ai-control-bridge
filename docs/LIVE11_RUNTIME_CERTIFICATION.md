# Titan Live 11 Runtime Certification

This runner certifies commands against the user's active Ableton Live 11 session by submitting each command through the real bridge and waiting for the Max for Live ACK.

## Validation meaning

- **Static:** command exists in schema and has a receiver or Remote Script handler.
- **Unit/CI:** automated repository checks passed.
- **Bridge ACK:** the active Live 11 session accepted the command.
- **Runtime:** the user visually confirmed the expected change in Live.
- **Audible:** the user listened to the result in context.

The runner certifies **Bridge ACK** only. It records that Runtime and Audible validation remain separate.

## File

`tools/TITAN_LIVE11_RUNTIME_CERTIFICATION.ps1`

The script reads the bridge URL and token automatically from:

`%LOCALAPPDATA%\Ableton AI Control Bridge\config.json`

The user does not need to open or edit that JSON file.

## Preconditions

1. Ableton Live 11 is open.
2. `AI Control Bridge Receiver` is loaded.
3. The desktop bridge is running.
4. The Receiver has already produced at least one ACK in the current bridge session.
5. The active `track_ref` mappings still belong to the same Live/Receiver session.

## Profiles

### safe

Tests:

- `start_playback`
- `stop_playback`
- `set_metronome` on/off
- `set_song_loop` on/off

Final state: playback stopped, metronome off, song loop off.

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\TITAN_LIVE11_RUNTIME_CERTIFICATION.ps1 -Profile safe
```

### mixer

Includes the safe profile and tests an existing track and return:

- `set_track_volume`
- `set_track_pan`
- `set_track_mute` on/off
- `set_track_solo` on/off
- `set_return_volume`
- `set_return_pan`
- `set_track_send`

The script applies the explicitly supplied final values. It does not claim to restore unknown previous values because state readback is not yet implemented.

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\TITAN_LIVE11_RUNTIME_CERTIFICATION.ps1 `
  -Profile mixer `
  -TrackRef kick `
  -ReturnIndex 0 `
  -TrackVolume 0.82 `
  -TrackPan 0 `
  -ReturnVolume 0.34 `
  -ReturnPan 0
```

### destructive

Use only in an empty disposable Live Set. It creates and modifies a temporary MIDI track, clip and scene, and tests collection mutations.

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\TITAN_LIVE11_RUNTIME_CERTIFICATION.ps1 `
  -Profile destructive `
  -ConfirmDestructive
```

The destructive profile tests:

- MIDI track creation
- arm on/off
- MIDI clip creation and notes
- clip name, color and loop
- clip launch and stop
- scene create, duplicate and delete
- track duplicate and delete

Because Live collections are eventually consistent, this profile is expected to expose commands that need ACK-driven deferred resolution. A failure is evidence for receiver repair, not a reason to retry blindly.

## Excluded from automatic certification

These require explicit device names, parameters, or browser targets and are not guessed:

- `set_macro`
- `set_device_parameter`
- `set_return_device_parameter`
- `load_native_device`
- `create_return_track`

They will be added after device/parameter inspection and stable return creation are implemented.

## Report

Default output:

`TITAN_LIVE11_CERTIFICATION_REPORT.json`

Each entry contains:

- submitted payload
- command ID
- final bridge status
- ACK result or error
- timestamps
- required/optional classification

A command is not canonical Live 11 support until it has passed Bridge ACK in the target installation and the expected Runtime result has been visually confirmed.
