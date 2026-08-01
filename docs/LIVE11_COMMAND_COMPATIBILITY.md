# Ableton Live 11 command compatibility

This document is the canonical command-support contract for the Ableton AI Control Bridge.

A command is not considered fully supported merely because it exists in the Python schema. It must pass the complete path:

`GUI or client -> HTTP schema -> Python bridge -> UDP transport -> Max for Live receiver or Remote Script -> LiveAPI -> ACK`

## Validation states

- **Static**: schema and execution handler exist, fields and ranges are validated, and CI parity tests pass.
- **Unit/CI**: automated repository tests and build checks pass.
- **Bridge ACK**: the target Live 11 session accepts and acknowledges the command.
- **Runtime**: the requested object or state is visibly present in Live 11.
- **Audible**: the musical or processing result has been listened to in context.

Only Bridge ACK or higher proves that a command works in a real Live 11 session.

## Max for Live receiver commands

The following public commands are declared in `ableton_bridge/commands.py` and implemented in `max-for-live/bridge_receiver.js`:

### Session and transport

- `set_tempo`
- `launch_scene`
- `stop_all_clips`
- `start_playback`
- `stop_playback`
- `set_time_signature`
- `set_metronome`
- `set_song_loop`

### Tracks

- `create_audio_track`
- `create_midi_track`
- `duplicate_track`
- `delete_track`
- `arm_track`
- `set_track_volume`
- `set_track_pan`
- `set_track_mute`
- `set_track_solo`
- `set_track_send`
- `set_macro`

### Scenes and clips

- `create_scene`
- `duplicate_scene`
- `delete_scene`
- `create_midi_clip`
- `launch_clip`
- `stop_track_clips`
- `set_clip_name`
- `set_clip_color`
- `set_clip_loop`

### Devices and parameters

- `set_device_parameter`
- `set_return_device_parameter`

Device and parameter commands require exact names exposed by the target Live 11 LiveAPI session. Their handler is present, but individual device/parameter combinations remain **Bridge ACK unverified** until tested in the active Set.

### Return tracks

- `create_return_track`
- `set_return_volume`
- `set_return_pan`
- `set_track_send`
- `set_return_device_parameter`

Return indices are the preferred stable target. Name resolution is a fallback and must not be treated as equally reliable after return collection changes.

## Live 11 Remote Script commands

- `load_native_device`

This command is implemented by `remote-scripts/AbletonAIControlBridge/control_surface.py`, not by the Max for Live receiver. It depends on:

- the Remote Script being installed and selected in Live 11;
- UDP port `9003` being available;
- the browser item being discoverable;
- the target being resolvable;
- Live accepting `browser.load_item` for the selected track.

Track and master targets are statically implemented. Return targets have shown runtime resolution problems and remain **partial / Bridge ACK unverified** until the receiver and Remote Script use the same stable return-target contract.

## Internal command

- `undo`

`undo` is generated internally by the bridge and implemented in the receiver. It is intentionally not exposed as a public HTTP command.

## Current support verdict

- Public schema commands with an execution handler: enforced by CI.
- Receiver handlers missing from the public schema: prohibited by CI, except internal `undo`.
- Remote Script registry and implementation parity: enforced by CI.
- Real Live 11 ACK coverage: incomplete and must be generated from the user's active Live 11 session.
- Device parameter coverage: dynamic and session-specific; parameter names must be discovered, never guessed.
- Master and group operations: not yet public commands and must not appear as operational GUI actions.

## Required runtime certification

A canonical certification run must:

1. start from a disposable Live 11 Set;
2. verify Bridge, Max receiver, and Remote Script versions;
3. submit one safe payload for every public command;
4. wait for the matching ACK after each mutation;
5. stop on the first rejection;
6. export command ID, payload, ACK, Live version, receiver commit, and bridge commit;
7. mark destructive commands as tested only in the disposable Set;
8. separately validate device and parameter commands using discovered LiveAPI names.

Until that certification is completed, the repository can claim **Static** and **Unit/CI** compatibility, but not complete Live 11 runtime support.
