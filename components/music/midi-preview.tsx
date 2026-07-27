"use client";

import type { MidiMetadata } from "@/lib/music-schema";
import type { AbletonInstructions } from "@/lib/agents/midi-composer";

interface MidiPreviewProps {
  metadata: MidiMetadata;
  ableton: AbletonInstructions;
  wavSpec?: {
    sample_rate: number;
    bit_depth: number;
    loudness_lufs: number;
    headroom_db: number;
    format: string;
  } | null;
}

const TRACK_COLORS: Record<string, string> = {
  kick:       "#ef4444",
  snare:      "#f97316",
  hihat:      "#eab308",
  bass:       "#22c55e",
  pad:        "#3b82f6",
  synth:      "#a855f7",
  arp:        "#ec4899",
  fx:         "#06b6d4",
  vocal:      "#ffffff",
  perc:       "#f59e0b",
};

export function MidiPreview({ metadata, ableton, wavSpec }: MidiPreviewProps) {
  return (
    <div className="space-y-6">
      {/* Metadata overview */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Tempo" value={`${metadata.tempo} BPM`} accent />
        <MetricCard label="Total Bars" value={String(metadata.total_bars)} />
        <MetricCard label="Total Beats" value={String(metadata.total_beats)} />
        <MetricCard label="Quantization" value={metadata.quantization} />
        <MetricCard label="Time Sig" value={metadata.time_signature} />
        <MetricCard label="Tracks" value={String(metadata.tracks.length)} />
      </div>

      {/* Track listing */}
      <div>
        <h4 className="text-xs font-mono text-text-faint uppercase tracking-widest mb-3">MIDI Tracks</h4>
        <div className="space-y-1.5">
          {metadata.tracks.map((track, i) => (
            <div key={i} className="flex items-center gap-3 py-1 text-xs font-mono">
              {/* Color swatch */}
              <span
                className="w-1 h-5 rounded-full shrink-0"
                style={{ backgroundColor: TRACK_COLORS[track.name.split(" ")[0].toLowerCase()] ?? "#666" }}
              />
              <span className="text-foreground w-32 truncate shrink-0">{track.name}</span>
              <span className="text-text-faint w-10 shrink-0">Ch {track.channel}</span>
              <div className="flex-1 h-2 bg-surface-raised rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (track.notes_count / 200) * 100)}%`,
                    backgroundColor: TRACK_COLORS[track.name.split(" ")[0].toLowerCase()] ?? "#555",
                    opacity: 0.7,
                  }}
                />
              </div>
              <span className="text-text-dim w-20 text-right shrink-0">{track.notes_count} notes</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ableton Project */}
      <div>
        <h4 className="text-xs font-mono text-text-faint uppercase tracking-widest mb-3">Ableton Project</h4>
        <div className="bg-surface rounded border border-border p-3 space-y-2">
          <div className="flex gap-4 text-xs font-mono">
            <span className="text-text-faint">Project:</span>
            <span className="text-brand truncate">{ableton.project_name}</span>
          </div>
          <div className="flex gap-4 text-xs font-mono">
            <span className="text-text-faint">Tempo:</span>
            <span className="text-foreground">{ableton.tempo} BPM</span>
            <span className="text-text-faint">Sig:</span>
            <span className="text-foreground">{ableton.time_signature}</span>
          </div>
          <div className="mt-2 text-xs font-mono text-text-dim leading-relaxed">
            {ableton.routing_notes}
          </div>
        </div>
      </div>

      {/* Clip Notes */}
      <div>
        <h4 className="text-xs font-mono text-text-faint uppercase tracking-widest mb-2">Clip Setup Notes</h4>
        <div className="space-y-1.5">
          {ableton.clip_notes.map((note, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className="text-brand font-mono shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-text-dim leading-relaxed">{note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Export Settings */}
      <div>
        <h4 className="text-xs font-mono text-text-faint uppercase tracking-widest mb-3">Export Settings</h4>
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Sample Rate" value={`${ableton.export_settings.sample_rate} Hz`} />
          <MetricCard label="Bit Depth" value={`${ableton.export_settings.bit_depth}-bit`} />
          <MetricCard label="Format" value={ableton.export_settings.format.toUpperCase()} />
          <MetricCard label="Normalize" value={ableton.export_settings.normalize ? "Yes" : "No"} />
        </div>
      </div>

      {/* WAV Spec (if available) */}
      {wavSpec && (
        <div>
          <h4 className="text-xs font-mono text-text-faint uppercase tracking-widest mb-3">WAV Master Spec</h4>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Loudness" value={`${wavSpec.loudness_lufs} LUFS`} accent />
            <MetricCard label="Headroom" value={`${wavSpec.headroom_db} dB`} />
            <MetricCard label="Format" value={`${wavSpec.sample_rate}Hz/${wavSpec.bit_depth}-bit`} />
            <MetricCard label="True Peak" value="-1.0 dBTP" />
          </div>
        </div>
      )}

      {/* Generation method */}
      <p className="text-[10px] font-mono text-text-faint border-t border-border pt-3">
        {metadata.generation_method}
      </p>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-surface-raised rounded border border-border/50 px-3 py-2">
      <div className="text-[10px] font-mono text-text-faint uppercase tracking-widest mb-0.5">{label}</div>
      <div className={`text-sm font-mono font-medium ${accent ? "text-brand" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
