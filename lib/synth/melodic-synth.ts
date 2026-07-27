/**
 * Melodic Synthesizer — Pure TypeScript, zero dependencies
 *
 * Synthesises bass, pad, stab, and arp voices entirely from oscillator math.
 * All note-to-frequency conversions use MIDI pitch (A4 = 69 = 440 Hz).
 *
 * Instruments:
 *   - bass()   — detuned sawtooth + ladder-style low-pass filter + sub sine
 *   - pad()    — four detuned saws with slow LFO + reverb shimmer
 *   - stab()   — short square wave burst with hard filter + envelope
 *   - arp()    — arpeggiated notes with adjustable rate and pattern
 *
 * Each instrument accepts a list of notes (MIDI pitch numbers) and timing
 * from the MidiComposer output, renders them to a single mono Float64Array.
 */

import {
  SAMPLE_RATE, TWO_PI,
  makeAdsr,
  makeBiquad, processBiquad, filterBuffer,
  sawWave, squareWave, sineWave, whiteNoise,
  tanhSaturate, hardClip,
  SimpleReverb, DelayLine,
} from "./wav-engine";

// ─── MIDI pitch helpers ────────────────────────────────────────────────────

/** MIDI note number → frequency Hz (A4 = 69 = 440 Hz) */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Note name string → MIDI number. e.g. "F2" → 41 */
export function noteToMidi(note: string): number {
  const m = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!m) return 60;
  const pc = NOTE_NAMES.indexOf(m[1]);
  return (parseInt(m[2]) + 1) * 12 + pc;
}

// ─── Note Event ────────────────────────────────────────────────────────────

export interface NoteEvent {
  /** MIDI note number (0–127) */
  pitch: number;
  /** Start time in beats (beat 0 = start of track) */
  startBeat: number;
  /** Duration in beats */
  durationBeats: number;
  /** Velocity 0–127 */
  velocity: number;
}

// ─── Bass ─────────────────────────────────────────────────────────────────────

export interface BassParams {
  /** Detuning between two saw oscillators (cents). Default 8. */
  detuneCents?: number;
  /** Low-pass filter cutoff (Hz). Default 700. */
  filterHz?: number;
  /** Filter resonance Q. Default 2.5. */
  filterQ?: number;
  /** Amount of sub-octave sine to blend in (0–1). Default 0.35. */
  subMix?: number;
  /** Drive into the filter. Default 1.5. */
  drive?: number;
  /** ADSR */
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
}

export function renderBass(
  notes: NoteEvent[],
  bpm: number,
  totalBars: number,
  p: BassParams = {}
): Float64Array {
  const detune = p.detuneCents ?? 8;
  const filterHz = p.filterHz ?? 700;
  const filterQ  = p.filterQ  ?? 2.5;
  const subMix   = p.subMix   ?? 0.35;
  const drive    = p.drive    ?? 1.5;

  const spb = (SAMPLE_RATE * 60) / bpm;           // samples per beat
  const totalSamples = Math.ceil(totalBars * 4 * spb);
  const out = new Float64Array(totalSamples);

  const lpFilter = makeBiquad("lowpass", filterHz, filterQ);
  // Add slight HP to remove DC
  const hpFilter = makeBiquad("highpass", 40, 0.7);

  const detuneRatio = Math.pow(2, detune / 1200);

  for (const note of notes) {
    const startSample = Math.round(note.startBeat * spb);
    const noteDurSec = (note.durationBeats * 60) / bpm;
    const vel = note.velocity / 127;

    const env = makeAdsr({
      attackSec:    p.attack  ?? 0.004,
      decaySec:     p.decay   ?? 0.08,
      sustainLevel: p.sustain ?? 0.75,
      releaseSec:   p.release ?? 0.05,
    }, noteDurSec + (p.release ?? 0.05));

    const freq = midiToHz(note.pitch);
    const freqSub = freq * 0.5;   // sub octave
    const freqHi  = freq * detuneRatio;

    let phase1 = 0, phase2 = 0, phaseSub = 0;
    const len = env.length;

    for (let i = 0; i < len; i++) {
      const outIdx = startSample + i;
      if (outIdx >= totalSamples) break;

      phase1   += TWO_PI * freq   / SAMPLE_RATE;
      phase2   += TWO_PI * freqHi / SAMPLE_RATE;
      phaseSub += TWO_PI * freqSub / SAMPLE_RATE;

      const saw1 = sawWave(phase1);
      const saw2 = sawWave(phase2);
      const sub  = sineWave(phaseSub) * subMix;
      const raw  = (saw1 * 0.5 + saw2 * 0.5) * (1 - subMix) + sub;

      // Filter per-sample (cheaper than instancing per note)
      const filtered = processBiquad(lpFilter, raw);
      out[outIdx] += processBiquad(hpFilter, filtered) * env[i] * vel * drive;
    }
  }

  tanhSaturate(out, 1.4);
  hardClip(out, 0.98);
  return out;
}

// ─── Pad ──────────────────────────────────────────────────────────────────────

export interface PadParams {
  /** Voices (detuned saws). Default 4. */
  voices?: number;
  /** Max detune spread (cents) across all voices. Default 18. */
  detuneCents?: number;
  /** Low-pass cutoff Hz. Default 2200. */
  filterHz?: number;
  /** LFO rate for filter mod (Hz). Default 0.25. */
  lfoRate?: number;
  /** LFO depth — semitones of filter modulation. Default 0.5 octaves = 600 cents. */
  lfoDepth?: number;
  /** Reverb wet amount (0–1). Default 0.35. */
  reverbWet?: number;
  /** ADSR */
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
}

export function renderPad(
  notes: NoteEvent[],
  bpm: number,
  totalBars: number,
  p: PadParams = {}
): Float64Array {
  const voices    = p.voices     ?? 4;
  const detune    = p.detuneCents ?? 18;
  const filterHz  = p.filterHz   ?? 2200;
  const lfoRate   = p.lfoRate    ?? 0.25;
  const lfoDepth  = p.lfoDepth   ?? 400;   // cents of filter mod
  const reverbWet = p.reverbWet  ?? 0.35;

  const spb = (SAMPLE_RATE * 60) / bpm;
  const totalSamples = Math.ceil(totalBars * 4 * spb);
  const out = new Float64Array(totalSamples);

  const reverb = new SimpleReverb(0.65, reverbWet);
  let lfoPhase = 0;

  // Pre-compute voice detune ratios
  const voiceRatios: number[] = [];
  for (let v = 0; v < voices; v++) {
    const cents = voices === 1 ? 0 : -detune + (v * (detune * 2)) / (voices - 1);
    voiceRatios.push(Math.pow(2, cents / 1200));
  }

  for (const note of notes) {
    const startSample = Math.round(note.startBeat * spb);
    const noteDurSec = (note.durationBeats * 60) / bpm;
    const vel = note.velocity / 127;

    const totalDurSec = noteDurSec + (p.release ?? 1.2);
    const env = makeAdsr({
      attackSec:    p.attack  ?? 0.6,
      decaySec:     p.decay   ?? 0.4,
      sustainLevel: p.sustain ?? 0.8,
      releaseSec:   p.release ?? 1.2,
    }, totalDurSec);

    const freq = midiToHz(note.pitch);
    const phases = new Float64Array(voices);

    for (let i = 0; i < env.length; i++) {
      const outIdx = startSample + i;
      if (outIdx >= totalSamples) break;

      // LFO for filter modulation
      lfoPhase += TWO_PI * lfoRate / SAMPLE_RATE;
      const lfoVal = Math.sin(lfoPhase);
      const dynFilter = filterHz * Math.pow(2, (lfoVal * lfoDepth) / 1200);
      const flt = makeBiquad("lowpass", Math.max(200, Math.min(20000, dynFilter)), 0.6);

      let sample = 0;
      for (let v = 0; v < voices; v++) {
        phases[v] += TWO_PI * freq * voiceRatios[v] / SAMPLE_RATE;
        sample += sawWave(phases[v]);
      }
      sample /= voices;

      const filtered = processBiquad(flt, sample);
      out[outIdx] += reverb.process(filtered) * env[i] * vel * 0.7;
    }
  }

  hardClip(out, 0.98);
  return out;
}

// ─── Stab ─────────────────────────────────────────────────────────────────────

export interface StabParams {
  /** Hard filter cutoff (Hz). Default 3500. */
  filterHz?: number;
  /** Filter resonance Q. Default 3.5. */
  filterQ?: number;
  /** Note duration (sec) — stabs are always short. Default 0.07. */
  noteDurSec?: number;
  /** Drive. Default 2.0. */
  drive?: number;
  /** Pitch detune (cents). Default 5. */
  detuneCents?: number;
}

export function renderStab(
  notes: NoteEvent[],
  bpm: number,
  totalBars: number,
  p: StabParams = {}
): Float64Array {
  const filterHz = p.filterHz ?? 3500;
  const filterQ  = p.filterQ  ?? 3.5;
  const noteDur  = p.noteDurSec ?? 0.07;
  const drive    = p.drive ?? 2.0;
  const detune   = p.detuneCents ?? 5;

  const spb = (SAMPLE_RATE * 60) / bpm;
  const totalSamples = Math.ceil(totalBars * 4 * spb);
  const out = new Float64Array(totalSamples);

  const detuneRatio = Math.pow(2, detune / 1200);

  for (const note of notes) {
    const startSample = Math.round(note.startBeat * spb);
    const vel = note.velocity / 127;

    const env = makeAdsr({
      attackSec:    0.001,
      decaySec:     noteDur * 0.5,
      sustainLevel: 0,
      releaseSec:   noteDur * 0.5,
    }, noteDur);

    const freq = midiToHz(note.pitch);
    const freqHi = freq * detuneRatio;

    // Per-note filter state (so resonance peak is at the right frequency)
    const lpFilter = makeBiquad("lowpass", filterHz, filterQ);
    const hpFilter = makeBiquad("highpass", 200, 0.7);

    let phase1 = 0, phase2 = 0;

    for (let i = 0; i < env.length; i++) {
      const outIdx = startSample + i;
      if (outIdx >= totalSamples) break;

      phase1 += TWO_PI * freq   / SAMPLE_RATE;
      phase2 += TWO_PI * freqHi / SAMPLE_RATE;

      const sq1 = squareWave(phase1, 0.48);
      const sq2 = squareWave(phase2, 0.52);
      const raw = (sq1 + sq2) * 0.5;

      const hp = processBiquad(hpFilter, raw);
      out[outIdx] += processBiquad(lpFilter, hp) * env[i] * vel;
    }
  }

  tanhSaturate(out, drive);
  hardClip(out, 0.98);
  return out;
}

// ─── Arpeggio ─────────────────────────────────────────────────────────────────

export interface ArpParams {
  /** Note rate in beats (e.g. 0.25 = 16th notes). Default 0.25. */
  noteLengthBeats?: number;
  /** Arp pattern: "up" | "down" | "updown" | "downup" | "random". Default "up". */
  pattern?: "up" | "down" | "updown" | "downup" | "random";
  /** Gate — fraction of note held vs silent (0–1). Default 0.6. */
  gate?: number;
  /** Octave range to arpeggiate over. Default 2. */
  octaves?: number;
  /** Base synth character: "saw" | "square" | "sine". Default "saw". */
  waveform?: "saw" | "square" | "sine";
  /** Filter cutoff (Hz). Default 4000. */
  filterHz?: number;
  /** Filter Q. Default 1.5. */
  filterQ?: number;
  /** Delay echo on the arp (sec). Default 0.125 (eighth note at 120bpm). */
  delayBeats?: number;
  /** Delay feedback 0–1. Default 0.3. */
  delayFeedback?: number;
}

export function renderArp(
  /** Root chord notes (MIDI). The arp will cycle through them. */
  chordNotes: number[],
  bpm: number,
  totalBars: number,
  p: ArpParams = {}
): Float64Array {
  const noteLengthBeats = p.noteLengthBeats ?? 0.25;
  const gate            = p.gate ?? 0.6;
  const octaves         = p.octaves ?? 2;
  const waveform        = p.waveform ?? "saw";
  const filterHz        = p.filterHz ?? 4000;
  const filterQ         = p.filterQ  ?? 1.5;
  const delayFeedback   = p.delayFeedback ?? 0.3;
  const delayBeats      = p.delayBeats ?? 0.25;

  const spb = (SAMPLE_RATE * 60) / bpm;
  const totalSamples = Math.ceil(totalBars * 4 * spb);
  const out = new Float64Array(totalSamples);

  // Build full arp note list (across octaves)
  const pool: number[] = [];
  for (let oct = 0; oct < octaves; oct++) {
    for (const n of chordNotes) pool.push(n + oct * 12);
  }
  if (p.pattern === "down" || p.pattern === "downup") pool.reverse();

  const notePool = p.pattern === "updown"
    ? [...pool, ...[...pool].reverse().slice(1, -1)]
    : pool;

  const lpFilter = makeBiquad("lowpass", filterHz, filterQ);
  const hpFilter = makeBiquad("highpass", 80, 0.7);
  const delay    = new DelayLine(2.0);
  const delaySamples = delayBeats * spb;

  const env = makeAdsr({
    attackSec: 0.002,
    decaySec:  0.04,
    sustainLevel: 0.7,
    releaseSec: 0.03,
  }, (noteLengthBeats * gate * 60) / bpm);

  const totalBeats = totalBars * 4;
  const totalNotes = Math.ceil(totalBeats / noteLengthBeats);
  let noteIndex = 0;

  for (let n = 0; n < totalNotes; n++) {
    const pitch   = notePool[noteIndex % notePool.length];
    const freq    = midiToHz(pitch);
    const startSample = Math.round(n * noteLengthBeats * spb);
    const noteSamples = Math.round(noteLengthBeats * gate * spb);
    noteIndex++;

    let phase = 0;

    for (let i = 0; i < env.length && i < noteSamples; i++) {
      const outIdx = startSample + i;
      if (outIdx >= totalSamples) break;

      phase += TWO_PI * freq / SAMPLE_RATE;
      let raw: number;
      if (waveform === "saw")    raw = sawWave(phase);
      else if (waveform === "square") raw = squareWave(phase, 0.5);
      else raw = sineWave(phase);

      const filtered = processBiquad(lpFilter, processBiquad(hpFilter, raw));
      const withDelay = filtered + delay.process(filtered, delaySamples, delayFeedback) * 0.4;
      out[outIdx] += withDelay * env[i] * 0.55;
    }

    if (p.pattern === "random") {
      noteIndex = Math.floor(Math.random() * notePool.length);
    }
  }

  hardClip(out, 0.98);
  return out;
}

// ─── Noise Texture (dark FX layer) ───────────────────────────────────────────

export interface NoiseTextureParams {
  /** HP filter cutoff (Hz). Default 2000. */
  hpHz?: number;
  /** LP filter cutoff (Hz). Default 8000. */
  lpHz?: number;
  /** Slow AM LFO rate (Hz). Default 0.15. */
  lfoRate?: number;
  /** Duration (sec). Defaults to totalBars at bpm. */
  durationSec?: number;
  /** Output gain 0–1. Default 0.25. */
  gain?: number;
}

export function renderNoiseTexture(
  bpm: number,
  totalBars: number,
  p: NoiseTextureParams = {}
): Float64Array {
  const hpHz   = p.hpHz  ?? 2000;
  const lpHz   = p.lpHz  ?? 8000;
  const lfoRate = p.lfoRate ?? 0.15;
  const gain   = p.gain ?? 0.25;

  const dur = p.durationSec ?? (totalBars * 4 * 60) / bpm;
  const totalSamples = Math.ceil(dur * SAMPLE_RATE);
  const out = new Float64Array(totalSamples);

  const hp = makeBiquad("highpass", hpHz, 0.7);
  const lp = makeBiquad("lowpass", lpHz, 0.7);

  let lfoPhase = 0;
  for (let i = 0; i < totalSamples; i++) {
    lfoPhase += TWO_PI * lfoRate / SAMPLE_RATE;
    const lfoAm = (Math.sin(lfoPhase) * 0.3 + 0.7); // 0.4 – 1.0
    const raw = whiteNoise();
    out[i] = processBiquad(lp, processBiquad(hp, raw)) * lfoAm * gain;
  }

  return out;
}
