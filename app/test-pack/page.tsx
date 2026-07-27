"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant = "night" | "daytime" | "morning";

interface StepState {
  status: "idle" | "running" | "ok" | "error";
  label:  string;
  detail: string;
}

const VARIANTS: { id: Variant; bpm: number; key: string; label: string; desc: string }[] = [
  { id: "night",   bpm: 120, key: "F minor",  label: "Night",   desc: "Deep, dark, hypnotic — 120 BPM" },
  { id: "daytime", bpm: 124, key: "C major",  label: "Daytime", desc: "Bright, energetic, club-ready — 124 BPM" },
  { id: "morning", bpm: 116, key: "G major",  label: "Morning", desc: "Warm, soulful, organic — 116 BPM" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dot(status: StepState["status"]) {
  const map: Record<StepState["status"], string> = {
    idle:    "bg-[var(--text-faint)]",
    running: "bg-[var(--brand)] animate-pulse",
    ok:      "bg-[var(--status-accepted)]",
    error:   "bg-[var(--status-error)]",
  };
  return map[status];
}

function fmt(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

// ─── Step row ─────────────────────────────────────────────────────────────────

function StepRow({ step, elapsed }: { step: StepState; elapsed?: number }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--surface-raised)] last:border-0">
      <span className={`mt-1 flex-none w-2 h-2 rounded-full ${dot(step.status)}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-[var(--foreground)]">{step.label}</span>
          {elapsed !== undefined && step.status === "ok" && (
            <span className="text-xs text-[var(--text-faint)] font-mono">{fmt(elapsed)}</span>
          )}
          {step.status === "running" && (
            <span className="text-xs text-[var(--brand)] font-mono animate-pulse">running…</span>
          )}
        </div>
        {step.detail && (
          <p className="text-xs text-[var(--text-dim)] mt-0.5 truncate">{step.detail}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TestPackPage() {
  const [selected, setSelected]   = useState<Variant>("night");
  const [bars, setBars]           = useState(8);
  const [running, setRunning]     = useState(false);
  const [steps, setSteps]         = useState<StepState[]>([]);
  const [elapsed, setElapsed]     = useState<number[]>([]);
  const [downloadUrl, setDownload] = useState<string | null>(null);
  const [filename, setFilename]   = useState("");

  const variant = VARIANTS.find(v => v.id === selected)!;

  function setStep(i: number, patch: Partial<StepState>) {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }

  async function run() {
    setRunning(true);
    setDownload(null);
    setFilename("");

    const initialSteps: StepState[] = [
      { status: "idle", label: "Stage 1 — Synthesise stems",   detail: "" },
      { status: "idle", label: "Stage 2 — Build Ableton Pack", detail: "" },
      { status: "idle", label: "Stage 3 — Prepare download",   detail: "" },
    ];
    setSteps(initialSteps);
    setElapsed([0, 0, 0]);

    const times: number[] = [0, 0, 0];

    // ── Step 1: generate-stems ──────────────────────────────────────────────
    setStep(0, { status: "running", label: "Stage 1 — Synthesise stems" });
    let t0 = Date.now();

    let pipeline: unknown;
    try {
      const res = await fetch("/api/music/generate-stems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variant: selected,
          bpm:     variant.bpm,
          bars,
          key:     variant.key,
          includeMix: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);

      times[0] = Date.now() - t0;
      pipeline = data;

      const stemCount: number = (data as { samplepack?: { stems?: unknown[] } }).samplepack?.stems?.length ?? 0;
      setStep(0, { status: "ok", detail: `${stemCount} stems rendered · ${fmt(times[0])}` });
      setElapsed([...times]);
    } catch (err) {
      times[0] = Date.now() - t0;
      setStep(0, { status: "error", detail: String(err) });
      setRunning(false);
      setElapsed([...times]);
      return;
    }

    // ── Step 2: build-ableton-pack ──────────────────────────────────────────
    setStep(1, { status: "running" });
    t0 = Date.now();

    let zipBlob: Blob;
    let packFilename: string;
    try {
      const res = await fetch("/api/music/build-ableton-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline,
          variant: selected,
          bpm:     variant.bpm,
          bars,
          key:     variant.key,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      zipBlob     = await res.blob();
      packFilename = res.headers.get("Content-Disposition")
        ?.match(/filename="?([^"]+)"?/)?.[1]
        ?? `DARKSCO_${selected}_${variant.bpm}bpm.zip`;

      times[1] = Date.now() - t0;
      setStep(1, { status: "ok", detail: `${(zipBlob.size / 1024).toFixed(0)} KB · ${packFilename}` });
      setElapsed([...times]);
    } catch (err) {
      times[1] = Date.now() - t0;
      setStep(1, { status: "error", detail: String(err) });
      setRunning(false);
      setElapsed([...times]);
      return;
    }

    // ── Step 3: create download URL ─────────────────────────────────────────
    setStep(2, { status: "running" });
    t0 = Date.now();

    try {
      const url = URL.createObjectURL(zipBlob);
      times[2] = Date.now() - t0;
      setDownload(url);
      setFilename(packFilename);
      setStep(2, { status: "ok", detail: "Ready — click Download to save" });
      setElapsed([...times]);

      // Auto-trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = packFilename;
      a.click();
    } catch (err) {
      times[2] = Date.now() - t0;
      setStep(2, { status: "error", detail: String(err) });
    }

    setRunning(false);
  }

  const total = elapsed.reduce((a, b) => a + b, 0);
  const allOk = steps.length > 0 && steps.every(s => s.status === "ok");
  const hasError = steps.some(s => s.status === "error");

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans flex items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-5">

        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Pack Test</h1>
          <p className="text-sm text-[var(--text-dim)] mt-0.5">
            One click — synthesise stems, build .als + ZIP, download.
          </p>
        </div>

        {/* Variant selector */}
        <div className="flex flex-col gap-2">
          {VARIANTS.map(v => (
            <button
              key={v.id}
              onClick={() => !running && setSelected(v.id)}
              disabled={running}
              className={[
                "flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors",
                selected === v.id
                  ? "border-[var(--brand)] bg-[var(--surface-raised)]"
                  : "border-[var(--surface-raised)] bg-[var(--surface)] hover:bg-[var(--surface-raised)]",
                running ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              <span className="font-medium text-sm">{v.label}</span>
              <span className="text-xs text-[var(--text-dim)]">{v.desc}</span>
            </button>
          ))}
        </div>

        {/* Bars selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-dim)] w-10">Bars</span>
          {[4, 8, 16, 32].map(n => (
            <button
              key={n}
              onClick={() => !running && setBars(n)}
              disabled={running}
              className={[
                "px-3 py-1.5 rounded text-sm font-mono transition-colors",
                bars === n
                  ? "bg-[var(--brand)] text-black font-semibold"
                  : "bg-[var(--surface-raised)] text-[var(--text-dim)] hover:text-[var(--foreground)]",
                running ? "opacity-50 cursor-not-allowed" : "",
              ].join(" ")}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Run button */}
        <button
          onClick={run}
          disabled={running}
          className={[
            "w-full py-3 rounded-lg font-semibold text-sm tracking-wide transition-all",
            running
              ? "bg-[var(--surface-raised)] text-[var(--text-faint)] cursor-not-allowed"
              : "bg-[var(--brand)] text-black hover:opacity-90 active:scale-[0.98]",
          ].join(" ")}
        >
          {running ? "Building pack…" : "Generate + Download Pack"}
        </button>

        {/* Steps */}
        {steps.length > 0 && (
          <div className="rounded-lg bg-[var(--surface)] border border-[var(--surface-raised)] px-4 py-1">
            {steps.map((s, i) => (
              <StepRow key={i} step={s} elapsed={elapsed[i]} />
            ))}
          </div>
        )}

        {/* Result banner */}
        {allOk && downloadUrl && (
          <div className="rounded-lg border border-[var(--status-accepted)] bg-[var(--surface)] px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--status-accepted)]">Pack ready</p>
              <p className="text-xs text-[var(--text-dim)] mt-0.5 font-mono truncate">{filename}</p>
              <p className="text-xs text-[var(--text-faint)] mt-0.5">Total: {fmt(total)}</p>
            </div>
            <a
              href={downloadUrl}
              download={filename}
              className="flex-none px-3 py-1.5 rounded bg-[var(--status-accepted)] text-black text-xs font-semibold hover:opacity-90"
            >
              Download
            </a>
          </div>
        )}

        {hasError && (
          <div className="rounded-lg border border-[var(--status-error)] bg-[var(--surface)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--status-error)]">Build failed</p>
            <p className="text-xs text-[var(--text-dim)] mt-1">Check the step above for details.</p>
          </div>
        )}

        {/* Footer hint */}
        <p className="text-xs text-[var(--text-faint)] text-center">
          ZIP contains .als project + WAV stems + MIDI clips
        </p>

      </div>
    </main>
  );
}
