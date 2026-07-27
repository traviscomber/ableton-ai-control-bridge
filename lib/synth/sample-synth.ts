/**
 * Sample Synthesizer — One-shot samples for the DARKSCO Samplepack
 *
 * Renders individual one-shot WAV files (not loops) for every instrument
 * across their full playable range, at multiple velocity layers.
 *
 * Output structure per stem:
 *   drums:    3 velocity layers × 1 note = 3 hits   (kick C1, snare D1, hihat F#1)
 *   melodic:  1 velocity × N notes (every minor/major 3rd across range)
 *
 * Each SampleHit includes:
 *   - wav_b64:    Base64-encoded 48kHz/24-bit mono WAV
 *   - midi_b64:   Base64-encoded single-note MIDI file (.mid)
 *   - midi_note:  GM MIDI note number (0–127)
 *   - note_name:  Human-readable e.g. "C3", "F#2"
 *   - velocity:   1–127
 *   - duration_ms: sample duration in ms
 */

import { synthesiseKick, synthesiseSnare, synthesiseHihat, type KickParams, type SnareParams, type HihatParams } from "./drum-synth";
import { renderBass, renderPad, renderStab, midiToHz, type BassParams, type NoteEvent } from "./melodic-synth";
import { encodeWavMono, SAMPLE_RATE, normalisePeak } from "./wav-engine";
import { encodeMidiFile, beatsToTicks, TICKS_PER_BEAT, type MidiNote } from "./midi-encoder";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SampleHit {
  /** stem type this belongs to */
  stem:        string;
  /** e.g. "kick_hard", "bass_C2", "pad_F3" */
  name:        string;
  /** e.g. "C2", "F#3", "kick" */
  note_name:   string;
  /** GM MIDI note number */
  midi_note:   number;
  /** velocity layer 1–127 */
  velocity:    number;
  /** velocity label */
  velocity_label: "soft" | "medium" | "hard";
  /** Base64 48kHz/24-bit mono WAV */
  wav_b64:     string;
  /** Base64 single-note Format-0 MIDI */
  midi_b64:    string;
  /** sample duration ms */
  duration_ms: number;
  /** WAV size in bytes */
  size_bytes:  number;
}

export interface StemSampleGroup {
  stem:        string;
  category:    "drum" | "melodic";
  /** GM root note for this stem (drum) or root of range (melodic) */
  root_note:   number;
  samples:     SampleHit[];
}

// ─── MIDI note name helpers ───────────────────────────────────────────────────

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function midiToName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return NOTE_NAMES[midi % 12] + octave;
}

// ─── Single-note MIDI builder ─────────────────────────────────────────────────

function makeSingleNoteMidi(
  midiNote: number,
  channel: number,
  velocity: number,
  bpm: number,
  durationBeats = 1.0,
): Buffer {
  const notes: MidiNote[] = [{
    channel,
    pitch:         Math.max(0, Math.min(127, midiNote)),
    velocity:      Math.max(1,  Math.min(127, velocity)),
    startTick:     0,
    durationTicks: beatsToTicks(durationBeats),
  }];
  return encodeMidiFile(notes, { bpm, trackName: `${midiToName(midiNote)} v${velocity}` });
}

// ─── Velocity layers ─────────────────────────────────────────────────────────

const VELOCITY_LAYERS: Array<{ label: "soft" | "medium" | "hard"; value: number }> = [
  { label: "soft",   value: 50  },
  { label: "medium", value: 90  },
  { label: "hard",   value: 120 },
];

// ─── GM drum note mapping ─────────────────────────────────────────────────────

const DRUM_GM: Record<string, { note: number; name: string }> = {
  kick:  { note: 36, name: "C1"  },   // Bass Drum 1
  snare: { note: 38, name: "D1"  },   // Acoustic Snare
  hihat: { note: 42, name: "F#1" },   // Closed Hi-Hat
  openHihat: { note: 46, name: "A#1" }, // Open Hi-Hat
  clap:  { note: 39, name: "D#1" },   // Hand Clap
  perc:  { note: 37, name: "C#1" },   // Side Stick
};

// ─── Melodic note ranges per stem ────────────────────────────────────────────

// One sample per octave-zone (Ableton Simpler maps these across keys).
// Minimal set — enough for full-range playability with Simpler's stretch.
const BASS_NOTES  = [29, 36, 41, 48, 53, 60]; // E1, C2, F2, C3, F3, C4
const PAD_NOTES   = [48, 55, 60, 67, 72];      // C3, G3, C4, G4, C5
const STAB_NOTES  = [48, 55, 60, 67, 72];      // C3, G3, C4, G4, C5
const ARP_NOTES   = [48, 55, 60, 67, 72];      // C3, G3, C4, G4, C5

// ─── Sample renderer: drums ───────────────────────────────────────────────────

function renderDrumSamples(
  stem: string,
  renderFn: (vel: number) => Float64Array,
  bpm: number,
): StemSampleGroup {
  const gm     = DRUM_GM[stem] ?? DRUM_GM.kick;
  const samples: SampleHit[] = [];

  for (const layer of VELOCITY_LAYERS) {
    const velScale = layer.value / 127;
    const buf      = renderFn(velScale);
    normalisePeak(buf, velScale * 0.95 + 0.03);

    const wav    = encodeWavMono(buf, { bitDepth: 24 });
    const mid    = makeSingleNoteMidi(gm.note, 9, layer.value, bpm, 0.5);
    const durMs  = Math.round((buf.length / SAMPLE_RATE) * 1000);

    samples.push({
      stem,
      name:           `${stem}_${layer.label}`,
      note_name:      gm.name,
      midi_note:      gm.note,
      velocity:       layer.value,
      velocity_label: layer.label,
      wav_b64:        wav.toString("base64"),
      midi_b64:       mid.toString("base64"),
      duration_ms:    durMs,
      size_bytes:     wav.length,
    });
  }

  return { stem, category: "drum", root_note: gm.note, samples };
}

// ─── Sample renderer: melodic ─────────────────────────────────────────────────

function renderMelodicSamples(
  stem: string,
  notes: number[],
  channel: number,
  bpm: number,
  renderOne: (midiNote: number) => Float64Array,
): StemSampleGroup {
  const samples: SampleHit[] = [];
  const velocity = 90;

  for (const midiNote of notes) {
    const buf   = renderOne(midiNote);
    normalisePeak(buf, 0.92);

    const wav   = encodeWavMono(buf, { bitDepth: 24 });
    const mid   = makeSingleNoteMidi(midiNote, channel, velocity, bpm, 1.0);
    const durMs = Math.round((buf.length / SAMPLE_RATE) * 1000);

    samples.push({
      stem,
      name:           `${stem}_${midiToName(midiNote)}`,
      note_name:      midiToName(midiNote),
      midi_note:      midiNote,
      velocity,
      velocity_label: "medium",
      wav_b64:        wav.toString("base64"),
      midi_b64:       mid.toString("base64"),
      duration_ms:    durMs,
      size_bytes:     wav.length,
    });
  }

  return { stem, category: "melodic", root_note: notes[0] ?? 48, samples };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export interface SamplePackInput {
  bpm:          number;
  kickParams?:  KickParams;
  snareParams?: SnareParams;
  hihatParams?: HihatParams;
  bassParams?:  BassParams;
  padParams?:   Partial<{ filterHz: number; detuneCents: number; voices: number }>;
  stabParams?:  Partial<{ filterHz: number; filterQ: number; drive: number }>;
  requestedStems?: string[];
}

/**
 * Render the full sample set for one DARKSCO variant.
 * Returns one StemSampleGroup per requested stem.
 * Each group contains all velocity layers (drums) or all pitches (melodic).
 */
export function renderSamplePack(input: SamplePackInput): StemSampleGroup[] {
  const {
    bpm,
    kickParams  = {},
    snareParams = {},
    hihatParams = {},
    bassParams  = {},
    requestedStems = ["kick","snare","hihat","bass","pad","stab","arp"],
  } = input;

  const groups: StemSampleGroup[] = [];

  // ── Drum one-shots ──────────────────────────────────────────────────────────

  if (requestedStems.includes("kick")) {
    groups.push(renderDrumSamples("kick", (velScale) => {
      const buf = synthesiseKick({ ...kickParams, drive: (kickParams.drive ?? 1.8) * velScale * 1.1 + 0.5 });
      return buf;
    }, bpm));
  }

  if (requestedStems.includes("snare")) {
    groups.push(renderDrumSamples("snare", (velScale) => {
      return synthesiseSnare({ ...snareParams, noiseLevel: (snareParams.noiseLevel ?? 0.65) * (0.7 + velScale * 0.3) });
    }, bpm));
  }

  if (requestedStems.includes("hihat")) {
    groups.push(renderDrumSamples("hihat", (_velScale) => {
      return synthesiseHihat({ ...hihatParams, closed: true });
    }, bpm));
  }

  // ── Melodic one-shots ────────────────────────────────────────────────────────

  if (requestedStems.includes("bass")) {
    groups.push(renderMelodicSamples("bass", BASS_NOTES, 1, bpm, (midiNote) => {
      const note: NoteEvent = { pitch: midiNote, startBeat: 0, durationBeats: 0.75, velocity: 90 };
      return renderBass([note], bpm, 1, { ...bassParams, release: 0.04 });
    }));
  }

  if (requestedStems.includes("pad")) {
    groups.push(renderMelodicSamples("pad", PAD_NOTES, 2, bpm, (midiNote) => {
      const note: NoteEvent = { pitch: midiNote, startBeat: 0, durationBeats: 1.5, velocity: 80 };
      return renderBass([note], bpm, 1, {
        filterHz:     input.padParams?.filterHz ?? 2200,
        filterQ:      1.0,
        subMix:       0,
        drive:        1.0,
        detuneCents:  input.padParams?.detuneCents ?? 14,
        attack:       0.05,
        decay:        0.3,
        sustain:      0.6,
        release:      0.1,
      });
    }));
  }

  if (requestedStems.includes("stab")) {
    groups.push(renderMelodicSamples("stab", STAB_NOTES, 3, bpm, (midiNote) => {
      const note: NoteEvent = { pitch: midiNote, startBeat: 0, durationBeats: 0.25, velocity: 95 };
      return renderBass([note], bpm, 1, {
        filterHz: input.stabParams?.filterHz ?? 3200,
        filterQ:  input.stabParams?.filterQ  ?? 4.0,
        subMix:   0,
        drive:    input.stabParams?.drive    ?? 2.2,
        attack:   0.001,
        decay:    0.06,
        sustain:  0.0,
        release:  0.03,
      });
    }));
  }

  if (requestedStems.includes("arp")) {
    groups.push(renderMelodicSamples("arp", ARP_NOTES, 4, bpm, (midiNote) => {
      const note: NoteEvent = { pitch: midiNote, startBeat: 0, durationBeats: 0.25, velocity: 85 };
      return renderBass([note], bpm, 1, {
        filterHz: 4000,
        filterQ:  2.0,
        subMix:   0,
        drive:    1.6,
        attack:   0.002,
        decay:    0.05,
        sustain:  0.3,
        release:  0.05,
      });
    }));
  }

  return groups;
}
