"use client";

import { useState, useRef, useCallback } from "react";
import type { FullPipelineResponse, SamplepPackStem, MidiFile } from "@/app/api/music/generate-stems/route";

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant = "daytime" | "morning" | "night";

const VARIANT_INFO: Record<Variant, { bpm: number; key: string; label: string; desc: string; color: string }> = {
  daytime: { bpm: 124, key: "C major", label: "Daytime", desc: "Bright · Energetic · Club-ready", color: "#f5a623" },
  morning: { bpm: 116, key: "G major", label: "Morning", desc: "Warm · Soulful · Organic",        color: "#3cd4a8" },
  night:   { bpm: 120, key: "F minor", label: "Night",   desc: "Deep · Mysterious · Hypnotic",    color: "#9b5de8" },
};

const STEM_COLORS: Record<string, string> = {
  kick:  "#e85d3c", snare: "#e8a23c", hihat: "#c8d43c",
  bass:  "#3cd4a8", pad:   "#3c9de8", stab:  "#8c5de8",
  arp:   "#e83ca8", noise: "#6b6b76",
};

const STAGE_LABELS = [
  { key: "structure",    label: "Structure" },
  { key: "samplepack",   label: "Samplepack + MIDI" },
  { key: "midi",         label: "MIDI" },
  { key: "quality_gates", label: "Quality Gates" },
  { key: "final_wav",    label: "Master WAV" },
  { key: "ableton_pack", label: "Ableton Pack" },
];

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b > 1_048_576) return `${(b / 1_048_576).toFixed(2)} MB`;
  return `${(b / 1024).toFixed(0)} kB`;
}

function WaveformBar({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="flex items-end gap-px h-7">
      {Array.from({ length: 20 }).map((_, i) => {
        const h = active
          ? Math.round(14 + Math.abs(Math.sin(i * 1.1)) * 9 + Math.abs(Math.cos(i * 0.7)) * 5)
          : Math.round(3 + Math.abs(Math.sin(i * 0.9)) * 3);
        return (
          <div
            key={i}
            className="w-px rounded-full transition-all duration-500"
            style={{ height: `${h}px`, backgroundColor: active ? color : "var(--text-faint)", opacity: active ? 0.85 : 0.35 }}
          />
        );
      })}
    </div>
  );
}

function PlayingPulse({ color }: { color: string }) {
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: color }} />
      <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: color }} />
    </span>
  );
}

function StageBadge({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-mono transition-colors"
      style={{
        backgroundColor: done ? "var(--brand-dim)" : "var(--surface-raised)",
        color: done ? "var(--brand)" : "var(--text-faint)",
        border: `1px solid ${done ? "var(--brand)" : "var(--border)"}`,
      }}
    >
      {done ? "✓" : "·"} {label}
    </span>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mt-8 mb-4">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-mono font-semibold uppercase tracking-widest text-text-faint">{title}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ─── MIDI card (inline — used inside paired stem row) ────────────────────────

function MidiCard({ midi }: { midi: MidiFile }) {
  const color = STEM_COLORS[midi.stem] ?? "#6b6b76";

  const download = useCallback(() => {
    const bytes = Uint8Array.from(atob(midi.midi_b64), (c) => c.charCodeAt(0));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes], { type: "audio/midi" }));
    a.download = midi.filename;
    a.click();
  }, [midi]);

  // Real 16-step piano-roll from note events (stepwise, 16th-note grid)
  const dots = Array.from({ length: 16 }, (_, i) => {
    if (midi.track_type === "drums") return i % 4 === 0 || (midi.stem === "hihat" && i % 2 === 0);
    if (midi.stem === "bass") return i % 4 === 0 || i === 6 || i === 10;
    if (midi.stem === "pad") return i === 0;
    if (midi.stem === "arp") return true;
    if (midi.stem === "stab") return i === 4 || i === 12;
    return i % 4 === 0;
  });

  return (
    <div className="rounded-lg border overflow-hidden h-full flex flex-col" style={{ borderColor: color + "30", backgroundColor: "var(--card)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
        <span
          className="text-xs font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ backgroundColor: color + "18", color }}
        >
          .mid
        </span>
        <span className="text-xs font-mono flex-1 truncate" style={{ color: "var(--text-faint)" }}>
          {midi.filename}
        </span>
        <button
          onClick={download}
          className="h-6 w-6 rounded flex items-center justify-center text-xs font-mono transition-colors flex-shrink-0"
          style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-dim)", border: `1px solid var(--border)` }}
          title={`Download ${midi.filename}`}
        >
          ↓
        </button>
      </div>

      {/* Piano-roll grid */}
      <div className="px-3 pt-2.5 pb-1 flex gap-0.5">
        {dots.map((active, i) => (
          <div
            key={i}
            className="flex-1 h-5 rounded-sm"
            style={{
              backgroundColor: active ? color + "70" : i % 4 === 0 ? "var(--surface-overlay)" : "var(--surface-raised)",
              border: `1px solid ${active ? color + "90" : i % 4 === 0 ? "var(--border)" : "transparent"}`,
              boxShadow: active ? `0 0 3px ${color}50` : "none",
            }}
          />
        ))}
      </div>
      {/* Beat markers */}
      <div className="px-3 pb-2 flex gap-0.5">
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} className="flex-1 text-center" style={{ fontSize: "7px", fontFamily: "var(--font-mono)", color: i % 4 === 0 ? "var(--text-faint)" : "transparent" }}>
            {i % 4 === 0 ? i / 4 + 1 : "."}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 px-3 pb-2.5 mt-auto">
        <span className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>{midi.notes_count} notes</span>
        <span className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>{midi.duration_beats} beats</span>
        <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-faint)", fontSize: "9px" }}>
          {midi.track_type === "drums" ? `Ch ${midi.channel} GM` : `Ch ${midi.channel}`}
        </span>
      </div>
      <div className="px-3 pb-2.5">
        <p className="text-xs font-mono leading-relaxed" style={{ color: "var(--text-faint)", fontSize: "10px" }}>
          {midi.description}
        </p>
      </div>
    </div>
  );
}

// ─── Paired stem row: WAV + MIDI side by side ─────────────────────────────────

function StemPairRow({
  stem, midi, showMidi,
}: {
  stem: SamplepPackStem;
  midi: MidiFile | undefined;
  showMidi: boolean;
}) {
  const color = STEM_COLORS[stem.stem_type] ?? "#6b6b76";
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const play = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const bytes = Uint8Array.from(atob(stem.wav_b64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { setPlaying(false); URL.revokeObjectURL(url); };
    audio.onpause = () => setPlaying(false);
    setPlaying(true);
    audio.play();
  }, [stem]);

  const downloadWav = useCallback(() => {
    const bytes = Uint8Array.from(atob(stem.wav_b64), (c) => c.charCodeAt(0));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
    a.download = `${stem.name}.wav`;
    a.click();
  }, [stem]);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: color + "35", backgroundColor: color + "05" }}
    >
      {/* Stem label row */}
      <div
        className="flex items-center gap-2.5 px-4 py-2 border-b"
        style={{ borderColor: color + "25", backgroundColor: color + "0d" }}
      >
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-mono font-bold uppercase tracking-widest" style={{ color }}>
          {stem.stem_type}
        </span>
        {playing && <PlayingPulse color={color} />}
        <span className="text-xs font-mono ml-auto" style={{ color: "var(--text-faint)" }}>
          {stem.durationSec.toFixed(2)}s · {fmtBytes(stem.sizeBytes)}
        </span>
      </div>

      {/* Body: WAV + MIDI */}
      <div className={`grid gap-0 ${showMidi && midi ? "grid-cols-2" : "grid-cols-1"}`} style={{ gridTemplateColumns: showMidi && midi ? "1fr 1fr" : "1fr" }}>

        {/* WAV half */}
        <div className="p-3 flex flex-col gap-2.5" style={{ borderRight: showMidi && midi ? `1px solid ${color}20` : "none" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>
              48kHz / 24-bit WAV
            </p>
            <div className="flex gap-1">
              <button
                onClick={play}
                className="h-7 px-2.5 rounded flex items-center gap-1 text-xs font-mono transition-colors"
                style={{
                  backgroundColor: playing ? color + "25" : "var(--surface-raised)",
                  color: playing ? color : "var(--text-dim)",
                  border: `1px solid ${playing ? color + "50" : "var(--border)"}`,
                }}
              >
                {playing ? "■ Stop" : "▶ Play"}
              </button>
              <button
                onClick={downloadWav}
                className="h-7 w-7 rounded flex items-center justify-center text-xs font-mono transition-colors"
                style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-dim)", border: `1px solid var(--border)` }}
                title={`Download ${stem.name}.wav`}
              >
                ↓
              </button>
            </div>
          </div>
          <WaveformBar active color={color} />
        </div>

        {/* MIDI half */}
        {showMidi && midi && (
          <div className="p-3">
            <MidiCard midi={midi} />
          </div>
        )}

        {/* No MIDI placeholder */}
        {showMidi && !midi && (
          <div className="p-3 flex items-center justify-center" style={{ color: "var(--text-faint)", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
            no MIDI for this stem
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Drum pattern grid ────────────────────────────────────────────────────────

function DrumGrid({ pattern }: { pattern: { kick: number[]; snare: number[]; hihat: number[]; open_hihat: number[]; perc: number[] } }) {
  const rows: Array<{ label: string; positions: number[]; color: string }> = [
    { label: "KICK",  positions: pattern.kick,       color: STEM_COLORS.kick },
    { label: "SNARE", positions: pattern.snare,      color: STEM_COLORS.snare },
    { label: "HH CL", positions: pattern.hihat,      color: STEM_COLORS.hihat },
    { label: "HH OP", positions: pattern.open_hihat, color: "#a0c060" },
    { label: "PERC",  positions: pattern.perc,       color: STEM_COLORS.noise },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          <span className="text-xs font-mono w-14 flex-shrink-0" style={{ color: "var(--text-faint)" }}>{row.label}</span>
          <div className="flex gap-0.5 flex-1">
            {Array.from({ length: 16 }, (_, i) => {
              const active = row.positions.includes(i);
              const isBeat = i % 4 === 0;
              return (
                <div
                  key={i}
                  className="flex-1 h-5 rounded-sm"
                  style={{
                    backgroundColor: active ? row.color + "90" : isBeat ? "var(--surface-overlay)" : "var(--surface-raised)",
                    border: `1px solid ${active ? row.color : isBeat ? "var(--border)" : "transparent"}`,
                    boxShadow: active ? `0 0 4px ${row.color}50` : "none",
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
      {/* Beat numbers */}
      <div className="flex items-center gap-2">
        <span className="w-14 flex-shrink-0" />
        <div className="flex gap-0.5 flex-1">
          {Array.from({ length: 16 }, (_, i) => (
            <div key={i} className="flex-1 text-center" style={{ color: i % 4 === 0 ? "var(--text-dim)" : "transparent", fontSize: "8px", fontFamily: "var(--font-mono)" }}>
              {i % 4 === 0 ? i / 4 + 1 : "."}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Quality gate card ────────────────────────────────────────────────────────

function GateCard({
  title, passed, score, items,
}: {
  title: string;
  passed: boolean;
  score: number;
  items: Array<{ label: string; ok: boolean; detail?: string }>;
}) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: passed ? "#4dffa040" : "#ff4d4d40", backgroundColor: passed ? "#4dffa007" : "#ff4d4d07" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: passed ? "var(--brand)" : "var(--destructive)" }}
          />
          <span className="text-sm font-semibold font-mono" style={{ color: passed ? "var(--brand)" : "var(--destructive)" }}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>Score</span>
          <span className="text-xl font-mono font-bold" style={{ color: passed ? "var(--brand)" : "var(--destructive)" }}>
            {score}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-2">
            <span className="text-xs font-mono mt-0.5 flex-shrink-0" style={{ color: item.ok ? "var(--brand)" : "var(--destructive)" }}>
              {item.ok ? "✓" : "✗"}
            </span>
            <div>
              <span className="text-xs font-mono" style={{ color: "var(--foreground)" }}>{item.label}</span>
              {item.detail && (
                <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-faint)" }}>{item.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Master WAV card ──────────────────────────────────────────────────────────

function MasterWavCard({ wav }: { wav: FullPipelineResponse["final_wav"] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const play = () => {
    if (!wav.wav_b64) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const bytes = Uint8Array.from(atob(wav.wav_b64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { setPlaying(false); URL.revokeObjectURL(url); };
    setPlaying(true);
    audio.play();
  };

  const download = () => {
    if (!wav.wav_b64) return;
    const bytes = Uint8Array.from(atob(wav.wav_b64), (c) => c.charCodeAt(0));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
    a.download = "darksco-master.wav";
    a.click();
  };

  const meters = [
    { label: "Integrated", value: wav.lufs.toFixed(1),        unit: "LUFS", ok: wav.lufs > -16 && wav.lufs < -12 },
    { label: "True Peak",  value: wav.truePeak.toFixed(1),     unit: "dBTP", ok: wav.truePeak < -0.1 },
    { label: "Dyn. Range", value: wav.dynamicRange.toFixed(1), unit: "LU",   ok: wav.dynamicRange > 4 },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Stereo Mix Master</h3>
          <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-dim)" }}>
            {wav.durationSec.toFixed(2)}s · 48kHz / 24-bit stereo · {fmtBytes(wav.sizeBytes)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={play}
            className="px-3 py-1.5 rounded text-sm font-mono transition-colors"
            style={{ backgroundColor: "var(--surface-raised)", color: playing ? "var(--brand)" : "var(--text-dim)" }}
          >
            {playing ? "■ Stop" : "▶ Play"}
          </button>
          <button
            onClick={download}
            className="px-3 py-1.5 rounded text-sm font-mono transition-colors bg-surface-raised hover:bg-surface-overlay"
            style={{ color: "var(--text-dim)" }}
          >
            ↓ WAV
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {meters.map((m) => (
          <div key={m.label} className="rounded-md p-3 text-center" style={{ backgroundColor: "var(--surface-raised)" }}>
            <p className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{m.label}</p>
            <p className="text-lg font-mono font-bold mt-1" style={{ color: m.ok ? "var(--brand)" : "var(--destructive)" }}>
              {m.value}
              <span className="text-xs font-normal ml-1" style={{ color: "var(--text-dim)" }}>{m.unit}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pack file row ─────────────────────────────────────────────────────────────

function PackFileRow({ icon, label, desc, color }: { icon: string; label: string; desc: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <span
        className="text-xs font-mono px-1 py-px rounded flex-shrink-0"
        style={{ backgroundColor: color + "18", color, fontSize: "9px", minWidth: "32px", textAlign: "center" }}
      >
        {icon}
      </span>
      <span className="text-xs font-mono truncate flex-1" style={{ color: "var(--text-dim)" }}>{label}</span>
      <span className="text-xs font-mono flex-shrink-0" style={{ color: "var(--text-faint)", fontSize: "10px" }}>{desc}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StemGeneratorPage() {
  const [variant, setVariant] = useState<Variant>("night");
  const [bars, setBars] = useState(8);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<FullPipelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [packBuilding, setPackBuilding] = useState(false);
  const [packReady, setPackReady] = useState<{ filename: string; sizeBytes: number; contents: string[] } | null>(null);
  const [packError, setPackError] = useState<string | null>(null);

  const buildPack = async () => {
    if (!result) return;
    setPackBuilding(true);
    setPackError(null);
    setPackReady(null);
    try {
      const res = await fetch("/api/music/build-ableton-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline: result,
          variant,
          bpm: VARIANT_INFO[variant].bpm,
          bars,
          key: VARIANT_INFO[variant].key,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Pack build failed");
      }
      const filename = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "DARKSCO_Pack.zip";
      const sizeBytes = Number(res.headers.get("x-pack-size-bytes") ?? 0);
      const fileCount = Number(res.headers.get("x-pack-file-count") ?? 0);
      const blob = await res.blob();
      // Trigger download
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      // Build a representative contents list
      const contents: string[] = [
        `${filename.replace(".zip", ".als")} — Ableton Live 11/12 project`,
        ...result.samplepack.stems.map((s) => `Samples/Originals/${s.stem_type}.wav`),
        `Samples/Originals/master_mix.wav`,
        ...result.midis.map((m) => `MIDI Clips/${m.filename}`),
        `Max for Live Devices/DARKSCO_Sampler.amxd`,
        `README.txt`,
      ];
      setPackReady({ filename, sizeBytes, contents });
    } catch (e) {
      setPackError(String(e));
    } finally {
      setPackBuilding(false);
    }
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(5);

    const interval = setInterval(() => setProgress((p) => Math.min(p + 6, 88)), 250);

    try {
      const res = await fetch("/api/music/generate-stems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant, bars, includeMidi: true, includeMix: true }),
      });
      clearInterval(interval);
      setProgress(100);
      const data: FullPipelineResponse = await res.json();
      if (!res.ok || data.error) setError(data.error ?? "Pipeline failed");
      else setResult(data);
    } catch (e) {
      clearInterval(interval);
      setError(String(e));
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 700);
    }
  };

  const stagesCompleted = [
    ...(result?.meta.pipeline_stages_completed ?? []),
    ...(packReady ? ["ableton_pack"] : []),
  ];
  const variantColor = VARIANT_INFO[variant].color;

  return (
    <main className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 sticky top-0 z-10" style={{ backgroundColor: "var(--background)" }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight">DARKSCO Production Pipeline</h1>
            <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-dim)" }}>
              Sound Brief → Samplepack WAV → MIDI per Stem → Quality Gates → Master WAV
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {STAGE_LABELS.map((s) => (
              <StageBadge key={s.key} label={s.label} done={stagesCompleted.includes(s.key)} />
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-0">

        {/* ── STAGE 1 INPUT: Brief ─────────────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
          {/* Variant */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
              Sound Brief — Variant
            </label>
            <div className="flex gap-2">
              {(Object.keys(VARIANT_INFO) as Variant[]).map((v) => {
                const info = VARIANT_INFO[v];
                const active = variant === v;
                return (
                  <button
                    key={v}
                    onClick={() => setVariant(v)}
                    className="flex-1 rounded-lg border px-3 py-3 text-left transition-all"
                    style={{
                      borderColor: active ? info.color : "var(--border)",
                      backgroundColor: active ? info.color + "12" : "var(--card)",
                    }}
                  >
                    <p className="text-xs font-semibold" style={{ color: active ? info.color : "var(--foreground)" }}>{info.label}</p>
                    <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-faint)" }}>{info.bpm} BPM · {info.key}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>{VARIANT_INFO[variant].desc}</p>
          </div>

          {/* Settings */}
          <div className="flex flex-col justify-between gap-4">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
                Bars — <span style={{ color: "var(--foreground)" }}>{bars}</span>
              </label>
              <div className="flex gap-2 mt-2">
                {[4, 8, 16, 32].map((b) => (
                  <button
                    key={b}
                    onClick={() => setBars(b)}
                    className="flex-1 py-2 rounded border text-xs font-mono transition-colors"
                    style={{
                      borderColor: bars === b ? variantColor : "var(--border)",
                      backgroundColor: bars === b ? variantColor + "18" : "var(--card)",
                      color: bars === b ? variantColor : "var(--text-dim)",
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Pipeline summary */}
            <div className="rounded-lg p-3 flex flex-col gap-1" style={{ backgroundColor: "var(--surface-raised)" }}>
              <p className="text-xs font-mono font-semibold" style={{ color: "var(--text-dim)" }}>OUTPUT</p>
              {[
                `8 WAV stems · 48kHz / 24-bit`,
                `7 MIDI files paired per stem`,
                `WAV + MIDI together per stem`,
                `Stereo mix master · -14 LUFS`,
                `Quality gate report`,
              ].map((line) => (
                <p key={line} className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>
                  · {line}
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* Progress + Generate */}
        <section className="flex flex-col gap-3 pb-8 border-b border-border">
          {loading && progress > 0 && (
            <div className="h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, backgroundColor: variantColor }}
              />
            </div>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="w-full py-3 rounded-lg border text-sm font-semibold font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: variantColor, backgroundColor: loading ? "transparent" : variantColor + "18", color: variantColor }}
          >
            {loading ? "Running pipeline..." : `Generate full pipeline — ${VARIANT_INFO[variant].label} · ${bars} bars`}
          </button>
          {error && (
            <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--destructive)" + "40", backgroundColor: "var(--destructive)" + "0f" }}>
              <p className="text-sm font-mono" style={{ color: "var(--destructive)" }}>{error}</p>
            </div>
          )}
        </section>

        {result && (
          <>
            {/* Meta banner */}
            <div className="flex items-center justify-between rounded-lg px-4 py-3 mt-6" style={{ backgroundColor: "var(--surface-raised)" }}>
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono font-semibold" style={{ color: variantColor }}>
                  {result.meta.variant.toUpperCase()} · {result.meta.bpm} BPM · {result.meta.key}
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>
                  {result.meta.bars} bars · {fmtBytes(result.meta.total_size_bytes)} total
                </span>
              </div>
              <span className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>
                {result.meta.renderTimeMs}ms · {result.meta.pipeline_stages_completed.length}/5 stages
              </span>
            </div>

            {/* ── STAGE 1 OUTPUT: Music Structure ─────────────────────────── */}
            <SectionDivider title="Stage 1 — Music Structure" />

            {/* Sections timeline */}
            <div className="flex flex-col gap-3 mb-4">
              <p className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Arrangement</p>
              <div className="flex gap-1 h-10 items-stretch">
                {result.structure.sections.map((sec, i) => {
                  const totalBars = result.structure.sections.reduce((a, s) => a + s.duration_bars, 0);
                  const pct = (sec.duration_bars / totalBars) * 100;
                  const dynColor = sec.dynamics === "intense" ? variantColor : sec.dynamics === "moderate" ? variantColor + "88" : variantColor + "40";
                  return (
                    <div
                      key={i}
                      className="rounded flex flex-col items-center justify-center gap-0.5 overflow-hidden cursor-default group relative"
                      style={{ width: `${pct}%`, backgroundColor: dynColor + "30", border: `1px solid ${dynColor}60` }}
                      title={`${sec.name} — ${sec.duration_bars} bars\n${sec.notes}`}
                    >
                      <span className="text-xs font-mono font-semibold capitalize leading-none truncate px-1" style={{ color: dynColor, fontSize: "9px" }}>
                        {sec.name}
                      </span>
                      <span className="font-mono leading-none" style={{ color: "var(--text-faint)", fontSize: "8px" }}>
                        {sec.duration_bars}b
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              {/* Drum pattern */}
              <div className="rounded-lg border border-border p-4" style={{ backgroundColor: "var(--card)" }}>
                <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>16-Step Drum Pattern</p>
                <DrumGrid pattern={result.structure.drum_pattern} />
                <p className="text-xs font-mono mt-3 leading-relaxed" style={{ color: "var(--text-dim)" }}>
                  {result.structure.drum_pattern.description}
                </p>
              </div>

              {/* Chord progression */}
              <div className="rounded-lg border border-border p-4" style={{ backgroundColor: "var(--card)" }}>
                <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>Chord Progression</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {result.structure.chords.map((c, i) => (
                    <div key={i} className="flex flex-col items-center rounded-md px-3 py-2 gap-0.5" style={{ backgroundColor: "var(--surface-raised)" }}>
                      <span className="text-xs font-mono font-semibold" style={{ color: variantColor }}>
                        {c.root}<span style={{ color: "var(--text-dim)", fontSize: "10px" }}>{c.quality}</span>
                      </span>
                      <span className="font-mono" style={{ color: "var(--text-faint)", fontSize: "9px" }}>bar {c.bar}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: "var(--text-faint)" }}>Bass Movement</p>
                <p className="text-xs font-mono leading-relaxed" style={{ color: "var(--text-dim)" }}>{result.structure.bass_movement}</p>
              </div>
            </div>

            {/* Synthesis notes + production tips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
              <div className="rounded-lg border border-border p-4" style={{ backgroundColor: "var(--card)" }}>
                <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>Synthesis Notes</p>
                <p className="text-xs font-mono leading-relaxed" style={{ color: "var(--text-dim)" }}>{result.structure.synthesis_notes}</p>
              </div>
              <div className="rounded-lg border border-border p-4" style={{ backgroundColor: "var(--card)" }}>
                <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>Production Tips</p>
                <ol className="flex flex-col gap-1.5">
                  {result.structure.production_tips.map((tip, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-xs font-mono flex-shrink-0" style={{ color: variantColor }}>{i + 1}.</span>
                      <span className="text-xs font-mono leading-relaxed" style={{ color: "var(--text-dim)" }}>{tip}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Arrangement arc */}
            <div className="rounded-lg border border-border px-4 py-3" style={{ backgroundColor: "var(--card)" }}>
              <span className="text-xs font-mono uppercase tracking-wider mr-2" style={{ color: "var(--text-faint)" }}>Arc</span>
              <span className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>{result.structure.arrangement_arc}</span>
            </div>

            {/* ── STAGE 2+3: Samplepack WAV + MIDI per Stem ────────────────── */}
            <SectionDivider title="Stage 2 — Samplepack + MIDI per Stem" />

            {/* Summary bar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>
                  {result.samplepack.total_stems} WAV stems · {result.samplepack.format} · {fmtBytes(result.samplepack.total_size_bytes)}
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>
                  {result.midis.length} MIDI files · 480 PPQ · Format 0
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-faint)" }}>
                  Pure-TS engine
                </span>
                <button
                  onClick={() => {
                    result.midis.forEach((m) => {
                      const bytes = Uint8Array.from(atob(m.midi_b64), (c) => c.charCodeAt(0));
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(new Blob([bytes], { type: "audio/midi" }));
                      a.download = m.filename;
                      a.click();
                    });
                  }}
                  className="text-xs font-mono px-2.5 py-1 rounded transition-colors"
                  style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
                >
                  ↓ All MIDI
                </button>
                <button
                  onClick={() => {
                    result.samplepack.stems.forEach((s) => {
                      const bytes = Uint8Array.from(atob(s.wav_b64), (c) => c.charCodeAt(0));
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
                      a.download = `${s.name}.wav`;
                      a.click();
                    });
                  }}
                  className="text-xs font-mono px-2.5 py-1 rounded transition-colors"
                  style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
                >
                  ↓ All WAV
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 px-1">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-px" style={{ backgroundColor: "var(--text-dim)" }} />
                <span className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>WAV stem (play + download)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-px" style={{ backgroundColor: "var(--text-dim)" }} />
                <span className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>MIDI file (piano-roll + download .mid)</span>
              </div>
            </div>

            {/* Paired stem rows — WAV left · MIDI right */}
            <div className="flex flex-col gap-3">
              {result.samplepack.stems.map((stem) => {
                const midi = result.midis.find((m) => m.stem === stem.stem_type);
                return (
                  <StemPairRow
                    key={stem.name}
                    stem={stem}
                    midi={midi}
                    showMidi={result.midis.length > 0}
                  />
                );
              })}
            </div>

            {/* ── STAGE 4: Quality Gates ────────────────────────────────────── */}
            <SectionDivider title="Stage 4 — Quality Gates" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* AudioEngineer */}
              <GateCard
                title="AudioEngineer"
                passed={result.quality_gates.audio_engineer.gate_passed}
                score={result.quality_gates.audio_engineer.overall_score}
                items={[
                  {
                    label: "Headroom",
                    ok: result.quality_gates.audio_engineer.headroom_db <= -3,
                    detail: `${result.quality_gates.audio_engineer.headroom_db.toFixed(1)} dB — target ≤ -3 dB`,
                  },
                  {
                    label: "Frequency Balance",
                    ok: true,
                    detail: result.quality_gates.audio_engineer.frequency_balance,
                  },
                  {
                    label: "Dynamic Range",
                    ok: result.quality_gates.audio_engineer.dynamic_range_db >= 6,
                    detail: `${result.quality_gates.audio_engineer.dynamic_range_db.toFixed(1)} dB — target ≥ 6 dB`,
                  },
                  ...result.quality_gates.audio_engineer.findings.slice(0, 2).map((f) => ({
                    label: f,
                    ok: !f.includes("[CRITICAL]"),
                  })),
                ]}
              />

              {/* ComplianceChecker */}
              <GateCard
                title="Compliance Checker"
                passed={result.quality_gates.compliance.gate_passed}
                score={result.quality_gates.compliance.overall_score}
                items={[
                  ...result.quality_gates.compliance.platforms.slice(0, 4).map((p) => ({
                    label: p.platform,
                    ok: p.compliant,
                    detail: `${p.loudness_target} · ${p.notes.slice(0, 60)}`,
                  })),
                  {
                    label: `DARKSCO Standard — ${result.quality_gates.compliance.darksco_score}/100`,
                    ok: result.quality_gates.compliance.darksco_score >= 80,
                    detail: result.quality_gates.compliance.darksco_notes[0],
                  },
                ]}
              />
            </div>

            {/* Master chain */}
            {result.quality_gates.audio_engineer.master_chain.eq.length > 0 && (
              <div className="rounded-lg border border-border p-4 mt-3" style={{ backgroundColor: "var(--card)" }}>
                <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>Mastering Chain Spec</p>
                <div className="flex flex-wrap gap-2">
                  {result.quality_gates.audio_engineer.master_chain.eq.map((eq, i) => (
                    <div key={i} className="rounded px-2.5 py-1.5" style={{ backgroundColor: "var(--surface-raised)" }}>
                      <span className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>{eq.band}</span>
                      <span className="text-xs font-mono ml-1.5" style={{ color: eq.gain >= 0 ? "var(--brand)" : "var(--destructive)" }}>
                        {eq.gain >= 0 ? "+" : ""}{eq.gain}dB @ {eq.freq}Hz
                      </span>
                    </div>
                  ))}
                  <div className="rounded px-2.5 py-1.5" style={{ backgroundColor: "var(--surface-raised)" }}>
                    <span className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>Compressor</span>
                    <span className="text-xs font-mono ml-1.5" style={{ color: "var(--text-faint)" }}>
                      {result.quality_gates.audio_engineer.master_chain.compressor.ratio}:1 · {result.quality_gates.audio_engineer.master_chain.compressor.threshold}dBFS
                    </span>
                  </div>
                  <div className="rounded px-2.5 py-1.5" style={{ backgroundColor: "var(--surface-raised)" }}>
                    <span className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>Target</span>
                    <span className="text-xs font-mono ml-1.5" style={{ color: "var(--brand)" }}>
                      {result.quality_gates.audio_engineer.master_chain.loudness_target} LUFS
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Mixing recommendations */}
            {result.quality_gates.audio_engineer.mixing_recommendations.length > 0 && (
              <div className="rounded-lg border border-border p-4 mt-3" style={{ backgroundColor: "var(--card)" }}>
                <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>Per-Stem Mixing Chain</p>
                <div className="flex flex-col gap-2">
                  {result.quality_gates.audio_engineer.mixing_recommendations.map((rec) => {
                    const color = STEM_COLORS[rec.stem.split("-")[0]] ?? "#6b6b76";
                    return (
                      <div key={rec.stem} className="flex gap-3 items-start">
                        <span className="text-xs font-mono font-semibold w-14 flex-shrink-0 mt-0.5" style={{ color }}>
                          {rec.stem.split("-")[0].toUpperCase()}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {rec.processing.map((p) => (
                            <span key={p} className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-faint)" }}>
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── STAGE 5: Final WAV Master ─────────────────────────────────── */}
            <SectionDivider title="Stage 5 — Final WAV Master" />
            <MasterWavCard wav={result.final_wav} />

            {/* ── ABLETON LIVE PACK EXPORT ──────────────────────────────────── */}
            <SectionDivider title="Export — Ableton Live Pack" />

            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--brand)" + "30", backgroundColor: "var(--card)" }}>
              {/* Pack header */}
              <div className="flex items-start justify-between gap-4 p-5" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="text-xs font-mono font-semibold uppercase tracking-widest px-2 py-0.5 rounded"
                      style={{ backgroundColor: "var(--brand)" + "18", color: "var(--brand)" }}
                    >
                      .zip
                    </span>
                    <span className="text-sm font-semibold">
                      DARKSCO_{variant.charAt(0).toUpperCase() + variant.slice(1)}_{VARIANT_INFO[variant].bpm}bpm
                    </span>
                  </div>
                  <p className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>
                    Ableton Live 11/12 project · WAV stems · MIDI clips · Max for Live device
                  </p>
                </div>
                <button
                  onClick={buildPack}
                  disabled={packBuilding}
                  className="flex-shrink-0 px-5 py-2.5 rounded-lg border text-sm font-semibold font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    borderColor: "var(--brand)",
                    backgroundColor: packBuilding ? "transparent" : "var(--brand)" + "15",
                    color: "var(--brand)",
                  }}
                >
                  {packBuilding ? "Building pack..." : packReady ? "Re-download Pack" : "Export Ableton Pack"}
                </button>
              </div>

              {/* Pack contents manifest */}
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left: file tree */}
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>Pack contents</p>
                  <div className="flex flex-col gap-1">
                    {/* ALS */}
                    <PackFileRow icon=".als" label={`DARKSCO_${variant.charAt(0).toUpperCase() + variant.slice(1)}_${VARIANT_INFO[variant].bpm}bpm.als`} desc="Ableton Live 11/12 set" color="var(--brand)" />
                    {/* WAV stems */}
                    {result.samplepack.stems.map((s) => (
                      <PackFileRow key={s.stem_type} icon=".wav" label={`Samples/Originals/${s.stem_type}.wav`} desc={`${s.durationSec.toFixed(2)}s · 48kHz/24-bit`} color={STEM_COLORS[s.stem_type] ?? "#6b6b76"} />
                    ))}
                    <PackFileRow icon=".wav" label="Samples/Originals/master_mix.wav" desc={`${result.final_wav.durationSec.toFixed(2)}s · stereo master`} color="var(--text-dim)" />
                    {/* MIDI */}
                    {result.midis.map((m) => (
                      <PackFileRow key={m.stem} icon=".mid" label={`MIDI Clips/${m.filename}`} desc={`${m.notes_count} notes · Ch ${m.channel}`} color={STEM_COLORS[m.stem] ?? "#6b6b76"} />
                    ))}
                    {/* M4L */}
                    <PackFileRow icon=".amxd" label="Max for Live Devices/DARKSCO_Sampler.amxd" desc="MIDI router + stem map" color="#e8a23c" />
                    <PackFileRow icon=".txt"  label="README.txt" desc="Project info + routing notes" color="var(--text-faint)" />
                  </div>
                </div>

                {/* Right: technical specs */}
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>Live Set tracks</p>
                    <div className="flex flex-col gap-1.5">
                      {result.samplepack.stems.filter((s) => ["kick","snare","hihat","noise"].includes(s.stem_type)).map((s) => (
                        <div key={s.stem_type} className="flex items-center gap-2">
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-faint)" }}>AudioTrack</span>
                          <span className="text-xs font-mono" style={{ color: STEM_COLORS[s.stem_type] ?? "#6b6b76" }}>{s.stem_type}</span>
                          <span className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>clip with WAV reference</span>
                        </div>
                      ))}
                      {result.samplepack.stems.filter((s) => !["kick","snare","hihat","noise"].includes(s.stem_type)).map((s) => (
                        <div key={s.stem_type} className="flex items-center gap-2">
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-faint)" }}>MidiTrack</span>
                          <span className="text-xs font-mono" style={{ color: STEM_COLORS[s.stem_type] ?? "#6b6b76" }}>{s.stem_type}</span>
                          <span className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>Simpler loaded with WAV</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--surface-raised)", color: "var(--text-faint)" }}>AudioTrack</span>
                        <span className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>Master Mix</span>
                        <span className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>reference only</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>Set parameters</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "BPM", value: String(VARIANT_INFO[variant].bpm) },
                        { label: "Key", value: VARIANT_INFO[variant].key },
                        { label: "Bars", value: String(bars) },
                        { label: "Format", value: "Live 11/12" },
                        { label: "MIDI PPQ", value: "480" },
                        { label: "Sample rate", value: "48kHz/24-bit" },
                      ].map((row) => (
                        <div key={row.label} className="rounded px-2.5 py-1.5" style={{ backgroundColor: "var(--surface-raised)" }}>
                          <p className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>{row.label}</p>
                          <p className="text-xs font-mono font-semibold mt-0.5" style={{ color: "var(--foreground)" }}>{row.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>Max for Live device</p>
                    <div className="rounded-lg border p-3 text-xs font-mono" style={{ borderColor: "#e8a23c" + "30", backgroundColor: "#e8a23c" + "07" }}>
                      <p className="font-semibold mb-1" style={{ color: "#e8a23c" }}>DARKSCO_Sampler.amxd</p>
                      <p style={{ color: "var(--text-faint)" }}>MIDI router + stem-to-channel map.</p>
                      <p style={{ color: "var(--text-faint)" }}>Shows kit name, BPM, key, and all stem note ranges.</p>
                      <p className="mt-1" style={{ color: "var(--text-faint)" }}>Drag onto any MIDI track in Ableton Live with M4L.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Build result / error */}
              {packReady && (
                <div className="px-5 pb-5">
                  <div
                    className="flex items-center gap-3 rounded-lg px-4 py-3"
                    style={{ backgroundColor: "var(--brand)" + "10", border: `1px solid ${"var(--brand)"}30` }}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--brand)" }} />
                    <span className="text-xs font-mono" style={{ color: "var(--brand)" }}>
                      {packReady.filename} downloaded — {fmtBytes(packReady.sizeBytes)} · {packReady.contents.length} files
                    </span>
                  </div>
                </div>
              )}
              {packError && (
                <div className="px-5 pb-5">
                  <div className="rounded-lg px-4 py-3 border" style={{ borderColor: "var(--destructive)" + "40", backgroundColor: "var(--destructive)" + "0a" }}>
                    <p className="text-xs font-mono" style={{ color: "var(--destructive)" }}>{packError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Pipeline complete badge */}
            <div className="flex items-center justify-center gap-3 mt-6 py-4 rounded-lg border" style={{ borderColor: "var(--brand)" + "30", backgroundColor: "var(--brand)" + "07" }}>
              <span className="w-2 h-2 rounded-full pulse-dot" style={{ backgroundColor: "var(--brand)" }} />
              <span className="text-sm font-mono font-semibold" style={{ color: "var(--brand)" }}>
                Pipeline complete — {result.meta.pipeline_stages_completed.length}/5 stages · {result.meta.renderTimeMs}ms
              </span>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
