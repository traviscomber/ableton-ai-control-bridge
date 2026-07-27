"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Terminal } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { HealthStatus } from "@/components/bridge/HealthStatus";
import { fetchHealth } from "@/lib/bridge-client";
import type { BridgeHealth } from "@/lib/types";
import { cn } from "@/lib/utils";

function makeMockHealth(): BridgeHealth {
  return {
    ok: true,
    version: "0.4.2",
    dry_run: false,
    approval_required: true,
    authentication_required: true,
    allowed_commands: [
      "set_tempo", "launch_scene", "stop_all_clips", "set_track_volume",
      "set_track_pan", "set_macro", "create_midi_clip", "create_audio_track",
      "create_midi_track", "arm_track", "start_playback", "stop_playback",
      "set_time_signature", "set_metronome",
    ],
    udp_target: "127.0.0.1:9001",
    ack_listener: "127.0.0.1:9002",
    max_receiver_seen: true,
    last_ack_at: new Date(Date.now() - 45000).toISOString(),
  };
}

const QUICK_COMMANDS = [
  {
    label: "Start bridge (with approval)",
    cmd: 'python -m ableton_bridge.server --token "change-this-token" --require-approval',
  },
  {
    label: "Dry-run mode",
    cmd: "python -m ableton_bridge.server --dry-run",
  },
  {
    label: "Check health",
    cmd: "curl http://127.0.0.1:8765/health",
  },
  {
    label: "Send a command",
    cmd: `curl -X POST http://127.0.0.1:8765/command \\
  -H "Content-Type: application/json" \\
  -d '{"type":"set_tempo","bpm":132}'`,
  },
  {
    label: "Get pending commands",
    cmd: `curl http://127.0.0.1:8765/api/commands?status=pending \\
  -H "X-Bridge-Token: your-token"`,
  },
];

export default function HealthPage() {
  const [health, setHealth] = useState<BridgeHealth | null>(makeMockHealth);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isMockMode, setIsMockMode] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
      setHealthError(null);
      setIsMockMode(false);
    } catch {
      setHealthError("Cannot reach bridge at http://127.0.0.1:8765");
      setHealth(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  function copyCmd(cmd: string) {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 1500);
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Bridge Health"
        subtitle="Server status, UDP transport, and ACK monitoring"
        right={
          <div className="flex items-center gap-2">
            {isMockMode && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#f5a623]/30 text-[#f5a623] bg-[#f5a623]/10">
                DEMO
              </span>
            )}
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised border border-border transition-colors disabled:opacity-50"
              aria-label="Refresh health status"
            >
              <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-2xl space-y-6">
          {/* Health status card */}
          <HealthStatus health={health} error={healthError} />

          {/* Quick start commands */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Quick Start</h2>
            </div>
            <div className="space-y-2">
              {QUICK_COMMANDS.map(({ label, cmd }) => (
                <div
                  key={label}
                  className="rounded-lg border border-border bg-card overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <button
                      onClick={() => copyCmd(cmd)}
                      className="text-[10px] font-mono px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-brand transition-colors"
                    >
                      {copiedCmd === cmd ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <pre className="px-3 py-2.5 text-[11px] font-mono text-text-dim overflow-x-auto">
                    {cmd}
                  </pre>
                </div>
              ))}
            </div>
          </section>

          {/* Connection diagram */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3">Connection Flow</h2>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-col gap-2">
                {[
                  { label: "AI / Agent / App", sub: "JSON over HTTP", active: true },
                  { label: "AI Control Bridge", sub: "Python · 127.0.0.1:8765", active: health?.ok ?? false },
                  { label: "Max for Live Receiver", sub: "UDP · 127.0.0.1:9001", active: health?.max_receiver_seen ?? false },
                  { label: "Ableton Live", sub: "Live API", active: false },
                ].map((node, i, arr) => (
                  <div key={node.label} className="flex flex-col items-start">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border w-full",
                      node.active ? "border-[#4dffa0]/40 bg-[#4dffa0]/5" : "border-border bg-surface"
                    )}>
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        node.active ? "bg-[#4dffa0]" : "bg-muted-foreground"
                      )} />
                      <div>
                        <div className="text-xs font-medium text-foreground">{node.label}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{node.sub}</div>
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="ml-3.5 w-px h-4 bg-border" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
