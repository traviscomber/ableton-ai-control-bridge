# DARKSCO Agents Quick Reference

## Agent Responsibilities

```
┌─────────────────────────────────────────────────────────────────┐
│ DARKSIDE — Orchestrator                                         │
│ Routes work, maps dependencies, enforces sequence              │
└────────────┬────────────────────────────────────────────────────┘
             │
             ├─→ ┌────────────────────────────────┐
             │   │ VENOM — Music Officer          │
             │   │ Score tracks 1-100             │
             │   │ Approve/Revise/Reject          │
             │   │ Guarantee release quality      │
             │   └────────────┬───────────────────┘
             │                │
             ├────────────────┼──→ ┌──────────────────────────┐
             │                │    │ HELA — Visual Executive  │
             │                │    │ Validate DARKSCO design  │
             │                │    │ Reject generic imagery   │
             │                │    │ Verify rights/records    │
             │                │    └────────────┬─────────────┘
             │                │                 │
             │                └─────────────────┼──→ ┌─────────────────────┐
             │                                  │    │ LOKI — Publisher    │
             │                                  │    │ 10-point QA check   │
             │                                  │    │ Ready for premiere  │
             │                                  │    └────────────┬────────┘
             │                                  │                │
             ├──────────────────────────────────┼────────────────┼──→ ┌──────────────────┐
             │                                  │                │    │ BANE — Analytics │
             │                                  │                │    │ Validate data    │
             │                                  │                │    │ Design exp'ts    │
             │                                  │                │    └────────┬─────────┘
             │                                  │                │             │
             ├──────────────────────────────────┼──────────────────────────────┤
             │                                  │                              │
             │    ┌────────────────────────────────────────────────────────┐   │
             │    │ THANOS — Rights Officer                              │   │
             │    │ Verify ownership, samples, contributors              │   │
             │    │ Block if rights uncertain                            │   │
             │    └────────────────────────────────┬─────────────────────┘   │
             │                                     │                          │
             └──────────────────────────────────────┼──────────────────────────┤
                                                    │                          │
                                    ┌───────────────┴──────────────────┐      │
                                    │                                  │      │
                                    ↓                                  ↓      ↓
                            ┌────────────────────────────────────────────────────┐
                            │ DOOM — Strategic Director                          │
                            │ All gates must pass. Quality > Frequency.          │
                            │ Identity > Trends. Rights > Speed.                 │
                            └─────────────────────────────────────────────────────┘
```

## Quality Gates

| Gate | Agent | Status | Criteria |
|------|-------|--------|----------|
| Music | Venom | APPROVE | Score ≥80, NO gaps |
| Visual | Hela | APPROVE | DARKSCO continuity, NO generic imagery |
| Publishing | Loki | READY | 10/10 QA checks passed |
| Analytics | Bane | VALID SIGNAL | HIGH/MEDIUM confidence |
| Rights | Thanos | COMMERCIAL READY | All ownership verified |
| Strategy | Doom | APPROVED | All 5 gates above passed |

## Agent Status Values

### Venom (Music)
- `APPROVE` — Release-ready music
- `REVISE` — Fixable issues identified
- `REJECT` — Below quality threshold

### Hela (Visual)
- `APPROVE` — DARKSCO identity preserved
- `REVISE` — Specific fixes needed
- `REJECT` — Generic/cliché assets

### Loki (Publishing)
- `READY` — All QA checks passed
- `BLOCKED` — QA failures prevent publication
- `PUBLISHED` — Live on YouTube (post-execution)

### Bane (Analytics)
- `VALID SIGNAL` — Data complete, experiments ready
- `INCONCLUSIVE` — Incomplete data
- `ACTION REQUIRED` — Critical gaps

### Thanos (Rights)
- `COMMERCIAL READY` — All rights verified
- `BLOCKED` — Uncertain ownership
- `NEEDS DECISION` — Escalate to Doom

### Doom (Strategy)
- `APPROVED` — All gates passed, execute
- `REVISE` — Fixable blockers, coordinate
- `REJECT` — Unresolvable issues, escalate

### Darkside (Orchestration)
- `ACTIVE` — Orchestrating workflow
- `BLOCKED` — Waiting on blocked agents
- `COMPLETE` — Release executed

---

## How to Invoke

```typescript
// POST /api/darksco/agents
{
  "workflow_id": "workflow-uuid",
  "agent_id": "venom",  // | "hela" | "loki" | "bane" | "thanos" | "doom" | "darkside"
  "operation_data": {
    // Agent-specific data (see section below)
  }
}
```

### Venom Input
```json
{
  "tracks": [{ "name", "darksco_identity", "headroom_db", "frequency_balance", "arrangement_clarity", "emotional_depth", "originality_rating", "session_function", "catalogue_placement", "licensing_ready" }],
  "sessions": [],
  "catalogue_state": "morning|noon|night"
}
```

### Hela Input
```json
{
  "music_direction": "energy curve, duration, narrative",
  "approved_assets": [{ "name", "classification", "tags", "source_record", "rights_verified", "has_motion", "motion_language_aligned", "format", "legible_at_small_scale" }],
  "visual_system": "DARKSCO continuity"
}
```

### Loki Input
```json
{
  "metadata": { "title", "description", "chapters", "rights_status", "end_screens" },
  "audio_file": { "format", "duration" },
  "video_file": { "format", "resolution", "thumbnail_path" },
  "captions": [],
  "credits": [],
  "playlist": { "name", "position" },
  "premiere_schedule": { "timestamp" }
}
```

### Bane Input
```json
{
  "baseline_metrics": { "impressions", "click_through_rate", "retention_30sec", "average_view_duration", "returning_viewers", "subscriber_acquisition" },
  "comparison_cohorts": [],
  "experiment_hypothesis": { "variable", "control", "test", "duration_days", "success_metric" },
  "release_data": { "age_days" }
}
```

### Thanos Input
```json
{
  "rights_records": { "master_ownership", "composition_ownership", "samples", "visual_assets", "contributors", "metadata_complete" },
  "contributors": [{ "name", "role_documented", "compensation_agreed" }],
  "samples": [{ "source", "license_verified" }],
  "visual_rights": [{ "source", "rights_verified" }],
  "master_rights": { "ownership" },
  "licensing_offers": []
}
```

### Doom Input
```json
{
  // Uses previousResponses from all agents
  // Consolidates all decisions
}
```

### Darkside Input
```json
{
  "objective": "release name and description",
  "deadline": "ISO date",
  "constraints": [],
  "available_inputs": []
}
```

---

## Decision Rules

### Never Approve Unless:
- **Venom**: Track score ≥80 AND catalogue strengthened
- **Hela**: DARKSCO continuity preserved AND no generic imagery
- **Loki**: All 10 QA checks pass
- **Bane**: Data completeness ≥65% OR experiment design valid
- **Thanos**: All rights verified, no ownership uncertainty
- **Doom**: All 5 agents above approved

### Always Block When:
- **Venom**: Any rejected track in proposal
- **Hela**: Generic/cliché/AI imagery detected
- **Loki**: Any QA check fails
- **Bane**: Data collection window too short (<3 days)
- **Thanos**: Any rights uncertainty detected
- **Doom**: Any mandatory gate fails

### Escalate to Doom When:
- **Any Agent**: Conflicting recommendations between agents
- **Any Agent**: Rights or brand risk detected
- **Any Agent**: Multiple revision cycles needed
- **Any Agent**: Exclusivity or ownership transfer required
- **Any Agent**: Unresolvable blocker

---

## Success Metrics

| Agent | Success |
|-------|---------|
| Venom | Track approved (≥80 score, catalog strengthened) |
| Hela | Visual approved (continuity, rights cleared) |
| Loki | Published (10/10 QA, premiere live) |
| Bane | Experiment running (hypothesis tested, baseline set) |
| Thanos | Commercial ready (all rights verified, offers ranked) |
| Doom | Released (all gates passed, measurement begins) |
| Darkside | Executed (release live, next workflow triggered) |

---

## Response Format (All Agents)

```json
{
  "status": "APPROVE|REVISE|REJECT|READY|VALID SIGNAL|COMMERCIAL READY|APPROVED|ACTIVE",
  "confidence": "HIGH|MEDIUM|LOW",
  "facts": ["fact1", "fact2"],
  "findings": ["finding1", "finding2"],
  "decision": "clear decision statement",
  "recommendation": "primary action",
  "actions": [
    {
      "owner": "agent-id",
      "description": "specific action",
      "deadline": "ISO date",
      "successMetric": "measurable outcome"
    }
  ],
  "risks": ["risk1", "risk2"],
  "blockers": ["blocker1", "blocker2"],
  "nextAgent": "next-agent-id"
}
```

---

## Example Workflow

1. **User**: "@Darkside Prepare Night Protocol 002 for release by Friday"

2. **Darkside**: Analyzes objective → determines Venom, Hela, Loki, Bane, Thanos, Doom required → creates execution plan

3. **Venom**: Scores all tracks 1-100 → rejects weak material → approves 3 tracks ≥80 score

4. **Hela**: Validates night palette (subterranean, machinery, plasma light) → approves visual continuity

5. **Loki**: Runs 10-point QA → all checks pass → marks READY

6. **Bane**: Establishes baseline metrics → experiment hypothesis valid → confidence HIGH

7. **Thanos**: Verifies all master/composition rights → all contributors documented → COMMERCIAL READY

8. **Doom**: All gates passed → APPROVED for release

9. **Darkside**: Routes to publishing team, measurement begins, assigns owners, deadlines

10. **Release**: Night Protocol 002 goes live with measurement tracking active

---

## Production Checklist

- ✓ All 7 agents implemented
- ✓ Quality gates enforced
- ✓ API routes functional
- ✓ Database schema complete
- ✓ Type safety verified
- ✓ Build passing (zero errors)
- ✓ Ready for UI integration
- ✓ Ready for music data ingestion

**Commit**: `a144cd8`  
**Date**: July 27, 2026
