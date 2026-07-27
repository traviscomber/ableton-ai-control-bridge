# DARKSCO Agents Integration — Operations & Workflow

**Status**: Agents codex synced to UI types and components  
**Updated**: 2026-07-27

---

## Overview

The DARKSCO executive agent team has been fully integrated into the web interface. Each of the 7 agents now operates according to their defined domain expertise using a shared protocol format.

### Agent Team

| Agent | Authority | Domain | UI Component |
|-------|-----------|--------|--------------|
| **Darkside** | Orchestrator | Task routing, execution planning | Orchestration board |
| **Doom** | Strategic Director | Final approval, priorities | Decision gate |
| **Venom** | Music Officer | Sonic identity, track scoring | Music approval card |
| **Hela** | Design Officer | Visual identity, art direction | Visual approval card |
| **Loki** | Publishing Officer | YouTube ops, metadata, releases | Publishing card |
| **Bane** | Intelligence Officer | Analytics, experiments, forecasts | Analytics card |
| **Thanos** | Business Officer | Rights, licensing, revenue | Commercial card |

---

## Shared Protocol Format

All agents respond using this unified output structure (types defined in `lib/types.ts`):

```typescript
interface AgentResponse {
  agentId: AgentId;                    // darkside | doom | venom | hela | loki | bane | thanos
  status: SharedProtocolStatus;        // Agent-specific (APPROVE, BLOCKED, READY, etc.)
  confidence: AgentConfidence;         // HIGH | MEDIUM | LOW
  facts?: string[];                    // Key evidence or observations
  decision?: string;                   // Decision recommendation
  actions: AgentAction[];              // Work items with owner, deadline, metric
  risks?: string[];                    // Identified blockers or concerns
  blockers?: string[];                 // Specific stoppers
  nextAgent?: AgentId;                 // Who should act next
  requiredInput?: string;              // What's needed to proceed
  respondedAt: string;                 // ISO timestamp
}
```

### Agent-Specific Statuses

- **Darkside**: `ACTIVE | BLOCKED | COMPLETE`
- **Doom**: `APPROVED | REVISE | DELAY | REJECT`
- **Venom**: `APPROVE | REVISE | REJECT`
- **Hela**: `APPROVE | REVISE | REJECT`
- **Loki**: `READY | BLOCKED | PUBLISHED`
- **Bane**: `VALID SIGNAL | INCONCLUSIVE | ACTION REQUIRED`
- **Thanos**: `COMMERCIAL READY | BLOCKED | NEEDS DECISION`

---

## Default Workflow (Conditional Sequence)

The standard route for a full release:

```
User Brief
    ↓
@Darkside Scope & Plan
    → Returns PLAN with agent tasks, dependencies, blockers
    ↓
@Venom Review Music
    → APPROVE | REVISE | REJECT
    ↓
@Hela Create Visual Direction
    → APPROVE | REVISE | REJECT
    ↓
@Thanos Verify Rights & Commercial
    → COMMERCIAL READY | BLOCKED
    ↓
@Loki Prepare Publishing Package
    → READY | BLOCKED | PUBLISHED
    ↓
@Bane Establish Measurement
    → VALID SIGNAL | INCONCLUSIVE
    ↓
@Doom Final Decision
    → APPROVED | REVISE | DELAY | REJECT
    ↓
@Darkside Assign Execution & Track
```

**Key**: Darkside may skip agents if the task is narrow (e.g., music-only review goes directly to Venom).

---

## Quality Gates (Release Readiness)

A release advances to publication only when **all 6 mandatory gates pass**:

1. ✅ **Music Approved** — Venom status = `APPROVE`
2. ✅ **Visual Approved** — Hela status = `APPROVE`
3. ✅ **Publishing Ready** — Loki status = `READY`
4. ✅ **Evidence Valid** — Bane status = `VALID SIGNAL` or `INCONCLUSIVE` (not blocked)
5. ✅ **Rights Clear** — Thanos status = `COMMERCIAL READY`
6. ✅ **Doom Approval** — Doom status = `APPROVED`

**Blockers**: Any `BLOCKED`, `REJECT`, or `NEEDS DECISION` status halts release until resolved.

---

## UI Component Updates

### AgentCard Refactored

Enhanced to display and invoke agent operations:

```typescript
interface AgentCardProps {
  agent: Agent;                           // Agent metadata
  decision?: AgentDecision;               // Legacy decision (fallback)
  response?: AgentResponse;               // Shared protocol response
  onInvoke?: (agentId: AgentId) => void; // Invoke handler
  isLoading?: boolean;                    // Operation in progress
}
```

**Features**:
- Displays agent status badge with confidence level
- Shows facts, decision, actions, risks, and handoff chain
- Invoke button to trigger agent operation
- Next agent indicator (handoff trail)
- Timestamp of last response

### Example Usage

```tsx
<AgentCard
  agent={agents[0]} // Venom
  response={musicReview}
  onInvoke={handleAgentInvoke}
  isLoading={isProcessing}
/>
```

---

## Agent Operations Implementation Roadmap

### Phase 1: Backend Routes ✅ (Typed)
- [x] Type definitions: `AgentResponse`, `DarkscoWorkflow`, `SharedProtocolStatus`
- [ ] API routes: `/api/darksco/agents/[agent]/operate`
- [ ] Agent state storage (Supabase or file-based)
- [ ] Request validation per agent domain

### Phase 2: UI Integration (In Progress)
- [x] AgentCard component refactored for operations
- [ ] Darkside orchestration board
- [ ] Doom decision gate
- [ ] Venom music approval form
- [ ] Hela visual direction form
- [ ] Loki publishing checklist
- [ ] Bane analytics form
- [ ] Thanos commercial form

### Phase 3: Workflow Visualization
- [ ] Dependency graph (show agent sequence)
- [ ] Status pipeline (drag-drop task assignment)
- [ ] Escalation queue (unresolved decisions to Doom)
- [ ] Quality gate dashboard (6-check status)

### Phase 4: Agent Communication
- [ ] Decision history (all responses with reasoning)
- [ ] Evidence links (Bane analytics → Doom decision)
- [ ] Comments/threads between agents
- [ ] Revision loops (REVISE → re-invoke agent)

---

## Operating Principles (All Agents)

Every agent follows these mandatory rules:

1. **Act on evidence** — Distinguish facts, assumptions, hypotheses
2. **Minimize output** — Only required information for decision
3. **Own one domain** — No cross-domain duplication
4. **Escalate early** — Surface blockers, rights issues, quality failures immediately
5. **Prefer reversible actions** — Test before scaling when uncertain
6. **Protect quality** — Never trade identity, rights, or quality for speed
7. **Close the loop** — Every recommendation includes owner, deadline, success metric

---

## Integration Points

### Bridge Admin Integration
- Command approval queue now respects DARKSCO workflow
- History shows which agent approved/routed each command
- Health status visible to all agents

### Data Flow
```
DARKSCO Workflow
    → Quality gates (6 checks)
    → Agent operations
    → Shared protocol responses
    → Release decision
    → Bridge command execution (if music-related)
    → Bane measurement
    → Thanos revenue tracking
```

---

## Next Steps

1. **Implement agent operation endpoints**
   - POST `/api/darksco/agents/venom/operate` → Music review
   - POST `/api/darksco/agents/doom/operate` → Strategic decision
   - etc.

2. **Add operation forms to UI**
   - Music scoring (Venom)
   - Visual direction (Hela)
   - Publishing checklist (Loki)

3. **Build workflow dashboard**
   - Show active workflow state
   - Display agent queue
   - Track quality gates

4. **Enable decision persistence**
   - Store AgentResponse in database
   - Link to project/catalogue
   - Create audit trail

5. **Implement escalation**
   - Detect conflicts (two agents recommending opposite)
   - Route to Doom for resolution
   - Show decision rationale

---

## Type Reference

### Core Types

```typescript
type AgentId = "darkside" | "doom" | "venom" | "hela" | "loki" | "bane" | "thanos";

type AgentConfidence = "HIGH" | "MEDIUM" | "LOW";

interface AgentResponse {
  agentId: AgentId;
  status: SharedProtocolStatus;
  confidence: AgentConfidence;
  facts?: string[];
  decision?: string;
  actions: AgentAction[];
  risks?: string[];
  blockers?: string[];
  nextAgent?: AgentId;
  requiredInput?: string;
  respondedAt: string;
}

interface AgentAction {
  owner: AgentId;
  description: string;
  deadline?: string;
  successMetric: string;
}

interface DarkscoWorkflow {
  id: string;
  projectId: string;
  objective: string;
  deadline: string;
  status: "pending" | "in-progress" | "blocked" | "complete";
  plan?: AgentResponse; // Darkside plan
  agents: Partial<Record<AgentId, AgentResponse>>;
  qualityGates: QualityGate[];
  createdAt: string;
  updatedAt: string;
}
```

See `lib/types.ts` for complete type definitions.

---

## References

- **Shared Protocol**: `agents/shared-protocol.md`
- **Agent Specs**: `agents/[agent-name].md` (darkside, doom, venom, hela, loki, bane, thanos)
- **Type Definitions**: `lib/types.ts` (AgentResponse, DarkscoWorkflow, etc.)
- **UI Component**: `components/darksco/AgentCard.tsx`
