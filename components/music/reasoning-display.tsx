"use client";

import type { OpenAIStructure } from "@/lib/music-schema";

interface ReasoningDisplayProps {
  structure: OpenAIStructure;
  tokens: number;
  cost: number;
  durationMs: number;
  model: string;
}

const SECTION_COLORS: Record<string, string> = {
  intro:      "bg-text-faint/30 text-text-dim",
  build:      "bg-status-sent/15 text-status-sent",
  verse:      "bg-brand/10 text-brand",
  chorus:     "bg-brand/20 text-brand",
  drop:       "bg-brand/30 text-brand",
  peak:       "bg-brand/40 text-foreground",
  breakdown:  "bg-surface-overlay text-muted-foreground",
  bridge:     "bg-status-pending/10 text-status-pending",
  outro:      "bg-text-faint/20 text-text-dim",
};

const DYNAMICS_DOT: Record<string, string> = {
  minimal:  "bg-text-faint",
  moderate: "bg-status-sent",
  intense:  "bg-brand",
};

export function ReasoningDisplay({ structure, tokens, cost, durationMs, model }: ReasoningDisplayProps) {
  const totalBars = structure.sections.reduce((s, sec) => s + sec.duration_bars, 0);

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="flex items-center gap-6 border-b border-border pb-4">
        <StatChip label="Model" value={model} accent />
        <StatChip label="Tokens" value={tokens.toLocaleString()} />
        <StatChip label="Cost" value={`$${cost.toFixed(4)}`} />
        <StatChip label="Duration" value={`${(durationMs / 1000).toFixed(1)}s`} />
        <StatChip label="Sections" value={String(structure.sections.length)} />
        <StatChip label="Total Bars" value={String(totalBars)} />
      </div>

      {/* Arrangement Arc */}
      <Section title="Arrangement Arc">
        <p className="text-sm text-foreground leading-relaxed">{structure.arrangement_arc}</p>
        <p className="text-xs text-text-dim mt-2 font-mono leading-relaxed">{structure.energy_curve}</p>
      </Section>

      {/* Section Timeline */}
      <Section title="Section Timeline">
        <div className="space-y-1">
          {structure.sections.map((sec, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className={`mt-0.5 px-2 py-0.5 rounded text-xs font-mono shrink-0 ${SECTION_COLORS[sec.name] ?? "bg-surface-overlay text-muted-foreground"}`}>
                {sec.name.toUpperCase()}
              </span>
              <span className="font-mono text-xs text-text-dim w-16 shrink-0 mt-1">{sec.duration_bars} bars</span>
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${DYNAMICS_DOT[sec.dynamics]}`} />
              <span className="text-foreground/80 flex-1">{sec.notes}</span>
            </div>
          ))}
        </div>
        {/* Visual bar chart */}
        <div className="mt-3 flex gap-0.5 h-6 items-end">
          {structure.sections.map((sec, i) => {
            const width = (sec.duration_bars / totalBars) * 100;
            const heightClass = sec.dynamics === "intense" ? "h-full" : sec.dynamics === "moderate" ? "h-3/4" : "h-2/5";
            return (
              <div
                key={i}
                style={{ width: `${width}%` }}
                className={`${heightClass} rounded-sm ${
                  sec.dynamics === "intense" ? "bg-brand/70" : sec.dynamics === "moderate" ? "bg-brand/30" : "bg-border"
                } transition-all`}
                title={`${sec.name}: ${sec.duration_bars} bars`}
              />
            );
          })}
        </div>
      </Section>

      {/* Drum Pattern */}
      <Section title="Drum Pattern">
        <p className="text-xs text-text-dim mb-3">{structure.drum_pattern.description}</p>
        <div className="space-y-2">
          {(["kick", "snare", "hihat", "open_hihat", "perc"] as const).map(part => {
            const pattern = structure.drum_pattern[part];
            if (!pattern?.length) return null;
            return (
              <DrumRow key={part} label={part} hits={pattern} />
            );
          })}
        </div>
      </Section>

      {/* Chord Progression */}
      <Section title={`Chord Progression (${structure.chords.length} chords)`}>
        <div className="flex flex-wrap gap-2">
          {structure.chords.map((chord, i) => (
            <div key={i} className="border border-border rounded px-2.5 py-1.5 text-xs font-mono">
              <span className="text-text-faint mr-1">Bar {chord.bar}</span>
              <span className="text-brand font-semibold">{chord.root}</span>
              <span className="text-text-dim ml-0.5">{chord.quality}</span>
              {chord.inversion > 0 && (
                <span className="text-text-faint ml-1">inv{chord.inversion}</span>
              )}
            </div>
          ))}
        </div>
        {structure.chords.length > 0 && (
          <p className="text-xs text-text-dim mt-2 font-mono">{structure.chords[0].voicing_notes}</p>
        )}
      </Section>

      {/* MIDI Plan */}
      <Section title={`MIDI Plan — ${structure.midi_plan.tracks.length} Tracks`}>
        <div className="space-y-2">
          {structure.midi_plan.tracks.map((track, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/40 last:border-0 text-sm">
              <span className="font-mono text-xs text-brand w-28 shrink-0 truncate">{track.name}</span>
              <span className="text-text-dim text-xs font-mono w-20 shrink-0">{track.instrument}</span>
              <span className={`text-xs font-mono px-1.5 py-0.5 rounded shrink-0 ${
                track.density === "dense" ? "bg-brand/20 text-brand" :
                track.density === "moderate" ? "bg-status-sent/15 text-status-sent" :
                "bg-border text-text-dim"
              }`}>{track.density}</span>
              <span className="text-text-faint text-xs font-mono shrink-0">vel {track.velocity_range[0]}–{track.velocity_range[1]}</span>
              <span className="text-text-faint text-xs flex-1 truncate">{track.humanization}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Synthesis Notes */}
      <Section title="Synthesis Notes">
        <p className="text-sm text-foreground/80 leading-relaxed">{structure.synthesis_notes}</p>
        <p className="text-sm text-foreground/80 leading-relaxed mt-2">{structure.bass_movement}</p>
      </Section>

      {/* Production Tips */}
      <Section title="Production Tips">
        <div className="space-y-2">
          {structure.production_tips.map((tip, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <span className="text-brand font-mono text-xs shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-foreground/80 leading-relaxed">{tip}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Quality Target */}
      <Section title="Quality Target">
        <div className="grid grid-cols-2 gap-3">
          <KVRow label="Loudness" value={`${structure.quality_target.loudness_lufs} LUFS`} accent />
          <KVRow label="Dynamic Range" value={structure.quality_target.dynamic_range} />
          <KVRow label="Frequency Balance" value={structure.quality_target.frequency_balance} />
          <KVRow label="Mix Reference" value={structure.quality_target.mix_reference} />
        </div>
        <div className="mt-2">
          <span className="text-xs font-mono text-text-faint uppercase tracking-widest">Mastering Chain</span>
          <div className="flex gap-2 mt-1.5 flex-wrap">
            {structure.quality_target.mastering_chain.map((proc, i) => (
              <span key={i} className="text-xs font-mono px-2 py-0.5 bg-surface-overlay rounded text-text-dim">
                {proc}
              </span>
            ))}
          </div>
        </div>
      </Section>

      {/* Raw Reasoning */}
      <Section title="Raw Reasoning (o1)">
        <div className="bg-surface rounded border border-border p-3 max-h-40 overflow-y-auto">
          <p className="text-xs font-mono text-text-dim leading-relaxed whitespace-pre-wrap">
            {structure.raw_reasoning}
          </p>
        </div>
      </Section>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function DrumRow({ label, hits }: { label: string; hits: number[] }) {
  const hitSet = new Set(hits);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-text-dim w-20 shrink-0">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: 16 }, (_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-sm border text-center leading-4 text-[8px] ${
              hitSet.has(i)
                ? label === "kick"
                  ? "border-brand bg-brand/60 text-background font-bold"
                  : label === "snare"
                  ? "border-status-sent/60 bg-status-sent/30 text-status-sent"
                  : "border-border/60 bg-surface-overlay text-text-dim"
                : "border-border/30 bg-transparent"
            } ${i % 4 === 0 ? "ml-1" : ""}`}
          >
            {hitSet.has(i) ? "•" : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-mono text-text-faint uppercase tracking-widest mb-3">{title}</h4>
      {children}
    </div>
  );
}

function StatChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-xs font-mono">
      <span className="text-text-faint">{label}: </span>
      <span className={accent ? "text-brand" : "text-foreground"}>{value}</span>
    </div>
  );
}

function KVRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-mono text-text-faint uppercase tracking-widest">{label}</span>
      <span className={`text-sm font-mono ${accent ? "text-brand" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
