import type {
  BridgeCommand,
  BridgeHealth,
  CommandsResponse,
  CommandResponse,
  CommandStatus,
} from "./types";

const DEFAULT_BRIDGE_BASE = "http://127.0.0.1:8765";

function bridgeBase(): string {
  if (typeof window === "undefined") return DEFAULT_BRIDGE_BASE;
  return localStorage.getItem("titanBridgeUrl") || process.env.NEXT_PUBLIC_BRIDGE_URL || DEFAULT_BRIDGE_BASE;
}

function bridgeHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("titanBridgeToken") || "" : "";
  return {
    "Content-Type": "application/json",
    ...(token ? { "X-Bridge-Token": token } : {}),
  };
}

export function saveBridgeConnection(url: string, token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("titanBridgeUrl", url.trim() || DEFAULT_BRIDGE_BASE);
  localStorage.setItem("titanBridgeToken", token.trim());
}

export function readBridgeConnection(): { url: string; token: string } {
  if (typeof window === "undefined") return { url: DEFAULT_BRIDGE_BASE, token: "" };
  return {
    url: localStorage.getItem("titanBridgeUrl") || DEFAULT_BRIDGE_BASE,
    token: localStorage.getItem("titanBridgeToken") || "",
  };
}

async function responseError(res: Response, fallback: string): Promise<Error> {
  const data = await res.json().catch(() => ({ error: res.statusText }));
  return new Error(data.error ?? fallback);
}

export async function sendCommand(payload: Record<string, unknown>): Promise<BridgeCommand> {
  const res = await fetch(`${bridgeBase()}/command`, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await responseError(res, "Send command failed");
  const data: CommandResponse = await res.json();
  return data.command;
}

export async function fetchHealth(): Promise<BridgeHealth> {
  const res = await fetch(`${bridgeBase()}/health`, { headers: bridgeHeaders(), cache: "no-store" });
  if (!res.ok) throw await responseError(res, `Health check failed: ${res.status}`);
  return res.json();
}

export async function fetchCommands(opts: { status?: CommandStatus; limit?: number } = {}): Promise<BridgeCommand[]> {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  params.set("limit", String(opts.limit ?? 200));
  const res = await fetch(`${bridgeBase()}/api/commands?${params}`, { headers: bridgeHeaders(), cache: "no-store" });
  if (!res.ok) throw await responseError(res, "Failed to fetch commands");
  const data: CommandsResponse = await res.json();
  return data.commands;
}

async function commandAction(id: string, action: "approve" | "reject" | "undo"): Promise<BridgeCommand> {
  const res = await fetch(`${bridgeBase()}/api/commands/${id}/${action}`, { method: "POST", headers: bridgeHeaders() });
  if (!res.ok) throw await responseError(res, `${action} failed`);
  const data: CommandResponse = await res.json();
  return data.command;
}

export const approveCommand = (id: string) => commandAction(id, "approve");
export const rejectCommand = (id: string) => commandAction(id, "reject");
export const undoCommand = (id: string) => commandAction(id, "undo");
