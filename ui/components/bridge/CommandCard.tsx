"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Check, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import type { BridgeCommand } from "@/lib/types";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

interface CommandCardProps {
  command: BridgeCommand;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  onUndo?: (id: string) => Promise<void>;
  compact?: boolean;
}

export function CommandCard({
  command,
  onApprove,
  onReject,
  onUndo,
  compact = false,
}: CommandCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState<"approve" | "reject" | "undo" | null>(null);

  const handle = useCallback(
    async (action: "approve" | "reject" | "undo") => {
      setLoading(action);
      try {
        if (action === "approve") await onApprove?.(command.id);
        if (action === "reject") await onReject?.(command.id);
        if (action === "undo") await onUndo?.(command.id);
      } finally {
        setLoading(null);
      }
    },
    [command.id, onApprove, onReject, onUndo]
  );

  const isPending = command.status === "pending";
  const canUndo = command.status === "sent" || command.status === "acknowledged";

  return (
    <article
      className={cn(
        "rounded-lg border bg-card transition-colors",
        isPending
          ? "border-[#f5a623]/40 hover:border-[#f5a623]/60"
          : "border-border hover:border-border/80"
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Command type */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold text-foreground">
              {command.command_type}
            </span>
            <StatusBadge status={command.status} />
            {command.undo_of && (
              <span className="text-[10px] text-muted-foreground font-mono">
                undo of {command.undo_of.slice(0, 8)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[10px] text-muted-foreground">
              {command.id.slice(0, 8)}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground">
              {formatDate(command.created_at)} {formatTime(command.created_at)}
            </span>
            {command.source && (
              <>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] text-muted-foreground">{command.source}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isPending && (
            <>
              <button
                onClick={() => handle("approve")}
                disabled={!!loading}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#4dffa0]/15 text-[#4dffa0] hover:bg-[#4dffa0]/25 border border-[#4dffa0]/30 transition-colors disabled:opacity-50"
                aria-label="Approve command"
              >
                <Check className="w-3 h-3" />
                {loading === "approve" ? "..." : "Approve"}
              </button>
              <button
                onClick={() => handle("reject")}
                disabled={!!loading}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#ff4d4d]/15 text-[#ff4d4d] hover:bg-[#ff4d4d]/25 border border-[#ff4d4d]/30 transition-colors disabled:opacity-50"
                aria-label="Reject command"
              >
                <X className="w-3 h-3" />
                {loading === "reject" ? "..." : "Reject"}
              </button>
            </>
          )}
          {canUndo && (
            <button
              onClick={() => handle("undo")}
              disabled={!!loading}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#f5a623]/15 text-[#f5a623] hover:bg-[#f5a623]/25 border border-[#f5a623]/30 transition-colors disabled:opacity-50"
              aria-label="Undo command"
            >
              <RotateCcw className="w-3 h-3" />
              {loading === "undo" ? "..." : "Undo"}
            </button>
          )}
          {!compact && (
            <button
              onClick={() => setExpanded((p) => !p)}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
              aria-label={expanded ? "Collapse command details" : "Expand command details"}
            >
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Payload preview (always show key fields) */}
      {!compact && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-3">
            {Object.entries(command.payload)
              .filter(([k]) => k !== "type")
              .slice(0, 4)
              .map(([k, v]) => (
                <span key={k} className="text-[11px] text-muted-foreground font-mono">
                  <span className="text-text-dim">{k}</span>
                  <span className="text-muted-foreground">={String(v)}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Expanded JSON */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-border mt-1 pt-3">
          <pre className="text-[11px] font-mono text-muted-foreground leading-relaxed overflow-x-auto whitespace-pre-wrap break-all rounded bg-surface p-3">
            {JSON.stringify(command.payload, null, 2)}
          </pre>
          {command.error && (
            <p className="mt-2 text-xs text-[#ff4d4d] font-mono">{command.error}</p>
          )}
          {command.result && (
            <pre className="mt-2 text-[11px] font-mono text-[#4d9fff] leading-relaxed">
              {JSON.stringify(command.result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </article>
  );
}
