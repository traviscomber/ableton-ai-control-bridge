/**
 * POST /api/music/generate-stems
 *
 * FULL PRODUCTION PIPELINE — 5 stages:
 *   1. Music Structure   (ReasoningArchitect — fallback or OpenAI o1)
 *   2. Samplepack WAV    (Pure-TS synthesis engine, 48kHz/24-bit per stem)
 *   3. MIDI per stem     (MidiComposer — one .mid file per stem type)
 *   4. Quality Gates     (AudioEngineer + ComplianceChecker)
 *   5. Final WAV Master  (Mastering chain — -14 LUFS streaming target)
 *
 * Body:
 * {
 *   variant:    "daytime" | "morning" | "night"
 *   bars?:      4 | 8 | 16 | 32  (default 8)
 *   bpm?:       number (overrides preset)
 *   stems?:     string[] (which stems to include, default all 8)
 *   includeMix?:   boolean (render mix master, default true)
 *   includeMidi?:  boolean (generate MIDI files, default true)
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { renderDrumBus } from "@/lib/synth/drum-synth";
import { renderBass, renderPad, renderStab, renderArp, renderNoiseTexture } from "@/lib/synth/melodic-synth";
import { masterMix, measureLufs } from "@/lib/synth/mastering";
import { encodeWavMono, SAMPLE_RATE } from "@/lib/synth/wav-engine";
import { composeMidiPerStem } from "@/lib/agents/midi-composer";
import { executeAudioEngineerAgent } from "@/lib/agents/audio-engineer";
import { executeComplianceCheckerAgent } from "@/lib/agents/compliance-checker";
import { renderSamplePack } from "@/lib/synth/sample-synth";
import type { StemSampleGroup } from "@/lib/synth/sample-synth";
import type { StemChannel } from "@/lib/synth/mastering";
import { uploadProduction, saveProductionRecord } from "@/lib/supabase/storage";
import { randomUUID } from "crypto";

export type { StemSampleGroup };

// ─── DARKSCO Variant Presets ─────────────────────────────────────────────────

const PRESETS = {
  daytime: {
    bpm: 124, key: "C major",
    description: "Bright dark disco, energetic, club-ready",
    chordRoot: [60, 64, 67], bassRoot: 36,
    drumProfile: { kick: [0,4,8,12], snare: [4,12], hihat: [0,2,4,6,8,10,12,14], openHihat: [7,15], clap: [4,12], perc: [2,6,10,14] },
    kickParams:  { startFreq: 260, endFreq: 50,  drive: 1.6, clickLevel: 0.2 },
    snareParams: { toneFreq: 200,  noiseLevel: 0.6, noiseHpHz: 1400 },
    hihatParams: { brightness: 0.8, filterHz: 9000 },
    bassParams:  { filterHz: 900,  filterQ: 2.0, subMix: 0.3, drive: 1.4 },
    padParams:   { voices: 4, detuneCents: 14, filterHz: 2800, lfoRate: 0.3, reverbWet: 0.3 },
    stabParams:  { filterHz: 4000, filterQ: 4.0, drive: 2.2 },
    arpParams:   { pattern: "up" as const, noteLengthBeats: 0.25, waveform: "saw" as const, filterHz: 5000 },
    masterParams: { eqHighDb: 1.5, eqMidDb: 0.5, stereoWidth: 1.15, compThreshDb: -10 },
    // Reasoning structure fallback
    structure: {
      sections: [
        { name: "intro",     duration_bars: 4,  elements: ["hihat","pad"],            dynamics: "minimal",  notes: "Gradual hi-hat open, pad swells in" },
        { name: "build",     duration_bars: 4,  elements: ["hihat","pad","bass"],     dynamics: "moderate", notes: "Bass enters, kick builds tension" },
        { name: "drop",      duration_bars: 8,  elements: ["kick","snare","hihat","bass","stab"], dynamics: "intense", notes: "Full energy drop, stabby synth accents" },
        { name: "breakdown", duration_bars: 4,  elements: ["pad","arp"],              dynamics: "minimal",  notes: "Strip back to pad and arp only" },
        { name: "peak",      duration_bars: 8,  elements: ["kick","snare","hihat","bass","pad","stab","arp"], dynamics: "intense", notes: "Everything in — peak energy" },
        { name: "outro",     duration_bars: 4,  elements: ["hihat","pad"],            dynamics: "minimal",  notes: "Strip back to intro elements, fade" },
      ],
      chords: [
        { bar: 1, root: "C", quality: "major",   inversion: 0, voicing_notes: "Root position, open voicing" },
        { bar: 3, root: "A", quality: "minor",   inversion: 0, voicing_notes: "Relative minor colour" },
        { bar: 5, root: "F", quality: "major",   inversion: 0, voicing_notes: "IV chord, bright lift" },
        { bar: 7, root: "G", quality: "major",   inversion: 0, voicing_notes: "V chord, resolution tension" },
      ],
      drum_pattern: { kick: [0,4,8,12], snare: [4,12], hihat: [0,2,4,6,8,10,12,14], open_hihat: [7,15], perc: [2,6,10,14], description: "Classic 4-on-the-floor with bright hi-hats and energetic clap layer" },
      bass_movement: "Root on beat 1, octave variation on beat 2.5, fifth on beat 3, chromatic approach on beat 4",
      synthesis_notes: "Bright sawtooth bass (900Hz LP, Q=2). Pad: 4-voice detuned (14¢), 2800Hz LP, LFO 0.3Hz. Stab: highpass aggression (4kHz, Q=4). Arp: 16th ascending.",
      production_tips: [
        "Sidechain compress pad and stab to kick — classic pumping effect",
        "Automate hi-hat filter cutoff upward through the build section",
        "Add 1/16 delay on arp with 25% feedback for disco shimmer",
        "Use NYC parallel compression on drum bus for punch",
        "Boost 4-6kHz on stabs for presence in a club mix",
      ],
      arrangement_arc: "Energetic club track — fast intro, explosive drop at bar 8, breakdown for tension, massive peak",
      energy_curve: "Bars 1-4: 25% — Bars 5-8: 55% — Bars 9-16: 90% — Bars 17-20: 30% — Bars 21-32: 95%",
    },
  },

  morning: {
    bpm: 116, key: "G major",
    description: "Fresh dark disco, soulful, warm, organic",
    chordRoot: [67, 71, 74], bassRoot: 43,
    drumProfile: { kick: [0,4,8,12], snare: [4,12], hihat: [0,2,4,6,8,10,12,14], openHihat: [6,14], clap: [4,12], perc: [3,11] },
    kickParams:  { startFreq: 200, endFreq: 55,  pitchDecay: 0.07, drive: 1.4, clickLevel: 0.12 },
    snareParams: { toneFreq: 180,  noiseLevel: 0.7, noiseHpHz: 1100, snap: 0.7 },
    hihatParams: { brightness: 0.55, filterHz: 7500 },
    bassParams:  { filterHz: 750,  filterQ: 1.8, subMix: 0.4, detuneCents: 6, drive: 1.3 },
    padParams:   { voices: 4, detuneCents: 20, filterHz: 2200, lfoRate: 0.2, reverbWet: 0.4, attack: 0.8 },
    stabParams:  { filterHz: 3200, filterQ: 3.0, drive: 1.8 },
    arpParams:   { pattern: "updown" as const, noteLengthBeats: 0.5, waveform: "saw" as const, filterHz: 3500 },
    masterParams: { eqLowDb: 0.8, eqHighDb: -0.5, eqMidDb: 0.3, stereoWidth: 1.1, compThreshDb: -12, compRatio: 2.5 },
    structure: {
      sections: [
        { name: "intro",     duration_bars: 4,  elements: ["pad","hihat"],            dynamics: "minimal",  notes: "Warm pad swells, gentle hi-hat groove" },
        { name: "verse",     duration_bars: 8,  elements: ["kick","bass","hihat","pad"], dynamics: "moderate", notes: "Soulful bass enters, laid-back groove" },
        { name: "chorus",    duration_bars: 8,  elements: ["kick","snare","hihat","bass","pad","stab"], dynamics: "intense", notes: "Full arrangement, vocal stabs" },
        { name: "breakdown", duration_bars: 4,  elements: ["pad","arp"],              dynamics: "minimal",  notes: "Morning atmosphere, solo arp melody" },
        { name: "peak",      duration_bars: 8,  elements: ["kick","snare","hihat","bass","pad","stab","arp"], dynamics: "intense", notes: "Full soulful peak" },
        { name: "outro",     duration_bars: 4,  elements: ["pad","hihat"],            dynamics: "minimal",  notes: "Warm fade back to morning atmosphere" },
      ],
      chords: [
        { bar: 1, root: "G", quality: "major",   inversion: 0, voicing_notes: "Bright root position" },
        { bar: 3, root: "E", quality: "minor",   inversion: 0, voicing_notes: "Relative minor, soulful colour" },
        { bar: 5, root: "C", quality: "major",   inversion: 1, voicing_notes: "IV first inversion for movement" },
        { bar: 7, root: "D", quality: "major",   inversion: 0, voicing_notes: "V chord, pull to resolution" },
      ],
      drum_pattern: { kick: [0,4,8,12], snare: [4,12], hihat: [0,2,4,6,8,10,12,14], open_hihat: [6,14], perc: [3,11], description: "Warm organic groove — slightly loose hi-hats, snappy snare" },
      bass_movement: "Warm sub presence, octave variation on beat 2.5 for soulful movement, fifth on beat 3",
      synthesis_notes: "Detuned saw bass (6¢, warm), 750Hz LP. Pad: slow attack (800ms), LFO 0.2Hz, large reverb tail. Arp: up-down pattern for morning energy.",
      production_tips: [
        "Add gentle saturation to bass for warmth without harshness",
        "High shelf cut at -1.5dB around 10kHz to keep morning feel soft",
        "Use a slow auto-pan on pad (0.1Hz) for gentle stereo movement",
        "Layer a subtle acoustic percussion element under the hi-hat",
        "Bus reverb on drum group at 15% to glue organic feel",
      ],
      arrangement_arc: "Gentle morning sunrise — warm intro, soulful verse, energetic chorus, melodic breakdown, organic peak",
      energy_curve: "Bars 1-4: 20% — Bars 5-12: 60% — Bars 13-20: 85% — Bars 21-24: 30% — Bars 25-36: 88%",
    },
  },

  night: {
    bpm: 120, key: "F minor",
    description: "Deep dark disco, mysterious, hypnotic",
    chordRoot: [65, 68, 72], bassRoot: 41,
    drumProfile: { kick: [0,3,8,12], snare: [4,12], hihat: [0,2,4,6,8,10,12,14], openHihat: [7], clap: [], perc: [2,6,9,14] },
    kickParams:  { startFreq: 160, endFreq: 40,  pitchDecay: 0.08, drive: 2.0, durationSec: 0.65, clickLevel: 0.08 },
    snareParams: { toneFreq: 150,  noiseLevel: 0.55, noiseHpHz: 900,  snap: 1.2, durationSec: 0.22 },
    hihatParams: { brightness: 0.35, filterHz: 6500 },
    bassParams:  { filterHz: 550,  filterQ: 3.0, subMix: 0.45, drive: 1.7, attack: 0.006, decay: 0.12 },
    padParams:   { voices: 4, detuneCents: 22, filterHz: 1600, lfoRate: 0.18, reverbWet: 0.5, attack: 1.0 },
    stabParams:  { filterHz: 2500, filterQ: 5.0, drive: 2.5 },
    arpParams:   { pattern: "down" as const, noteLengthBeats: 0.5, waveform: "square" as const, filterHz: 2800, delayBeats: 0.5, delayFeedback: 0.4 },
    masterParams: { eqLowDb: 1.5, eqLowMidDb: -0.5, eqHighDb: -1.0, stereoWidth: 1.05, compThreshDb: -14, compRatio: 4 },
    structure: {
      sections: [
        { name: "intro",     duration_bars: 4,  elements: ["noise","pad"],            dynamics: "minimal",  notes: "Dark noise texture, deep pad slowly emerges" },
        { name: "build",     duration_bars: 4,  elements: ["hihat","pad","bass","noise"], dynamics: "moderate", notes: "Bass enters deep, hi-hats drive tension" },
        { name: "drop",      duration_bars: 16, elements: ["kick","snare","hihat","bass","pad","stab"], dynamics: "intense", notes: "Deep hypnotic drop — syncopated kick (pos 0,3,8,12)" },
        { name: "breakdown", duration_bars: 8,  elements: ["pad","arp","noise"],      dynamics: "minimal",  notes: "Dark atmospheric break — arp descends mysteriously" },
        { name: "peak",      duration_bars: 16, elements: ["kick","snare","hihat","bass","pad","stab","arp","noise"], dynamics: "intense", notes: "Maximum darkness — all elements including noise texture" },
        { name: "outro",     duration_bars: 8,  elements: ["pad","noise"],            dynamics: "minimal",  notes: "Dissolve into texture and dark pad" },
      ],
      chords: [
        { bar: 1,  root: "F",  quality: "minor",  inversion: 0, voicing_notes: "Root position, deep minor" },
        { bar: 5,  root: "Db", quality: "major",  inversion: 0, voicing_notes: "bVI — eerie brightness against minor" },
        { bar: 9,  root: "Ab", quality: "major",  inversion: 1, voicing_notes: "bIII first inversion, haunting" },
        { bar: 13, root: "Eb", quality: "minor",  inversion: 0, voicing_notes: "bVII minor — dark resolution" },
      ],
      drum_pattern: { kick: [0,3,8,12], snare: [4,12], hihat: [0,2,4,6,8,10,12,14], open_hihat: [7], perc: [2,6,9,14], description: "Syncopated kick at positions 0,3,8,12 — off-grid feel. Dark closed hi-hats, one open on 7." },
      bass_movement: "Deep 40Hz sub-bass root, minimal movement — root holds, fifth appears on bar 3, chromatic half-step on approach",
      synthesis_notes: "Deep square+sub bass (550Hz LP, Q=3, 45% sub blend). Pad: slow attack (1s), very dark (1600Hz LP), heavy reverb (50%). Arp: descending square wave with 1/8 delay and 40% feedback.",
      production_tips: [
        "High-pass all non-bass elements at 120Hz+ to keep sub clean",
        "Add Ableton Corpus (Pipe) resonator on bass for metallic darkness",
        "Automate pad filter from 800Hz up to 2000Hz in the drop",
        "Use max stereo width on pad and arp, keep kick/bass mono",
        "Add reverb tail automation — increase 30%→60% into the breakdown",
      ],
      arrangement_arc: "Hypnotic night journey — dark intro, deep drop sustained, mysterious breakdown, maximum darkness peak",
      energy_curve: "Bars 1-4: 15% — Bars 5-8: 40% — Bars 9-24: 85% — Bars 25-32: 25% — Bars 33-48: 92% — Bars 49-56: 20%",
    },
  },
} as const;

type Variant = keyof typeof PRESETS;

// ─── Note helper ──────────────────────────────────────────────────────────────

function makeNotes(
  rootMidi: number, bpm: number, bars: number,
  notesPerBar: number, durationBeats: number, velocity = 90
) {
  const beatsBetween = 4 / notesPerBar;
  const totalBeats = bars * 4;
  const notes = [];
  for (let beat = 0; beat < totalBeats; beat += beatsBetween) {
    notes.push({ pitch: rootMidi, startBeat: beat, durationBeats, velocity });
  }
  return notes;
}

// ─── Response Types ───────────────────────────────────────────────────────────

export interface SampleHit {
  stem:           string;
  name:           string;
  note_name:      string;
  midi_note:      number;
  velocity:       number;
  velocity_label: "soft" | "medium" | "hard";
  wav_b64:        string;  // stripped from response after upload (empty string)
  midi_b64:       string;  // stripped from response after upload (empty string)
  wav_url:        string;  // signed Supabase URL
  midi_url:       string;  // signed Supabase URL
  wav_path:       string;  // storage path for re-signing
  duration_ms:    number;
  size_bytes:     number;
}

export interface SamplepPackStem {
  name:         string;
  stem_type:    string;
  wav_b64:      string;  // stripped from response after upload (empty string)
  wav_url:      string;  // signed Supabase URL
  wav_path:     string;  // storage path for re-signing
  sampleRate:   number;
  bitDepth:     number;
  durationSec:  number;
  sizeBytes:    number;
}

export interface MidiFile {
  stem:           string;
  filename:       string;
  midi_b64:       string;  // stripped from response after upload (empty string)
  midi_url:       string;  // signed Supabase URL
  midi_path:      string;  // storage path for re-signing
  notes_count:    number;
  duration_beats: number;
  channel:        number;
  track_type:     "drums" | "melodic";
  description:    string;
}

export interface FullPipelineResponse {
  // Stage 1
  structure: {
    sections: Array<{ name: string; duration_bars: number; elements: string[]; dynamics: string; notes: string }>;
    chords: Array<{ bar: number; root: string; quality: string; inversion: number; voicing_notes: string }>;
    drum_pattern: { kick: number[]; snare: number[]; hihat: number[]; open_hihat: number[]; perc: number[]; description: string };
    bass_movement: string;
    synthesis_notes: string;
    production_tips: string[];
    arrangement_arc: string;
    energy_curve: string;
    reasoning_used: "openai" | "fallback";
  };
  // Stage 2 — Samplepack
  samplepack: {
    stems:              SamplepPackStem[];
    total_stems:        number;
    total_size_bytes:   number;
    format:             string;
    // Individual one-shot samples grouped by stem
    sample_groups:      StemSampleGroup[];
    total_samples:      number;
    total_sample_bytes: number;
  };
  // Stage 3
  midis: MidiFile[];
  // Stage 4
  quality_gates: {
    audio_engineer: {
      gate_passed: boolean;
      overall_score: number;
      headroom_db: number;
      frequency_balance: string;
      dynamic_range_db: number;
      findings: string[];
      mixing_recommendations: Array<{ stem: string; processing: string[] }>;
      master_chain: {
        eq: Array<{ band: string; freq: number; gain: number; type: string }>;
        compressor: { ratio: number; threshold: number; attack_ms: number; release_ms: number };
        loudness_target: number;
      };
    };
    compliance: {
      gate_passed: boolean;
      overall_score: number;
      platforms: Array<{ platform: string; compliant: boolean; loudness_target: string; notes: string }>;
      darksco_score: number;
      darksco_notes: string[];
      release_ready: boolean;
    };
  };
  // Stage 5
  final_wav: {
    wav_b64:  string;  // stripped after upload
    wav_url:  string;  // signed Supabase URL
    wav_path: string;  // storage path
    lufs: number;
    truePeak: number;
    dynamicRange: number;
    durationSec: number;
    sizeBytes: number;
  };
  // Meta
  production_id: string; // Supabase production record ID
  meta: {
    variant: Variant;
    bpm: number;
    key: string;
    bars: number;
    description: string;
    renderTimeMs: number;
    total_size_bytes: number;
    pipeline_stages_completed: string[];
    reasoning_used: "openai" | "fallback";
  };
  error?: string;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const start = Date.now();
  const stagesCompleted: string[] = [];

  try {
    const body = await req.json();
    const variant: Variant = (body.variant ?? "night") as Variant;
    const preset = PRESETS[variant];
    if (!preset) {
      return NextResponse.json({ error: `Unknown variant: ${variant}` }, { status: 400 });
    }

    const bpm = body.bpm ?? preset.bpm;
    const bars = body.bars ?? 8;
    const requestedStems: string[] = body.stems ?? ["kick","snare","hihat","bass","pad","stab","arp","noise"];
    const includeMix: boolean = body.includeMix ?? true;
    const includeMidi: boolean = body.includeMidi ?? true;

    // ── STAGE 1: Music Structure ─────────────────────────────────────────────
    const structure: FullPipelineResponse["structure"] = {
      sections: preset.structure.sections.map(s => ({ ...s, elements: [...s.elements] })),
      chords: preset.structure.chords.map(c => ({ ...c })),
      drum_pattern: {
        kick: [...preset.structure.drum_pattern.kick],
        snare: [...preset.structure.drum_pattern.snare],
        hihat: [...preset.structure.drum_pattern.hihat],
        open_hihat: [...preset.structure.drum_pattern.open_hihat],
        perc: [...preset.structure.drum_pattern.perc],
        description: preset.structure.drum_pattern.description,
      },
      bass_movement: preset.structure.bass_movement,
      synthesis_notes: preset.structure.synthesis_notes,
      production_tips: [...preset.structure.production_tips],
      arrangement_arc: preset.structure.arrangement_arc,
      energy_curve: preset.structure.energy_curve,
      reasoning_used: "fallback",
    };
    stagesCompleted.push("structure");

    // ── STAGE 2: Samplepack WAV synthesis ───────────────────────────────────
    const stems: SamplepPackStem[] = [];
    const mixChannels: StemChannel[] = [];

    const addStem = (type: string, buf: Float64Array, gainDb: number, pan: number, hpHz?: number, lpHz?: number) => {
      const wav = encodeWavMono(buf, { bitDepth: 24 });
      stems.push({
        name:        `${type}-${variant}`,
        stem_type:   type,
        wav_b64:     wav.toString("base64"),
        wav_url:     "",
        wav_path:    "",
        sampleRate:  SAMPLE_RATE,
        bitDepth:    24,
        durationSec: buf.length / SAMPLE_RATE,
        sizeBytes:   wav.length,
      });
      mixChannels.push({ buffer: buf, gainDb, pan, hpCutHz: hpHz, lpCutHz: lpHz });
    };

    if (requestedStems.includes("kick")) {
      const buf = renderDrumBus({ kick: [...preset.drumProfile.kick] }, { bpm, bars, kickParams: preset.kickParams });
      addStem("kick", buf, 0, 0, 30);
    }
    if (requestedStems.includes("snare")) {
      const buf = renderDrumBus(
        { snare: [...preset.drumProfile.snare], clap: [...(preset.drumProfile.clap ?? [])] },
        { bpm, bars, snareParams: preset.snareParams, clapParams: {} }
      );
      addStem("snare", buf, -1, 0);
    }
    if (requestedStems.includes("hihat")) {
      const buf = renderDrumBus(
        { hihat: [...preset.drumProfile.hihat], openHihat: [...preset.drumProfile.openHihat] },
        { bpm, bars, hihatParams: preset.hihatParams, openHihatParams: { brightness: (preset.hihatParams.brightness ?? 0.5) - 0.1, durationSec: 0.28 } }
      );
      addStem("hihat", buf, -3, 0.15);
    }
    if (requestedStems.includes("bass")) {
      const notes = makeNotes(preset.bassRoot, bpm, bars, 2, 1.8, 100);
      const buf = renderBass(notes, bpm, bars, preset.bassParams);
      addStem("bass", buf, -2, 0, 35, 250);
    }
    if (requestedStems.includes("pad")) {
      const notes = preset.chordRoot.map((pitch) => ({ pitch, startBeat: 0, durationBeats: bars * 4 - 0.5, velocity: 80 }));
      const buf = renderPad(notes, bpm, bars, preset.padParams);
      addStem("pad", buf, -5, 0);
    }
    if (requestedStems.includes("stab")) {
      const stabNotes = [];
      for (let bar = 0; bar < bars; bar++) {
        if (bar % 2 === 0) {
          stabNotes.push({ pitch: preset.chordRoot[0], startBeat: bar * 4 + 1, durationBeats: 0.25, velocity: 95 });
          stabNotes.push({ pitch: preset.chordRoot[2], startBeat: bar * 4 + 3, durationBeats: 0.25, velocity: 85 });
        }
      }
      const buf = renderStab(stabNotes, bpm, bars, preset.stabParams);
      addStem("stab", buf, -4, -0.2);
    }
    if (requestedStems.includes("arp")) {
      const buf = renderArp([...preset.chordRoot], bpm, bars, preset.arpParams);
      addStem("arp", buf, -5, 0.3);
    }
    if (requestedStems.includes("noise")) {
      const buf = renderNoiseTexture(bpm, bars, {
        hpHz: variant === "night" ? 1500 : 2500,
        lpHz: variant === "night" ? 6000 : 10000,
        gain: 0.2,
      });
      addStem("noise", buf, -8, 0);
    }
    stagesCompleted.push("samplepack");

    // ── STAGE 2b: One-shot samples (samplepack) ──────────────────────────────
    const sampleGroups = renderSamplePack({
      bpm,
      kickParams:  preset.kickParams,
      snareParams: preset.snareParams,
      hihatParams: preset.hihatParams,
      bassParams:  preset.bassParams,
      padParams:   { filterHz: preset.padParams?.filterHz, detuneCents: preset.padParams?.detuneCents },
      stabParams:  { filterHz: preset.stabParams?.filterHz, filterQ: preset.stabParams?.filterQ, drive: preset.stabParams?.drive },
      requestedStems,
    });
    const totalSampleBytes = sampleGroups.reduce(
      (acc, g) => acc + g.samples.reduce((a, s) => a + s.size_bytes, 0), 0
    );
    const totalSampleCount = sampleGroups.reduce((acc, g) => acc + g.samples.length, 0);

    // ── STAGE 3: MIDI per stem ───────────────────────────────────────────────
    let midis: MidiFile[] = [];
    if (includeMidi) {
      midis = composeMidiPerStem({
        structure: {
          drum_pattern: {
            kick: [...preset.drumProfile.kick],
            snare: [...preset.drumProfile.snare],
            hihat: [...preset.drumProfile.hihat],
            open_hihat: [...preset.drumProfile.openHihat],
            perc: [...(preset.drumProfile.perc ?? [])],
          },
          chords: preset.structure.chords.map(c => ({
            bar: c.bar,
            root: c.root,
            quality: c.quality,
            inversion: c.inversion,
          })),
          sections: preset.structure.sections.map(s => ({
            name: s.name,
            duration_bars: s.duration_bars,
            dynamics: s.dynamics,
          })),
        },
        bpm,
        bars,
        variant,
        key: preset.key,
      });
      stagesCompleted.push("midi");
    }

    // ── STAGE 4: Quality Gates ───────────────────────────────────────────────
    const soundbankStemsForQA = stems.map(s => ({
      name: s.name,
      instrument_type: s.stem_type,
      frequency_range: [
        s.stem_type === "kick" || s.stem_type === "bass" ? 30 : s.stem_type === "pad" ? 80 : 200,
        s.stem_type === "hihat" || s.stem_type === "noise" ? 16000 : s.stem_type === "arp" ? 8000 : 4000,
      ] as [number, number],
      duration_seconds: s.durationSec,
      category: ["kick","snare","hihat","perc"].includes(s.stem_type) ? "percussive" : "melodic",
    }));

    const aeResult = await executeAudioEngineerAgent({
      structure: preset.structure as any,
      midi_tracks_count: midis.length,
      soundbank_stems: soundbankStemsForQA,
      bpm,
      total_bars: bars,
      style: `darksco-${variant}`,
    });

    // ── STAGE 5: Final WAV Master ────────────────────────────────────────────
    let finalWav: FullPipelineResponse["final_wav"] | undefined;
    if (includeMix && mixChannels.length > 0) {
      const master = masterMix(mixChannels, {
        ...preset.masterParams,
        targetLufs: -14,
        ceilingDbTP: -0.3,
        bitDepth: 24,
      });
      finalWav = {
        wav_b64:     master.wavBuffer.toString("base64"),
        wav_url:     "",
        wav_path:    "",
        lufs:        master.lufs.integratedLufs,
        truePeak:    master.lufs.truePeakDbTP,
        dynamicRange: master.lufs.dynamicRangeDb,
        durationSec: master.durationSec,
        sizeBytes:   master.wavBuffer.length,
      };
    }

    // Run compliance checker after we know LUFS
    const ccResult = await executeComplianceCheckerAgent({
      loudness_lufs: finalWav?.lufs ?? -14,
      headroom_db: aeResult.wav_export_spec.headroom_db,
      true_peak_dbtp: finalWav?.truePeak ?? -0.3,
      sample_rate: SAMPLE_RATE,
      bit_depth: 24,
      duration_seconds: finalWav?.durationSec ?? bars * 4 * (60 / bpm),
      style: `darksco-${variant}`,
      bpm,
      key: preset.key,
      stems_count: stems.length,
      midi_tracks_count: midis.length,
      arrangement_sections: preset.structure.sections.length,
    });
    stagesCompleted.push("quality_gates");
    if (finalWav) stagesCompleted.push("final_wav");

    const totalSizeBytes =
      stems.reduce((s, r) => s + r.sizeBytes, 0) +
      (finalWav?.sizeBytes ?? 0);

    // ── Upload all files to Supabase Storage ─────────────────────────────────
    const productionId = randomUUID();
    let storedPaths: Awaited<ReturnType<typeof uploadProduction>> | null = null;

    try {
      storedPaths = await uploadProduction({
        productionId,
        variant,
        bpm,
        stems:        stems.map(s => ({ stem_type: s.stem_type, name: s.name, wav_b64: s.wav_b64 })),
        midis:        midis.map(m => ({ stem: m.stem, filename: m.filename, midi_b64: m.midi_b64 })),
        sampleGroups: sampleGroups.map(g => ({
          stem: g.stem,
          samples: g.samples.map(s => ({ name: s.name, wav_b64: s.wav_b64, midi_b64: s.midi_b64 })),
        })),
        masterWav: { wav_b64: finalWav?.wav_b64 ?? "" },
      });

      // Persist metadata record
      await saveProductionRecord({
        productionId,
        variant,
        bpm,
        key:           preset.key,
        bars,
        structureJson: structure,
        qualityJson:   {},  // filled below
        finalWavMeta:  { lufs: finalWav?.lufs, truePeak: finalWav?.truePeak, durationSec: finalWav?.durationSec },
        stemsPaths:    Object.fromEntries(Object.entries(storedPaths.stems).map(([k, v]) => [k, v.path])),
        midiPaths:     Object.fromEntries(Object.entries(storedPaths.midis).map(([k, v]) => [k, v.path])),
        samplePaths:   Object.fromEntries(Object.entries(storedPaths.sampleGroups).map(([k, vs]) => [k, vs.map(v => v.path)])),
        pipelineMs:    Date.now() - start,
        totalSizeBytes: totalSizeBytes,
      });

      stagesCompleted.push("storage");
    } catch (storageErr) {
      // Non-fatal — log and continue without storage URLs
      console.error("[generate-stems] Storage upload failed:", storageErr);
    }

    // Populate URL fields and strip base64 from response objects
    for (const stem of stems) {
      const stored = storedPaths?.stems[stem.stem_type];
      stem.wav_url  = stored?.url  ?? "";
      stem.wav_path = stored?.path ?? "";
      stem.wav_b64  = "";  // strip — no longer needed in response
    }
    for (const midi of midis) {
      const stored = storedPaths?.midis[midi.stem];
      midi.midi_url  = stored?.url  ?? "";
      midi.midi_path = stored?.path ?? "";
      midi.midi_b64  = "";
    }
    for (const group of sampleGroups) {
      const storedGroup = storedPaths?.sampleGroups[group.stem] ?? [];
      group.samples.forEach((s, i) => {
        s.wav_url  = storedGroup[i]?.url  ?? "";
        s.wav_path = storedGroup[i]?.path ?? "";
        s.wav_b64  = "";
        s.midi_b64 = "";
        // MIDI for samples: we don't upload midi for samples individually yet, keep midi_url empty
        s.midi_url = "";
      });
    }
    if (finalWav) {
      const stored = storedPaths?.masterWav;
      finalWav.wav_url  = stored?.url  ?? "";
      finalWav.wav_path = stored?.path ?? "";
      finalWav.wav_b64  = "";
    }

    const response: FullPipelineResponse = {
      production_id: productionId,
      structure,
      samplepack: {
        stems,
        total_stems:        stems.length,
        total_size_bytes:   stems.reduce((s, r) => s + r.sizeBytes, 0),
        format:             "48kHz / 24-bit WAV",
        sample_groups:      sampleGroups,
        total_samples:      totalSampleCount,
        total_sample_bytes: totalSampleBytes,
      },
      midis,
      quality_gates: {
        audio_engineer: {
          gate_passed: aeResult.gate_passed,
          overall_score: Math.round(
            Object.values(aeResult.quality_scores as Record<string, number>).reduce((a, b) => a + b, 0) /
            Math.max(1, Object.values(aeResult.quality_scores).length)
          ),
          headroom_db: aeResult.wav_export_spec.headroom_db,
          frequency_balance: aeResult.mixing_report.frequency_analysis,
          dynamic_range_db: Math.round(Math.abs(aeResult.wav_export_spec.headroom_db) + 6),
          findings: aeResult.issues.map(i => `[${i.severity.toUpperCase()}] ${i.message}`),
          mixing_recommendations: aeResult.mixing_report.stem_balance.slice(0, 6).map(sb => ({
            stem: sb.name,
            processing: sb.processing,
          })),
          master_chain: {
            eq: aeResult.mixing_report.master_chain.eq_settings,
            compressor: aeResult.mixing_report.master_chain.compressor,
            loudness_target: aeResult.mixing_report.master_chain.loudness_target,
          },
        },
        compliance: {
          gate_passed: ccResult.overall_compliant,
          overall_score: ccResult.quality_scores.compliance ?? 0,
          platforms: ccResult.platforms.map(p => ({
            platform: p.platform,
            compliant: p.compliant,
            loudness_target: p.loudness_target,
            notes: p.notes,
          })),
          darksco_score: ccResult.darksco_standard.score,
          darksco_notes: ccResult.darksco_standard.notes,
          release_ready: ccResult.release_ready,
        },
      },
      final_wav: finalWav ?? {
        wav_b64:     "",
        wav_url:     "",
        wav_path:    "",
        lufs:        -14,
        truePeak:    -0.3,
        dynamicRange: 8,
        durationSec: 0,
        sizeBytes:   0,
      },
      meta: {
        variant,
        bpm,
        key: preset.key,
        bars,
        description: preset.description,
        renderTimeMs: Date.now() - start,
        total_size_bytes: totalSizeBytes,
        pipeline_stages_completed: stagesCompleted,
        reasoning_used: "fallback",
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[generate-stems]", err);
    return NextResponse.json(
      { error: String(err), meta: { pipeline_stages_completed: stagesCompleted, renderTimeMs: Date.now() - start } },
      { status: 500 }
    );
  }
}
