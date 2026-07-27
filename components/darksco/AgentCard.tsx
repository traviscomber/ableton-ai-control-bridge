"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Play, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent, AgentDecision, AgentStatus, AgentConfidence, AgentResponse, AgentId } from "@/lib/types";

const STATUS_CONFIG: Record<AgentStatus, { label: string; textColor: string; bgColor: string; border: string }> = {
  READY:   { label: "READY",   textColor: "text-[#4dffa0]", bgColor: "bg-[#4dffa0]/10", border: "border-[#4dffa0]/30" },
  ACTIVE:  { label: "ACTIVE",  textColor: "text-[#4d9fff]", bgColor: "bg-[#4d9fff]/10", border: "border-[#4d9fff]/30" },
  BLOCKED: { label: "BLOCKED", textColor: "text-[#ff4d4d]", bgColor: "bg-[#ff4d4d]/10", border: "border-[#ff4d4d]/30" },
  PENDING: { label: "PENDING", textColor: "text-[#f5a623]", bgColor: "bg-[#f5a623]/10", border: "border-[#f5a623]/30" },
  DONE:    { label: "DONE",    textColor: "text-[#4dffa0]", bgColor: "bg-[#4dffa0]/10", border: "border-[#4dffa0]/30" },
  IDLE:    { label: "IDLE",    textColor: "text-[#9898a4]", bgColor: "bg-[#9898a4]/10", border: "border-[#9898a4]/30" },
};

const CONFIDENCE_LABELS: Record<AgentConfidence, string> = {
  HIGH: "HIGH",
  MEDIUM: "MED",
  LOW: "LOW",
};

const CONFIDENCE_COLORS: Record<AgentConfidence, string> = {
  HIGH: "text-[#4dffa0]",
  MEDIUM: "text-[#f5a623]",
  LOW: "text-[#ff4d4d]",
};

interface AgentCardProps {
  agent: Agent;
  decision?: AgentDecision;
  response?: AgentResponse; // Shared protocol response from agent operation
  onInvoke?: (agentId: AgentId) => void;
  isLoading?: boolean;
}

export function AgentCard({ agent, decision, response, onInvoke, isLoading }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Use response status if available, otherwise fall back to decision
  const status: AgentStatus = (response?.status as AgentStatus) || decision?.status ?? "IDLE";
  const sc = STATUS_CONFIG[status];
  const confidence = response?.confidence || decision?.confidence;

  return (
    <article
      className={cn(
        "rounded-lg border bg-card transition-all hover:bg-surface-raised cursor-pointer",
        status === "BLOCKED" ? "border-[#ff4d4d]/30" : "border-border"
      )}
      style={{
        boxShadow: status !== "IDLE" ? `0 0 0 1px ${agent.color}14` : undefined,
      }}
      onClick={() => setExpanded((p) => !p)}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {/* Avatar dot */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: `${agent.color}20`, color: agent.color, border: `1px solid ${agent.color}40` }}
            >
              {agent.name[0]}
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground leading-none">{agent.name}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{agent.role}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Status badge */}
            <span
              className={cn(
                "text-[9px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded border",
                sc.textColor, sc.bgColor, sc.border
              )}
            >
              {sc.label}
            </span>
            {confidence && (
              <span className={cn("text-[10px] font-mono font-bold", CONFIDENCE_COLORS[confidence])}>
                {CONFIDENCE_LABELS[confidence]}
              </span>
            )}
            {/* Invoke button if handler provided and not yet responded */}
            {onInvoke && !response && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onInvoke(agent.id);
                }}
                disabled={isLoading}
                className="p-1 hover:bg-brand/10 rounded transition-colors disabled:opacity-50"
                title={`Invoke ${agent.name}`}
              >
                <Play className="w-3.5 h-3.5 text-brand" />
              </button>
            )}
            <span className="text-muted-foreground">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </div>
        </div>

        {/* Summary */}
        {(decision?.summary || response?.decision || response?.recommendation) && (
          <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {decision?.summary || response?.decision || response?.recommendation}
          </p>
        )}
        {!decision && !response && (
          <p className="mt-2.5 text-xs text-muted-foreground italic">
            {isLoading ? "Loading operation..." : "No decision recorded yet."}
          </p>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (response || decision) && (
        <div className="px-4 pb-4 border-t border-border mt-0 pt-3 space-y-3">
          {/* Facts/Findings */}
          {(response?.facts || response?.findings) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                {response.facts ? "Facts" : "Findings"}
              </p>
              <ul className="space-y-1">
                {(response.facts || response.findings)?.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="text-brand mt-0.5">→</span>
                    <span className="line-clamp-2">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          {(response?.actions || decision?.actions) && (response?.actions?.length || decision?.actions?.length) ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-brand mb-1.5">
                Actions
              </p>
              <ul className="space-y-1.5">
                {(response?.actions || decision?.actions)?.map((a, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="text-brand mt-0.5 flex-shrink-0">›</span>
                    <span className="line-clamp-2">{typeof a === "string" ? a : a.description || `${a.owner}: ${a.description}`}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Risks/Blockers */}
          {(response?.risks || response?.blockers || decision?.blockers) && (response?.risks?.length || response?.blockers?.length || decision?.blockers?.length) ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ff4d4d] mb-1.5">
                {response?.risks?.length ? "Risks" : "Blockers"}
              </p>
              <ul className="space-y-1">
                {(response?.risks || response?.blockers || decision?.blockers)?.map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-[#ff4d4d]/80">
                    <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Next Agent Handoff */}
          {response?.nextAgent && (
            <div className="text-[10px] text-muted-foreground italic border-t border-border pt-2">
              Next: <span className="font-mono text-brand">{response.nextAgent}</span>
              {response.requiredInput && ` — requires ${response.requiredInput}`}
            </div>
          )}

          <div className="text-[10px] text-muted-foreground font-mono pt-2">
            {response?.respondedAt || decision?.updatedAt ? (
              <>Responded {new Date(response?.respondedAt || decision?.updatedAt || "").toLocaleString("en-US", {
                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
              })}</>
            ) : (
              <>Pending</>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
