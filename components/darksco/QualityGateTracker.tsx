import { Check, X, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QualityGate } from "@/lib/types";
import { AGENT_MAP } from "@/lib/darksco-data";

interface QualityGateTrackerProps {
  gates: QualityGate[];
}

export function QualityGateTracker({ gates }: QualityGateTrackerProps) {
  const passedCount = gates.filter((g) => g.passed).length;
  const total = gates.length;
  const allPassed = passedCount === total;
  const progress = (passedCount / total) * 100;

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {allPassed ? (
            <Check className="w-4 h-4 text-[#4dffa0]" />
          ) : (
            <Lock className="w-4 h-4 text-[#f5a623]" />
          )}
          <span className="text-sm font-semibold text-foreground">Release Gates</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground">
            {passedCount}/{total}
          </span>
          <span
            className={cn(
              "text-[10px] font-mono font-bold tracking-widest px-2 py-0.5 rounded border",
              allPassed
                ? "text-[#4dffa0] bg-[#4dffa0]/10 border-[#4dffa0]/30"
                : "text-[#f5a623] bg-[#f5a623]/10 border-[#f5a623]/30"
            )}
          >
            {allPassed ? "RELEASE READY" : "IN PROGRESS"}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="w-full h-1 rounded-full bg-surface-raised overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              backgroundColor: allPassed ? "#4dffa0" : "#f5a623",
            }}
          />
        </div>
      </div>

      {/* Gate list */}
      <div className="px-4 pb-4 space-y-1.5">
        {gates.map((gate) => {
          const agent = AGENT_MAP[gate.owner];
          return (
            <div
              key={gate.key}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md border",
                gate.passed
                  ? "bg-[#4dffa0]/5 border-[#4dffa0]/20"
                  : "bg-surface border-border"
              )}
            >
              {/* Checkmark */}
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                  gate.passed ? "bg-[#4dffa0]/20" : "bg-surface-raised"
                )}
              >
                {gate.passed ? (
                  <Check className="w-3 h-3 text-[#4dffa0]" />
                ) : (
                  <X className="w-3 h-3 text-muted-foreground" />
                )}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground">{gate.label}</div>
                {gate.blockedReason && !gate.passed && (
                  <div className="text-[10px] text-[#ff4d4d] mt-0.5">{gate.blockedReason}</div>
                )}
              </div>

              {/* Owner */}
              {agent && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ backgroundColor: `${agent.color}20`, color: agent.color, border: `1px solid ${agent.color}40` }}
                  >
                    {agent.name[0]}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{agent.name}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
