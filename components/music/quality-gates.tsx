"use client";

import type { QualityScores } from "@/lib/music-schema";

interface QualityGatesProps {
  scores: Partial<QualityScores>;
  status: string;
}

const GATES = [
  {
    key: "reasoning_coherence" as keyof QualityScores,
    label: "Reasoning",
    description: "OpenAI o1 structure coherence",
    threshold: 80,
    step: "reasoning",
  },
  {
    key: "midi_accuracy" as keyof QualityScores,
    label: "MIDI",
    description: "Note accuracy & quantization",
    threshold: 80,
    step: "midi",
  },
  {
    key: "arrangement_integrity" as keyof QualityScores,
    label: "Arrangement",
    description: "Section balance & transitions",
    threshold: 80,
    step: "arrangement",
  },
  {
    key: "audio_engineering" as keyof QualityScores,
    label: "Audio Eng.",
    description: "Headroom, EQ, dynamics",
    threshold: 70,
    step: "arrangement",
  },
  {
    key: "compliance" as keyof QualityScores,
    label: "Compliance",
    description: "Platform loudness standards",
    threshold: 80,
    step: "quality",
  },
  {
    key: "venom_final" as keyof QualityScores,
    label: "Venom Final",
    description: "Overall quality gate",
    threshold: 75,
    step: "exported",
  },
];

const STATUS_ORDER = ["brief", "reasoning", "midi", "arrangement", "quality", "exported"];

function getGateState(
  gateStep: string,
  currentStatus: string,
  score: number | undefined,
  threshold: number
): "pending" | "pass" | "fail" | "active" {
  const gateIdx = STATUS_ORDER.indexOf(gateStep);
  const statusIdx = STATUS_ORDER.indexOf(currentStatus);

  if (statusIdx < gateIdx) return "pending";
  if (statusIdx === gateIdx) return "active";
  if (score === undefined) return "pending";
  return score >= threshold ? "pass" : "fail";
}

export function QualityGates({ scores, status }: QualityGatesProps) {
  const passed = GATES.filter(g => {
    const score = scores[g.key] as number | undefined;
    return score !== undefined && score >= g.threshold;
  }).length;

  const total = GATES.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono text-text-faint uppercase tracking-widest">Quality Gates</h3>
        <span className="text-xs font-mono text-text-dim">
          <span className={passed === total ? "text-brand" : "text-foreground"}>{passed}</span>
          <span className="text-text-faint">/{total} passed</span>
        </span>
      </div>

      {/* Gates */}
      <div className="space-y-2">
        {GATES.map((gate, i) => {
          const score = scores[gate.key] as number | undefined;
          const state = getGateState(gate.step, status, score, gate.threshold);

          return (
            <GateRow
              key={gate.key}
              index={i + 1}
              label={gate.label}
              description={gate.description}
              score={score}
              threshold={gate.threshold}
              state={state}
            />
          );
        })}
      </div>

      {/* Overall bar */}
      {scores.overall !== undefined && (
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-mono text-text-faint uppercase tracking-widest">Overall Score</span>
            <span className={`text-lg font-mono font-bold ${
              scores.overall >= 80 ? "text-brand" : scores.overall >= 60 ? "text-status-pending" : "text-destructive"
            }`}>
              {scores.overall}
            </span>
          </div>
          <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                scores.overall >= 80 ? "bg-brand" : scores.overall >= 60 ? "bg-status-pending" : "bg-destructive"
              }`}
              style={{ width: `${scores.overall}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function GateRow({
  index,
  label,
  description,
  score,
  threshold,
  state,
}: {
  index: number;
  label: string;
  description: string;
  score: number | undefined;
  threshold: number;
  state: "pending" | "pass" | "fail" | "active";
}) {
  const stateConfig = {
    pass:    { dot: "bg-brand",          text: "text-brand",         bar: "bg-brand" },
    fail:    { dot: "bg-destructive",     text: "text-destructive",   bar: "bg-destructive" },
    active:  { dot: "bg-status-sent pulse-dot", text: "text-status-sent", bar: "bg-status-sent" },
    pending: { dot: "bg-border",          text: "text-text-faint",    bar: "bg-border/40" },
  }[state];

  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* Index + dot */}
      <span className="text-xs font-mono text-text-faint w-4 shrink-0">{String(index).padStart(2, "0")}</span>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stateConfig.dot}`} />

      {/* Label + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono ${state === "pending" ? "text-text-faint" : "text-foreground"}`}>
            {label}
          </span>
          <span className="text-[10px] text-text-faint hidden sm:block truncate">{description}</span>
        </div>
        {/* Score bar */}
        {score !== undefined && (
          <div className="h-0.5 bg-surface-raised rounded-full overflow-hidden mt-1 w-full max-w-24">
            <div
              className={`h-full rounded-full transition-all duration-500 ${stateConfig.bar}`}
              style={{ width: `${score}%` }}
            />
          </div>
        )}
      </div>

      {/* Score value */}
      <span className={`text-xs font-mono w-12 text-right shrink-0 ${stateConfig.text}`}>
        {score !== undefined ? `${score}/100` : state === "active" ? "..." : "—"}
      </span>
    </div>
  );
}
