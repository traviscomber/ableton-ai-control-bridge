# Canonical Ableton Track Build

Status: canonical operating baseline for the current Ableton Live 11 session.

## Scope

- Ableton Live 11 with Max for Live.
- Project tempo: 128 BPM.
- Tonality: F minor.
- 12 stems, 4 return tracks, 64-bar / 8-section arrangement target.
- Bridge branch: `fix/receiver-stable-targets`.
- Receiver references remain valid only while the same Live session and receiver instance stay open.

## Canonical stem order

1. `01 KICK`
2. `02 ROUND BASS`
3. `03 PERCUSSION`
4. `04 GROOVE HAT`
5. `05 OPEN HAT`
6. `06 SYNTH STAB`
7. `07 MELODY`
8. `08 PAD`
9. `09 FX RISER`
10. `10 FX IMPACT`
11. `11 VOICE`
12. `12 AMBIENT`

## Canonical stem chains

- Kick: `Operator -> Saturator -> EQ Eight`
- Round Bass: `Operator -> Compressor -> EQ Eight -> Auto Filter`
- Percussion: `Drum Rack -> Drum Buss -> EQ Eight`
- Groove Hat: `Drum Rack -> EQ Eight -> Auto Pan`
- Open Hat: `Drum Rack -> EQ Eight -> Auto Pan`
- Synth Stab: `Wavetable -> Auto Filter -> Saturator -> EQ Eight`
- Melody: `Wavetable -> Echo -> EQ Eight`
- Pad: `Drift -> Hybrid Reverb -> EQ Eight`
- FX Riser: `Operator -> Auto Filter -> Echo -> EQ Eight`
- FX Impact: `Operator -> Saturator -> EQ Eight -> Echo`
- Voice: `EQ Eight -> Compressor -> Echo`
- Ambient: `Drift -> Hybrid Reverb -> Auto Filter -> EQ Eight -> Auto Pan`

## Canonical packages

Use one package at a time and only its named `.cmd` entrypoint.

- Kick Operator: `CANONICAL_CLEAN_KICK_OPERATOR_V3.zip`
- Bass: `TITAN_CANONICAL_ROUND_BASS_V2.zip`
- Percussion: `TITAN_CANONICAL_PERCUSSION_V2.zip`
- Groove Hat: `TITAN_CANONICAL_GROOVE_HAT_V1.zip`
- Open Hat: `TITAN_CANONICAL_OPEN_HAT_V1.zip`
- Synth Stab: `TITAN_CANONICAL_SYNTH_STAB_V1.zip`
- Melody: `TITAN_CANONICAL_MELODY_V1.zip`
- Pad: `TITAN_CANONICAL_PAD_V1.zip`
- FX Riser: `TITAN_CANONICAL_FX_RISER_V1.zip`
- FX Impact: `TITAN_CANONICAL_FX_IMPACT_V1.zip`
- Voice recovery: `TITAN_CANONICAL_VOICE_RECOVERY_V2.zip`
- Ambient: `TITAN_CANONICAL_AMBIENT_V1.zip`
- Returns A/B: `TITAN_RETURNS_A_B_CONFIG_V2.zip`
- Returns C/D: `TITAN_RETURNS_C_D_CONFIG_V1.zip`
- Premix: `TITAN_PREMIX_GROUPING_PLAN_V1.zip`

## Canonical returns

Exactly four returns, in this order:

0. `A SHORT ROOM` — native `Reverb`
1. `B DUB DELAY` — native `Echo`
2. `C LONG SPACE` — native `Hybrid Reverb`
3. `D PARALLEL DRIVE` — native `Drum Buss`, with optional Glue Compressor and EQ Eight added manually later.

Do not create duplicate return tracks. Devices must be loaded directly on the return, not inside racks, and must retain their native LiveAPI names.

At 128 BPM:

- Quarter note: 468.75 ms.
- Short-room predelay target: approximately 29.30 ms.
- Short-room decay target: approximately 351.56 ms.

## Premix and grouping

Canonical manual groups:

- `DRUMS`: Kick, Percussion, Groove Hat, Open Hat.
- `LOW END`: Round Bass.
- `MUSIC`: Synth Stab, Melody, Pad.
- `FX + ATMOS`: FX Riser, FX Impact, Ambient.
- `VOICE`: Voice.

The current receiver does not safely create Group Tracks or move existing tracks while preserving references. Grouping is manual until dedicated commands are implemented.

Premix target: the densest section should peak near -6 dBFS on the Master before master-bus processing.

## Master chain

Planned canonical chain:

`EQ Eight -> Glue Compressor -> Saturator -> Limiter`

Targets:

- EQ: broad corrective moves only; optional 20-25 Hz subs cleanup.
- Glue Compressor: ratio 2:1, slow attack, Auto release, about 1-2 dB gain reduction.
- Saturator: about 1-2 dB drive with Soft Clip.
- Limiter: protection only; provisional ceiling near -1 dBFS.

Master-device automation is not yet supported by the current receiver. Add explicit `master` target commands before automating this chain.

## Execution rules

1. Keep Ableton, Bridge, and Receiver open throughout the sequence.
2. Use `track_ref`; do not substitute unsupported `track_name` fields at the HTTP schema boundary.
3. Serialize commands and wait for ACK after every fragile operation.
4. Do not rerun packages that add devices unless the package is explicitly idempotent.
5. Never reload the receiver while relying on in-memory references.
6. Do not claim success from static validation alone. Report Static, Unit/CI, Bridge ACK, Runtime, and Audible separately.
7. Preserve one obvious `.cmd` entrypoint per delivery package.

## Confirmed canonical decisions

- Kick Operator V3 is confirmed working in the Live session.
- Bass V1 is deprecated; Bass V2 is the canonical bass correction.
- Percussion V1 is deprecated due to a truncated PowerShell function; Percussion V2 is canonical.
- Voice V1 is deprecated after an ACK timeout; Voice Recovery V2 is canonical.
- Return scripts using `return_name` are deprecated. Returns are addressed by stable indices 0-3.
- `ER Diffusion` is not a valid Reverb parameter for this Live 11 device. Use the confirmed Live 11 parameter set used by Returns A/B V2.
- A fifth compression return is not required. `D PARALLEL DRIVE` is the canonical parallel-density bus.

## Remaining engineering work

- Add explicit master-device commands.
- Add safe Group Track creation and track-move commands.
- Add device enumeration diagnostics for tracks, returns, and Master.
- Persist return references by index and exact name in the receiver.
- Add regression tests for return resolution, return-device discovery, and parameter enumeration.
