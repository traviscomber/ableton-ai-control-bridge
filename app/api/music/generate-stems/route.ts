/**
 * POST /api/music/generate-stems
 *
 * Generates a complete set of WAV stems from scratch using the pure-TypeScript
 * synthesis engine (zero external audio dependencies). Each stem is synthesised,
 * run through the mastering chain, and returned as base64-encoded WAV data.
 *
 * The route also generates a stereo mix master from all stems combined.
 *
 * Body (JSON):
 * {
 *   variant: "daytime" | "morning" | "night"  (DARKSCO preset)
 *   bpm?: number         (overrides preset BPM)
 *   bars?: number        (how many bars to render, default 8)
 *   stems?: string[]     (which stems to generate: kick|snare|hihat|bass|pad|stab|arp|noise)
 *   includeMix?: boolean (render a stereo master mix, default true)
 * }
 *
 * Response (JSON):
 * {
 *   stems: { name, wav_b64, sampleRate, bitDepth, durationSec, sizeBytes }[]
 *   mix?:  { wav_b64, lufs, truePeak, dynamicRange, durationSec, sizeBytes }
 *   meta:  { bpm, key, bars, variant, renderTimeMs }
 * }
 */

import { NextRequest, NextResponse } from "next/server";

import { renderDrumBus } from "@/lib/synth/drum-synth";
import { renderBass, renderPad, renderStab, renderArp, renderNoiseTexture } from "@/lib/synth/melodic-synth";
import { masterMix, measureLufs } from "@/lib/synth/mastering";
import { encodeWavMono, SAMPLE_RATE } from "@/lib/synth/wav-engine";
import type { StemChannel } from "@/lib/synth/mastering";

// ─── DARKSCO variant presets ─────────────────────────────────────────────────

const PRESETS = {
  daytime: {
    bpm: 124,
    key: "C major",
    // Notes in C major: C D E F G A B → MIDI 60 62 64 65 67 69 71
    chordRoot: [60, 64, 67],          // C major triad
    bassRoot: 36,                      // C2
    description: "Bright dark disco, energetic, club-ready",
    drumProfile: {
      kick:      [0, 4, 8, 12],
      snare:     [4, 12],
      hihat:     [0, 2, 4, 6, 8, 10, 12, 14],
      openHihat: [7, 15],
      clap:      [4, 12],
      perc:      [2, 6, 10, 14],
    },
    kickParams:  { startFreq: 260, endFreq: 50,  drive: 1.6, clickLevel: 0.2 },
    snareParams: { toneFreq: 200,  noiseLevel: 0.6, noiseHpHz: 1400 },
    hihatParams: { brightness: 0.8, filterHz: 9000 },
    bassParams:  { filterHz: 900,  filterQ: 2.0, subMix: 0.3, drive: 1.4 },
    padParams:   { voices: 4, detuneCents: 14, filterHz: 2800, lfoRate: 0.3, reverbWet: 0.3 },
    stabParams:  { filterHz: 4000, filterQ: 4.0, drive: 2.2 },
    arpParams:   { pattern: "up" as const, noteLengthBeats: 0.25, waveform: "saw" as const, filterHz: 5000 },
    masterParams: { eqHighDb: 1.5, eqMidDb: 0.5, stereoWidth: 1.15, compThreshDb: -10 },
  },
  morning: {
    bpm: 116,
    key: "G major",
    // G major: G A B C D E F# → MIDI 67 69 71 72 74 76 78
    chordRoot: [67, 71, 74],          // G major triad
    bassRoot: 43,                      // G2
    description: "Fresh dark disco, soulful, warm, organic",
    drumProfile: {
      kick:      [0, 4, 8, 12],
      snare:     [4, 12],
      hihat:     [0, 2, 4, 6, 8, 10, 12, 14],
      openHihat: [6, 14],
      clap:      [4, 12],
      perc:      [3, 11],
    },
    kickParams:  { startFreq: 200, endFreq: 55,  pitchDecay: 0.07, drive: 1.4, clickLevel: 0.12 },
    snareParams: { toneFreq: 180,  noiseLevel: 0.7, noiseHpHz: 1100, snap: 0.7 },
    hihatParams: { brightness: 0.55, filterHz: 7500 },
    bassParams:  { filterHz: 750,  filterQ: 1.8, subMix: 0.4, detuneCents: 6, drive: 1.3 },
    padParams:   { voices: 4, detuneCents: 20, filterHz: 2200, lfoRate: 0.2, reverbWet: 0.4, attack: 0.8 },
    stabParams:  { filterHz: 3200, filterQ: 3.0, drive: 1.8 },
    arpParams:   { pattern: "updown" as const, noteLengthBeats: 0.5, waveform: "saw" as const, filterHz: 3500 },
    masterParams: { eqLowDb: 0.8, eqHighDb: -0.5, eqMidDb: 0.3, stereoWidth: 1.1, compThreshDb: -12, compRatio: 2.5 },
  },
  night: {
    bpm: 120,
    key: "F minor",
    // F minor: F G Ab Bb C Db Eb → MIDI 65 67 68 70 72 73 75
    chordRoot: [65, 68, 72],          // F minor triad
    bassRoot: 41,                      // F2
    description: "Deep dark disco, mysterious, hypnotic",
    drumProfile: {
      kick:      [0, 3, 8, 12],
      snare:     [4, 12],
      hihat:     [0, 2, 4, 6, 8, 10, 12, 14],
      openHihat: [7],
      clap:      [],
      perc:      [2, 6, 9, 14],
    },
    kickParams:  { startFreq: 160, endFreq: 40,  pitchDecay: 0.08, drive: 2.0, durationSec: 0.65, clickLevel: 0.08 },
    snareParams: { toneFreq: 150,  noiseLevel: 0.55, noiseHpHz: 900,  snap: 1.2, durationSec: 0.22 },
    hihatParams: { brightness: 0.35, filterHz: 6500 },
    bassParams:  { filterHz: 550,  filterQ: 3.0, subMix: 0.45, drive: 1.7, attack: 0.006, decay: 0.12 },
    padParams:   { voices: 4, detuneCents: 22, filterHz: 1600, lfoRate: 0.18, reverbWet: 0.5, attack: 1.0 },
    stabParams:  { filterHz: 2500, filterQ: 5.0, drive: 2.5 },
    arpParams:   { pattern: "down" as const, noteLengthBeats: 0.5, waveform: "square" as const, filterHz: 2800, delayBeats: 0.5, delayFeedback: 0.4 },
    masterParams: { eqLowDb: 1.5, eqLowMidDb: -0.5, eqHighDb: -1.0, stereoWidth: 1.05, compThreshDb: -14, compRatio: 4 },
  },
} as const;

type Variant = keyof typeof PRESETS;

// ─── Note event builder ────────────────────────────────────────────────────

function makeNotes(
  rootMidi: number,
  bpm: number,
  bars: number,
  notesPerBar: number,
  durationBeats: number,
  velocity = 90
) {
  const beatsBetween = 4 / notesPerBar;
  const totalBeats   = bars * 4;
  const notes = [];
  for (let beat = 0; beat < totalBeats; beat += beatsBetween) {
    notes.push({ pitch: rootMidi, startBeat: beat, durationBeats, velocity });
  }
  return notes;
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    const body = await req.json();
    const variant: Variant = body.variant ?? "night";
    const preset = PRESETS[variant];
    if (!preset) {
      return NextResponse.json({ error: `Unknown variant: ${variant}` }, { status: 400 });
    }

    const bpm   = body.bpm  ?? preset.bpm;
    const bars  = body.bars ?? 8;
    const requestedStems: string[] = body.stems ?? ["kick", "snare", "hihat", "bass", "pad", "stab", "arp", "noise"];
    const includeMix: boolean = body.includeMix ?? true;

    const stemResults: {
      name: string;
      wav_b64: string;
      sampleRate: number;
      bitDepth: number;
      durationSec: number;
      sizeBytes: number;
    }[] = [];

    const mixChannels: StemChannel[] = [];

    // ── Kick ──────────────────────────────────────────────────────────────
    if (requestedStems.includes("kick")) {
      const buf = renderDrumBus(
        { kick: [...preset.drumProfile.kick] },
        { bpm, bars, kickParams: preset.kickParams }
      );
      const wav = encodeWavMono(buf, { bitDepth: 24 });
      stemResults.push({
        name: `kick-${variant}`,
        wav_b64: wav.toString("base64"),
        sampleRate: SAMPLE_RATE,
        bitDepth: 24,
        durationSec: buf.length / SAMPLE_RATE,
        sizeBytes: wav.length,
      });
      mixChannels.push({ buffer: buf, gainDb: 0, pan: 0, hpCutHz: 30 });
    }

    // ── Snare ────────────────────────────────────────────────────────────
    if (requestedStems.includes("snare")) {
      const buf = renderDrumBus(
        { snare: [...preset.drumProfile.snare], clap: [...preset.drumProfile.clap] },
        { bpm, bars, snareParams: preset.snareParams, clapParams: {} }
      );
      const wav = encodeWavMono(buf, { bitDepth: 24 });
      stemResults.push({
        name: `snare-${variant}`,
        wav_b64: wav.toString("base64"),
        sampleRate: SAMPLE_RATE,
        bitDepth: 24,
        durationSec: buf.length / SAMPLE_RATE,
        sizeBytes: wav.length,
      });
      mixChannels.push({ buffer: buf, gainDb: -1, pan: 0 });
    }

    // ── Hi-Hat ───────────────────────────────────────────────────────────
    if (requestedStems.includes("hihat")) {
      const buf = renderDrumBus(
        { hihat: [...preset.drumProfile.hihat], openHihat: [...preset.drumProfile.openHihat] },
        { bpm, bars, hihatParams: preset.hihatParams, openHihatParams: { brightness: (preset.hihatParams.brightness ?? 0.5) - 0.1, durationSec: 0.28 } }
      );
      const wav = encodeWavMono(buf, { bitDepth: 24 });
      stemResults.push({
        name: `hihat-${variant}`,
        wav_b64: wav.toString("base64"),
        sampleRate: SAMPLE_RATE,
        bitDepth: 24,
        durationSec: buf.length / SAMPLE_RATE,
        sizeBytes: wav.length,
      });
      mixChannels.push({ buffer: buf, gainDb: -3, pan: 0.15 });
    }

    // ── Bass ─────────────────────────────────────────────────────────────
    if (requestedStems.includes("bass")) {
      const notes = makeNotes(preset.bassRoot, bpm, bars, 2, 1.8, 100);
      const buf = renderBass(notes, bpm, bars, preset.bassParams);
      const wav = encodeWavMono(buf, { bitDepth: 24 });
      stemResults.push({
        name: `bass-${variant}`,
        wav_b64: wav.toString("base64"),
        sampleRate: SAMPLE_RATE,
        bitDepth: 24,
        durationSec: buf.length / SAMPLE_RATE,
        sizeBytes: wav.length,
      });
      mixChannels.push({ buffer: buf, gainDb: -2, pan: 0, hpCutHz: 35, lpCutHz: 250 });
    }

    // ── Pad ──────────────────────────────────────────────────────────────
    if (requestedStems.includes("pad")) {
      const notes = preset.chordRoot.map((pitch) => ({
        pitch,
        startBeat: 0,
        durationBeats: bars * 4 - 0.5,
        velocity: 80,
      }));
      const buf = renderPad(notes, bpm, bars, preset.padParams);
      const wav = encodeWavMono(buf, { bitDepth: 24 });
      stemResults.push({
        name: `pad-${variant}`,
        wav_b64: wav.toString("base64"),
        sampleRate: SAMPLE_RATE,
        bitDepth: 24,
        durationSec: buf.length / SAMPLE_RATE,
        sizeBytes: wav.length,
      });
      mixChannels.push({ buffer: buf, gainDb: -5, pan: 0 });
    }

    // ── Stab ─────────────────────────────────────────────────────────────
    if (requestedStems.includes("stab")) {
      const beatsPerBar = 4;
      const stabNotes = [];
      for (let bar = 0; bar < bars; bar++) {
        // Stabs on beat 2 and 4 of every other bar
        if (bar % 2 === 0) {
          stabNotes.push({ pitch: preset.chordRoot[0], startBeat: bar * beatsPerBar + 1, durationBeats: 0.25, velocity: 95 });
          stabNotes.push({ pitch: preset.chordRoot[2], startBeat: bar * beatsPerBar + 3, durationBeats: 0.25, velocity: 85 });
        }
      }
      const buf = renderStab(stabNotes, bpm, bars, preset.stabParams);
      const wav = encodeWavMono(buf, { bitDepth: 24 });
      stemResults.push({
        name: `stab-${variant}`,
        wav_b64: wav.toString("base64"),
        sampleRate: SAMPLE_RATE,
        bitDepth: 24,
        durationSec: buf.length / SAMPLE_RATE,
        sizeBytes: wav.length,
      });
      mixChannels.push({ buffer: buf, gainDb: -4, pan: -0.2 });
    }

    // ── Arp ───────────────────────────────────────────────────────────────
    if (requestedStems.includes("arp")) {
      const buf = renderArp([...preset.chordRoot], bpm, bars, preset.arpParams);
      const wav = encodeWavMono(buf, { bitDepth: 24 });
      stemResults.push({
        name: `arp-${variant}`,
        wav_b64: wav.toString("base64"),
        sampleRate: SAMPLE_RATE,
        bitDepth: 24,
        durationSec: buf.length / SAMPLE_RATE,
        sizeBytes: wav.length,
      });
      mixChannels.push({ buffer: buf, gainDb: -5, pan: 0.3 });
    }

    // ── Noise texture ────────────────────────────────────────────────────
    if (requestedStems.includes("noise")) {
      const buf = renderNoiseTexture(bpm, bars, {
        hpHz: variant === "night" ? 1500 : 2500,
        lpHz: variant === "night" ? 6000 : 10000,
        gain: 0.2,
      });
      const wav = encodeWavMono(buf, { bitDepth: 24 });
      stemResults.push({
        name: `noise-${variant}`,
        wav_b64: wav.toString("base64"),
        sampleRate: SAMPLE_RATE,
        bitDepth: 24,
        durationSec: buf.length / SAMPLE_RATE,
        sizeBytes: wav.length,
      });
      mixChannels.push({ buffer: buf, gainDb: -8, pan: 0 });
    }

    // ── Mix master ────────────────────────────────────────────────────────
    let mixResult: {
      wav_b64: string;
      lufs: number;
      truePeak: number;
      dynamicRange: number;
      durationSec: number;
      sizeBytes: number;
    } | undefined;

    if (includeMix && mixChannels.length > 0) {
      const master = masterMix(mixChannels, {
        ...preset.masterParams,
        targetLufs: -14,
        ceilingDbTP: -0.3,
        bitDepth: 24,
      });
      mixResult = {
        wav_b64: master.wavBuffer.toString("base64"),
        lufs: master.lufs.integratedLufs,
        truePeak: master.lufs.truePeakDbTP,
        dynamicRange: master.lufs.dynamicRangeDb,
        durationSec: master.durationSec,
        sizeBytes: master.wavBuffer.length,
      };
    }

    const renderTimeMs = Date.now() - start;

    return NextResponse.json({
      stems: stemResults,
      mix: mixResult,
      meta: {
        bpm,
        key: preset.key,
        bars,
        variant,
        description: preset.description,
        renderTimeMs,
        stemCount: stemResults.length,
        totalSizeBytes: stemResults.reduce((s, r) => s + r.sizeBytes, 0) + (mixResult?.sizeBytes ?? 0),
      },
    });
  } catch (err) {
    console.error("[generate-stems]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
