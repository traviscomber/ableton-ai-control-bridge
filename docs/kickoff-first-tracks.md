# DARKSCO First Tracks Kickoff

Date: 2026-07-26  
Status: **KICKED OFF**  
Orchestrator: **Darkside**  
Final authority: **Doom**

## Objective

Produce the first three DARKSCO release-candidate tracks through the working Ableton Live 11 control pipeline:

1. **Morning Transmission 001** — Intelligent Chill
2. **Midday System 001** — Minimal Techno
3. **Night Protocol 001** — Dark Techno

The sprint succeeds when all three tracks exist as editable Ableton projects with documented source briefs, validated SongPlans, reproducible execution records, mix-review exports, rights metadata, and a clear GO/REVISE/REJECT decision.

## Strategic decision — Doom

**GO with a focused three-track production sprint.**

Do not wait for the future operator dashboard, MCP layer, or rebuilt `.amxd` before beginning composition. The user has confirmed the current Ableton setup is working. Device inspection and rebuilding remain a parallel hardening workstream when the `.amxd` is supplied.

Priority order:

1. Create one strong Night reference track first.
2. Convert lessons from that session into reusable production modules.
3. Produce Noon and Morning as distinct states of the same universe.
4. Select release candidates only after comparative review.

## Team decisions

### Darkside — orchestration

- Maintain one production board and dependency order.
- Keep infrastructure work subordinate to track completion.
- Record blockers without stopping unaffected workstreams.
- Consolidate all specialist decisions into a single readiness gate.

### Venom — music director

- Own briefs, SongPlans, arrangement, sound identity, and mix readiness.
- Begin with **Night Protocol 001** because the current bridge examples and sonic direction are closest to dark/minimal techno.
- Enforce state distinction:
  - Morning: spacious, evolving, intelligent, restrained.
  - Noon: precise, architectural, hypnotic, controlled.
  - Night: physical, cinematic, industrial, disciplined.
- Reject technically complete but musically generic material.

### Ultron — Ableton systems engineer

- Preserve the current working Live 11 setup.
- Validate each generated JSONL before execution.
- Use ACK sequencing for production runs.
- Capture execution failures and recovery steps.
- Inspect and rebuild the user-provided `.amxd` later without blocking composition.

### Hela — visual director

- Create one visual direction sheet per state.
- Define a shared material, typography, symbol, and motion language.
- Prepare cover and video-frame concepts only after the music reaches arrangement lock.
- Avoid generic cyberpunk, random AI imagery, and unrelated visual styles.

### Loki — publishing and release operations

- Maintain track naming, version labels, metadata, and release-package structure.
- Prepare working titles, descriptions, credits, and export checklists.
- Do not schedule a public release before Doom approves a final master and rights package.

### Bane — evidence and analytics

- Define production metrics that improve decisions rather than reward volume.
- Track iteration count, completion time, failed commands, manual repairs, and quality-gate outcomes.
- Establish a blind comparative review template for the three candidates.

### Thanos — rights and commercial readiness

- Require source, sample, plugin, contributor, and AI-assistance records for each track.
- Block release when ownership or sample rights are unclear.
- Prepare licensing-ready metadata only after the musical candidate passes review.

## Production sequence

### Stage 1 — Night Protocol 001

Target: first full arrangement candidate.

Required outputs:

- Creative brief
- Versioned SongPlan
- Validated JSONL
- Ableton Live Set
- Execution log
- Rough stereo export
- Stems or grouped exports
- Musical review notes
- Rights/provenance record

Initial musical constraints:

- Tempo range: 132–140 BPM
- Length target: 5–7 minutes
- Minimal memorable motif
- Controlled industrial percussion
- Deep but disciplined low end
- At least three meaningful energy states
- One major negative-space or scale event
- No unlicensed samples

### Stage 2 — Midday System 001

Target: structurally precise and functionally hypnotic without copying Night.

Initial musical constraints:

- Tempo range: 124–132 BPM
- Length target: 5–7 minutes
- Reduced arrangement with continuous microvariation
- Architectural percussion and controlled bass movement
- Long transitions and no unnecessary melodic density

### Stage 3 — Morning Transmission 001

Target: intelligent and spacious without becoming generic ambient music.

Initial musical constraints:

- Tempo range: 88–116 BPM
- Length target: 5–8 minutes
- Organic-machine texture relationship
- Evolving harmonic environment
- Restrained motif and detailed spatial movement
- Calm energy with an identifiable structural arc

## Quality gates

Each track must pass these gates in order:

1. **Brief gate** — intent, state, tempo, structure, and constraints are explicit.
2. **Plan gate** — SongPlan validates and has no undocumented destructive actions.
3. **Execution gate** — commands complete with ACK evidence or documented recovery.
4. **Arrangement gate** — full beginning-to-end structure exists.
5. **Music gate** — Venom marks GO or bounded REVISE.
6. **Technical gate** — no clipping, broken routing, missing devices, or unresolved dependencies.
7. **Rights gate** — Thanos confirms provenance is sufficient.
8. **Visual gate** — Hela confirms the visual concept belongs to the same universe.
9. **Release gate** — Doom decides GO, REVISE, DELAY, or REJECT.

## Sprint 002 — First Track Production

Duration: 7 production days from the first Ableton session.

| ID | Owner | Task | Completion evidence |
|---|---|---|---|
| S2-01 | Venom | Write the Night Protocol 001 creative brief | Approved brief with tempo, structure, palette, and exclusions |
| S2-02 | Venom | Produce versioned Night SongPlan | Schema-valid plan and human-readable arrangement |
| S2-03 | Ultron | Validate and execute the Night JSONL safely | Validation output, ACK log, and recovery record |
| S2-04 | Venom | Complete the first full arrangement | Ableton Set and rough stereo export |
| S2-05 | Bane | Create production evidence sheet | Metrics and issue log for the session |
| S2-06 | Thanos | Create track provenance record | Sources, samples, plugins, contributors, and AI assistance documented |
| S2-07 | Hela | Create Night visual direction sheet | Approved visual references and constraints |
| S2-08 | Loki | Create release working package | Naming, versions, metadata shell, and export checklist |
| S2-09 | Doom | Review first arrangement candidate | GO, REVISE, DELAY, or REJECT decision |
| S2-10 | Darkside | Convert lessons into Noon/Morning backlog | Prioritized reusable modules and corrections |

## Working file structure

Use this structure for each track:

```text
production/
  night-protocol-001/
    brief.md
    songplan.json
    commands.jsonl
    evidence/
    rights/
    exports/
    visuals/
```

Equivalent folders should be created for `midday-system-001` and `morning-transmission-001` when their production starts.

Do not commit proprietary audio, licensed samples, or large Ableton project assets unless repository storage and rights policy explicitly permit them. Use manifests and external evidence locations where necessary.

## Current blockers

- The actual user `.amxd` has not yet been supplied for packaging inspection.
- No Ableton runtime evidence has been captured in the repository for the new smoke sequence.
- The final sound palette and available plugins on the production machine are not yet inventoried.

These do not block writing the first brief, SongPlan, command sequence, or production record templates.

## Immediate next action

Venom prepares `production/night-protocol-001/brief.md`. Darkside then converts the approved brief into the first production task sequence, and Ultron validates the generated commands before they are sent to Ableton.
