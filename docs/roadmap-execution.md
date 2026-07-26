# DARKSCO Execution Roadmap

Status: **ACTIVE**  
Repository baseline: **Ableton AI Control Bridge v0.4.2 technical beta**  
Roadmap horizon: **90 days**  
Primary orchestrator: **Darkside**  
Final strategic authority: **Doom**

This document converts the strategic vision in [`../roadmap.md`](../roadmap.md) into executable repository work. It does not replace the manifesto, brand definition, or long-term roadmap.

## 1. Current Baseline

The repository already provides:

- Local Python HTTP bridge.
- Validated JSON command protocol.
- UDP transport to Max for Live.
- CLI and JSONL runner.
- Dry-run and approval controls.
- Sequential ACK execution.
- Track references that protect the Max for Live receiver track.
- SongPlan compilation for scene-based composition.
- Unit tests and Windows installation workflow.

Primary unresolved product constraint:

- A tested and distributable `.amxd` receiver must be built and verified inside Max for Live.

## 2. Operating Team

| Owner | Authority | Immediate responsibility |
|---|---|---|
| Darkside | Orchestration | Route work, maintain dependencies, consolidate status |
| Doom | Strategy | Approve scope, priorities, release gates, and major tradeoffs |
| Venom | Music and Ableton | Validate musical workflows, SongPlan quality, device behavior |
| Hela | Visual and interface | Define operator UI, visual system, screenshots, usability QA |
| Loki | Publishing | Documentation, release notes, launch messaging, calendar |
| Bane | Intelligence | Test evidence, adoption metrics, performance baselines |
| Thanos | Business and rights | Licensing, ownership records, packaging, commercial readiness |

The retired names Deckard, Selene, Morticia, Raven, K, and Lestat remain historical references only and must be replaced when `roadmap.md` is refactored.

## 3. Priority Order

1. **Make the bridge verifiably reliable in Ableton Live.**
2. **Make complete track creation repeatable and reviewable.**
3. **Make installation and operation understandable to a non-developer.**
4. **Add intelligence without weakening approval, audit, and safety controls.**
5. **Prepare a distributable product and DARKSCO production system.**

## 4. Phase 0 — Activation and Audit

Target: Days 1–3

### Deliverables

- [ ] Confirm all tests pass on the supported Python versions.
- [ ] Inventory command coverage against the documented protocol.
- [ ] Identify commands implemented in Python but missing in Max for Live.
- [ ] Identify Max receiver operations without automated or manual verification evidence.
- [ ] Confirm the Windows installer from a clean environment.
- [ ] Record current limitations and known failure modes.
- [ ] Establish one release checklist and one evidence folder.

### Owners

- Darkside: execution board and dependency map.
- Venom: Ableton and musical workflow audit.
- Bane: test baseline and evidence standard.
- Loki: documentation inconsistencies.
- Doom: approve v0.5 scope.

### Exit gate

Phase 0 passes when every supported command has one of these statuses:

- verified end-to-end,
- verified in dry-run only,
- implemented but unverified,
- missing,
- intentionally deferred.

## 5. Phase 1 — Reliable Ableton Device

Target: Days 4–14  
Release target: **v0.5**

### Product objective

A new user can install the bridge, load the receiver, execute a validated sequence, and confirm the result without editing source files.

### Workstreams

#### Receiver packaging

- [ ] Build `AI Control Bridge Receiver.amxd` inside Max for Live.
- [ ] Freeze required JavaScript dependencies when appropriate.
- [ ] Verify installation on Ableton Live 11.
- [ ] Test Live 12 when available; document unsupported differences.
- [ ] Add device version and protocol version reporting.

Owner: Venom  
Support: Loki

#### End-to-end verification

- [ ] Create a deterministic smoke-test SongPlan.
- [ ] Execute the test using ACK mode.
- [ ] Verify tempo, scenes, tracks, clips, notes, names, colors, and mixer state.
- [ ] Capture expected and observed results.
- [ ] Add recovery instructions for partial execution.

Owner: Venom  
Evidence owner: Bane

#### Installation usability

- [ ] Reduce Windows setup to one documented path.
- [ ] Add preflight checks for Python, ports, token, receiver, and Live connection.
- [ ] Make failures actionable rather than generic.
- [ ] Add one operator checklist for first launch.

Owner: Loki  
Interface review: Hela

### v0.5 release gate

- `.amxd` built and tested.
- Clean Windows installation verified.
- Smoke test completed twice without manual repair.
- No undocumented destructive command.
- Recovery and backup instructions published.

## 6. Phase 2 — DARKSCO Composition Engine

Target: Days 15–30  
Release target: **v0.6**

### Product objective

Convert a musical brief into a coherent, editable Ableton session plan with explicit structure, references, validation, and review checkpoints.

### Workstreams

#### SongPlan schema

- [ ] Version the SongPlan schema.
- [ ] Add explicit project metadata and creative intent.
- [ ] Add Morning, Noon, Night, and bridge classifications.
- [ ] Add arrangement roles: opener, builder, transition, peak, reset, descent, closer.
- [ ] Add deterministic seeds or generation records where applicable.
- [ ] Add rights and source metadata fields.

Owner: Venom  
Rights review: Thanos

#### Musical intelligence

- [ ] Add reusable rhythm, bass, harmony, texture, and transition modules.
- [ ] Add constraint validation for tempo, register, density, velocity, and repetition.
- [ ] Add variation rules that prevent mechanical copy-paste.
- [ ] Add state-specific production profiles for Morning, Noon, and Night.
- [ ] Add a musical quality report before compilation.

Owner: Venom

#### Safe execution planning

- [ ] Generate a human-readable plan before JSONL.
- [ ] Show command count and estimated execution scope.
- [ ] Flag destructive or high-impact actions.
- [ ] Support validate, approve, execute, pause, resume, and abort states.
- [ ] Preserve an immutable execution log.

Owner: Darkside  
Evidence: Bane

### v0.6 release gate

- Three reference SongPlans compile successfully.
- Each state produces a structurally distinct result.
- Every generated command validates before execution.
- Session creation can be resumed after interruption.
- Rights and generation metadata are retained.

## 7. Phase 3 — Operator Experience

Target: Days 31–45  
Release target: **v0.7**

### Product objective

A producer can operate DARKSCO without memorizing CLI flags or raw JSON.

### Scope

- [ ] Design a local operator dashboard.
- [ ] Show bridge, Ableton, receiver, token, and port status.
- [ ] Load and inspect SongPlans.
- [ ] Display approval queue and high-impact warnings.
- [ ] Show execution progress and ACK state.
- [ ] Provide pause, resume, abort, and retry controls.
- [ ] Display structured logs and export evidence.
- [ ] Preserve CLI parity for automation.

Owner: Hela  
Technical routing: Darkside  
Workflow validation: Venom

### v0.7 release gate

- Primary workflows require no terminal use after installation.
- All interface actions map to documented protocol operations.
- Error states include a recommended corrective action.
- Screenshots and operator documentation are complete.

## 8. Phase 4 — Agent and MCP Layer

Target: Days 46–60  
Release target: **v0.8**

### Product objective

Allow ChatGPT and other agents to plan, inspect, and execute controlled Ableton workflows through explicit tools rather than unrestricted machine access.

### Scope

- [ ] Define a stable MCP tool surface over the bridge.
- [ ] Separate read tools, planning tools, validation tools, and execution tools.
- [ ] Require confirmation for destructive or irreversible operations.
- [ ] Add session-state inspection before planning.
- [ ] Add idempotency keys and duplicate-action protection.
- [ ] Add scoped tokens and command allowlists.
- [ ] Add structured tool errors suitable for agent recovery.
- [ ] Add example agent workflows using Venom and Darkside.

Owner: Darkside  
Musical policy: Venom  
Security and commercial review: Thanos

### v0.8 release gate

- MCP tools cannot bypass protocol validation.
- Read-only inspection works without execution permission.
- Duplicate requests do not duplicate destructive actions.
- Every action is attributable and logged.
- Approval policy is tested with permitted and denied actions.

## 9. Phase 5 — Production Catalogue Pilot

Target: Days 61–75  
Release target: **v0.9**

### Product objective

Use the system to create a controlled pilot catalogue rather than isolated technical demos.

### Pilot catalogue

- [ ] Morning Transmission 001.
- [ ] Midday System 001.
- [ ] Night Protocol 001.
- [ ] Complete Daily Cycle 001.

### Required records

- [ ] SongPlan and source brief.
- [ ] Generation and editing history.
- [ ] Ableton project and exported stems.
- [ ] Mix and master versions.
- [ ] Rights and sample records.
- [ ] Visual concept and source records.
- [ ] Release metadata.
- [ ] Quality-gate decision.

Owners:

- Venom: music.
- Hela: visual system.
- Loki: release package.
- Bane: performance baseline.
- Thanos: rights and commercial readiness.
- Doom: final approval.

## 10. Phase 6 — v1.0 Product Readiness

Target: Days 76–90  
Release target: **v1.0**

### Product objective

Ship a stable, documented, auditable Ableton AI production bridge suitable for controlled public use.

### v1.0 requirements

- [ ] Supported-platform matrix.
- [ ] Installable Max for Live device.
- [ ] Stable versioned protocol.
- [ ] Stable versioned SongPlan schema.
- [ ] Automated tests and documented manual Ableton tests.
- [ ] Local operator interface.
- [ ] MCP tool layer.
- [ ] Audit logs and recovery procedures.
- [ ] Security and token documentation.
- [ ] Licensing and contributor records.
- [ ] Four completed pilot releases.
- [ ] Release notes, migration notes, and known limitations.

### Final gate

Doom chooses one outcome:

- **GO** — publish v1.0.
- **REVISE** — fix a bounded list of release blockers.
- **DELAY** — major reliability, rights, or product risks remain.

## 11. Current Sprint — Sprint 001

Duration: 7 days  
Objective: establish a verified baseline and lock the v0.5 scope.

| ID | Owner | Task | Completion evidence |
|---|---|---|---|
| S1-01 | Bane | Run the complete automated test suite | Test command, environment, and results recorded |
| S1-02 | Venom | Audit protocol commands against Max receiver implementation | Command coverage matrix |
| S1-03 | Venom | Define deterministic Ableton smoke-test session | SongPlan, JSONL, and expected state |
| S1-04 | Loki | Audit installation and first-run documentation | Prioritized documentation defects |
| S1-05 | Hela | Review first-run operator experience | Usability findings with severity |
| S1-06 | Thanos | Define rights and provenance fields required in SongPlan | Approved metadata checklist |
| S1-07 | Darkside | Consolidate evidence and dependencies | Sprint status and blocker report |
| S1-08 | Doom | Approve exact v0.5 release scope | GO, REVISE, DELAY, or REJECT decision |

## 12. Definition of Done

A task is done only when:

- The output exists in the repository or linked evidence location.
- The result has been verified, not merely implemented.
- Documentation is updated.
- Known limitations are recorded.
- The responsible owner approves the result.
- Required tests pass.
- A follow-up owner is assigned when work remains.

## 13. Change Control

- Darkside maintains execution status.
- Doom approves changes to phase objectives or release gates.
- Specialists may revise tasks inside their domain without changing strategic scope.
- Any change affecting rights, destructive behavior, compatibility, or public promises requires explicit review.
- Completed work should be committed with a scoped message and evidence reference.
