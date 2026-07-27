-- DARKSCO Agent Operations Schema

-- Workflows table: tracks release projects through the agent pipeline
CREATE TABLE IF NOT EXISTS public.darksco_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL UNIQUE,
  objective TEXT NOT NULL,
  deadline TIMESTAMP NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in-progress', 'blocked', 'complete')),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  completed_at TIMESTAMP
);

-- Agent responses table: shared protocol responses from each agent operation
CREATE TABLE IF NOT EXISTS public.agent_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.darksco_workflows(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  facts TEXT[] DEFAULT '{}',
  findings TEXT[] DEFAULT '{}',
  decision TEXT,
  recommendation TEXT,
  actions JSONB DEFAULT '[]',
  risks TEXT[] DEFAULT '{}',
  blockers TEXT[] DEFAULT '{}',
  next_agent TEXT,
  required_input TEXT,
  responded_at TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, agent_id)
);

-- Quality gates table: tracks mandatory approval checks
CREATE TABLE IF NOT EXISTS public.quality_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.darksco_workflows(id) ON DELETE CASCADE,
  gate_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'passed', 'failed')),
  required_by_agent TEXT,
  checked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Escalations table: tracks when work goes to Doom for resolution
CREATE TABLE IF NOT EXISTS public.escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.darksco_workflows(id) ON DELETE CASCADE,
  escalated_from_agent TEXT NOT NULL,
  reason TEXT NOT NULL,
  decision_needed TEXT,
  doom_decision TEXT,
  doom_status TEXT CHECK (doom_status IN ('PENDING', 'APPROVED', 'REVISE', 'DELAY', 'REJECT')),
  escalated_at TIMESTAMP NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Audit trail table: all workflow state changes for compliance
CREATE TABLE IF NOT EXISTS public.workflow_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.darksco_workflows(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  agent_id TEXT,
  action TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.darksco_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all authenticated users to read and manage workflows
CREATE POLICY "workflows_select" ON public.darksco_workflows FOR SELECT USING (true);
CREATE POLICY "workflows_insert" ON public.darksco_workflows FOR INSERT WITH CHECK (true);
CREATE POLICY "workflows_update" ON public.darksco_workflows FOR UPDATE USING (true);

CREATE POLICY "responses_select" ON public.agent_responses FOR SELECT USING (true);
CREATE POLICY "responses_insert" ON public.agent_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "responses_update" ON public.agent_responses FOR UPDATE USING (true);

CREATE POLICY "gates_select" ON public.quality_gates FOR SELECT USING (true);
CREATE POLICY "gates_insert" ON public.quality_gates FOR INSERT WITH CHECK (true);
CREATE POLICY "gates_update" ON public.quality_gates FOR UPDATE USING (true);

CREATE POLICY "escalations_select" ON public.escalations FOR SELECT USING (true);
CREATE POLICY "escalations_insert" ON public.escalations FOR INSERT WITH CHECK (true);
CREATE POLICY "escalations_update" ON public.escalations FOR UPDATE USING (true);

CREATE POLICY "audit_select" ON public.workflow_audit FOR SELECT USING (true);
CREATE POLICY "audit_insert" ON public.workflow_audit FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS workflows_status_idx ON public.darksco_workflows(status);
CREATE INDEX IF NOT EXISTS workflows_project_idx ON public.darksco_workflows(project_id);
CREATE INDEX IF NOT EXISTS responses_workflow_agent_idx ON public.agent_responses(workflow_id, agent_id);
CREATE INDEX IF NOT EXISTS gates_workflow_idx ON public.quality_gates(workflow_id);
CREATE INDEX IF NOT EXISTS escalations_workflow_idx ON public.escalations(workflow_id);
CREATE INDEX IF NOT EXISTS audit_workflow_idx ON public.workflow_audit(workflow_id);
