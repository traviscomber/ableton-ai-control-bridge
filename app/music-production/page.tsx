"use client";

import { useState, useEffect, useCallback } from "react";
import { ProductionCreator } from "@/components/music/production-creator";
import { ReasoningDisplay } from "@/components/music/reasoning-display";
import { MidiPreview } from "@/components/music/midi-preview";
import { QualityGates } from "@/components/music/quality-gates";
import type { OpenAIStructure, QualityScores, MidiMetadata } from "@/lib/music-schema";
import type { AbletonInstructions } from "@/lib/agents/midi-composer";

// ─── Types ─────────────────────────────────────────────────────────────

interface Production {
  id: string;
  brief: string;
  style: string;
  bpm: number;
  key: string;
  mood_keywords: string[];
  status: string;
  openai_structure: OpenAIStructure | null;
  reasoning_tokens: number;
  reasoning_cost: number;
  midi_metadata: MidiMetadata | null;
  quality_scores: Partial<QualityScores> | null;
  wav_path: string | null;
  loudness_lufs: number | null;
  soundbank_id: string | null;
  created_at: string;
}

interface Soundbank {
  id: string;
  name: string;
  total_stems: number;
  status: string;
}

type Tab = "brief" | "reasoning" | "midi" | "quality" | "export";

const PIPELINE_STEPS = [
  { id: "brief",      label: "01 Brief",      status: "brief" },
  { id: "reasoning",  label: "02 Reasoning",  status: "reasoning" },
  { id: "midi",       label: "03 MIDI",        status: "midi" },
  { id: "arrangement",label: "04 Arrangement", status: "arrangement" },
  { id: "quality",    label: "05 Quality",     status: "quality" },
  { id: "exported",   label: "06 WAV Export",  status: "exported" },
];

const STATUS_ORDER = ["brief", "reasoning", "midi", "arrangement", "quality", "exported"];

// ─── Main Page ─────────────────────────────────────────────────────────

interface DbSetupStatus {
  status: "checking" | "ready" | "missing_tables" | "error";
  missing_tables?: string[];
  schema_sql?: string;
  instructions?: string[];
}

export default function MusicProductionPage() {
  const [soundbanks, setSoundbanks] = useState<Soundbank[]>([]);
  const [production, setProduction] = useState<Production | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("brief");
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<DbSetupStatus>({ status: "checking" });
  const [showSql, setShowSql] = useState(false);

  // Session state for API responses
  const [reasoningLog, setReasoningLog] = useState<{ model: string; tokens: number; cost: number; durationMs: number } | null>(null);
  const [midiData, setMidiData] = useState<{ ableton: AbletonInstructions; wavSpec: null } | null>(null);
  const [exportData, setExportData] = useState<{
    wav_file: { path: string; size_mb: string; duration: string; format: string; loudness: string };
    compliance: { overall: boolean; release_ready: boolean; report: string; platforms: { platform: string; compliant: boolean }[] };
    quality_scores: QualityScores;
    ableton_project: { export_steps: string[]; project_name: string };
  } | null>(null);

  const loadSoundbanks = useCallback(async () => {
    try {
      const res = await fetch("/api/music/soundbanks");
      if (!res.ok) return;
      const d = await res.json();
      setSoundbanks(d.soundbanks ?? []);
    } catch {
      // silently ignore — DB may not be set up yet
    }
  }, []);

  // Check DB setup then load soundbanks
  useEffect(() => {
    fetch("/api/music/setup-production-db")
      .then(r => r.json())
      .then(d => {
        if (d.status === "ready") {
          setDbStatus({ status: "ready" });
          loadSoundbanks();
        } else {
          setDbStatus({
            status: "missing_tables",
            missing_tables: d.missing_tables ?? [],
            schema_sql: d.schema_sql ?? "",
            instructions: d.instructions ?? [],
          });
        }
      })
      .catch(() => {
        setDbStatus({ status: "error" });
        loadSoundbanks(); // try anyway
      });
  }, [loadSoundbanks]);

  const currentStatusIdx = production ? STATUS_ORDER.indexOf(production.status) : -1;

  // ─── Pipeline runners ─────────────────────────────────────────────

  async function runAnalyzeReasoning() {
    if (!production) return;
    setRunning("reasoning");
    setError(null);
    try {
      const res = await fetch("/api/music/analyze-reasoning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ production_id: production.id, total_bars: 64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reasoning failed");
      setProduction(data.production);
      setReasoningLog({
        model: data.log.model,
        tokens: data.log.tokens,
        cost: data.log.cost_usd,
        durationMs: data.log.duration_ms,
      });
      setActiveTab("reasoning");
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(null);
    }
  }

  async function runGenerateMidi() {
    if (!production) return;
    setRunning("midi");
    setError(null);
    try {
      const res = await fetch("/api/music/generate-midi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ production_id: production.id, total_bars: 64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "MIDI generation failed");
      setProduction(data.production);
      setMidiData({ ableton: data.ableton_project, wavSpec: null });
      setActiveTab("midi");
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(null);
    }
  }

  async function runExportWav() {
    if (!production) return;
    setRunning("export");
    setError(null);
    try {
      const res = await fetch("/api/music/export-wav", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ production_id: production.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Export failed");
      setProduction(data.production);
      setExportData(data.export_package);
      setActiveTab("export");
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(null);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/music-hub" className="text-text-faint hover:text-foreground transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline mr-1">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Hub
          </a>
          <span className="text-border">/</span>
          <h1 className="text-sm font-mono font-semibold text-foreground">Music Production Studio</h1>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-text-faint">
          <span>OpenAI o1</span>
          <span className="text-border">·</span>
          <span>MIDI</span>
          <span className="text-border">·</span>
          <span>48kHz/24-bit WAV</span>
        </div>
      </header>

      {/* DB setup banner */}
      {dbStatus.status === "missing_tables" && (
        <div className="border-b border-amber-500/30 bg-amber-500/5 px-6 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-amber-400 font-semibold">
                Database tables required — run the SQL below in your Supabase dashboard
              </p>
              <p className="text-[11px] font-mono text-amber-400/70 mt-0.5">
                Missing: {dbStatus.missing_tables?.join(", ")}
              </p>
              {dbStatus.instructions && (
                <ol className="mt-2 space-y-0.5">
                  {dbStatus.instructions.map((step, i) => (
                    <li key={i} className="text-[11px] font-mono text-amber-400/60">{step}</li>
                  ))}
                </ol>
              )}
              <button
                onClick={() => setShowSql(v => !v)}
                className="mt-2 text-[11px] font-mono text-amber-400 underline underline-offset-2 hover:text-amber-300"
              >
                {showSql ? "Hide SQL" : "Show SQL to run"}
              </button>
              {showSql && dbStatus.schema_sql && (
                <pre className="mt-2 max-h-48 overflow-y-auto bg-background border border-amber-500/20 rounded p-3 text-[10px] font-mono text-text-dim whitespace-pre-wrap break-all">
                  {dbStatus.schema_sql}
                </pre>
              )}
            </div>
            <button
              onClick={() => {
                setDbStatus({ status: "checking" });
                fetch("/api/music/setup-production-db")
                  .then(r => r.json())
                  .then(d => {
                    if (d.status === "ready") {
                      setDbStatus({ status: "ready" });
                      loadSoundbanks();
                    } else {
                      setDbStatus({ status: "missing_tables", ...d });
                    }
                  })
                  .catch(() => setDbStatus({ status: "error" }));
              }}
              className="shrink-0 text-[11px] font-mono text-amber-400 border border-amber-500/30 rounded px-2 py-1 hover:bg-amber-500/10"
            >
              Re-check
            </button>
          </div>
        </div>
      )}

      <div className="flex h-[calc(100vh-49px)]">
        {/* Left sidebar — pipeline steps */}
        <aside className="w-52 border-r border-border shrink-0 flex flex-col">
          <div className="p-4 border-b border-border">
            <p className="text-[10px] font-mono text-text-faint uppercase tracking-widest">Pipeline</p>
          </div>
          <nav className="flex-1 py-2">
            {PIPELINE_STEPS.map((step, i) => {
              const stepIdx = STATUS_ORDER.indexOf(step.status);
              const done = production && currentStatusIdx > stepIdx;
              const active = production && currentStatusIdx === stepIdx;
              const pending = !production || currentStatusIdx < stepIdx;

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 px-4 py-2.5 text-xs font-mono border-l-2 transition-colors ${
                    active
                      ? "border-brand text-foreground bg-brand/5"
                      : done
                      ? "border-border text-text-dim"
                      : "border-transparent text-text-faint"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    active ? "bg-brand pulse-dot" : done ? "bg-text-dim" : "bg-border"
                  }`} />
                  {step.label}
                  {done && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="ml-auto shrink-0">
                      <path d="M2 5l2.5 2.5L8 3" stroke="#4dffa0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Production info */}
          {production && (
            <div className="p-4 border-t border-border space-y-2">
              <p className="text-[10px] font-mono text-text-faint uppercase tracking-widest">Production</p>
              <p className="text-xs font-mono text-brand truncate">{production.style}</p>
              <p className="text-xs font-mono text-text-dim">{production.bpm} BPM · {production.key}</p>
              <div className="flex flex-wrap gap-1">
                {(production.mood_keywords ?? []).slice(0, 3).map(m => (
                  <span key={m} className="text-[9px] font-mono px-1 py-0.5 bg-surface-raised rounded text-text-faint">{m}</span>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          {production && (
            <div className="flex border-b border-border shrink-0">
              {(["brief", "reasoning", "midi", "quality", "export"] as Tab[]).map(tab => {
                const available =
                  tab === "brief" ||
                  (tab === "reasoning" && production.openai_structure) ||
                  (tab === "midi" && production.midi_metadata) ||
                  (tab === "quality" && production.quality_scores) ||
                  (tab === "export" && production.wav_path);
                return (
                  <button
                    key={tab}
                    onClick={() => available && setActiveTab(tab)}
                    className={`px-4 py-2.5 text-xs font-mono border-b-2 transition-colors ${
                      activeTab === tab
                        ? "border-brand text-foreground"
                        : available
                        ? "border-transparent text-text-dim hover:text-foreground"
                        : "border-transparent text-text-faint cursor-not-allowed opacity-40"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {/* Error bar */}
            {error && (
              <div className="mx-6 mt-4 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded text-xs font-mono text-destructive">
                {error}
                <button onClick={() => setError(null)} className="ml-3 opacity-60 hover:opacity-100">dismiss</button>
              </div>
            )}

            <div className="p-6 grid grid-cols-[1fr_280px] gap-6 items-start">
              {/* Left: tab content */}
              <div>
                {/* Brief / Creator */}
                {(!production || activeTab === "brief") && (
                  <Panel title="New Production" subtitle="Define your track and let OpenAI o1 reason through the music theory">
                    {production ? (
                      <div className="space-y-4">
                        <div className="bg-surface-raised rounded border border-border p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-text-faint">Brief:</span>
                            <span className="text-sm text-foreground">{production.brief}</span>
                          </div>
                          <div className="flex gap-4 text-xs font-mono">
                            <span className="text-text-faint">Style: <span className="text-brand">{production.style}</span></span>
                            <span className="text-text-faint">BPM: <span className="text-foreground">{production.bpm}</span></span>
                            <span className="text-text-faint">Key: <span className="text-foreground">{production.key}</span></span>
                          </div>
                        </div>
                        <button
                          onClick={() => setProduction(null)}
                          className="text-xs font-mono text-text-faint hover:text-foreground"
                        >
                          + Create new production
                        </button>
                      </div>
                    ) : (
                      <ProductionCreator
                        soundbanks={soundbanks}
                        onCreated={prod => {
                          setProduction(prod as unknown as Production);
                          setActiveTab("brief");
                        }}
                      />
                    )}
                  </Panel>
                )}

                {/* Reasoning */}
                {activeTab === "reasoning" && production?.openai_structure && reasoningLog && (
                  <Panel title="OpenAI o1 Music Structure" subtitle="Complete theory blueprint generated by the reasoning model">
                    <ReasoningDisplay
                      structure={production.openai_structure}
                      tokens={reasoningLog.tokens}
                      cost={reasoningLog.cost}
                      durationMs={reasoningLog.durationMs}
                      model={reasoningLog.model}
                    />
                  </Panel>
                )}

                {/* MIDI */}
                {activeTab === "midi" && production?.midi_metadata && midiData && (
                  <Panel title="MIDI Project + Ableton Instructions" subtitle="Generated note data, track layout, and Ableton Live setup guide">
                    <MidiPreview
                      metadata={production.midi_metadata}
                      ableton={midiData.ableton}
                      wavSpec={null}
                    />
                  </Panel>
                )}

                {/* Quality */}
                {activeTab === "quality" && production?.quality_scores && (
                  <Panel title="Quality Assessment" subtitle="6-gate validation pipeline — all gates must pass before WAV export">
                    <QualityGates
                      scores={production.quality_scores}
                      status={production.status}
                    />
                  </Panel>
                )}

                {/* Export */}
                {activeTab === "export" && exportData && (
                  <Panel title="WAV Export Package" subtitle="Final stereo master specification and Ableton render guide">
                    <ExportPanel data={exportData} />
                  </Panel>
                )}
              </div>

              {/* Right: action panel */}
              <div className="space-y-4 sticky top-6">
                {production && (
                  <>
                    {/* Next action */}
                    <ActionCard
                      step="02"
                      title="Run OpenAI o1 Reasoning"
                      description="Sends brief + soundbank stems to OpenAI o1 for deep music theory analysis. Returns complete production blueprint."
                      badge="~$0.50–$1.00"
                      disabled={currentStatusIdx >= 1}
                      loading={running === "reasoning"}
                      done={currentStatusIdx > 1 || (production.openai_structure !== null)}
                      onClick={runAnalyzeReasoning}
                    />

                    <ActionCard
                      step="03"
                      title="Generate MIDI + Arrangement"
                      description="Converts the reasoning structure into MIDI tracks, stem assignments, mixing chain, and Ableton project instructions."
                      badge="instant"
                      disabled={!production.openai_structure || currentStatusIdx >= 3}
                      loading={running === "midi"}
                      done={currentStatusIdx >= 3}
                      onClick={runGenerateMidi}
                    />

                    <ActionCard
                      step="06"
                      title="Export WAV Package"
                      description="Runs compliance checks across all platforms, calculates final quality scores, and produces the WAV master specification."
                      badge="instant"
                      disabled={currentStatusIdx < 3}
                      loading={running === "export"}
                      done={currentStatusIdx >= 5}
                      onClick={runExportWav}
                    />

                    {/* Status badge */}
                    <div className="border border-border rounded px-3 py-2.5 bg-surface-raised">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-text-faint uppercase tracking-widest">Status</span>
                        <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                          production.status === "exported" ? "bg-brand/20 text-brand" :
                          production.status === "brief" ? "bg-border text-text-dim" :
                          "bg-status-sent/15 text-status-sent"
                        }`}>
                          {production.status}
                        </span>
                      </div>
                      {production.reasoning_tokens > 0 && (
                        <div className="mt-2 text-[10px] font-mono text-text-faint space-y-0.5">
                          <div>Tokens: {production.reasoning_tokens.toLocaleString()}</div>
                          <div>Cost: ${production.reasoning_cost.toFixed(4)}</div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Quality gates mini */}
                {production?.quality_scores && (
                  <div className="border border-border rounded p-3 bg-surface-raised">
                    <QualityGates scores={production.quality_scores} status={production.status} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-text-dim mt-0.5 font-mono">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function ActionCard({
  step, title, description, badge, disabled, loading, done, onClick,
}: {
  step: string;
  title: string;
  description: string;
  badge: string;
  disabled: boolean;
  loading: boolean;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <div className={`border rounded p-3 space-y-2 transition-colors ${
      done ? "border-brand/30 bg-brand/5" : disabled ? "border-border/40 opacity-50" : "border-border bg-surface-raised"
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-text-faint">{step}</span>
        <span className="text-[10px] font-mono text-text-faint">{badge}</span>
      </div>
      <p className="text-xs font-semibold text-foreground leading-tight">{title}</p>
      <p className="text-[11px] text-text-dim leading-relaxed">{description}</p>
      <button
        onClick={onClick}
        disabled={disabled || loading || done}
        className={`w-full py-2 text-xs font-mono rounded transition-colors ${
          done
            ? "bg-brand/10 text-brand cursor-default"
            : disabled
            ? "bg-surface-overlay text-text-faint cursor-not-allowed"
            : "bg-brand text-background hover:bg-brand/90"
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-background animate-pulse" />
            Running...
          </span>
        ) : done ? "Done" : "Run"}
      </button>
    </div>
  );
}

function ExportPanel({ data }: {
  data: {
    wav_file: { path: string; size_mb: string; duration: string; format: string; loudness: string };
    compliance: { overall: boolean; release_ready: boolean; report: string; platforms: { platform: string; compliant: boolean }[] };
    quality_scores: QualityScores;
    ableton_project: { export_steps: string[]; project_name: string };
  };
}) {
  return (
    <div className="space-y-6">
      {/* WAV file */}
      <div className="bg-surface-raised border border-brand/30 rounded p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
          <span className="text-xs font-mono text-brand uppercase tracking-widest">WAV Master Ready</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Format", value: data.wav_file.format },
            { label: "Loudness", value: data.wav_file.loudness },
            { label: "Duration", value: data.wav_file.duration },
            { label: "Size (est.)", value: `${data.wav_file.size_mb} MB` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-mono text-text-faint uppercase tracking-widest">{label}</p>
              <p className="text-sm font-mono text-foreground mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Platform compliance */}
      <div>
        <h4 className="text-xs font-mono text-text-faint uppercase tracking-widest mb-3">Platform Compliance</h4>
        <div className="grid grid-cols-2 gap-2">
          {data.compliance.platforms.map(p => (
            <div key={p.platform} className="flex items-center gap-2 py-1 text-xs font-mono">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.compliant ? "bg-brand" : "bg-destructive"}`} />
              <span className={p.compliant ? "text-foreground" : "text-destructive"}>{p.platform}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-dim mt-2 font-mono leading-relaxed">{data.compliance.report}</p>
      </div>

      {/* Ableton steps */}
      <div>
        <h4 className="text-xs font-mono text-text-faint uppercase tracking-widest mb-3">Ableton Render Steps</h4>
        <div className="space-y-2">
          {data.ableton_project.export_steps.map((step, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className="text-brand font-mono shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-text-dim leading-relaxed">{step.replace(/^\d+\.\s*/, "")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quality scores */}
      <QualityGates scores={data.quality_scores} status="exported" />
    </div>
  );
}
