# DARKSCO Execution Roadmap

Status: **ACTIVE**  
Repository baseline: **Ableton AI Control Bridge v0.4.2 technical beta**  
Roadmap horizon: **90 days**  
Current sprint: **Sprint 002 — First Track Production Loop**  
Primary orchestrator: **Darkside**  
Final strategic authority: **Doom**

This document converts the strategic vision in [`../roadmap.md`](../roadmap.md) into executable repository work. It does not replace the manifesto, brand definition, or long-term roadmap.

## 1. Current Baseline

The repository currently provides:

- Local Python HTTP bridge.
- Validated JSON command protocol.
- UDP transport to Max for Live.
- CLI and JSONL runner.
- Dry-run and approval controls.
- Sequential ACK execution.
- Stable track references that protect the Max for Live receiver track.
- SongPlan validation and deterministic compilation.
- Windows installer, diagnostics, preflight, and launcher source.
- Night Protocol 001 brief, SongPlan, command builder, arrangement revision, and review checklist.

Confirmed source-level progress:

- Explicit SongPlan `track_ref` values are preserved.
- Night Protocol 001 compiles into a validated, non-destructive command sequence.
- The first production package is stored under `production/night-protocol-001/`.
- Five transitions, microvariation rules, and a signature event are specified for the v0.2 production pass.

Primary unresolved constraints:

1. The receiver `.amxd` has not been rebuilt and packaged under a verified Max for Live toolchain.
2. Night Protocol 001 has not yet been verified through a complete Ableton runtime execution.
3. No review WAV, stems, mix, master, or final rights record exists yet.
4. The complete automated test suite has not been rerun in this connector-only environment.

## 2. Operating Team

| Owner | Authority | Immediate responsibility |
|---|---|---|
| Darkside | Orchestration | Maintain dependencies, sprint state, evidence, and handoffs |
| Doom | Strategy | Approve scope, priorities, release gates, and major tradeoffs |
| Venom | Music and Ableton | Musical briefs, arrangements, sound identity, and listening approval |
| Ultron | Ableton engineering | Bridge reliability, command validation, receiver compatibility, runtime evidence |
| Hela | Visual and interface | Visual system, operator experience, screenshots, and audiovisual alignment |
| Loki | Publishing | Documentation, version records, release package, and launch operations |
| Bane | Intelligence | Test evidence, comparison metrics, and review baselines |
| Thanos | Business and rights | Provenance, licensing, ownership, and commercial readiness |

## 3. Priority Order

1. **Complete one verified Night Protocol 001 production loop.**
2. **Close the v0.5 Ableton reliability gate.**
3. **Convert the Night production lessons into reusable composition modules.**
4. **Create Midday System 001 and Morning Transmission 001 as distinct reference SongPlans.**
5. **Reduce operation to a clear non-developer workflow.**
6. **Prepare the catalogue, visual system, rights records, and release package.**

## 4. Phase 0 — Activation and Audit

Status: **SUBSTANTIALLY COMPLETE / EVIDENCE CLEANUP OPEN**

Completed or source-documented:

- Command coverage inventory.
- Max receiver parity review.
- Preflight diagnostics.
- Windows repair-manifest improvements.
- Deterministic smoke-test assets.
- Known limitation tracking.
- Sprint and roadmap records.

Still required:

- [ ] Run the complete automated test suite on the supported Windows/Python environment.
- [ ] Record the exact test command, environment, and results.
- [ ] Classify every supported command as runtime-verified, dry-run verified, implemented-unverified, missing, or deferred.
- [ ] Consolidate release evidence into one indexed location.

## 5. Phase 1 — Reliable Ableton Device

Release target: **v0.5**  
Status: **ACTIVE IN PARALLEL**

### Product objective

A new user can install the bridge, load the receiver, execute a validated sequence, and confirm the result without editing source files.

### Receiver packaging

- [ ] Preserve the current working `.amxd` as the baseline.
- [ ] Inspect freeze state, JavaScript embedding, paths, dependencies, and version metadata.
- [ ] Build a versioned `AI Control Bridge Receiver.amxd` inside a compatible Max for Live environment.
- [ ] Reopen the packaged device in Ableton Live 11.
- [ ] Verify protocol and device version reporting.

Owner: **Ultron**  
Musical workflow review: **Venom**

### End-to-end verification

- [x] Create deterministic smoke-test and production SongPlans.
- [ ] Execute Night Protocol 001 using sequential ACK mode.
- [ ] Verify tempo, scenes, tracks, clips, notes, names, colors, volume, and pan.
- [ ] Confirm the receiver track is not moved, renamed, or deleted.
- [ ] Complete the smoke test twice without manual repair.
- [ ] Record expected versus observed state.
- [ ] Publish recovery instructions for interrupted or partial execution.

Evidence owner: **Bane**

### Installation usability

- [x] Reduce Windows setup to one primary documented path.
- [x] Add configuration, port, token, and health diagnostics.
- [x] Add launcher source and Windows build workflow.
- [ ] Compile and runtime-test the launcher executable on Windows.
- [ ] Verify a clean installation from an unconfigured Windows environment.

### v0.5 release gate

- [ ] Packaged `.amxd` rebuilt and tested.
- [ ] Clean Windows installation verified.
- [ ] Smoke test completed twice without manual repair.
- [x] No undocumented destructive command in the Night Protocol plan.
- [ ] Recovery and backup instructions runtime-validated.

## 6. Phase 2 — DARKSCO Composition Engine

Release target: **v0.6**  
Status: **ACTIVE**

### Product objective

Convert a musical brief into a coherent, editable Ableton session plan with explicit structure, references, validation, review checkpoints, and rights metadata.

### SongPlan schema

- [x] Version the SongPlan schema as `darksco.song-plan/1.0`.
- [x] Add project metadata and creative intent references.
- [x] Add state classification for Night.
- [x] Preserve explicit stable track references.
- [x] Add rights and source placeholders.
- [ ] Add Morning, Noon, and bridge classifications as tested reference plans.
- [ ] Add arrangement roles: opener, builder, transition, peak, reset, descent, closer.
- [ ] Add deterministic seeds or generation records where generation occurs.

Owner: **Venom**  
Rights review: **Thanos**

### Musical intelligence

- [ ] Add reusable rhythm modules.
- [ ] Add reusable bass modules.
- [ ] Add reusable motif and harmony modules.
- [ ] Add reusable atmosphere and texture modules.
- [x] Define the first reusable transition grammar from Night Protocol 001.
- [x] Define 4-, 8-, and 16-bar microvariation rules.
- [ ] Encode transition and variation modules in machine-readable form.
- [ ] Add density, velocity, register, repetition, and low-end constraints.
- [ ] Add state-specific production profiles for Morning, Noon, and Night.
- [ ] Generate a musical quality report before compilation.

Owner: **Venom**  
Technical implementation: **Ultron**

### Safe execution planning

- [x] Generate a human-readable production plan before execution.
- [x] Show expected command scope and destructive-action status.
- [x] Validate every generated command before execution.
- [ ] Support explicit pause, resume, and abort states.
- [ ] Persist resumable execution checkpoints.
- [ ] Preserve an immutable execution evidence record.

Owner: **Darkside**  
Evidence: **Bane**

### v0.6 release gate

- [x] Night reference SongPlan compiles successfully.
- [ ] Midday reference SongPlan compiles successfully.
- [ ] Morning reference SongPlan compiles successfully.
- [ ] Each state produces a structurally distinct result.
- [x] Night generated commands validate before execution.
- [ ] Session creation can resume after interruption.
- [ ] Rights and generation metadata are retained through the full production loop.

## 7. Phase 3 — Operator Experience

Release target: **v0.7**  
Status: **EARLY FOUNDATION**

- [x] Add a simple Windows launcher source.
- [x] Display bridge and receiver readiness states.
- [ ] Compile and test the launcher executable on Windows.
- [ ] Load and inspect SongPlans from the operator interface.
- [ ] Display approval queue and high-impact warnings.
- [ ] Show execution progress and ACK state.
- [ ] Provide pause, resume, abort, and retry controls.
- [ ] Export structured logs and evidence.
- [ ] Preserve CLI parity.

Owner: **Hela**  
Technical routing: **Ultron and Darkside**  
Workflow validation: **Venom**

## 8. Phase 4 — Agent and MCP Layer

Release target: **v0.8**  
Status: **PLANNED**

- [ ] Define stable read, planning, validation, and execution tools.
- [ ] Require confirmation for destructive or irreversible operations.
- [ ] Inspect session state before planning.
- [ ] Add idempotency keys and duplicate-action protection.
- [ ] Add scoped tokens and command allowlists.
- [ ] Add structured errors suitable for agent recovery.
- [ ] Add Venom and Darkside reference workflows.

## 9. Phase 5 — Production Catalogue Pilot

Release target: **v0.9**  
Status: **STARTED EARLY TO VALIDATE THE SYSTEM**

### Pilot catalogue

- [ ] Morning Transmission 001.
- [ ] Midday System 001.
- [~] Night Protocol 001 — source package complete; Ableton production and review pending.
- [ ] Complete Daily Cycle 001.

### Night Protocol 001 records

- [x] Source brief.
- [x] Versioned SongPlan.
- [x] Command builder and source validation record.
- [x] Transition and microvariation plan.
- [x] Production review checklist.
- [ ] Verified Ableton project.
- [ ] Arrangement View production version.
- [ ] Review WAV.
- [ ] Exported stems.
- [ ] Mix and master versions.
- [ ] Complete rights and sample record.
- [ ] Visual concept and source records.
- [ ] Release metadata.
- [ ] Venom approval and Doom quality-gate decision.

## 10. Phase 6 — v1.0 Product Readiness

Release target: **v1.0**  
Status: **PLANNED**

Requirements remain:

- Supported-platform matrix.
- Installable Max for Live device.
- Stable versioned protocol and SongPlan schema.
- Automated and documented Ableton runtime tests.
- Local operator interface.
- MCP tool layer.
- Audit logs and recovery procedures.
- Security and token documentation.
- Licensing and contributor records.
- Four completed pilot releases.
- Release notes, migration notes, and known limitations.

## 11. Current Sprint — Sprint 002

Duration: **7 days**  
Objective: **complete the first Night Protocol production loop and extract reusable composition rules without weakening the v0.5 reliability gate.**

| ID | Owner | Task | Completion evidence |
|---|---|---|---|
| S2-01 | Ultron | Execute Night Protocol 001 in a disposable Ableton Set | ACK log and observed-state record |
| S2-02 | Venom | Implement five transitions and the signature event | Arrangement v0.3 and review WAV |
| S2-03 | Venom | Assign deliberate sounds to all eight production tracks | Production v0.2 Ableton Set |
| S2-04 | Bane | Record runtime metrics and structured listening notes | Completed review checklist and comparison report |
| S2-05 | Hela | Define the Night Protocol visual environment and transition map | Visual direction document |
| S2-06 | Thanos | Complete sample, device, and contributor provenance | Rights record with no unknown sources |
| S2-07 | Loki | Establish versioned production folders and release metadata shell | Indexed production package |
| S2-08 | Ultron | Inspect the current `.amxd` baseline when provided | Dependency, freeze-state, and compatibility report |
| S2-09 | Darkside | Encode reusable transition and variation modules | Module specification linked to Night evidence |
| S2-10 | Doom | Review the first production WAV | GO, REVISE, DELAY, or REJECT decision |

### Sprint 002 exit gate

Sprint 002 passes when:

- Night Protocol executes successfully in Ableton with complete ACK evidence.
- The receiver track remains untouched.
- Five transitions and the signature event are implemented.
- A review WAV is exported.
- Rights and source records contain no unknown material.
- Reusable transition and variation rules are documented.
- Venom completes a listening review.
- Doom records a formal decision.

## 12. Definition of Done

A task is done only when:

- The output exists in the repository or indexed evidence location.
- The result is verified at the correct evidence level.
- Documentation and known limitations are updated.
- The responsible owner approves the result.
- Required tests pass.
- A follow-up owner is assigned when work remains.

Source implementation is not equivalent to Ableton runtime verification. A generated SongPlan is not equivalent to a finished track.

## 13. Change Control

- Darkside maintains execution status and dependencies.
- Doom approves changes to phase objectives and release gates.
- Specialists may revise tasks inside their domain without changing strategic scope.
- Rights, destructive behavior, compatibility, and public promises require explicit review.
- Completed work must be committed with scoped messages and evidence references.
