"use client";

import { useState } from "react";
import { Disc3, Clock, Music2 } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { AgentCard } from "@/components/darksco/AgentCard";
import { QualityGateTracker } from "@/components/darksco/QualityGateTracker";
import { AGENTS, MOCK_ACTIVE_PROJECT } from "@/lib/darksco-data";
import { cn } from "@/lib/utils";
import type { ReleaseStatus } from "@/lib/types";

const STATUS_CONFIG: Record<ReleaseStatus, { label: string; color: string; bg: string; border: string }> = {
  "in-progress": { label: "IN PROGRESS", color: "#4d9fff", bg: "bg-[#4d9fff]/10", border: "border-[#4d9fff]/30" },
  "blocked":     { label: "BLOCKED",     color: "#ff4d4d", bg: "bg-[#ff4d4d]/10", border: "border-[#ff4d4d]/30" },
  "ready":       { label: "READY",       color: "#4dffa0", bg: "bg-[#4dffa0]/10", border: "border-[#4dffa0]/30" },
  "released":    { label: "RELEASED",    color: "#4dffa0", bg: "bg-[#4dffa0]/10", border: "border-[#4dffa0]/30" },
};

export default function DarkscoPage() {
  const project = MOCK_ACTIVE_PROJECT;
  const sc = STATUS_CONFIG[project.status];

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="DARKSCO Production Hub"
        subtitle="Executive agent team — Night Protocol 002"
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: agents grid */}
        <main className="flex-1 overflow-y-auto px-5 py-5">
          {/* Project header */}
          <div className="rounded-lg border border-border bg-card px-5 py-4 mb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-raised flex items-center justify-center">
                  <Disc3 className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {project.name}
                    <span className="ml-2 text-xs text-muted-foreground font-mono">{project.version}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {project.bpm && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {project.bpm} BPM
                      </span>
                    )}
                    {project.duration && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="w-2.5 h-2.5" /> {project.duration}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Updated {new Date(project.updatedAt).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <span
                className={cn(
                  "text-[10px] font-mono font-bold tracking-widest px-2 py-0.5 rounded border",
                  sc.bg, sc.border
                )}
                style={{ color: sc.color }}
              >
                {sc.label}
              </span>
            </div>
          </div>

          {/* Agent grid - Darkside first, then 3 columns */}
          <div className="space-y-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Agent Status
            </h2>

            {/* Darkside orchestrator — full width */}
            <AgentCard
              agent={AGENTS.find((a) => a.id === "darkside")!}
              decision={project.agents.darkside}
            />

            {/* Doom — full width, special styling */}
            <AgentCard
              agent={AGENTS.find((a) => a.id === "doom")!}
              decision={project.agents.doom}
            />

            {/* Specialists — 2-column grid */}
            <div className="grid grid-cols-2 gap-3">
              {AGENTS.filter((a) => !["darkside", "doom"].includes(a.id)).map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  decision={project.agents[agent.id]}
                />
              ))}
            </div>
          </div>

          {/* Workflow diagram */}
          <div className="mt-6">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Default Workflow
            </h2>
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {["Darkside", "Venom", "Hela", "Loki", "Bane", "Thanos", "Doom"].map((name, i, arr) => {
                  const agent = AGENTS.find((a) => a.name === name)!;
                  const agentDecision = project.agents[agent.id];
                  const isActive = agentDecision?.status === "ACTIVE";
                  const isDone = agentDecision?.status === "READY" || agentDecision?.status === "DONE";
                  const isBlocked = agentDecision?.status === "BLOCKED";
                  return (
                    <div key={name} className="flex items-center gap-1.5">
                      <div
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium border",
                          isActive
                            ? "text-foreground"
                            : isDone
                            ? "text-[#4dffa0]"
                            : isBlocked
                            ? "text-[#ff4d4d]"
                            : "text-muted-foreground"
                        )}
                        style={{
                          borderColor: isActive || isDone || isBlocked ? `${agent.color}40` : "#222228",
                          backgroundColor: isActive || isDone || isBlocked ? `${agent.color}15` : "transparent",
                        }}
                      >
                        {name}
                      </div>
                      {i < arr.length - 1 && (
                        <span className="text-muted-foreground text-xs">›</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>

        {/* Right panel: quality gates */}
        <aside className="w-80 shrink-0 border-l border-border overflow-y-auto">
          <div className="p-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Quality Gate
            </h2>
            <QualityGateTracker gates={project.gates} />

            {/* Protocol reference */}
            <div className="mt-4 rounded-lg border border-border bg-surface p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Stop Conditions
              </p>
              <ul className="space-y-1">
                {[
                  "Rights uncertain",
                  "Mandatory gate failed",
                  "Conflicting agent recommendations",
                  "Brand identity risk",
                  "Evidence unavailable for irreversible action",
                ].map((cond, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                    <span className="text-[#ff4d4d] mt-0.5 shrink-0">!</span>
                    {cond}
                  </li>
                ))}
              </ul>
            </div>

            {/* Priority formula */}
            <div className="mt-3 rounded-lg border border-border bg-surface p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Priority Formula
              </p>
              <div className="font-mono text-[11px] text-text-dim">
                <div>Priority =</div>
                <div className="ml-2 text-brand">(Impact × Confidence × Fit)</div>
                <div className="ml-2">/ Effort</div>
              </div>
              <p className="mt-1.5 text-[9px] text-muted-foreground">
                Each factor 1–5. Rights/brand risk overrides score.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
