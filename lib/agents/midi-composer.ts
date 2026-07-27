/**
 * MidiComposer Agent
 *
 * Converts a DARKSCO music structure (from ReasoningArchitect or preset) into
 * individual MIDI files — one per stem type. Each file is a self-contained
 * Format 0 MIDI, ready to import into Ableton Live, Logic, or any DAW.
 *
 * Stem → MIDI channel mapping (GM-compatible):
 *   kick    → Ch 9 (GM drums), note 36 (Bass Drum 1)
 *   snare   → Ch 9, note 38 (Acoustic Snare) + 39 (Hand Clap)
 *   hihat   → Ch 9, note 42 (Closed HH) + 46 (Open HH)
 *   perc    → Ch 9, note 39 (auxiliary perc)
 *   bass    → Ch 0, pitched root + fifth pattern from chord progression
 *   pad     → Ch 1, full chord voicings sustained per bar
 *   stab    → Ch 2, chord tones at off-beat positions
 *   arp     → Ch 3, ascending/descending chord tones at 16th-note rate
 */

import {
  encodeMidiFile,
  beatsToTicks,
  sixteenthToTicks,
  TICKS_PER_BEAT,
  type MidiNote,
} from "@/lib/synth/midi-encoder";

export type { MidiNote };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MusicStructure {
  drum_pattern: {
    kick: number[];
    snare: number[];
    hihat: number[];
    open_hihat: number[];
    perc: number[];
  };
  chords: Array<{
    bar: number;
    root: string;
    quality: string;
    inversion: number;
  }>;
  sections: Array<{
    name: string;
    duration_bars: number;
    dynamics: string;
  }>;
}

export interface MidiStemFile {
  stem:           string;
  filename:       string;
  midi_b64:       string;  // stripped to "" after upload to Supabase
  midi_url:       string;  // signed Supabase Storage URL
  midi_path:      string;  // storage path for re-signing
  notes_count:    number;
  duration_beats: number;
  channel:        number;
  track_type:     "drums" | "melodic";
  description:    string;
}

export interface MidiComposerInput {
  structure: MusicStructure;
  bpm: number;
  bars: number;
  variant: string;
  key: string;
}

// ─── Note name → MIDI pitch ───────────────────────────────────────────────────

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteNameToMidi(root: string, octave: number): number {
  const idx = NOTE_NAMES.findIndex(
    (n) => n.toLowerCase() === root.toLowerCase().replace("b", "#").replace("eb", "D#").replace("ab", "G#").replace("bb", "A#").replace("db", "C#").replace("gb", "F#")
  );
  const semitone = idx >= 0 ? idx : NOTE_NAMES.indexOf(root) >= 0 ? NOTE_NAMES.indexOf(root) : 5; // default F
  return (octave + 1) * 12 + semitone;
}

function chordToNotes(root: string, quality: string, octave = 2): number[] {
  const CHORD_INTERVALS: Record<string, number[]> = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    dim: [0, 3, 6],
    dim7: [0, 3, 6, 9],
    aug: [0, 4, 8],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],
    m7: [0, 3, 7, 10],
    maj7: [0, 4, 7, 11],
    "7": [0, 4, 7, 10],
  };
  const base = noteNameToMidi(root, octave);
  const intervals = CHORD_INTERVALS[quality] ?? CHORD_INTERVALS["minor"];
  return intervals.map((i) => base + i);
}

function humanizeVel(base: number, spread = 12): number {
  return Math.max(30, Math.min(127, Math.round(base + (Math.random() - 0.5) * spread)));
}

// ─── Per-stem MIDI generators ─────────────────────────────────────────────────

function makeKickMidi(pattern: number[], bpm: number, bars: number): MidiNote[] {
  const notes: MidiNote[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const barOffsetTicks = bar * 4 * TICKS_PER_BEAT;
    for (const pos of pattern) {
      notes.push({
        channel: 9,
        pitch: 36,
        velocity: humanizeVel(110, 8),
        startTick: barOffsetTicks + sixteenthToTicks(pos),
        durationTicks: Math.round(TICKS_PER_BEAT * 0.1),
      });
    }
  }
  return notes;
}

function makeSnareMidi(snare: number[], clap: number[], bpm: number, bars: number): MidiNote[] {
  const notes: MidiNote[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * 4 * TICKS_PER_BEAT;
    for (const pos of snare) {
      notes.push({ channel: 9, pitch: 38, velocity: humanizeVel(100, 10), startTick: offset + sixteenthToTicks(pos), durationTicks: Math.round(TICKS_PER_BEAT * 0.1) });
    }
    for (const pos of clap) {
      notes.push({ channel: 9, pitch: 39, velocity: humanizeVel(90, 8), startTick: offset + sixteenthToTicks(pos) + Math.round(TICKS_PER_BEAT * 0.01), durationTicks: Math.round(TICKS_PER_BEAT * 0.08) });
    }
  }
  return notes;
}

function makeHihatMidi(closed: number[], open: number[], bpm: number, bars: number): MidiNote[] {
  const notes: MidiNote[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * 4 * TICKS_PER_BEAT;
    for (const pos of closed) {
      notes.push({ channel: 9, pitch: 42, velocity: humanizeVel(78, 14), startTick: offset + sixteenthToTicks(pos), durationTicks: Math.round(TICKS_PER_BEAT * 0.07) });
    }
    for (const pos of open) {
      notes.push({ channel: 9, pitch: 46, velocity: humanizeVel(82, 10), startTick: offset + sixteenthToTicks(pos), durationTicks: Math.round(TICKS_PER_BEAT * 0.25) });
    }
  }
  return notes;
}

function makeBassMidi(
  chords: MusicStructure["chords"],
  bpm: number,
  bars: number
): MidiNote[] {
  const notes: MidiNote[] = [];
  const chordMap = new Map<number, { root: string; quality: string }>();
  for (const c of chords) chordMap.set(c.bar, c);

  for (let bar = 0; bar < bars; bar++) {
    const chord = chordMap.get(bar + 1) ?? chordMap.get(1);
    const offset = bar * 4 * TICKS_PER_BEAT;

    const rootNote = chord ? noteNameToMidi(chord.root, 1) : 41; // F1 default
    const fifth = rootNote + 7;

    // Beat 1: root (long)
    notes.push({ channel: 0, pitch: rootNote, velocity: humanizeVel(102, 8), startTick: offset, durationTicks: Math.round(TICKS_PER_BEAT * 0.88) });
    // Beat 2.5: octave variation (even bars)
    if (bar % 2 === 0) {
      notes.push({ channel: 0, pitch: rootNote + 12, velocity: humanizeVel(82, 12), startTick: offset + beatsToTicks(1.5), durationTicks: Math.round(TICKS_PER_BEAT * 0.38) });
    }
    // Beat 3: fifth
    notes.push({ channel: 0, pitch: fifth, velocity: humanizeVel(92, 8), startTick: offset + beatsToTicks(2), durationTicks: Math.round(TICKS_PER_BEAT * 0.72) });
    // Beat 4 sixteenth: chromatic approach
    notes.push({ channel: 0, pitch: rootNote - 1, velocity: humanizeVel(72, 14), startTick: offset + beatsToTicks(3.75), durationTicks: Math.round(TICKS_PER_BEAT * 0.18) });
  }
  return notes;
}

function makePadMidi(
  chords: MusicStructure["chords"],
  bpm: number,
  bars: number
): MidiNote[] {
  const notes: MidiNote[] = [];
  const chordMap = new Map<number, { root: string; quality: string }>();
  for (const c of chords) chordMap.set(c.bar, c);

  for (let bar = 0; bar < bars; bar++) {
    const chord = chordMap.get(bar + 1) ?? chordMap.get(1);
    const offset = bar * 4 * TICKS_PER_BEAT;
    if (!chord) continue;

    const chordNotes = chordToNotes(chord.root, chord.quality, 3);
    for (let i = 0; i < chordNotes.length; i++) {
      notes.push({
        channel: 1,
        pitch: chordNotes[i],
        velocity: humanizeVel(62 + i * 4, 8),
        startTick: offset,
        durationTicks: Math.round(TICKS_PER_BEAT * 3.75), // almost full bar
      });
    }
  }
  return notes;
}

function makeStabMidi(
  chords: MusicStructure["chords"],
  sections: MusicStructure["sections"],
  bpm: number,
  bars: number
): MidiNote[] {
  const notes: MidiNote[] = [];
  const chordMap = new Map<number, { root: string; quality: string }>();
  for (const c of chords) chordMap.set(c.bar, c);

  for (let bar = 0; bar < bars; bar++) {
    const chord = chordMap.get(bar + 1) ?? chordMap.get(1);
    const offset = bar * 4 * TICKS_PER_BEAT;
    if (!chord) continue;

    const chordNotes = chordToNotes(chord.root, chord.quality, 3);
    if (chordNotes.length === 0) continue;

    // Stabs on off-beats every other bar
    if (bar % 2 === 0) {
      notes.push({ channel: 2, pitch: chordNotes[0], velocity: humanizeVel(96, 10), startTick: offset + beatsToTicks(1), durationTicks: Math.round(TICKS_PER_BEAT * 0.22) });
    }
    notes.push({ channel: 2, pitch: chordNotes[chordNotes.length > 2 ? 2 : 0], velocity: humanizeVel(88, 12), startTick: offset + beatsToTicks(3), durationTicks: Math.round(TICKS_PER_BEAT * 0.22) });
  }
  return notes;
}

function makeArpMidi(
  chords: MusicStructure["chords"],
  bpm: number,
  bars: number,
  direction: "up" | "down" | "updown" = "up"
): MidiNote[] {
  const notes: MidiNote[] = [];
  const chordMap = new Map<number, { root: string; quality: string }>();
  for (const c of chords) chordMap.set(c.bar, c);

  for (let bar = 0; bar < bars; bar++) {
    const chord = chordMap.get(bar + 1) ?? chordMap.get(1);
    const offset = bar * 4 * TICKS_PER_BEAT;
    if (!chord) continue;

    const baseNotes = chordToNotes(chord.root, chord.quality, 3);
    // Add octave above for arp range
    const extended = [...baseNotes, ...baseNotes.map((n) => n + 12)];
    const sequence =
      direction === "down"
        ? [...extended].reverse()
        : direction === "updown"
        ? [...extended, ...[...extended].reverse().slice(1)]
        : extended;

    const stepTicks = Math.round(TICKS_PER_BEAT / 4); // 16th notes
    const totalSteps = 16; // one bar of 16th notes

    for (let step = 0; step < totalSteps; step++) {
      const note = sequence[step % sequence.length];
      notes.push({
        channel: 3,
        pitch: note,
        velocity: humanizeVel(72, 16),
        startTick: offset + step * stepTicks,
        durationTicks: Math.round(stepTicks * 0.8),
      });
    }
  }
  return notes;
}

// ─── Legacy compat types (used by music-production page + midi-preview) ──────

export interface AbletonInstructions {
  project_name: string;
  tempo: number;
  time_signature: string;
  routing_notes: string;
  clip_notes: string[];
  export_settings: {
    sample_rate: number;
    bit_depth: number;
    format: string;
    normalize: boolean;
  };
}

/** Legacy shim for generate-midi/route.ts */
export async function executeMidiComposerAgent(input: {
  production_id: string;
  structure: MusicStructure;
  bpm: number;
  key: string;
  total_bars: number;
}): Promise<{
  tracks: Array<{ production_id: string; track_type: string; track_number: number; channel: number; notes: MidiNote[] }>;
  metadata: { tempo: number; total_bars: number; total_beats: number; quantization: string; time_signature: string; tracks: Array<{ name: string; channel: number; notes_count: number }>; generation_method: string };
  ableton_instructions: AbletonInstructions;
  error?: string;
}> {
  const stems = composeMidiPerStem({
    structure: input.structure,
    bpm: input.bpm,
    bars: input.total_bars,
    variant: "production",
    key: input.key,
  });

  const tracks = stems.map((s, i) => ({
    production_id: input.production_id,
    track_type: s.stem,
    track_number: i + 1,
    channel: s.channel,
    notes: [] as MidiNote[], // MIDI data is base64 encoded in midi_b64
  }));

  const metadata = {
    tempo: input.bpm,
    total_bars: input.total_bars,
    total_beats: input.total_bars * 4,
    quantization: "16th",
    time_signature: "4/4",
    tracks: stems.map((s) => ({ name: s.stem, channel: s.channel, notes_count: s.notes_count })),
    generation_method: "DARKSCO MidiComposer — pure TypeScript MIDI synthesis, 16th-note grid",
  };

  const ableton_instructions: AbletonInstructions = {
    project_name: `DARKSCO_${input.key}_${input.bpm}bpm_${Date.now()}`,
    tempo: input.bpm,
    time_signature: "4/4",
    routing_notes: "Import each MIDI file to its corresponding Ableton track. Match track names to stem audio files from the samplepack.",
    clip_notes: stems.map((s) => `${s.stem}.mid → ${s.description}`),
    export_settings: { sample_rate: 48000, bit_depth: 24, format: "wav", normalize: false },
  };

  return { tracks, metadata, ableton_instructions };
}

// ─── Main composer ───────────────────────────────────────────────────────────

export function composeMidiPerStem(input: MidiComposerInput): MidiStemFile[] {
  const { structure, bpm, bars, variant, key } = input;
  const dp = structure.drum_pattern;
  const results: MidiStemFile[] = [];

  // Helper to package a midi file
  const packMidi = (
    stem: string,
    notes: MidiNote[],
    channel: number,
    trackType: "drums" | "melodic",
    description: string
  ): MidiStemFile => {
    const buf = encodeMidiFile(notes, {
      bpm,
      trackName: `${stem}-${variant}`,
    });
    const totalBeats = bars * 4;
    return {
      stem,
      filename:       `${stem}-${variant}.mid`,
      midi_b64:       buf.toString("base64"),
      midi_url:       "",
      midi_path:      "",
      notes_count:    notes.length,
      duration_beats: totalBeats,
      channel,
      track_type:     trackType,
      description,
    };
  };

  // Kick
  const kickNotes = makeKickMidi(dp.kick, bpm, bars);
  results.push(packMidi("kick", kickNotes, 9, "drums", `4-on-the-floor kick at positions [${dp.kick.join(",")}] — GM note 36`));

  // Snare (includes clap layer)
  const clapPattern = dp.perc.length > 0 ? dp.perc.slice(0, 2) : [];
  const snareNotes = makeSnareMidi(dp.snare, clapPattern, bpm, bars);
  results.push(packMidi("snare", snareNotes, 9, "drums", `Snare at [${dp.snare.join(",")}] + clap layer — GM notes 38/39`));

  // Hi-hat (closed + open)
  const hihatNotes = makeHihatMidi(dp.hihat, dp.open_hihat, bpm, bars);
  results.push(packMidi("hihat", hihatNotes, 9, "drums", `Closed HH [${dp.hihat.join(",")}], Open HH [${dp.open_hihat.join(",")}] — GM notes 42/46`));

  // Bass
  const bassNotes = makeBassMidi(structure.chords, bpm, bars);
  results.push(packMidi("bass", bassNotes, 0, "melodic", `Root-fifth bass line following chord progression — Ch 0, octave 1`));

  // Pad
  const padNotes = makePadMidi(structure.chords, bpm, bars);
  results.push(packMidi("pad", padNotes, 1, "melodic", `Full chord voicings sustained per bar — Ch 1, octave 3`));

  // Stab
  const stabNotes = makeStabMidi(structure.chords, structure.sections, bpm, bars);
  results.push(packMidi("stab", stabNotes, 2, "melodic", `Off-beat chord stabs every other bar — Ch 2, 16th-note duration`));

  // Arp — detect direction from variant
  const arpDirection: "up" | "down" | "updown" =
    variant === "night" ? "down" : variant === "morning" ? "updown" : "up";
  const arpNotes = makeArpMidi(structure.chords, bpm, bars, arpDirection);
  results.push(packMidi("arp", arpNotes, 3, "melodic", `${arpDirection.toUpperCase()} arpeggio at 16th-note rate — Ch 3, octave 3+4`));

  return results;
}
