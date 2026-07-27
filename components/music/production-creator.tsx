"use client";

import { useState } from "react";

interface Soundbank {
  id: string;
  name: string;
  total_stems: number;
  status: string;
}

interface ProductionCreatorProps {
  soundbanks: Soundbank[];
  onCreated: (production: { id: string; brief: string; style: string; bpm: number; key: string }) => void;
}

const STYLE_PRESETS = [
  { value: "darksco-night",    label: "DARKSCO Night",    bpm: 120, key: "F minor" },
  { value: "darksco-daytime",  label: "DARKSCO Daytime",  bpm: 124, key: "C major" },
  { value: "darksco-morning",  label: "DARKSCO Morning",  bpm: 116, key: "G major" },
  { value: "minimal-techno",   label: "Minimal Techno",   bpm: 128, key: "A minor" },
  { value: "dark-techno",      label: "Dark Techno",      bpm: 132, key: "D minor" },
  { value: "custom",           label: "Custom",           bpm: 128, key: "A minor" },
];

const MOOD_OPTIONS = [
  "dark", "hypnotic", "groovy", "industrial", "spatial",
  "meditative", "funky", "energetic", "soulful", "mysterious",
  "pulsating", "warm", "deep", "atmospheric",
];

export function ProductionCreator({ soundbanks, onCreated }: ProductionCreatorProps) {
  const [brief, setBrief] = useState("");
  const [selectedPreset, setSelectedPreset] = useState(STYLE_PRESETS[0]);
  const [bpm, setBpm] = useState(120);
  const [key, setKey] = useState("F minor");
  const [totalBars, setTotalBars] = useState(64);
  const [selectedSoundbankId, setSelectedSoundbankId] = useState(soundbanks[0]?.id ?? "");
  const [selectedMoods, setSelectedMoods] = useState<string[]>(["dark", "hypnotic", "groovy"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMood(mood: string) {
    setSelectedMoods(prev =>
      prev.includes(mood) ? prev.filter(m => m !== mood) : [...prev, mood]
    );
  }

  function applyPreset(preset: typeof STYLE_PRESETS[0]) {
    setSelectedPreset(preset);
    if (preset.value !== "custom") {
      setBpm(preset.bpm);
      setKey(preset.key);
    }
  }

  async function handleCreate() {
    if (!brief.trim()) {
      setError("Brief is required — describe the track you want to create.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/music/create-production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soundbank_id: selectedSoundbankId || null,
          brief: brief.trim(),
          style: selectedPreset.value,
          bpm,
          key,
          mood_keywords: selectedMoods,
          total_bars: totalBars,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create production");
      onCreated(data.production);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Style Presets */}
      <div>
        <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">
          Style Preset
        </label>
        <div className="flex flex-wrap gap-2">
          {STYLE_PRESETS.map(preset => (
            <button
              key={preset.value}
              onClick={() => applyPreset(preset)}
              className={`px-3 py-1.5 text-xs font-mono rounded border transition-colors ${
                selectedPreset.value === preset.value
                  ? "border-brand text-brand bg-brand/10"
                  : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Brief */}
      <div>
        <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">
          Production Brief
          <span className="text-brand ml-1">*</span>
        </label>
        <textarea
          value={brief}
          onChange={e => setBrief(e.target.value)}
          rows={3}
          placeholder="Describe the track — energy, feel, reference sounds, intended use (e.g. 'dark hypnotic groove for 3am sets, heavy sub bass, industrial percussion, evolving filter sweeps')..."
          className="w-full bg-surface-raised border border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-text-faint focus:outline-none focus:border-brand/60 resize-none font-sans leading-relaxed"
        />
      </div>

      {/* BPM / Key / Bars */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">BPM</label>
          <input
            type="number"
            min={60}
            max={180}
            value={bpm}
            onChange={e => setBpm(Number(e.target.value))}
            className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-brand/60"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">Key</label>
          <input
            type="text"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="F minor"
            className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-brand/60"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">Bars</label>
          <select
            value={totalBars}
            onChange={e => setTotalBars(Number(e.target.value))}
            className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-brand/60"
          >
            {[32, 48, 64, 96, 128].map(b => (
              <option key={b} value={b}>{b} bars</option>
            ))}
          </select>
        </div>
      </div>

      {/* Soundbank */}
      {soundbanks.length > 0 && (
        <div>
          <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">
            Soundbank
          </label>
          <select
            value={selectedSoundbankId}
            onChange={e => setSelectedSoundbankId(e.target.value)}
            className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-brand/60"
          >
            <option value="">No soundbank (use defaults)</option>
            {soundbanks.map(sb => (
              <option key={sb.id} value={sb.id}>
                {sb.name} — {sb.total_stems} stems
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Mood Keywords */}
      <div>
        <label className="block text-xs font-mono text-muted-foreground mb-2 uppercase tracking-widest">
          Mood Keywords
        </label>
        <div className="flex flex-wrap gap-2">
          {MOOD_OPTIONS.map(mood => (
            <button
              key={mood}
              onClick={() => toggleMood(mood)}
              className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors ${
                selectedMoods.includes(mood)
                  ? "border-brand/60 text-brand bg-brand/8"
                  : "border-border text-text-faint hover:text-muted-foreground hover:border-border/60"
              }`}
            >
              {mood}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs font-mono text-destructive border border-destructive/30 rounded px-3 py-2 bg-destructive/5">
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        onClick={handleCreate}
        disabled={loading || !brief.trim()}
        className="w-full py-3 bg-brand text-background text-sm font-mono font-semibold rounded hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Creating production..." : "Create Production"}
      </button>

      <p className="text-xs text-text-faint font-mono text-center">
        OpenAI o1 reasoning runs in the next step — this creates the project record
      </p>
    </div>
  );
}
