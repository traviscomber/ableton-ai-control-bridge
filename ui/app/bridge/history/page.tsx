"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Download, RefreshCw, ChevronDown } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { CommandCard } from "@/components/bridge/CommandCard";
import { StatusBadge } from "@/components/bridge/StatusBadge";
import { fetchCommands, undoCommand } from "@/lib/bridge-client";
import type { BridgeCommand, CommandStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Mock data ────────────────────────────────────────────────────────────────
function makeMockHistory(): BridgeCommand[] {
  const types = [
    "set_tempo",
    "launch_scene",
    "create_midi_clip",
    "set_track_volume",
    "set_macro",
    "start_playback",
    "stop_playback",
    "arm_track",
    "set_track_pan",
    "create_midi_track",
  ];
  const statuses: CommandStatus[] = ["acknowledged", "sent", "rejected", "error", "simulated"];
  const now = Date.now();
  return Array.from({ length: 40 }, (_, i) => {
    const type = types[i % types.length];
    const status = i === 0 ? "pending" : statuses[i % statuses.length];
    return {
      id: `cmd-hist-${i.toString().padStart(3, "0")}`,
      command_type: type,
      payload: { type, track: (i % 8) + 1, bpm: 100 + i, value: Math.round((i % 100) / 100 * 1000) / 1000 },
      status,
      source: "127.0.0.1",
      created_at: new Date(now - i * 90000).toISOString(),
      updated_at: new Date(now - i * 89000).toISOString(),
      result: status === "acknowledged" ? { forwarded: true } : null,
      error: status === "error" ? "Max receiver timeout" : null,
    };
  });
}

const ALL_STATUSES: CommandStatus[] = [
  "pending", "accepted", "sent", "acknowledged", "rejected", "error", "simulated",
];

export default function HistoryPage() {
  const [commands, setCommands] = useState<BridgeCommand[]>(makeMockHistory());
  const [isMockMode, setIsMockMode] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CommandStatus | "all">("all");
  const [sortDesc, setSortDesc] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const cmds = await fetchCommands({ limit: 200 });
      setCommands(cmds);
      setIsMockMode(false);
    } catch {
      // Bridge offline — keep mock data
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  const handleUndo = useCallback(async (id: string) => {
    if (isMockMode) {
      setCommands((prev) => prev.map((c) => (c.id === id ? { ...c, status: "rejected" } : c)));
      return;
    }
    const updated = await undoCommand(id);
    setCommands((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }, [isMockMode]);

  function exportJSON() {
    const blob = new Blob([JSON.stringify(commands, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bridge-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Filter + search
  const filtered = commands
    .filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.command_type.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          JSON.stringify(c.payload).toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) =>
      sortDesc
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  // Status counts
  const counts = commands.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Command History"
        subtitle={`${commands.length} total commands recorded`}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={exportJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised border border-border transition-colors"
              aria-label="Export history as JSON"
            >
              <Download className="w-3 h-3" />
              Export
            </button>
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised border border-border transition-colors disabled:opacity-50"
              aria-label="Refresh history"
            >
              <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="flex flex-col flex-1 min-h-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search commands..."
              className="w-full h-8 pl-8 pr-3 rounded border border-border bg-surface text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setStatusFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                statusFilter === "all"
                  ? "bg-surface-raised text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All ({commands.length})
            </button>
            {ALL_STATUSES.filter((s) => counts[s]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                  statusFilter === s
                    ? "bg-surface-raised text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s} ({counts[s]})
              </button>
            ))}
          </div>

          {/* Sort */}
          <button
            onClick={() => setSortDesc((p) => !p)}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground border border-border transition-colors"
          >
            <ChevronDown className={cn("w-3 h-3 transition-transform", !sortDesc && "rotate-180")} />
            {sortDesc ? "Newest first" : "Oldest first"}
          </button>

          {isMockMode && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#f5a623]/30 text-[#f5a623] bg-[#f5a623]/10">
              DEMO
            </span>
          )}
        </div>

        {/* Command list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="w-8 h-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No commands match your filters</p>
            </div>
          ) : (
            filtered.map((cmd) => (
              <CommandCard key={cmd.id} command={cmd} onUndo={handleUndo} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
