import type {
  BridgeCommand,
  BridgeHealth,
  CommandsResponse,
  CommandResponse,
  CommandStatus,
} from "./types";

// Always go through the Next.js server-side proxy so the browser never
// needs a direct connection to localhost:8765 (CORS / network isolation).
// The proxy forwards requests to BRIDGE_URL (default http://127.0.0.1:8765).
const BRIDGE_BASE = "/api/bridge";

function bridgeHeaders(token?: string): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  const t = token ?? (typeof window !== "undefined" ? localStorage.getItem("bridgeToken") : null);
  if (t) h["X-Bridge-Token"] = t;
  return h;
}

export async function fetchHealth(token?: string): Promise<BridgeHealth> {
  const res = await fetch(`${BRIDGE_BASE}/health`, {
    headers: bridgeHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function fetchCommands(
  opts: { status?: CommandStatus; limit?: number; token?: string } = {}
): Promise<BridgeCommand[]> {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  params.set("limit", String(opts.limit ?? 200));
  const res = await fetch(`${BRIDGE_BASE}/api/commands?${params}`, {
    headers: bridgeHeaders(opts.token),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Failed to fetch commands");
  }
  const data: CommandsResponse = await res.json();
  return data.commands;
}

export async function approveCommand(id: string, token?: string): Promise<BridgeCommand> {
  const res = await fetch(`${BRIDGE_BASE}/api/commands/${id}/approve`, {
    method: "POST",
    headers: bridgeHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Approve failed");
  }
  const data: CommandResponse = await res.json();
  return data.command;
}

export async function rejectCommand(id: string, token?: string): Promise<BridgeCommand> {
  const res = await fetch(`${BRIDGE_BASE}/api/commands/${id}/reject`, {
    method: "POST",
    headers: bridgeHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Reject failed");
  }
  const data: CommandResponse = await res.json();
  return data.command;
}

export async function undoCommand(id: string, token?: string): Promise<BridgeCommand> {
  const res = await fetch(`${BRIDGE_BASE}/api/commands/${id}/undo`, {
    method: "POST",
    headers: bridgeHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Undo failed");
  }
  const data: CommandResponse = await res.json();
  return data.command;
}
