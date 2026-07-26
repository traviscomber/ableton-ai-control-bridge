# DARKSCO Roadmap Audit

Audit date: 2026-07-26  
Scope: [`roadmap.md`](../roadmap.md), [`roadmap-execution.md`](roadmap-execution.md), and the current `main` implementation.

## Executive Assessment

The execution roadmap is correctly ordered: reliability must precede composition intelligence, interface work, MCP exposure, and catalogue production.

The repository is beyond an early prototype. It already contains a functional local bridge, command validation, approval controls, command history, ACK processing, a JSONL runner, and a scene-based DARKSCO composition layer. The primary v0.5 risk is not missing architecture; it is incomplete end-to-end evidence inside Ableton Live and the absence of a verified distributable `.amxd` device.

## Verified Repository Baseline

| Capability | Status | Evidence |
|---|---|---|
| Python package and CLI entry points | Implemented | `pyproject.toml` |
| HTTP bridge | Implemented | `ableton_bridge/server.py` |
| UDP command transport | Implemented | Bridge server and transport layer |
| ACK listener and command acknowledgement | Implemented | `BridgeState.receive_acknowledgements` |
| Token authentication | Implemented | `AccessPolicy` and server authorization |
| Command allowlist | Implemented | Server startup validation |
| Human approval flow | Implemented | Pending, approve, reject, and undo operations |
| Dry-run mode | Implemented | Bridge state and runner behavior |
| Persistent command history | Implemented | Command store |
| Health endpoint | Implemented | `/health` response |
| Preflight diagnostics | Implemented in this audit | `ableton_bridge/preflight.py` |
| Max receiver acknowledgement visibility | Implemented | Health endpoint `max_receiver_seen` and `last_ack_at` |
| Packaged `.amxd` receiver | Not verified | Must be built and tested inside Max for Live |
| Clean Windows installation evidence | Not yet recorded | Manual clean-environment test required |
| Full protocol-to-Max coverage matrix | Not yet recorded | Venom audit required |
| Deterministic Ableton smoke test | Not yet recorded | Required for v0.5 gate |

## Roadmap Corrections

### 1. Do not rebuild capabilities already present

The roadmap should treat authentication, approval, undo, ACK handling, command history, and health reporting as existing systems requiring verification and hardening rather than new features.

### 2. Split software-verifiable and Ableton-verifiable work

Repository tests can verify validation, HTTP behavior, persistence, CLI behavior, and diagnostics. They cannot prove Live API execution, device packaging, clip creation, mixer behavior, or `.amxd` portability.

Every v0.5 task must therefore identify one evidence class:

- automated Python test,
- protocol fixture validation,
- Max for Live manual test,
- Ableton end-to-end test,
- clean installation test.

### 3. Make the `.amxd` the critical path

The packaged receiver is the only mandatory deliverable that cannot be completed or validated outside Max for Live. It should be treated as the v0.5 critical-path dependency.

### 4. Keep MCP work after stable execution

MCP exposure should not begin until command coverage, idempotency requirements, approval policy, and receiver behavior are stable. Otherwise it will expose unstable operations through a larger surface.

### 5. Separate DARKSCO catalogue goals from bridge release gates

The four pilot releases validate the creative system, but they should not block a technically stable bridge release unless v1.0 is defined as the combined product and catalogue launch.

## Development Started

The first roadmap implementation is complete:

- Added `ableton-bridge-check` CLI entry point.
- Added bridge/configuration/authentication/transport/receiver diagnostics.
- Added strict `--require-receiver` mode for release and autonomous-execution checks.
- Added JSON output for automation and future MCP consumption.
- Added unit tests for offline, authenticated-ready, and receiver-required states.
- Added operator documentation.

Independent test result:

```text
Ran 3 tests
OK
```

## Recommended v0.5 Sequence

1. Build and save the Max receiver as a valid `.amxd`.
2. Create the protocol coverage matrix.
3. Create one deterministic smoke-test SongPlan and expected Ableton state.
4. Run the smoke test twice with ACK mode and record evidence.
5. Test the Windows installer in a clean environment.
6. Fix only failures discovered by those tests.
7. Run `ableton-bridge-check --require-receiver` as the final release preflight.
8. Issue Doom's v0.5 GO, REVISE, DELAY, or REJECT decision.

## Current Decision

**Status: REVISE**

The v0.5 scope is viable, but release approval is blocked until the `.amxd`, command coverage matrix, deterministic smoke test, and clean Windows installation are verified.
