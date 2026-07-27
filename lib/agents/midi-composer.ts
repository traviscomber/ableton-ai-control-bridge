/**
 * MidiComposer Agent
 *
 * Converts an OpenAI reasoning structure into precise, playable MIDI data.
 * Generates note events (pitch, velocity, timing) for every track in the
 * MIDI plan, applying humanization, swing, and groove.
 *
 * Output is used by ArrangementMaster to map stems and by the export pipeline
 * to generate the .mid project file.
 */

import type {
  OpenAIStructure,
  MidiTrack,
  MidiMetadata,
} from "@/lib/music-schema";

export interface MidiComposerInput {
  production_id: string;
  structure: OpenAIStructure;
  bpm: number;
  key: string;
  total_bars: number;
}

export interface MidiComposerResponse {
  tracks: Omit<MidiTrack, "id" | "created_at">[];
  metadata: MidiMetadata;
  ableton_instructions: AbletonInstructions;
  error?: string;
}

export interface AbletonInstructions {
  project_name: string;
  tempo: number;
  time_signature: string;
  tracks: AbletonTrack[];
  color_coding: Record<string, string>;
  routing_notes: string;
  clip_notes: string[];
  export_settings: {
    sample_rate: number;
    bit_depth: number;
    format: string;
    normalize: boolean;
    render_type: string;
  };
}

export interface AbletonTrack {
  name: string;
  type: "midi" | "audio";
  instrument: string;
  color: string;
  clips: AbletonClip[];
  routing: string;
  fx_chain: string[];
}

export interface AbletonClip {
  name: string;
  start_bar: number;
  length_bars: number;
  loop: boolean;
  notes_count: number;
  color: string;
}

// ─── MIDI Note Helpers ────────────────────────────────────────────────

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteNameToMidi(note: string): number {
  // e.g. "C1" → 24, "F2" → 41
  const match = note.match(/^([A-G]#?)(\d+)$/);
  if (!match) return 36; // Default C2
  const [, name, octave] = match;
  const semitone = NOTE_NAMES.indexOf(name);
  return (parseInt(octave) + 1) * 12 + semitone;
}

function keyRootMidi(key: string): number {
  // "F minor" → root note F
  const root = key.split(" ")[0];
  return NOTE_NAMES.indexOf(root) + 36; // Octave 2 base
}

function getScaleNotes(key: string): number[] {
  const rootMidi = keyRootMidi(key);
  const isMinor = key.toLowerCase().includes("minor");
  // Minor scale intervals: W H W W H W W
  const intervals = isMinor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  return intervals.map(i => rootMidi + i);
}

function chordToMidiNotes(root: string, quality: string, octave = 2): number[] {
  const rootIndex = NOTE_NAMES.indexOf(root);
  if (rootIndex === -1) return [36, 39, 43];
  const base = rootIndex + (octave + 1) * 12;
  const intervals: Record<string, number[]> = {
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
    m9: [0, 3, 7, 10, 14],
  };
  const pattern = intervals[quality] ?? intervals["minor"];
  return pattern.map(i => base + i);
}

function humanize(velocity: number, amount: number): number {
  const jitter = (Math.random() - 0.5) * 2 * amount * 127;
  return Math.max(30, Math.min(127, Math.round(velocity + jitter)));
}

function swingOffset(sixteenth: number, swingAmount: number): number {
  // Apply swing offset to odd 16th notes
  return sixteenth % 2 === 1 ? swingAmount : 0;
}

// ─── Track Generators ─────────────────────────────────────────────────

function generateDrumTrack(
  production_id: string,
  trackType: "kick" | "snare" | "hihat" | "perc",
  pattern: number[],
  total_bars: number,
  velocityBase: number,
  humanizationAmt: number,
  swing: number,
  channel: number,
  trackNumber: number
): Omit<MidiTrack, "id" | "created_at"> {
  const notes: MidiTrack["notes"] = [];

  // MIDI drum note assignments (GM standard)
  const drumNotes: Record<string, number> = {
    kick: 36,    // Bass Drum 1
    snare: 38,   // Acoustic Snare
    hihat: 42,   // Closed Hi-Hat
    open_hihat: 46, // Open Hi-Hat
    perc: 39,    // Hand Clap / auxiliary
  };

  const pitch = drumNotes[trackType] ?? 36;

  for (let bar = 0; bar < total_bars; bar++) {
    for (const sixteenth of pattern) {
      const startBeat = bar * 4 + (sixteenth / 4) + swingOffset(sixteenth, swing);
      notes.push({
        pitch,
        velocity: humanize(velocityBase, humanizationAmt),
        start_beat: startBeat,
        duration_beats: 0.1, // Short drum hit
      });
    }
  }

  return {
    production_id,
    track_type: trackType,
    track_number: trackNumber,
    channel,
    notes,
    quantization: "16th",
    velocity_humanization: humanizationAmt,
    swing_amount: swing,
  };
}

function generateBassTrack(
  production_id: string,
  structure: OpenAIStructure,
  total_bars: number,
  key: string,
): Omit<MidiTrack, "id" | "created_at"> {
  const notes: MidiTrack["notes"] = [];
  const scaleNotes = getScaleNotes(key);
  const rootMidi = keyRootMidi(key);

  // Build bar → chord map from structure
  const chordMap: Record<number, { root: string; quality: string }> = {};
  for (const chord of structure.chords) {
    chordMap[chord.bar] = { root: chord.root, quality: chord.quality };
  }

  for (let bar = 0; bar < total_bars; bar++) {
    const chord = chordMap[bar + 1]; // bars are 1-indexed in structure

    // Simple bass pattern: root on beat 1, fifth on beat 3, approach on beat 4
    const rootPitch = chord
      ? noteNameToMidi(`${chord.root}1`)
      : rootMidi - 24; // octave down

    const fifthPitch = rootPitch + 7;

    // Beat 1: root
    notes.push({ pitch: rootPitch, velocity: humanize(100, 0.1), start_beat: bar * 4, duration_beats: 0.9 });
    // Beat 2.5: octave variation
    if (bar % 2 === 0) {
      notes.push({ pitch: rootPitch + 12, velocity: humanize(80, 0.15), start_beat: bar * 4 + 1.5, duration_beats: 0.4 });
    }
    // Beat 3: fifth
    notes.push({ pitch: fifthPitch, velocity: humanize(90, 0.1), start_beat: bar * 4 + 2, duration_beats: 0.75 });
    // Beat 4: chromatic approach (±1 semitone toward next root)
    const approachPitch = rootPitch - 1;
    notes.push({ pitch: approachPitch, velocity: humanize(75, 0.2), start_beat: bar * 4 + 3.75, duration_beats: 0.2 });
  }

  return {
    production_id,
    track_type: "bass",
    track_number: 5,
    channel: 2,
    notes,
    quantization: "8th",
    velocity_humanization: 0.12,
    swing_amount: 0,
  };
}

function generatePadTrack(
  production_id: string,
  structure: OpenAIStructure,
  total_bars: number,
): Omit<MidiTrack, "id" | "created_at"> {
  const notes: MidiTrack["notes"] = [];

  const chordMap: Record<number, { root: string; quality: string; inversion: number }> = {};
  for (const chord of structure.chords) {
    chordMap[chord.bar] = chord;
  }

  for (let bar = 0; bar < total_bars; bar++) {
    const chord = chordMap[bar + 1] ?? chordMap[1];
    if (!chord) continue;

    const chordNotes = chordToMidiNotes(chord.root, chord.quality, 3);

    // Long sustained pad chord — one hit per bar
    chordNotes.forEach((pitch, i) => {
      notes.push({
        pitch,
        velocity: humanize(65 + i * 3, 0.08),
        start_beat: bar * 4,
        duration_beats: 3.8, // Almost full bar, slight gap
      });
    });
  }

  return {
    production_id,
    track_type: "pad",
    track_number: 6,
    channel: 3,
    notes,
    quantization: "bar",
    velocity_humanization: 0.08,
    swing_amount: 0,
  };
}

function generateSynthStabTrack(
  production_id: string,
  structure: OpenAIStructure,
  total_bars: number,
  key: string,
): Omit<MidiTrack, "id" | "created_at"> {
  const notes: MidiTrack["notes"] = [];
  const scaleNotes = getScaleNotes(key);

  // Stabs on off-beats in active sections
  const activeSections = structure.sections.filter(s => s.dynamics !== "minimal");
  let activeBars = new Set<number>();
  let currentBar = 0;
  for (const section of structure.sections) {
    if (section.dynamics !== "minimal") {
      for (let b = 0; b < section.duration_bars; b++) {
        activeBars.add(currentBar + b);
      }
    }
    currentBar += section.duration_bars;
  }

  for (let bar = 0; bar < total_bars; bar++) {
    if (!activeBars.has(bar)) continue;
    // Syncopated stabs: beats 2 and 4
    const stab1Pitch = scaleNotes[2] + 12; // Third of scale, upper octave
    const stab2Pitch = scaleNotes[4] + 12; // Fifth of scale

    notes.push({ pitch: stab1Pitch, velocity: humanize(95, 0.15), start_beat: bar * 4 + 1.5, duration_beats: 0.2 });
    if (bar % 2 === 0) {
      notes.push({ pitch: stab2Pitch, velocity: humanize(88, 0.15), start_beat: bar * 4 + 3, duration_beats: 0.2 });
    }
  }

  return {
    production_id,
    track_type: "synth",
    track_number: 7,
    channel: 4,
    notes,
    quantization: "16th",
    velocity_humanization: 0.15,
    swing_amount: 0.03,
  };
}

function generateArpTrack(
  production_id: string,
  structure: OpenAIStructure,
  total_bars: number,
  key: string,
): Omit<MidiTrack, "id" | "created_at"> {
  const notes: MidiTrack["notes"] = [];
  const scaleNotes = getScaleNotes(key);

  // Arpeggio pattern — 16th note ascending triplet through scale
  const arpPattern = [0, 2, 4, 2]; // Scale degree indices
  let currentBar = 0;
  for (const section of structure.sections) {
    if (section.dynamics === "intense") {
      for (let bar = 0; bar < section.duration_bars; bar++) {
        const actualBar = currentBar + bar;
        arpPattern.forEach((degree, sixteenth) => {
          const pitch = scaleNotes[degree % scaleNotes.length] + 12;
          notes.push({
            pitch,
            velocity: humanize(80, 0.12),
            start_beat: actualBar * 4 + sixteenth,
            duration_beats: 0.9,
          });
        });
      }
    }
    currentBar += section.duration_bars;
  }

  return {
    production_id,
    track_type: "arp",
    track_number: 8,
    channel: 5,
    notes,
    quantization: "16th",
    velocity_humanization: 0.12,
    swing_amount: 0,
  };
}

// ─── Ableton Instructions Builder ────────────────────────────────────

function buildAbletonInstructions(
  structure: OpenAIStructure,
  bpm: number,
  total_bars: number,
  tracks: Omit<MidiTrack, "id" | "created_at">[]
): AbletonInstructions {
  const colorPalette: Record<string, string> = {
    kick: "#FF4444",
    snare: "#FF8844",
    hihat: "#FFCC44",
    bass: "#44FF88",
    pad: "#4488FF",
    synth: "#CC44FF",
    arp: "#FF44CC",
    fx: "#44FFFF",
    vocal: "#FFFFFF",
    perc: "#FF6644",
  };

  const abletonTracks: AbletonTrack[] = tracks.map(t => {
    let currentBar = 1;
    const clips: AbletonClip[] = structure.sections.map(section => {
      const clip: AbletonClip = {
        name: `${t.track_type.toUpperCase()} – ${section.name.charAt(0).toUpperCase() + section.name.slice(1)}`,
        start_bar: currentBar,
        length_bars: section.duration_bars,
        loop: section.name !== "outro" && section.name !== "intro",
        notes_count: t.notes.filter(n =>
          n.start_beat >= (currentBar - 1) * 4 &&
          n.start_beat < (currentBar - 1 + section.duration_bars) * 4
        ).length,
        color: colorPalette[t.track_type] ?? "#888888",
      };
      currentBar += section.duration_bars;
      return clip;
    });

    return {
      name: `${t.track_type.charAt(0).toUpperCase() + t.track_type.slice(1)} [Ch${t.channel}]`,
      type: "midi",
      instrument: t.track_type,
      color: colorPalette[t.track_type] ?? "#888888",
      clips,
      routing: t.track_type === "kick" || t.track_type === "snare" || t.track_type === "hihat"
        ? "→ Drum Bus → Master"
        : `→ ${t.track_type.charAt(0).toUpperCase() + t.track_type.slice(1)} Bus → Master`,
      fx_chain: t.track_type === "kick" ? ["Transient Shaper", "EQ Eight", "Compressor"]
        : t.track_type === "bass" ? ["Operator", "Auto Filter", "Saturator", "Compressor"]
        : t.track_type === "pad" ? ["Wavetable", "Reverb", "Auto Filter", "Utility"]
        : ["Simpler", "EQ Eight", "Reverb"],
    };
  });

  return {
    project_name: `DARKSCO_Production_${Date.now()}`,
    tempo: bpm,
    time_signature: "4/4",
    tracks: abletonTracks,
    color_coding: colorPalette,
    routing_notes: "Drum tracks → Drum Rack → Drum Bus (parallel compression). Bass → Bass Bus (sidechain from kick). Pads/Synths → Synth Bus (reverb send). All → Master (limiter).",
    clip_notes: [
      "Each section has its own clip — use Scene Launch for arrangement",
      "Loop all clips except Intro and Outro for easier arrangement",
      "Use Follow Actions on sections for live performance",
      "Automate Filter Cutoff on pad during build sections (bars increase)",
      "Use Clip Envelopes on velocity for dynamic variation",
    ],
    export_settings: {
      sample_rate: 48000,
      bit_depth: 24,
      format: "wav",
      normalize: false,
      render_type: "master-output",
    },
  };
}

// ─── Main Agent ───────────────────────────────────────────────────────

export async function executeMidiComposerAgent(
  input: MidiComposerInput
): Promise<MidiComposerResponse> {
  const { production_id, structure, bpm, key, total_bars } = input;

  try {
    const tracks: Omit<MidiTrack, "id" | "created_at">[] = [];

    // 1. Drum tracks from OpenAI drum pattern
    const dp = structure.drum_pattern;
    tracks.push(generateDrumTrack(production_id, "kick", dp.kick, total_bars, 110, 0.08, 0, 10, 1));
    tracks.push(generateDrumTrack(production_id, "snare", dp.snare, total_bars, 95, 0.1, 0, 10, 2));
    tracks.push(generateDrumTrack(production_id, "hihat", dp.hihat, total_bars, 75, 0.18, 0.04, 10, 3));
    if (dp.perc?.length) {
      tracks.push(generateDrumTrack(production_id, "perc", dp.perc, total_bars, 70, 0.2, 0, 10, 4));
    }

    // 2. Bass track from chord progression
    tracks.push(generateBassTrack(production_id, structure, total_bars, key));

    // 3. Pad track (long sustained chords)
    tracks.push(generatePadTrack(production_id, structure, total_bars));

    // 4. Synth stabs (off-beat, active sections only)
    tracks.push(generateSynthStabTrack(production_id, structure, total_bars, key));

    // 5. Arpeggio (intense sections only)
    const arpNotes = generateArpTrack(production_id, structure, total_bars, key);
    if (arpNotes.notes.length > 0) tracks.push(arpNotes);

    const totalBeats = total_bars * 4;
    const metadata: MidiMetadata = {
      tempo: bpm,
      time_signature: "4/4",
      total_bars,
      total_beats: totalBeats,
      quantization: "16th",
      tracks: tracks.map((t, i) => ({
        name: `${t.track_type} [Ch${t.channel}]`,
        track_number: t.track_number,
        notes_count: t.notes.length,
        duration_beats: totalBeats,
        channel: t.channel,
      })),
      generation_method: "OpenAI o1 structure → MidiComposer agent",
    };

    const abletonInstructions = buildAbletonInstructions(structure, bpm, total_bars, tracks);

    return { tracks, metadata, ableton_instructions: abletonInstructions };
  } catch (err) {
    return {
      tracks: [],
      metadata: {
        tempo: bpm,
        time_signature: "4/4",
        total_bars,
        total_beats: total_bars * 4,
        quantization: "16th",
        tracks: [],
        generation_method: "error-fallback",
      },
      ableton_instructions: {
        project_name: `DARKSCO_ERROR_${Date.now()}`,
        tempo: bpm,
        time_signature: "4/4",
        tracks: [],
        color_coding: {},
        routing_notes: "Error occurred — check logs",
        clip_notes: [],
        export_settings: { sample_rate: 48000, bit_depth: 24, format: "wav", normalize: false, render_type: "master-output" },
      },
      error: `MidiComposer failed: ${String(err)}`,
    };
  }
}
