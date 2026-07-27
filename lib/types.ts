// ────────────────────────────────────────────────────────────────────────────
// Bridge types — mirrors Python BridgeState / CommandStore records
// ────────────────────────────────────────────────────────────────────────────

export type CommandStatus =
  | "pending"
  | "accepted"
  | "sent"
  | "acknowledged"
  | "rejected"
  | "error"
  | "simulated";

export interface BridgeCommand {
  id: string;
  command_type: string;
  payload: Record<string, unknown>;
  status: CommandStatus;
  source: string;
  created_at: string;
  updated_at: string;
  result?: Record<string, unknown> | null;
  error?: string | null;
  undo_of?: string | null;
}

export interface BridgeHealth {
  ok: boolean;
  version: string;
  dry_run: boolean;
  approval_required: boolean;
  authentication_required: boolean;
  allowed_commands: string[];
  udp_target: string;
  ack_listener: string;
  max_receiver_seen: boolean;
  last_ack_at: string | null;
}

export interface CommandsResponse {
  ok: boolean;
  commands: BridgeCommand[];
}

export interface CommandResponse {
  ok: boolean;
  command: BridgeCommand;
}

export interface ErrorResponse {
  ok: false;
  error: string;
}

// ────────────────────────────────────────────────────────────────────────────
// DARKSCO agent types
// ────────────────────────────────────────────────────────────────────────────

export type AgentId =
  | "darkside"
  | "doom"
  | "venom"
  | "hela"
  | "loki"
  | "bane"
  | "thanos";

export type AgentStatus = "READY" | "BLOCKED" | "ACTIVE" | "PENDING" | "DONE" | "IDLE";

export type AgentConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface AgentDecision {
  status: AgentStatus;
  confidence: AgentConfidence;
  summary: string;
  actions?: string[];
  blockers?: string[];
  updatedAt: string;
}

export interface Agent {
  id: AgentId;
  name: string;
  role: string;
  authority: string;
  color: string;
  decision?: AgentDecision;
}

export type QualityGateKey =
  | "music"
  | "visual"
  | "publishing"
  | "evidence"
  | "rights"
  | "doom_approval";

export interface QualityGate {
  key: QualityGateKey;
  label: string;
  owner: AgentId;
  passed: boolean;
  blockedReason?: string;
}

export type ReleaseStatus = "in-progress" | "blocked" | "ready" | "released";

export interface DarkscoProject {
  id: string;
  name: string;
  version: string;
  status: ReleaseStatus;
  bpm?: number;
  duration?: string;
  createdAt: string;
  updatedAt: string;
  gates: QualityGate[];
  agents: Partial<Record<AgentId, AgentDecision>>;
}

export interface CatalogueTrack {
  id: string;
  name: string;
  version: string;
  bpm: number;
  duration: string;
  status: ReleaseStatus;
  releasedAt?: string;
  tags: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// DARKSCO Shared Agent Protocol — all agents use this output format
// ────────────────────────────────────────────────────────────────────────────

export type SharedProtocolStatus =
  // Darkside statuses
  | "ACTIVE"
  | "BLOCKED"
  | "COMPLETE"
  // Doom statuses
  | "APPROVED"
  | "REVISE"
  | "DELAY"
  | "REJECT"
  // Venom statuses
  | "APPROVE"
  | "REVISE"
  | "REJECT"
  // Hela statuses
  | "APPROVE"
  | "REVISE"
  | "REJECT"
  // Loki statuses
  | "READY"
  | "BLOCKED"
  | "PUBLISHED"
  // Bane statuses
  | "VALID SIGNAL"
  | "INCONCLUSIVE"
  | "ACTION REQUIRED"
  // Thanos statuses
  | "COMMERCIAL READY"
  | "BLOCKED"
  | "NEEDS DECISION";

export interface AgentAction {
  owner: AgentId;
  description: string;
  deadline?: string;
  successMetric: string;
}

export interface AgentResponse {
  agentId: AgentId;
  status: SharedProtocolStatus;
  confidence: AgentConfidence;
  facts?: string[];
  findings?: string[];
  material?: string;
  decision?: string;
  recommendation?: string;
  sequence?: AgentAction[];
  revision?: AgentAction[];
  actions: AgentAction[];
  risks?: string[];
  blockers?: string[];
  gaps?: string[];
  nextAgent?: AgentId;
  requiredInput?: string;
  respondedAt: string;
}

export interface DarkscoWorkflow {
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
  completedAt?: string;
}
