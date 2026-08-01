# Titan Live 11 Blocks 1–3

Scope: Ableton Live 11, Max for Live Receiver, bridge schema on `main`.

## Block 1 — Live readback

Read-only commands:

- `get_live_state`
- `list_tracks`
- `inspect_track`
- `list_returns`
- `inspect_device_chain`
- `inspect_device_parameters`
- `inspect_clip`
- `inspect_master`

All results are returned through the standard bridge ACK record. Device parameter inspection returns exact names, indices, min/max, native value, normalized value and quantization state from the active Live 11 session.

## Block 2 — Snapshots and rollback

Commands:

- `capture_mixer_snapshot`
- `restore_mixer_snapshot`
- `capture_device_snapshot`
- `restore_device_snapshot`

Snapshots are held in Receiver memory. They are invalid after reloading the Receiver or restarting Live. Mixer restore refuses to run if track or return counts changed. Device restore refuses to run if the parameter count changed.

## Block 3 — Master

Commands:

- `inspect_master`
- `set_master_volume`
- `set_master_device_parameter`
- `set_master_device_enabled`
- existing `load_native_device` with `target_kind: "master"`

Master parameters must first be discovered with `inspect_device_parameters`. `set_master_device_enabled` uses the exact LiveAPI parameter name `Device On`; runtime ACK certification is required before canonical use.

## Validation levels

- **Static:** schema and Receiver handlers implemented.
- **Unit/CI:** tests added; workflow result pending.
- **Bridge ACK:** must be executed with the updated Receiver in Live 11.
- **Runtime:** confirm visible values and devices in Live.
- **Audible:** required only for sound-design and master-chain decisions.

## Required runtime conditions

1. Install the updated Receiver bundle.
2. Restart Live or reload the updated Receiver.
3. Start the matching bridge build.
4. Do not reuse snapshot IDs after Receiver or Live restart.
5. Inspect device parameters before setting them.
