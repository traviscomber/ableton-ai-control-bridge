# Supabase Setup for DARKSCO Agent Operations

## Schema Creation

To set up the DARKSCO database schema in Supabase:

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `lib/db-schema.sql` into a new query
4. Execute the query

This will create all necessary tables:
- `darksco_workflows` — Release project pipelines
- `agent_responses` — Agent operation decisions using shared protocol
- `quality_gates` — 6 mandatory approval checks
- `escalations` — Conflicts escalated to Doom for resolution
- `workflow_audit` — Complete audit trail

## Environment Variables

Ensure these env vars are set in your project:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## API Endpoints

### Workflows

**GET `/api/darksco/workflows`**
- Lists all workflows

**POST `/api/darksco/workflows`**
- Create new workflow
- Body: `{ project_id, objective, deadline }`
- Initializes 6 quality gates automatically

### Agent Operations

**POST `/api/darksco/agents`**
- Invoke agent operation
- Body: `{ workflow_id, agent_id, operation_data }`
- Returns shared protocol response: `{ status, confidence, facts, decision, actions, risks, blockers, nextAgent, requiredInput }`

## Shared Protocol

All agents respond with this format:

```typescript
interface AgentResponse {
  agentId: string;
  status: SharedProtocolStatus; // Agent-specific enum
  confidence: "HIGH" | "MEDIUM" | "LOW";
  facts?: string[];
  findings?: string[];
  decision?: string;
  recommendation?: string;
  actions: AgentAction[];
  risks?: string[];
  blockers?: string[];
  nextAgent?: string;
  requiredInput?: string;
  respondedAt: string;
}
```

## Agent Statuses

- **Darkside** (Orchestrator): ACTIVE, BLOCKED, COMPLETE
- **Doom** (Strategic Director): APPROVED, REVISE, DELAY, REJECT
- **Venom** (Music Officer): APPROVE, REVISE, REJECT
- **Hela** (Visual Executive): APPROVE, REVISE, REJECT
- **Loki** (Publishing Officer): READY, BLOCKED, PUBLISHED
- **Bane** (Intelligence Officer): VALID SIGNAL, INCONCLUSIVE, ACTION REQUIRED
- **Thanos** (Business Officer): COMMERCIAL READY, BLOCKED, NEEDS DECISION

## Quality Gates (6 Mandatory)

1. **Music approved** — Venom approval
2. **Visual approved** — Hela approval
3. **Publishing ready** — Loki approval
4. **Evidence valid** — Bane approval
5. **Rights clear** — Thanos approval
6. **Final approval** — Doom approval

All gates must pass before release is authorized.

## Workflow Sequence

1. **Darkside** creates workflow and routes to first agent
2. **Venom** reviews music → approves or revises
3. **Hela** reviews visual → approves or escalates blockers
4. **Loki** validates publishing metadata
5. **Bane** establishes measurement framework
6. **Thanos** clears rights and licensing
7. **Doom** consolidates all decisions → final approve/revise/delay/reject

If any agent sets blockers, workflow escalates to Doom for conflict resolution.

## Testing

```bash
# Create a workflow
curl -X POST http://localhost:3000/api/darksco/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test-001",
    "objective": "Night Protocol 002 Release",
    "deadline": "2026-02-14T18:00:00Z"
  }'

# Get workflow ID from response, then invoke Venom
curl -X POST http://localhost:3000/api/darksco/agents \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "<workflow-id>",
    "agent_id": "venom"
  }'
```

All operations are logged in `workflow_audit` table for compliance.
