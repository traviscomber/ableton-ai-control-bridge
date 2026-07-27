"use client";

import { useState, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant = "daytime" | "morning" | "night";

interface StemResult {
  name: string;
  wav_b64: string;
  sampleRate: number;
  bitDepth: number;
  durationSec: number;
  sizeBytes: number;
}

interface MixResult {
  wav_b64: string;
  lufs: number;
  truePeak: number;
  dynamicRange: number;
  durationSec: number;
  sizeBytes: number;
}

interface GenerateResponse {
  stems: StemResult[];
  mix?: MixResult;
  meta: {
    bpm: number;
    key: string;
    bars: number;
    variant: Variant;
    description: string;
    renderTimeMs: number;
    stemCount: number;
    totalSizeBytes: number;
  };
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_STEMS = ["kick", "snare", "hihat", "bass", "pad", "stab", "arp", "noise"] as const;
type StemName = typeof ALL_STEMS[number];

const STEM_COLORS: Record<StemName, string> = {
  kick:  "#e85d3c",
  snare: "#e8a23c",
  hihat: "#c8d43c",
  bass:  "#3cd4a8",
  pad:   "#3c9de8",
  stab:  "#8c5de8",
  arp:   "#e83ca8",
  noise: "#6b6b76",
};

const STEM_LABELS: Record<StemName, string> = {
  kick:  "Kick",
  snare: "Snare",
  hihat: "Hi-Hat",
  bass:  "Bass",
  pad:   "Pad",
  stab:  "Stab",
  arp:   "Arp",
  noise: "Noise",
};

const VARIANT_INFO: Record<Variant, { bpm: number; key: string; label: string; desc: string }> = {
  daytime: { bpm: 124, key: "C major",  label: "Daytime", desc: "Bright · Energetic · Club-ready" },
  morning: { bpm: 116, key: "G major",  label: "Morning", desc: "Warm · Soulful · Organic" },
  night:   { bpm: 120, key: "F minor",  label: "Night",   desc: "Deep · Mysterious · Hypnotic" },
};

// ─── Waveform visualiser ─────────────────────────────────────────────────────

function WaveformBar({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="flex items-end gap-px h-8">
      {Array.from({ length: 24 }).map((_, i) => {
        const height = active
          ? 20 + Math.abs(Math.sin(i * 1.1)) * 10 + Math.abs(Math.cos(i * 0.7)) * 6
          : 4 + Math.abs(Math.sin(i * 0.9)) * 4;
        return (
          <div
            key={i}
            className="w-px rounded-full transition-all duration-500"
            style={{
              height: `${height}px`,
              backgroundColor: active ? color : "var(--text-faint)",
              opacity: active ? 0.85 : 0.4,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Animated playing indicator ───────────────────────────────────────────────

function PlayingPulse({ color }: { color: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span
        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full h-2 w-2"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

// ─── Stem card ────────────────────────────────────────────────────────────────

function StemCard({
  name,
  result,
  selected,
  onToggle,
}: {
  name: StemName;
  result?: StemResult;
  selected: boolean;
  onToggle: () => void;
}) {
  const color = STEM_COLORS[name];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const play = useCallback(() => {
    if (!result) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const blob = new Blob(
      [Uint8Array.from(atob(result.wav_b64), (c) => c.charCodeAt(0))],
      { type: "audio/wav" }
    );
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { setPlaying(false); URL.revokeObjectURL(url); };
    audio.onpause = () => setPlaying(false);
    setPlaying(true);
    audio.play();
  }, [result]);

  const download = useCallback(() => {
    if (!result) return;
    const blob = new Blob(
      [Uint8Array.from(atob(result.wav_b64), (c) => c.charCodeAt(0))],
      { type: "audio/wav" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${result.name}.wav`;
    a.click();
  }, [result]);

  return (
    <div
      className="rounded-lg border transition-all duration-150 overflow-hidden"
      style={{
        borderColor: selected ? color + "60" : "var(--border)",
        backgroundColor: selected ? color + "08" : "var(--card)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Toggle checkbox */}
        <button
          onClick={onToggle}
          className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
          style={{
            borderColor: selected ? color : "var(--border)",
            backgroundColor: selected ? color : "transparent",
          }}
          aria-label={`${selected ? "Deselect" : "Select"} ${STEM_LABELS[name]} stem`}
        >
          {selected && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-mono font-semibold uppercase tracking-wider"
              style={{ color }}
            >
              {STEM_LABELS[name]}
            </span>
            {playing && <PlayingPulse color={color} />}
          </div>
          {result && (
            <p className="text-xs text-text-faint mt-0.5 font-mono">
              {result.durationSec.toFixed(2)}s · 48kHz/24bit · {(result.sizeBytes / 1024).toFixed(0)}kB
            </p>
          )}
        </div>

        {/* Actions */}
        {result && (
          <div className="flex gap-1.5">
            <button
              onClick={play}
              className="px-2.5 py-1 rounded text-xs font-mono transition-colors"
              style={{
                backgroundColor: playing ? color + "30" : "var(--surface-raised)",
                color: playing ? color : "var(--text-dim)",
              }}
              aria-label={`Play ${STEM_LABELS[name]}`}
            >
              {playing ? "■" : "▶"}
            </button>
            <button
              onClick={download}
              className="px-2.5 py-1 rounded text-xs font-mono transition-colors bg-surface-raised text-text-dim hover:text-foreground"
              aria-label={`Download ${STEM_LABELS[name]} WAV`}
            >
              ↓
            </button>
          </div>
        )}
      </div>

      {/* Waveform bar */}
      <div className="px-4 pb-3">
        <WaveformBar active={!!result} color={color} />
      </div>
    </div>
  );
}

// ─── Mix card ─────────────────────────────────────────────────────────────────

function MixCard({ mix }: { mix: MixResult }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const play = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const blob = new Blob(
      [Uint8Array.from(atob(mix.wav_b64), (c) => c.charCodeAt(0))],
      { type: "audio/wav" }
    );
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { setPlaying(false); URL.revokeObjectURL(url); };
    setPlaying(true);
    audio.play();
  };

  const download = () => {
    const blob = new Blob(
      [Uint8Array.from(atob(mix.wav_b64), (c) => c.charCodeAt(0))],
      { type: "audio/wav" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "darksco-mix-master.wav";
    a.click();
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Stereo Mix Master</h3>
          <p className="text-xs text-text-dim font-mono mt-1">
            {mix.durationSec.toFixed(2)}s · 48kHz/24bit stereo · {(mix.sizeBytes / 1024).toFixed(0)}kB
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={play}
            className="px-3 py-1.5 rounded text-sm font-mono transition-colors"
            style={{ backgroundColor: "var(--surface-raised)", color: playing ? "#3c9de8" : "var(--text-dim)" }}
          >
            {playing ? "■ Stop" : "▶ Play"}
          </button>
          <button
            onClick={download}
            className="px-3 py-1.5 rounded text-sm font-mono bg-surface-raised text-text-dim hover:text-foreground transition-colors"
          >
            ↓ WAV
          </button>
        </div>
      </div>

      {/* LUFS meters */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        {[
          { label: "Integrated", value: mix.lufs.toFixed(1), unit: "LUFS", ok: mix.lufs > -16 && mix.lufs < -12 },
          { label: "True Peak",  value: mix.truePeak.toFixed(1), unit: "dBTP", ok: mix.truePeak < -0.1 },
          { label: "Dyn. Range", value: mix.dynamicRange.toFixed(1), unit: "LU", ok: mix.dynamicRange > 4 },
        ].map((m) => (
          <div key={m.label} className="bg-surface-raised rounded-md p-3 text-center">
            <p className="text-xs text-text-faint font-mono uppercase tracking-wider">{m.label}</p>
            <p
              className="text-lg font-mono font-bold mt-1"
              style={{ color: m.ok ? "#3cd4a8" : "#e85d3c" }}
            >
              {m.value}
              <span className="text-xs font-normal text-text-dim ml-1">{m.unit}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StemGeneratorPage() {
  const [variant, setVariant] = useState<Variant>("night");
  const [bars, setBars] = useState(8);
  const [selectedStems, setSelectedStems] = useState<Set<StemName>>(
    new Set(ALL_STEMS)
  );
  const [includeMix, setIncludeMix] = useState(true);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const toggleStem = (name: StemName) => {
    setSelectedStems((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const generate = async () => {
    if (selectedStems.size === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(10);

    // Fake progress while waiting
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 8, 88));
    }, 200);

    try {
      const res = await fetch("/api/music/generate-stems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variant,
          bars,
          stems: [...selectedStems],
          includeMix,
        }),
      });

      clearInterval(interval);
      setProgress(100);

      const data: GenerateResponse = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Generation failed");
      } else {
        setResult(data);
      }
    } catch (e) {
      clearInterval(interval);
      setError(String(e));
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 600);
    }
  };

  const stemMap = new Map<string, StemResult>();
  result?.stems.forEach((s) => {
    const key = s.name.replace(`-${result.meta.variant}`, "");
    stemMap.set(key, s);
  });

  return (
    <main className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Stem Generator</h1>
            <p className="text-xs text-text-dim font-mono mt-0.5">
              Zero-dependency synthesis · 48kHz / 24-bit WAV
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-text-faint">DARKSCO ENGINE</span>
            <span className="w-2 h-2 rounded-full bg-brand-dim" />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Controls */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Variant picker */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-mono text-text-dim uppercase tracking-wider">Variant</label>
            <div className="flex gap-2">
              {(Object.keys(VARIANT_INFO) as Variant[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setVariant(v)}
                  className="flex-1 rounded-lg border px-3 py-2.5 text-left transition-all duration-150"
                  style={{
                    borderColor: variant === v ? "var(--brand)" : "var(--border)",
                    backgroundColor: variant === v ? "var(--brand-dim)20" : "var(--card)",
                  }}
                >
                  <p
                    className="text-xs font-semibold"
                    style={{ color: variant === v ? "var(--brand)" : "var(--foreground)" }}
                  >
                    {VARIANT_INFO[v].label}
                  </p>
                  <p className="text-xs text-text-faint font-mono mt-0.5">
                    {VARIANT_INFO[v].bpm} BPM · {VARIANT_INFO[v].key}
                  </p>
                </button>
              ))}
            </div>
            <p className="text-xs text-text-dim font-mono">{VARIANT_INFO[variant].desc}</p>
          </div>

          {/* Settings */}
          <div className="flex flex-col gap-4">
            {/* Bars */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono text-text-dim uppercase tracking-wider">
                Bars — <span className="text-foreground">{bars}</span>
              </label>
              <div className="flex gap-2">
                {[4, 8, 16, 32].map((b) => (
                  <button
                    key={b}
                    onClick={() => setBars(b)}
                    className="flex-1 py-2 rounded border text-xs font-mono transition-colors"
                    style={{
                      borderColor: bars === b ? "var(--brand)" : "var(--border)",
                      backgroundColor: bars === b ? "var(--brand-dim)20" : "var(--card)",
                      color: bars === b ? "var(--brand)" : "var(--text-dim)",
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Include mix */}
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                onClick={() => setIncludeMix((v) => !v)}
                className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0"
                style={{
                  borderColor: includeMix ? "var(--brand)" : "var(--border)",
                  backgroundColor: includeMix ? "var(--brand)" : "transparent",
                }}
              >
                {includeMix && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span className="text-sm text-foreground">Include stereo mix master</span>
            </label>
          </div>
        </section>

        {/* Stem selector */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-mono text-text-dim uppercase tracking-wider">Stems</label>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedStems(new Set(ALL_STEMS))}
                className="text-xs font-mono text-text-dim hover:text-foreground transition-colors"
              >
                All
              </button>
              <button
                onClick={() => setSelectedStems(new Set())}
                className="text-xs font-mono text-text-dim hover:text-foreground transition-colors"
              >
                None
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {ALL_STEMS.map((name) => (
              <StemCard
                key={name}
                name={name}
                result={stemMap.get(name)}
                selected={selectedStems.has(name)}
                onToggle={() => toggleStem(name)}
              />
            ))}
          </div>
        </section>

        {/* Generate button + progress */}
        <section className="flex flex-col gap-3">
          {loading && progress > 0 && (
            <div className="h-px bg-border rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-200 rounded-full"
                style={{ width: `${progress}%`, backgroundColor: "var(--brand)" }}
              />
            </div>
          )}

          <button
            onClick={generate}
            disabled={loading || selectedStems.size === 0}
            className="w-full py-3 rounded-lg border text-sm font-semibold font-mono transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              borderColor: "var(--brand)",
              backgroundColor: loading ? "transparent" : "var(--brand-dim)20",
              color: "var(--brand)",
            }}
          >
            {loading
              ? `Synthesising ${selectedStems.size} stem${selectedStems.size !== 1 ? "s" : ""}...`
              : `Generate ${selectedStems.size} stem${selectedStems.size !== 1 ? "s" : ""}${includeMix ? " + mix" : ""}`}
          </button>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive font-mono">{error}</p>
            </div>
          )}
        </section>

        {/* Results */}
        {result && (
          <section className="flex flex-col gap-4">
            {/* Meta banner */}
            <div className="flex items-center justify-between rounded-lg bg-surface-raised px-4 py-3">
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-brand uppercase tracking-wider">
                  {result.meta.variant} · {result.meta.bpm} BPM · {result.meta.key}
                </span>
                <span className="text-xs text-text-faint font-mono">
                  {result.meta.stemCount} stems · {(result.meta.totalSizeBytes / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              <span className="text-xs font-mono text-text-faint">
                {result.meta.renderTimeMs}ms render
              </span>
            </div>

            {/* Updated stem grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {ALL_STEMS.map((name) => (
                <StemCard
                  key={name}
                  name={name}
                  result={stemMap.get(name)}
                  selected={selectedStems.has(name)}
                  onToggle={() => toggleStem(name)}
                />
              ))}
            </div>

            {/* Mix master */}
            {result.mix && <MixCard mix={result.mix} />}
          </section>
        )}

        {/* Engine info */}
        <section className="border-t border-border pt-6">
          <h2 className="text-xs font-mono text-text-faint uppercase tracking-wider mb-4">Engine Architecture</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: "WAV Engine",
                file: "lib/synth/wav-engine.ts",
                items: ["Sine · Saw · Square · Triangle · Noise oscillators", "ADSR envelope generator", "Biquad filter (LP · HP · BP · Notch · Peak)", "Schroeder reverb · Delay line", "Stereo panning (constant-power)", "16-bit / 24-bit WAV encoder"],
              },
              {
                title: "Drum Synthesizer",
                file: "lib/synth/drum-synth.ts",
                items: ["Kick — 808 pitched sine + pitch sweep", "Snare — tone body + HP noise burst", "Hi-Hat — metallic filtered noise (open/closed)", "Clap — layered noise bursts with smear", "Perc — short metallic transient", "16-step sequencer with swing"],
              },
              {
                title: "Mastering Chain",
                file: "lib/synth/mastering.ts",
                items: ["5-band parametric EQ (biquad)", "Bus compressor (RMS, feed-forward)", "Stereo widener (M/S)", "Look-ahead brick-wall limiter", "ITU-R BS.1770-4 LUFS meter", "Target normalisation to -14 LUFS"],
              },
            ].map((mod) => (
              <div key={mod.title} className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">{mod.title}</h3>
                <p className="text-xs font-mono text-text-faint mt-0.5 mb-3">{mod.file}</p>
                <ul className="flex flex-col gap-1.5">
                  {mod.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-text-dim">
                      <span className="text-text-faint mt-0.5">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
