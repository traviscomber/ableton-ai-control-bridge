# Night Protocol 001 — Production Package

Status: **SOURCE READY / ABLETON EXECUTION PENDING**

This folder is the canonical storage location for the first DARKSCO release-candidate track.

## Stored files

- `brief.md` — approved Venom production brief and musical constraints.
- `song-plan.json` — versioned DARKSCO SongPlan used to generate the Ableton command sequence.
- `BUILD COMMANDS.cmd` — Windows one-click compiler and validator.
- `commands.jsonl` — generated locally after running the builder; do not hand-edit unless the SongPlan is also updated.
- `validation.md` — source-level validation evidence and expected Ableton state.

Related repository files:

- `tests/test_night_protocol_001.py` — production-plan regression coverage.
- `darksco/compiler.py` — deterministic SongPlan compiler.
- `ableton_bridge/commands.py` — public bridge command contract.
- `max-for-live/bridge_receiver.js` — Max for Live receiver implementation.

## Build on Windows

From the repository or installed Desktop package, double-click:

```text
production\night-protocol-001\BUILD COMMANDS.cmd
```

The builder creates and validates:

```text
production\night-protocol-001\commands.jsonl
```

## Execute in Ableton

Use a new disposable Ableton Live Set with the receiver `.amxd` loaded.

```powershell
$token = (Get-Content .\config.json | ConvertFrom-Json).token

ableton-bridge-run `
  production\night-protocol-001\commands.jsonl `
  --token $token `
  --auto-approve `
  --wait-ack
```

## Preservation rules

- Keep the original `.amxd` unchanged until a rebuilt device is runtime-verified.
- Do not execute against an important production Set.
- Commit updates to the SongPlan, validation record, and expected state together.
- Store Ableton `.als`, rendered audio, stems, screenshots, and runtime evidence outside Git until file-size and rights policy are finalized.
- Record the external evidence location in `validation.md` when runtime testing begins.
