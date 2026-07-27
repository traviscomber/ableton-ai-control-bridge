/**
 * Sample Synthesizer — Full multi-oscillator one-shot engine
 *
 * Every instrument is synthesised from first principles using all available
 * WAV-engine oscillators, filters, envelopes, saturation, reverb, and delay.
 *
 * Drum one-shots:
 *   kick   — sine+saw oscillator layer + click transient + pitch envelope + tanh sat (3 velocities)
 *   snare  — triangle body + bandpass resonance + tuned noise burst + parallel comb (3 velocities)
 *   hihat  — white+pink noise mix, metallic resonance stack, open/closed variants (3 velocities each)
 *   clap   — layered burst smear + HP body + velocity-controlled spread
 *   perc   — metallic sine sweep + bandpass noise layer
 *
 * Melodic one-shots (all per MIDI note across full playable range):
 *   bass   — 3 detuned saws + sub sine + resonant LP + tanh sat, 12 notes C1–C4
 *   pad    — 6-voice supersaw + slow LFO filter mod + reverb shimmer, 9 notes C3–C5
 *   stab   — square+saw layer + saturated HP/LP band + tight ADSR, 9 notes C3–C5
 *   arp    — saw+triangle voice + delay echo + resonant LP + short gate, 9 notes C3–C5
 *
 * Each SampleHit carries:
 *   wav_b64   Base64 48kHz/24-bit mono WAV
 *   midi_b64  Base64 single-note Format-0 MIDI file
 */

import {
  SAMPLE_RATE, TWO_PI,
  makeAdsr,
  makeBiquad, processBiquad,
  sawWave, squareWave, sineWave, triangleWave,
  whiteNoise, PinkNoise,
  tanhSaturate, hardClip, normalisePeak,
  SimpleReverb, DelayLine,
  encodeWavMono,
} from "./wav-engine";
import type { KickParams, SnareParams, HihatParams, ClapParams } from "./drum-synth";
import type { BassParams } from "./melodic-synth";
import { midiToHz } from "./melodic-synth";
import { encodeMidiFile, beatsToTicks, type MidiNote } from "./midi-encoder";

// Re-export KickParams etc so sample-synth can be the single import point
export type { KickParams, SnareParams, HihatParams, ClapParams, BassParams };

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SampleHit {
  stem:           string;
  /** e.g. "kick_hard", "bass_C2", "pad_F3" */
  name:           string;
  note_name:      string;
  midi_note:      number;
  velocity:       number;
  velocity_label: "soft" | "medium" | "hard";
  /** Base64 48kHz/24-bit mono WAV — stripped to "" after upload to Supabase */
  wav_b64:        string;
  /** Base64 single-note Format-0 MIDI — stripped to "" after upload to Supabase */
  midi_b64:       string;
  /** Signed Supabase Storage URL (populated after upload) */
  wav_url:        string;
  midi_url:       string;
  wav_path:       string;
  duration_ms:    number;
  size_bytes:     number;
}

export interface StemSampleGroup {
  stem:      string;
  category:  "drum" | "melodic";
  root_note: number;
  samples:   SampleHit[];
}

// ─── MIDI helpers ─────────────────────────────────────────────────────────────

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
function midiToName(n: number): string {
  return NOTE_NAMES[n % 12] + (Math.floor(n / 12) - 1);
}

function seconds(s: number): number {
  return Math.ceil(s * SAMPLE_RATE);
}

function makeSingleNoteMidi(
  note: number,
  channel: number,
  velocity: number,
  bpm: number,
  durationBeats = 1.0,
): Buffer {
  const notes: MidiNote[] = [{
    channel,
    pitch:         Math.max(0, Math.min(127, note)),
    velocity:      Math.max(1,  Math.min(127, velocity)),
    startTick:     0,
    durationTicks: beatsToTicks(durationBeats),
  }];
  return encodeMidiFile(notes, { bpm, trackName: `${midiToName(note)} v${velocity}` });
}

// ─── Velocity layers ─────────────────────────────────────────────────────────

const VEL_LAYERS: Array<{ label: "soft"|"medium"|"hard"; value: number }> = [
  { label: "soft",   value: 50  },
  { label: "medium", value: 90  },
  { label: "hard",   value: 120 },
];

// ─── GM drum positions ────────────────────────────────────────────────────────

const DRUM_GM: Record<string, { note: number; name: string }> = {
  kick:       { note: 36, name: "C1"  },
  snare:      { note: 38, name: "D1"  },
  hihat:      { note: 42, name: "F#1" },
  openHihat:  { note: 46, name: "A#1" },
  clap:       { note: 39, name: "D#1" },
  perc:       { note: 37, name: "C#1" },
};

// ─── Melodic note ranges ──────────────────────────────────────────────────────
// 12 notes for bass (C1–C4 every min/maj 3rd), 9 notes for pad/stab/arp (C3–C5)

const BASS_NOTES = [36,40,43,48,52,55,60,64,67,72,76,79]; // C2–G5 every minor/major 3rd
const PAD_NOTES  = [48,52,55,57,60,62,64,67,69,72];        // C3–A4 semitone-skip (root zones)
const STAB_NOTES = [48,52,55,57,60,62,64,67,69,72];
const ARP_NOTES  = [48,52,55,57,60,62,64,67,69,72];

// ─── ── KICK: sine+saw + pitch envelope + click + saturation ────────────────

function renderKickSample(velScale: number, p: KickParams = {}): Float64Array {
  const startFreq  = p.startFreq  ?? 220;
  const endFreq    = p.endFreq    ?? 42;
  const pitchDecay = p.pitchDecay ?? 0.06;
  const dur        = p.durationSec ?? 0.6;
  const drive      = (p.drive ?? 1.8) * (0.5 + velScale * 0.7);
  const clickLevel = (p.clickLevel ?? 0.18) * velScale;

  const len = seconds(dur);
  const out = new Float64Array(len);

  const ampEnv = makeAdsr({
    attackSec:    p.attack  ?? 0.001,
    decaySec:     (p.decay  ?? 0.35) + (1 - velScale) * 0.1,
    sustainLevel: 0,
    releaseSec:   p.release ?? 0.18,
  }, dur);

  const pitchDecaySamples = pitchDecay * SAMPLE_RATE;

  // Transient click — short HP noise burst
  const clickLen    = seconds(0.012);
  const clickFilter = makeBiquad("highpass", 2500, 1.2);
  const clickFilter2 = makeBiquad("bandpass", 5000, 2.0);

  // Slight SAW layer for extra punch on hard hits
  const sawMix = velScale * 0.12;

  let phase = 0, sawPhase = 0;

  for (let i = 0; i < len; i++) {
    const freq = endFreq + (startFreq - endFreq) * Math.exp(-i / pitchDecaySamples);
    phase    += TWO_PI * freq          / SAMPLE_RATE;
    sawPhase += TWO_PI * (freq * 0.5)  / SAMPLE_RATE;

    const sine = sineWave(phase)  * ampEnv[i];
    const saw  = sawWave(sawPhase) * ampEnv[i] * sawMix;

    let click = 0;
    if (i < clickLen) {
      const raw  = processBiquad(clickFilter, whiteNoise());
      click = processBiquad(clickFilter2, raw) * (1 - i / clickLen) * clickLevel;
    }

    out[i] = sine + saw + click;
  }

  tanhSaturate(out, drive);
  hardClip(out, 0.99);
  return out;
}

// ─── SNARE: triangle body + comb resonance + tuned noise burst ──────────────

function renderSnareSample(velScale: number, p: SnareParams = {}): Float64Array {
  const toneFreq   = p.toneFreq   ?? 180;
  const dur        = p.durationSec ?? 0.22;
  const noiseLevel = (p.noiseLevel ?? 0.65) * (0.6 + velScale * 0.5);
  const noiseHpHz  = p.noiseHpHz   ?? 1200;
  const snap       = (p.snap ?? 0.9) * (0.85 + velScale * 0.3);

  const len = seconds(dur);
  const out = new Float64Array(len);

  // Tone: triangle through bandpass resonator — simulates shell resonance
  const bpFilter  = makeBiquad("bandpass", toneFreq, snap);
  const bpFilter2 = makeBiquad("bandpass", toneFreq * 1.62, snap * 0.7); // comb partial
  const toneEnv   = makeAdsr({
    attackSec:    p.toneAttack ?? 0.002,
    decaySec:     p.toneDecay  ?? 0.09,
    sustainLevel: 0,
    releaseSec:   0.05,
  }, dur);

  // Noise: HP white noise — simulates snare wires
  const noiseEnv = makeAdsr({
    attackSec:    0.001,
    decaySec:     0.07,
    sustainLevel: 0.08,
    releaseSec:   0.10,
  }, dur);
  const hpFilter  = makeBiquad("highpass", noiseHpHz, 0.7);
  const hpFilter2 = makeBiquad("highpass", noiseHpHz * 0.5, 0.9);

  // Body transient: short sine click at toneFreq × 2 for attack crack
  const crackLen = seconds(0.006);
  const crackEnv = makeAdsr({ attackSec: 0.0001, decaySec: 0.005, sustainLevel: 0, releaseSec: 0.001 }, 0.007);
  let crackPhase = 0;

  let phase = 0;
  for (let i = 0; i < len; i++) {
    phase += TWO_PI * toneFreq / SAMPLE_RATE;

    const tri   = triangleWave(phase);
    const tone  = (processBiquad(bpFilter, tri) + processBiquad(bpFilter2, tri) * 0.4) * toneEnv[i];
    const noise = (processBiquad(hpFilter, whiteNoise()) + processBiquad(hpFilter2, whiteNoise()) * 0.5) * noiseEnv[i] * noiseLevel;

    // Attack crack
    let crack = 0;
    if (i < crackLen) {
      crackPhase += TWO_PI * toneFreq * 2.1 / SAMPLE_RATE;
      crack = sineWave(crackPhase) * crackEnv[i] * velScale * 0.4;
    }

    out[i] = tone + noise + crack;
  }

  tanhSaturate(out, 1.2 + velScale * 0.4);
  hardClip(out, 0.99);
  return out;
}

// ─── HIHAT: white+pink noise metallic resonance stack ────────────────────────

function renderHihatSample(velScale: number, closed: boolean, p: HihatParams = {}): Float64Array {
  const dur        = p.durationSec ?? (closed ? 0.07 : 0.35);
  const filterHz   = p.filterHz ?? (closed ? 9000 : 7500);
  const filterQ    = p.filterQ  ?? 1.8;
  const brightness = (p.brightness ?? 0.6) * (0.8 + velScale * 0.3);

  const len = seconds(dur);
  const out = new Float64Array(len);

  const decaySec = closed ? 0.03 * (1 + (1 - velScale) * 0.3) : 0.22;
  const env = makeAdsr({
    attackSec:    0.0005,
    decaySec,
    sustainLevel: 0,
    releaseSec:   closed ? 0.02 : 0.1,
  }, dur);

  const pink     = new PinkNoise();
  // Three-band metallic resonance stack
  const hp1      = makeBiquad("highpass", filterHz * 0.5,  filterQ);
  const bp1      = makeBiquad("bandpass", filterHz,        filterQ * 2.5);
  const bp2      = makeBiquad("bandpass", filterHz * 1.25, filterQ * 1.8);
  const bp3      = makeBiquad("bandpass", filterHz * 1.57, filterQ * 1.4); // metallic partial
  const lp1      = makeBiquad("lowpass",  18000, 0.5);

  for (let i = 0; i < len; i++) {
    const w  = whiteNoise();
    const pk = pink.next();
    const mixed = w * brightness + pk * (1 - brightness);

    const hp  = processBiquad(hp1, mixed);
    const bp  = processBiquad(bp1, hp);
    const bp_  = processBiquad(bp2, hp) * 0.5;
    const bp__ = processBiquad(bp3, hp) * 0.25;
    out[i] = processBiquad(lp1, hp + bp + bp_ + bp__) * env[i] * velScale;
  }

  return out;
}

// ─── CLAP: layered noise bursts + HP body + velocity smear ───────────────────

function renderClapSample(velScale: number, p: ClapParams = {}): Float64Array {
  const layers   = p.layers  ?? 4;
  const smearSec = (p.smearSec ?? 0.009) * (0.7 + velScale * 0.6);
  const dur      = p.durationSec ?? 0.22;
  const bodyHpHz = p.bodyHpHz ?? 900;

  const len = seconds(dur);
  const out = new Float64Array(len);

  const hpFilter  = makeBiquad("highpass", bodyHpHz, 0.8);
  const hpFilter2 = makeBiquad("highpass", 2000,     1.2);
  const tailEnv   = makeAdsr({ attackSec: 0.001, decaySec: 0.15, sustainLevel: 0, releaseSec: 0.07 }, dur);

  for (let i = 0; i < len; i++) {
    const raw = processBiquad(hpFilter2, processBiquad(hpFilter, whiteNoise()));
    out[i] += raw * tailEnv[i] * 0.4 * velScale;
  }

  for (let l = 0; l < layers; l++) {
    const offsetSamples = Math.round(l * smearSec * SAMPLE_RATE);
    const burstDur = 0.014;
    const burstLen = seconds(burstDur);
    const bf  = makeBiquad("bandpass", 1100 + l * 280, 1.1 + l * 0.2);
    const bfp = makeBiquad("highpass", 800,             0.9);
    const bEnv = makeAdsr({ attackSec: 0.0004, decaySec: burstDur * 0.65, sustainLevel: 0, releaseSec: burstDur * 0.35 }, burstDur);

    for (let i = 0; i < burstLen; i++) {
      const outIdx = offsetSamples + i;
      if (outIdx >= len) break;
      out[outIdx] += processBiquad(bf, processBiquad(bfp, whiteNoise())) * bEnv[i] * velScale;
    }
  }

  tanhSaturate(out, 1.1 + velScale * 0.3);
  hardClip(out, 0.99);
  return out;
}

// ─── PERC: metallic sine sweep + bandpass noise layer ────────────────────────

function renderPercSample(velScale: number): Float64Array {
  const freqHz = 600;
  const dur    = 0.10;
  const len    = seconds(dur);
  const out    = new Float64Array(len);

  const env       = makeAdsr({ attackSec: 0.001, decaySec: dur * 0.45, sustainLevel: 0.08, releaseSec: dur * 0.45 }, dur);
  const noiseFilter = makeBiquad("bandpass", freqHz * 1.2, 3.5);
  const sweepSamples = dur * 0.25 * SAMPLE_RATE;
  let phase = 0;

  for (let i = 0; i < len; i++) {
    const freq = freqHz - 80 * Math.exp(-i / sweepSamples);
    phase += TWO_PI * freq / SAMPLE_RATE;
    const tone  = sineWave(phase)  * 0.55;
    const noise = processBiquad(noiseFilter, whiteNoise()) * 0.45;
    out[i] = (tone + noise) * env[i] * velScale;
  }

  return out;
}

// ─── DRUM sample group renderer ───────────────────────────────────────────────

type DrumRenderFn = (velScale: number) => Float64Array;

function renderDrumGroup(
  stem: string,
  renderFn: DrumRenderFn,
  bpm: number,
): StemSampleGroup {
  const gm      = DRUM_GM[stem] ?? DRUM_GM.kick;
  const samples: SampleHit[] = [];

  for (const layer of VEL_LAYERS) {
    const velScale = layer.value / 127;
    const buf      = renderFn(velScale);
    normalisePeak(buf, velScale * 0.93 + 0.05);  // louder layers peak higher

    const wav   = encodeWavMono(buf, { bitDepth: 24 });
    const mid   = makeSingleNoteMidi(gm.note, 9, layer.value, bpm, 0.5);
    const durMs = Math.round((buf.length / SAMPLE_RATE) * 1000);

    samples.push({
      stem,
      name:           `${stem}_${layer.label}`,
      note_name:      gm.name,
      midi_note:      gm.note,
      velocity:       layer.value,
      velocity_label: layer.label,
      wav_b64:        wav.toString("base64"),
      midi_b64:       mid.toString("base64"),
      wav_url:        "",
      midi_url:       "",
      wav_path:       "",
      duration_ms:    durMs,
      size_bytes:     wav.length,
    });
  }

  return { stem, category: "drum", root_note: gm.note, samples };
}

// ─── BASS: 3 detuned saws + sub sine + resonant LP + tanh saturation ─────────

function renderBassSample(midiNote: number, bpm: number, p: BassParams = {}): Float64Array {
  const detune   = p.detuneCents ?? 10;
  const filterHz = p.filterHz   ?? 700;
  const filterQ  = p.filterQ    ?? 2.5;
  const subMix   = p.subMix     ?? 0.4;
  const drive    = p.drive      ?? 1.6;

  const dur     = 0.95; // ~1 bar at 120 bpm
  const durSec  = dur;

  const spb     = (SAMPLE_RATE * 60) / bpm;
  const len     = seconds(durSec);
  const out     = new Float64Array(len);

  // Three saws: root, +detune, -detune*0.6 for slight asymmetry
  const r1 = Math.pow(2,  detune         / 1200);
  const r2 = Math.pow(2, -detune * 0.65  / 1200);
  const r3 = Math.pow(2,  detune * 1.40  / 1200);

  const freq    = midiToHz(midiNote);
  const freqSub = freq * 0.5;

  const lpFilter = makeBiquad("lowpass",  filterHz, filterQ);
  const hpFilter = makeBiquad("highpass", 38,       0.7);
  const peakMid  = makeBiquad("peak",     freq * 1.5, 1.2, 3); // harmonic punch

  const env = makeAdsr({
    attackSec:    p.attack  ?? 0.004,
    decaySec:     p.decay   ?? 0.1,
    sustainLevel: p.sustain ?? 0.78,
    releaseSec:   p.release ?? 0.07,
  }, durSec);

  let ph1 = 0, ph2 = 0, ph3 = 0, phSub = 0;

  for (let i = 0; i < len; i++) {
    ph1   += TWO_PI * freq        * r1 / SAMPLE_RATE;
    ph2   += TWO_PI * freq        * r2 / SAMPLE_RATE;
    ph3   += TWO_PI * freq        * r3 / SAMPLE_RATE;
    phSub += TWO_PI * freqSub           / SAMPLE_RATE;

    const saws = (sawWave(ph1) + sawWave(ph2) + sawWave(ph3)) / 3;
    const sub  = sineWave(phSub) * subMix;
    const raw  = saws * (1 - subMix * 0.7) + sub;

    let s = processBiquad(peakMid, raw);
    s = processBiquad(lpFilter, s);
    s = processBiquad(hpFilter, s);

    out[i] = s * env[i] * drive;
  }

  tanhSaturate(out, 1.5);
  hardClip(out, 0.98);
  return out;
}

// ─── PAD: 6-voice supersaw + LFO filter mod + reverb shimmer ─────────────────

function renderPadSample(midiNote: number, bpm: number, p: { filterHz?: number; detuneCents?: number } = {}): Float64Array {
  const voices   = 6;
  const detune   = p.detuneCents ?? 20;
  const filterHz = p.filterHz   ?? 2200;
  const lfoRate  = 0.22;
  const lfoDepth = 480; // cents

  const dur = 1.8;
  const len = sections(dur);
  const out = new Float64Array(len);

  const reverb  = new SimpleReverb(0.65, 0.38);

  // Voice detune offsets: spread across ±detune cents
  const ratios: number[] = [];
  for (let v = 0; v < voices; v++) {
    const cents = -detune + (v * (detune * 2)) / (voices - 1);
    ratios.push(Math.pow(2, cents / 1200));
  }

  const freq   = midiToHz(midiNote);
  const phases = new Float64Array(voices);
  let lfoPhase = 0;

  const env = makeAdsr({
    attackSec: 0.08,
    decaySec:  0.4,
    sustainLevel: 0.72,
    releaseSec: 0.25,
  }, dur);

  for (let i = 0; i < len; i++) {
    lfoPhase += TWO_PI * lfoRate / SAMPLE_RATE;
    const dynCut  = filterHz * Math.pow(2, (Math.sin(lfoPhase) * lfoDepth) / 1200);
    const lpFlt   = makeBiquad("lowpass", Math.max(180, Math.min(18000, dynCut)), 0.65);
    const hpFlt   = makeBiquad("highpass", 55, 0.7);

    let sample = 0;
    for (let v = 0; v < voices; v++) {
      phases[v] += TWO_PI * freq * ratios[v] / SAMPLE_RATE;
      sample    += sawWave(phases[v]);
    }
    sample /= voices;

    const filt  = processBiquad(lpFlt, processBiquad(hpFlt, sample));
    out[i] = reverb.process(filt) * env[i] * 0.75;
  }

  hardClip(out, 0.98);
  return out;
}

function sections(s: number) { return Math.ceil(s * SAMPLE_RATE); }

// ─── STAB: square+saw layer + saturated HP/LP band + tight ADSR ──────────────

function renderStabSample(midiNote: number, p: { filterHz?: number; filterQ?: number; drive?: number } = {}): Float64Array {
  const filterHz = p.filterHz ?? 3200;
  const filterQ  = p.filterQ  ?? 4.5;
  const drive    = p.drive    ?? 2.4;
  const detune   = 7; // cents — slight thicken

  const dur  = 0.18;
  const len  = seconds(dur);
  const out  = new Float64Array(len);

  const freq = midiToHz(midiNote);
  const r    = Math.pow(2, detune / 1200);

  const lpFilter = makeBiquad("lowpass",  filterHz, filterQ);
  const hpFilter = makeBiquad("highpass", 200,      0.7);
  const notch    = makeBiquad("notch",    freq * 2, 1.5); // reduce harsh 2nd harmonic

  const env = makeAdsr({
    attackSec:    0.001,
    decaySec:     0.055,
    sustainLevel: 0,
    releaseSec:   0.04,
  }, dur);

  let ph1 = 0, ph2 = 0;

  for (let i = 0; i < len; i++) {
    ph1 += TWO_PI * freq       / SAMPLE_RATE;
    ph2 += TWO_PI * freq * r   / SAMPLE_RATE;

    const sq1 = squareWave(ph1, 0.47);
    const sq2 = squareWave(ph2, 0.53);
    const saw = sawWave(ph1) * 0.25; // slight saw edge

    const raw = (sq1 + sq2) * 0.5 * 0.75 + saw;

    let s = processBiquad(hpFilter, raw);
    s = processBiquad(notch, s);
    s = processBiquad(lpFilter, s);
    out[i] = s * env[i];
  }

  tanhSaturate(out, drive);
  hardClip(out, 0.98);
  return out;
}

// ─── ARP: saw+triangle mix + delay echo + resonant LP ────────────────────────

function renderArpSample(midiNote: number, bpm: number, p: { filterHz?: number } = {}): Float64Array {
  const filterHz = p.filterHz ?? 4200;

  const dur = 0.30;
  const len = seconds(dur);
  const out = new Float64Array(len);

  const freq = midiToHz(midiNote);

  const lpFilter = makeBiquad("lowpass",  filterHz, 2.0);
  const hpFilter = makeBiquad("highpass", 80,       0.7);

  const delaySamples = (60 / bpm) * 0.5 * SAMPLE_RATE; // eighth-note delay
  const delay        = new DelayLine(0.6);

  const env = makeAdsr({
    attackSec:    0.002,
    decaySec:     0.05,
    sustainLevel: 0.45,
    releaseSec:   0.08,
  }, dur);

  let ph = 0, phTri = 0;

  for (let i = 0; i < len; i++) {
    ph    += TWO_PI * freq / SAMPLE_RATE;
    phTri += TWO_PI * freq / SAMPLE_RATE;

    // Saw+triangle blend — more complex harmonic content
    const raw = sawWave(ph) * 0.6 + triangleWave(phTri) * 0.4;
    const filt = processBiquad(lpFilter, processBiquad(hpFilter, raw));

    // Delay echo at 0.35 feedback
    const echo = delay.process(filt, delaySamples, 0.35) * 0.38;
    out[i] = (filt + echo) * env[i] * 0.6;
  }

  hardClip(out, 0.98);
  return out;
}

// ─── Melodic sample group renderer ───────────────────────────────────────────

function renderMelodicGroup(
  stem:      string,
  notes:     number[],
  channel:   number,
  bpm:       number,
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
      wav_url:        "",
      midi_url:       "",
      wav_path:       "",
      duration_ms:    durMs,
      size_bytes:     wav.length,
    });
  }

  return { stem, category: "melodic", root_note: notes[0] ?? 48, samples };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export interface SamplePackInput {
  bpm:             number;
  kickParams?:     KickParams;
  snareParams?:    SnareParams;
  hihatParams?:    HihatParams;
  clapParams?:     ClapParams;
  bassParams?:     BassParams;
  padParams?:      Partial<{ filterHz: number; detuneCents: number }>;
  stabParams?:     Partial<{ filterHz: number; filterQ: number; drive: number }>;
  arpParams?:      Partial<{ filterHz: number }>;
  requestedStems?: string[];
}

/**
 * Render the full one-shot sample set for one DARKSCO variant.
 * Returns one StemSampleGroup per requested stem.
 *   Drums:   3 velocity layers × 1 note
 *   Melodic: 1 velocity × N notes across full playable range
 */
export function renderSamplePack(input: SamplePackInput): StemSampleGroup[] {
  const {
    bpm,
    kickParams  = {},
    snareParams = {},
    hihatParams = {},
    clapParams  = {},
    bassParams  = {},
    requestedStems = ["kick","snare","hihat","clap","perc","bass","pad","stab","arp"],
  } = input;

  const groups: StemSampleGroup[] = [];

  // ── Drums ───────────────────────────────────────────────────────────────────

  if (requestedStems.includes("kick")) {
    groups.push(renderDrumGroup("kick", (v) => renderKickSample(v, kickParams), bpm));
  }

  if (requestedStems.includes("snare")) {
    groups.push(renderDrumGroup("snare", (v) => renderSnareSample(v, snareParams), bpm));
  }

  if (requestedStems.includes("hihat")) {
    groups.push(renderDrumGroup("hihat", (v) => renderHihatSample(v, true, hihatParams), bpm));
  }

  if (requestedStems.includes("openHihat")) {
    groups.push(renderDrumGroup("openHihat", (v) => renderHihatSample(v, false, hihatParams), bpm));
  }

  if (requestedStems.includes("clap")) {
    groups.push(renderDrumGroup("clap", (v) => renderClapSample(v, clapParams), bpm));
  }

  if (requestedStems.includes("perc")) {
    groups.push(renderDrumGroup("perc", (v) => renderPercSample(v), bpm));
  }

  // ── Melodic ─────────────────────────────────────────────────────────────────

  if (requestedStems.includes("bass")) {
    groups.push(renderMelodicGroup("bass", BASS_NOTES, 1, bpm, (n) => renderBassSample(n, bpm, bassParams)));
  }

  if (requestedStems.includes("pad")) {
    groups.push(renderMelodicGroup("pad", PAD_NOTES, 2, bpm, (n) => renderPadSample(n, bpm, {
      filterHz:     input.padParams?.filterHz,
      detuneCents:  input.padParams?.detuneCents,
    })));
  }

  if (requestedStems.includes("stab")) {
    groups.push(renderMelodicGroup("stab", STAB_NOTES, 3, bpm, (n) => renderStabSample(n, {
      filterHz: input.stabParams?.filterHz,
      filterQ:  input.stabParams?.filterQ,
      drive:    input.stabParams?.drive,
    })));
  }

  if (requestedStems.includes("arp")) {
    groups.push(renderMelodicGroup("arp", ARP_NOTES, 4, bpm, (n) => renderArpSample(n, bpm, {
      filterHz: input.arpParams?.filterHz,
    })));
  }

  return groups;
}
