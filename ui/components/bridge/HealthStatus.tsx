"use client";

import { useEffect, useState } from "react";
import { Activity, Wifi, WifiOff, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BridgeHealth } from "@/lib/types";

interface HealthStatusProps {
  health: BridgeHealth | null;
  error?: string | null;
  compact?: boolean;
}

function MetricRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-mono", accent ? "text-brand" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

export function HealthStatus({ health, error, compact }: HealthStatusProps) {
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString("en-US", { hour12: false }));
  }, [health]);

  if (error) {
    return (
      <div className="rounded-lg border border-[#ff4d4d]/30 bg-[#ff4d4d]/5 p-4">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-[#ff4d4d]" />
          <span className="text-sm font-semibold text-[#ff4d4d]">Bridge Offline</span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground font-mono">{error}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Start the bridge: <span className="font-mono text-text-dim">python -m ableton_bridge.server --token &lt;your-token&gt;</span>
        </p>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 animate-pulse">
        <div className="h-4 bg-surface-raised rounded w-32 mb-2" />
        <div className="h-3 bg-surface-raised rounded w-48" />
      </div>
    );
  }

  const statusOk = health.ok;

  return (
    <div className={cn("rounded-lg border bg-card", statusOk ? "border-[#4dffa0]/30" : "border-[#ff4d4d]/30")}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", statusOk ? "bg-[#4dffa0] pulse-dot" : "bg-[#ff4d4d]")} />
          <span className="text-sm font-semibold text-foreground">
            {statusOk ? "Bridge Online" : "Bridge Error"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {health.dry_run && (
            <span className="text-[10px] font-mono font-semibold tracking-widest px-2 py-0.5 rounded border border-[#9898a4]/30 text-[#9898a4] bg-[#9898a4]/10">
              DRY-RUN
            </span>
          )}
          {health.approval_required && (
            <span className="text-[10px] font-mono font-semibold tracking-widest px-2 py-0.5 rounded border border-[#f5a623]/30 text-[#f5a623] bg-[#f5a623]/10">
              APPROVAL ON
            </span>
          )}
          {!compact && (
            <span className="text-[10px] text-muted-foreground font-mono">{lastUpdated}</span>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="px-4 py-1">
        <MetricRow label="Version" value={health.version} accent />
        <MetricRow label="UDP target" value={health.udp_target} />
        <MetricRow label="ACK listener" value={health.ack_listener} />
        <MetricRow
          label="Max receiver"
          value={health.max_receiver_seen ? "Seen" : "Not seen yet"}
          accent={health.max_receiver_seen}
        />
        <MetricRow
          label="Last ACK"
          value={
            health.last_ack_at
              ? new Date(health.last_ack_at).toLocaleTimeString("en-US", { hour12: false })
              : "—"
          }
        />
        {!compact && (
          <>
            <MetricRow
              label="Auth required"
              value={health.authentication_required ? "Yes" : "No"}
            />
            <div className="py-2">
              <span className="text-xs text-muted-foreground">Allowed commands</span>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {health.allowed_commands.map((cmd) => (
                  <span
                    key={cmd}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-raised text-text-dim"
                  >
                    {cmd}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
