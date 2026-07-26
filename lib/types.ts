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
