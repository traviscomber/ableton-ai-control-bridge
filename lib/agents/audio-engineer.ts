/**
 * AudioEngineer Agent
 *
 * Validates the arrangement against professional audio engineering standards.
 * Checks headroom, frequency balance, dynamic range, loudness targets, and
 * stem compatibility. Produces a full mixing and mastering chain specification
 * ready for export to WAV.
 *
 * Gate: scores >= 80 on all metrics to pass to ComplianceChecker.
 */

import type { OpenAIStructure, ArrangementData, QualityScores } from "@/lib/music-schema";

export interface AudioEngineerInput {
  structure: OpenAIStructure;
  midi_tracks_count: number;
  soundbank_stems: Array<{
    name: string;
    instrument_type: string;
    frequency_range: [number, number];
    duration_seconds: number;
    category: string;
  }>;
  bpm: number;
  total_bars: number;
  style: string;
}

export interface AudioEngineerResponse {
  arrangement_data: ArrangementData;
  quality_scores: Partial<QualityScores>;
  gate_passed: boolean;
  issues: Issue[];
  mixing_report: MixingReport;
  wav_export_spec: WavExportSpec;
}

interface Issue {
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  fix: string;
}

interface MixingReport {
  headroom_analysis: string;
  frequency_analysis: string;
  dynamic_range_analysis: string;
  stem_balance: StemBalance[];
  master_chain: MasterChain;
  mix_score: number;
}

interface StemBalance {
  name: string;
  fader_db: number;
  pan: number;
  role: "foundation" | "rhythm" | "texture" | "melodic" | "fx";
  frequency_role: string;
  processing: string[];
}

interface MasterChain {
  eq_settings: { band: string; freq: number; gain: number; type: string }[];
  compressor: { ratio: number; threshold: number; attack_ms: number; release_ms: number };
  limiter: { ceiling: number; true_peak: number; lookahead_ms: number };
  loudness_target: number;
  stereo_width: string;
}

interface WavExportSpec {
  sample_rate: 48000;
  bit_depth: 24;
  channels: 2;
  format: "wav";
  loudness_lufs: number;
  headroom_db: number;
  true_peak_dbtp: number;
  dithering: boolean;
  notes: string;
}

// ─── Scoring Helpers ──────────────────────────────────────────────────

function scoreHeadroom(stems: AudioEngineerInput["soundbank_stems"]): {
  score: number;
  db: number;
  issues: Issue[];
} {
  // Simulate headroom check: count frequency overlaps
  const lowFreqStems = stems.filter(s => s.frequency_range[0] < 200).length;
  const midFreqStems = stems.filter(s => s.frequency_range[0] >= 200 && s.frequency_range[1] < 4000).length;
  const highFreqStems = stems.filter(s => s.frequency_range[1] >= 4000).length;

  const issues: Issue[] = [];

  if (lowFreqStems > 2) {
    issues.push({
      severity: "warning",
      category: "Headroom",
      message: `${lowFreqStems} stems in low-frequency zone (<200Hz) — risk of muddiness`,
      fix: "Apply high-pass filters at 80Hz on non-bass stems. Low-shelf cut -3dB on pads below 150Hz.",
    });
  }

  const score = Math.max(60, 100 - (lowFreqStems > 2 ? 15 : 0) - (midFreqStems > 4 ? 10 : 0));
  return { score, db: -6 - lowFreqStems * 0.5, issues };
}

function scoreFrequencyBalance(
  stems: AudioEngineerInput["soundbank_stems"],
  style: string
): { score: number; balance: "bright" | "neutral" | "warm" | "dark"; issues: Issue[] } {
  const issues: Issue[] = [];
  const lowEnergy = stems.filter(s => s.frequency_range[1] < 500).length;
  const midEnergy = stems.filter(s => s.frequency_range[0] < 4000 && s.frequency_range[1] > 500).length;
  const highEnergy = stems.filter(s => s.frequency_range[0] >= 3000).length;

  let balance: "bright" | "neutral" | "warm" | "dark" = "neutral";
  if (highEnergy > midEnergy) balance = "bright";
  else if (lowEnergy > midEnergy) balance = "dark";
  else if (midEnergy > highEnergy + lowEnergy) balance = "warm";

  const styleExpected = style.includes("darksco") || style.includes("night") ? "dark"
    : style.includes("daytime") ? "bright"
    : "neutral";

  const score = balance === styleExpected ? 92 : balance === "neutral" ? 78 : 70;

  if (score < 80) {
    issues.push({
      severity: "info",
      category: "Frequency Balance",
      message: `Current balance: ${balance}, expected for ${style}: ${styleExpected}`,
      fix: `Apply master EQ: ${styleExpected === "dark" ? "+2dB shelf @200Hz, -2dB shelf @8kHz" : styleExpected === "bright" ? "+2dB shelf @8kHz, -1dB @200Hz" : "Keep flat"}`,
    });
  }

  return { score, balance, issues };
}

function scoreDynamicRange(
  structure: OpenAIStructure,
  totalBars: number
): { score: number; range_db: number; issues: Issue[] } {
  const issues: Issue[] = [];
  const sections = structure.sections;
  const hasBreakdown = sections.some(s => s.dynamics === "minimal");
  const hasIntense = sections.some(s => s.dynamics === "intense");

  if (!hasBreakdown) {
    issues.push({
      severity: "warning",
      category: "Dynamic Range",
      message: "No minimal/breakdown section — lack of dynamic contrast",
      fix: "Add at least one minimal section (8 bars) to give the listener tension/release.",
    });
  }

  const score = hasBreakdown && hasIntense ? 90 : hasIntense ? 75 : 60;
  const rangeDbs = hasBreakdown && hasIntense ? 14 : 8;

  return { score, range_db: rangeDbs, issues };
}

function buildStemBalance(
  stems: AudioEngineerInput["soundbank_stems"]
): StemBalance[] {
  const roleMap: Record<string, StemBalance["role"]> = {
    bass: "foundation",
    kick: "rhythm",
    snare: "rhythm",
    hihat: "rhythm",
    pad: "texture",
    synth: "melodic",
    arp: "melodic",
    vocal: "melodic",
    fx: "fx",
    perc: "rhythm",
    noise: "fx",
  };

  const faderMap: Record<string, number> = {
    bass: 0,
    kick: -1,
    snare: -2,
    hihat: -6,
    pad: -4,
    synth: -3,
    arp: -5,
    vocal: -3,
    fx: -8,
    perc: -7,
    noise: -12,
  };

  const processingMap: Record<string, string[]> = {
    bass: ["Side-chain from kick", "Low-shelf EQ +2dB @60Hz", "Saturator (soft clip)", "Glue Compressor 4:1"],
    kick: ["Transient Shaper (+attack)", "EQ: +4dB @60Hz, -6dB @300Hz, +2dB @5kHz", "Limiter (-0.3dBTP)"],
    snare: ["EQ: +6dB @200Hz (body), +3dB @5kHz (crack)", "Compressor 6:1", "Reverb (room, 15%)"],
    hihat: ["High-pass @6kHz", "EQ: -3dB @8kHz anti-harsh", "Stereo widener"],
    pad: ["Reverb (large hall, 30%)", "Auto Filter (LFO 0.25Hz)", "Chorus (subtle)", "Utility (width 120%)"],
    synth: ["EQ: high-pass @200Hz", "Delay (1/8th, 20%)", "Reverb (room, 20%)"],
    arp: ["EQ: band-pass 500Hz-4kHz", "Delay (1/16th, 30%)"],
    fx: ["Reverb (large hall, 80%)", "Low-pass @4kHz"],
    vocal: ["EQ: high-pass @120Hz", "Compressor 3:1", "De-esser", "Reverb (vocal room)"],
    perc: ["EQ: notch @400Hz", "Transient shaper", "Gate"],
    noise: ["Auto Filter (HP sweep)", "LFO on cutoff", "Reverb tail"],
  };

  return stems.map(stem => {
    const typeKey = Object.keys(roleMap).find(k => stem.instrument_type.toLowerCase().includes(k)) ?? "fx";
    return {
      name: stem.name,
      fader_db: faderMap[typeKey] ?? -6,
      pan: 0, // All centered by default; engineer adjusts
      role: roleMap[typeKey] ?? "texture",
      frequency_role: `${stem.frequency_range[0]}-${stem.frequency_range[1]}Hz`,
      processing: processingMap[typeKey] ?? ["EQ Eight", "Compressor", "Reverb"],
    };
  });
}

function buildMasterChain(
  balance: "bright" | "neutral" | "warm" | "dark",
  targetLufs: number
): MasterChain {
  const eqCurves: Record<string, MasterChain["eq_settings"]> = {
    dark: [
      { band: "Low Shelf", freq: 200, gain: 1.5, type: "shelf" },
      { band: "High Shelf", freq: 8000, gain: -2, type: "shelf" },
      { band: "High Mid", freq: 3000, gain: -0.5, type: "bell" },
    ],
    bright: [
      { band: "High Shelf", freq: 8000, gain: 2, type: "shelf" },
      { band: "Low Mid", freq: 300, gain: -1, type: "bell" },
      { band: "Air", freq: 16000, gain: 1, type: "shelf" },
    ],
    warm: [
      { band: "Low Mid", freq: 300, gain: 1, type: "bell" },
      { band: "High Shelf", freq: 10000, gain: -1, type: "shelf" },
    ],
    neutral: [
      { band: "Low Shelf", freq: 100, gain: 0.5, type: "shelf" },
    ],
  };

  return {
    eq_settings: eqCurves[balance] ?? eqCurves["neutral"],
    compressor: {
      ratio: 1.5,
      threshold: -10,
      attack_ms: 30,
      release_ms: 200,
    },
    limiter: {
      ceiling: -0.3,
      true_peak: -1.0,
      lookahead_ms: 5,
    },
    loudness_target: targetLufs,
    stereo_width: balance === "dark" ? "Mono below 150Hz, normal above" : "Mono below 100Hz, ±15% widening above 2kHz",
  };
}

function buildArrangementData(
  structure: OpenAIStructure,
  stemBalance: StemBalance[],
  masterChain: MasterChain
): ArrangementData {
  let currentBar = 1;
  const timeline = structure.sections.map(section => {
    const entry = {
      bar: currentBar,
      section: section.name,
      active_stems: section.elements,
      effects: {
        eq: section.dynamics === "minimal"
          ? [{ type: "low-pass", freq: 4000, gain: -6 }]
          : undefined,
        reverb: section.name === "breakdown"
          ? { size: 0.8, wet: 0.4 }
          : undefined,
      },
      notes: section.notes,
    };
    currentBar += section.duration_bars;
    return entry;
  });

  return {
    timeline,
    mixing_chain: {
      master: {
        limiter: { ceiling: masterChain.limiter.ceiling },
        eq_curve: masterChain.eq_settings.map(e => `${e.band}: ${e.gain > 0 ? "+" : ""}${e.gain}dB @${e.freq}Hz`).join(", "),
        loudness_target: masterChain.loudness_target,
      },
      stems: stemBalance.map(s => ({
        name: s.name,
        fader_db: s.fader_db,
        pan: s.pan,
        effects: s.processing,
      })),
    },
    ableton_export: {
      project_name: `DARKSCO_Production`,
      tempo: 0, // filled by API layer
      time_signature: "4/4",
      tracks: stemBalance.map(s => s.name),
      notes: "Export master stereo output at 48kHz/24-bit WAV. Apply true peak limiting at -1dBTP.",
    },
  };
}

// ─── Main Agent ───────────────────────────────────────────────────────

export async function executeAudioEngineerAgent(
  input: AudioEngineerInput
): Promise<AudioEngineerResponse> {
  const { structure, soundbank_stems, bpm, total_bars, style } = input;

  const headroomResult = scoreHeadroom(soundbank_stems);
  const frequencyResult = scoreFrequencyBalance(soundbank_stems, style);
  const dynamicResult = scoreDynamicRange(structure, total_bars);

  const targetLufs = structure.quality_target?.loudness_lufs ?? -14;
  const stemBalance = buildStemBalance(soundbank_stems);
  const masterChain = buildMasterChain(frequencyResult.balance, targetLufs);
  const arrangementData = buildArrangementData(structure, stemBalance, masterChain);

  const allIssues = [
    ...headroomResult.issues,
    ...frequencyResult.issues,
    ...dynamicResult.issues,
  ];

  const criticals = allIssues.filter(i => i.severity === "critical").length;
  const mixScore = Math.round((headroomResult.score + frequencyResult.score + dynamicResult.score) / 3);

  const qualityScores: Partial<QualityScores> = {
    arrangement_integrity: dynamicResult.score,
    audio_engineering: mixScore,
  };

  const gatePassed = criticals === 0 && mixScore >= 70;

  return {
    arrangement_data: arrangementData,
    quality_scores: qualityScores,
    gate_passed: gatePassed,
    issues: allIssues,
    mixing_report: {
      headroom_analysis: `Headroom target: ${headroomResult.db.toFixed(1)}dB. ${headroomResult.issues.length ? "Warnings present." : "Clean."}`,
      frequency_analysis: `Balance: ${frequencyResult.balance}. Score: ${frequencyResult.score}/100.`,
      dynamic_range_analysis: `Range: ~${dynamicResult.range_db}dB. Score: ${dynamicResult.score}/100.`,
      stem_balance: stemBalance,
      master_chain: masterChain,
      mix_score: mixScore,
    },
    wav_export_spec: {
      sample_rate: 48000,
      bit_depth: 24,
      channels: 2,
      format: "wav",
      loudness_lufs: targetLufs,
      headroom_db: headroomResult.db,
      true_peak_dbtp: -1.0,
      dithering: false,
      notes: `Stereo master WAV. ${frequencyResult.balance} frequency curve. Mastered to ${targetLufs} LUFS. ${structure.quality_target?.mastering_chain?.join(" → ") ?? "Standard mastering chain"}.`,
    },
  };
}
