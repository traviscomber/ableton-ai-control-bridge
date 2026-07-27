"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Inbox, Filter } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { CommandCard } from "@/components/bridge/CommandCard";
import { HealthStatus } from "@/components/bridge/HealthStatus";
import { fetchCommands, fetchHealth, approveCommand, rejectCommand } from "@/lib/bridge-client";
import type { BridgeCommand, BridgeHealth } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Mock data for offline preview ──────────────────────────────────────────
// Use a factory function so Date.now() is called client-side only,
// preventing SSR/client timestamp mismatch hydration errors.
function makeMockCommands(): BridgeCommand[] {
  const now = Date.now();
  return [
    {
      id: "cmd-a1b2c3d4",
      command_type: "set_tempo",
      payload: { type: "set_tempo", bpm: 132 },
      status: "pending",
      source: "127.0.0.1",
      created_at: new Date(now - 15000).toISOString(),
      updated_at: new Date(now - 15000).toISOString(),
    },
    {
      id: "cmd-b2c3d4e5",
      command_type: "create_midi_clip",
      payload: {
        type: "create_midi_clip",
        track: 1,
        clip: 0,
        bar: 1,
        beats: 8,
        notes: [
          { pitch: 41, start: 0.0, duration: 0.5, velocity: 105 },
          { pitch: 44, start: 1.0, duration: 0.5, velocity: 96 },
        ],
      },
      status: "pending",
      source: "127.0.0.1",
      created_at: new Date(now - 8000).toISOString(),
      updated_at: new Date(now - 8000).toISOString(),
    },
    {
      id: "cmd-c3d4e5f6",
      command_type: "set_track_volume",
      payload: { type: "set_track_volume", track: 2, volume: 0.75 },
      status: "pending",
      source: "127.0.0.1",
      created_at: new Date(now - 3000).toISOString(),
      updated_at: new Date(now - 3000).toISOString(),
    },
    {
      id: "cmd-d4e5f6g7",
      command_type: "set_macro",
      payload: { type: "set_macro", track: 3, macro: 1, value: 0.4 },
      status: "sent",
      source: "127.0.0.1",
      created_at: new Date(now - 60000).toISOString(),
      updated_at: new Date(now - 55000).toISOString(),
    },
    {
      id: "cmd-e5f6g7h8",
      command_type: "launch_scene",
      payload: { type: "launch_scene", scene: 0 },
      status: "acknowledged",
      source: "127.0.0.1",
      created_at: new Date(now - 120000).toISOString(),
      updated_at: new Date(now - 119000).toISOString(),
      result: { forwarded: true },
    },
  ];
}

type FilterMode = "all" | "pending" | "active";

export default function QueuePage() {
  const [commands, setCommands] = useState<BridgeCommand[]>(makeMockCommands);
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMockMode, setIsMockMode] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [cmds, h] = await Promise.all([
        fetchCommands({ limit: 100 }),
        fetchHealth(),
      ]);
      setCommands(cmds);
      setHealth(h);
      setHealthError(null);
      setIsMockMode(false);
    } catch {
      // Bridge not running locally — keep mock data
      setHealthError("Cannot reach bridge at http://127.0.0.1:8765");
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  const handleApprove = useCallback(async (id: string) => {
    if (isMockMode) {
      setCommands((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "sent" } : c))
      );
      return;
    }
    const updated = await approveCommand(id);
    setCommands((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }, [isMockMode]);

  const handleReject = useCallback(async (id: string) => {
    if (isMockMode) {
      setCommands((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "rejected" } : c))
      );
      return;
    }
    const updated = await rejectCommand(id);
    setCommands((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }, [isMockMode]);

  // Keyboard shortcuts: j/k to navigate, a to approve, r to reject
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const pendingCount = commands.filter((c) => c.status === "pending").length;

  const filtered = commands.filter((c) => {
    if (filter === "pending") return c.status === "pending";
    if (filter === "active") return ["pending", "sent", "accepted"].includes(c.status);
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Command Queue"
        subtitle="Approve or reject pending commands before they reach Ableton"
        right={
          <button
            onClick={refresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised border border-border transition-colors disabled:opacity-50"
            aria-label="Refresh commands"
          >
            <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
            Refresh
          </button>
        }
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main command list */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Filter bar */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            {(["all", "pending", "active"] as FilterMode[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                  filter === f
                    ? "bg-surface-raised text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "all" ? "All" : f === "pending" ? `Pending (${pendingCount})` : "Active"}
              </button>
            ))}

            {isMockMode && (
              <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded border border-[#f5a623]/30 text-[#f5a623] bg-[#f5a623]/10">
                DEMO — bridge offline
              </span>
            )}
          </div>

          {/* Command list */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Inbox className="w-8 h-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No commands in queue</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Commands will appear here when{" "}
                  <span className="font-mono">--require-approval</span> is set
                </p>
              </div>
            ) : (
              filtered.map((cmd) => (
                <CommandCard
                  key={cmd.id}
                  command={cmd}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))
            )}
          </div>
        </main>

        {/* Right panel: health status */}
        <aside className="w-72 shrink-0 border-l border-border overflow-y-auto">
          <div className="p-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Bridge Status
            </h2>
            <HealthStatus health={health} error={healthError} compact />

            {/* Stats */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { label: "Pending", value: commands.filter(c => c.status === "pending").length, color: "#f5a623" },
                { label: "Sent", value: commands.filter(c => c.status === "sent").length, color: "#4d9fff" },
                { label: "Acked", value: commands.filter(c => c.status === "acknowledged").length, color: "#4dffa0" },
                { label: "Rejected", value: commands.filter(c => c.status === "rejected").length, color: "#ff4d4d" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg bg-surface p-3 border border-border">
                  <div className="text-lg font-mono font-bold" style={{ color }}>{value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Keyboard hints */}
            <div className="mt-4 rounded-lg bg-surface border border-border p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                Keyboard
              </p>
              <div className="space-y-1">
                {[
                  ["Enter", "Approve"],
                  ["Delete", "Reject"],
                  ["U", "Undo sent"],
                ].map(([key, action]) => (
                  <div key={key} className="flex items-center justify-between">
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-raised border border-border text-text-dim">
                      {key}
                    </kbd>
                    <span className="text-[10px] text-muted-foreground">{action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
