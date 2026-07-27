"use client";

import { useState, useCallback } from "react";
import { sendCommand } from "@/lib/bridge-client";

const PRESETS = [80, 90, 100, 110, 120, 128, 132, 140, 150, 160, 174];

type Status = "idle" | "sending" | "ok" | "error";

export default function TestTempoPage() {
  const [bpm, setBpm] = useState(120);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<number | null>(null);

  const send = useCallback(async (value: number) => {
    setStatus("sending");
    setResult(null);
    try {
      const cmd = await sendCommand({ type: "set_tempo", bpm: value });
      setLastSent(value);
      setStatus("ok");
      setResult(JSON.stringify(cmd, null, 2));
    } catch (err) {
      setStatus("error");
      setResult(err instanceof Error ? err.message : "Unknown error");
    }
  }, []);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-8 p-8 font-mono">

      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Tempo Test</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sends <span className="text-[#4dffa0]">set_tempo</span> directly to Ableton via bridge on 127.0.0.1:8765
        </p>
      </div>

      {/* BPM Slider */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label htmlFor="bpm-slider" className="text-xs text-muted-foreground uppercase tracking-widest">BPM</label>
          <span className="text-4xl font-bold text-foreground tabular-nums">{bpm}</span>
        </div>
        <input
          id="bpm-slider"
          type="range"
          min={60}
          max={200}
          step={1}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="w-full accent-[#4dffa0] h-1.5 rounded-full cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>60</span>
          <span>130</span>
          <span>200</span>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2 justify-center max-w-sm">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setBpm(p)}
            className={`px-3 py-1 rounded text-xs border transition-colors ${
              bpm === p
                ? "border-[#4dffa0] text-[#4dffa0] bg-[#4dffa0]/10"
                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Send Button */}
      <button
        onClick={() => send(bpm)}
        disabled={status === "sending"}
        className="w-full max-w-sm h-14 rounded-lg text-sm font-semibold tracking-wide transition-all
          bg-[#4dffa0] text-black hover:bg-[#3de890] active:scale-95
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "sending" ? "Sending..." : `Set ${bpm} BPM in Ableton`}
      </button>

      {/* Status */}
      {status === "ok" && (
        <div className="w-full max-w-sm rounded-lg border border-[#4dffa0]/30 bg-[#4dffa0]/5 p-4">
          <p className="text-xs text-[#4dffa0] font-semibold mb-2">
            Sent {lastSent} BPM — acknowledged
          </p>
          <pre className="text-[10px] text-muted-foreground overflow-auto whitespace-pre-wrap break-all">
            {result}
          </pre>
        </div>
      )}

      {status === "error" && (
        <div className="w-full max-w-sm rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-xs text-red-400 font-semibold mb-1">Error — bridge unreachable?</p>
          <p className="text-[10px] text-muted-foreground break-all">{result}</p>
          <p className="text-[10px] text-muted-foreground mt-2">
            Make sure bridge is running: <span className="text-[#4dffa0]">python -m ableton_bridge</span>
          </p>
        </div>
      )}
    </main>
  );
}
