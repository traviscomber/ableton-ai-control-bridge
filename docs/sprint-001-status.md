# DARKSCO Sprint 001 Status

Status: **ACTIVE**  
Objective: establish a verified v0.5 baseline without disrupting the working Ableton system.

## Completed

| ID | Owner | Result | Evidence |
|---|---|---|---|
| S1-01 | Bane | Preflight diagnostics added | `ableton_bridge/preflight.py`, `tests/test_preflight.py` |
| S1-02 | Venom | Protocol and Max receiver source coverage audited | `docs/command-coverage.md` |
| S1-03 | Venom | Deterministic non-destructive smoke sequence created | `examples/smoke/v0.5-smoke-test.jsonl` |
| S1-04 | Loki | Preflight operator documentation added | `docs/preflight.md` |
| S1-05 | Hela | First-run diagnostic output made human-readable and JSON-capable | `ableton-bridge-check` CLI |
| S1-06 | Thanos | Rights and provenance requirements identified in execution roadmap | `docs/roadmap-execution.md` |
| S1-07 | Darkside | Repository roadmap audit completed | `docs/roadmap-audit.md` |
| S1-09 | Venom | `set_macro` corrected for stable `track_ref` addressing | `max-for-live/bridge_receiver.js` |
| S1-10 | Bane | Protocol/receiver parity regression test added | `tests/test_command_coverage.py` |
| S1-11 | Bane | Smoke sequence validation tests added | `tests/test_v05_smoke_sequence.py` |

## Current Baseline

- Python protocol defines 28 public commands.
- Max receiver dispatches the same 28 commands.
- The internal `undo` command remains receiver-supported.
- Existing numeric track behavior is preserved.
- `set_macro` now resolves numeric and stable referenced tracks through the same path.
- The smoke sequence excludes destructive commands.
- Preflight diagnostics do not modify Ableton state.

## Pending Human Verification

These items require the user's working Ableton and Max for Live environment and cannot be truthfully marked complete from repository inspection alone:

- Run the full automated test suite in the target Windows environment.
- Load the existing `.amx`/`.amxd` receiver in Ableton.
- Execute `examples/smoke/v0.5-smoke-test.jsonl` with ACK waiting enabled.
- Confirm all commands acknowledge successfully.
- Confirm the final Live Set state matches the expected smoke sequence.
- Record Ableton, Max for Live, receiver, Python, and bridge versions.

## Verification Command

```powershell
ableton-bridge-check --config .\config.json --require-receiver
ableton-bridge-run examples\smoke\v0.5-smoke-test.jsonl --token $token --wait-ack
```

Run only against a disposable or backed-up Live Set.

## Doom Gate

**Decision: REVISE**

The source baseline is stronger and protected by regression checks. v0.5 approval remains conditional on one successful end-to-end smoke run in the user's confirmed working Ableton environment.

## Next Development Sequence

1. Capture the first end-to-end smoke evidence.
2. Add the evidence record under `docs/evidence/`.
3. Mark v0.5 baseline approved if every command acknowledges successfully.
4. Begin the operator dashboard as an additive interface over the existing bridge APIs.
