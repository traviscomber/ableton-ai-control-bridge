import type {
  BridgeCommand,
  BridgeHealth,
  CommandsResponse,
  CommandResponse,
  CommandStatus,
} from "./types";

// Call the bridge DIRECTLY from the browser at 127.0.0.1:8765.
// The v0 preview runs on Vercel — its server cannot reach your local machine.
// Only the browser tab (which IS on your machine) can reach localhost:8765.
// NEXT_PUBLIC_BRIDGE_URL lets you override this for other environments.
const BRIDGE_BASE =
  (typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_BRIDGE_URL
    : undefined) ?? "http://127.0.0.1:8765";

function bridgeHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

export async function sendCommand(payload: Record<string, unknown>): Promise<BridgeCommand> {
  const res = await fetch(`${BRIDGE_BASE}/command`, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Send command failed");
  }
  const data: CommandResponse = await res.json();
  return data.command;
}

export async function fetchHealth(): Promise<BridgeHealth> {
  const res = await fetch(`${BRIDGE_BASE}/health`, {
    headers: bridgeHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function fetchCommands(
  opts: { status?: CommandStatus; limit?: number } = {}
): Promise<BridgeCommand[]> {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  params.set("limit", String(opts.limit ?? 200));
  const res = await fetch(`${BRIDGE_BASE}/api/commands?${params}`, {
    headers: bridgeHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Failed to fetch commands");
  }
  const data: CommandsResponse = await res.json();
  return data.commands;
}

export async function approveCommand(id: string): Promise<BridgeCommand> {
  const res = await fetch(`${BRIDGE_BASE}/api/commands/${id}/approve`, {
    method: "POST",
    headers: bridgeHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Approve failed");
  }
  const data: CommandResponse = await res.json();
  return data.command;
}

export async function rejectCommand(id: string): Promise<BridgeCommand> {
  const res = await fetch(`${BRIDGE_BASE}/api/commands/${id}/reject`, {
    method: "POST",
    headers: bridgeHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Reject failed");
  }
  const data: CommandResponse = await res.json();
  return data.command;
}

export async function undoCommand(id: string): Promise<BridgeCommand> {
  const res = await fetch(`${BRIDGE_BASE}/api/commands/${id}/undo`, {
    method: "POST",
    headers: bridgeHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Undo failed");
  }
  const data: CommandResponse = await res.json();
  return data.command;
}
