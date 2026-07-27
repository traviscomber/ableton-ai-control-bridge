/**
 * Drum Synthesizer — Pure TypeScript, zero dependencies
 *
 * Synthesizes every percussion element from scratch using the WAV engine
 * primitives. Each function returns a Float64Array (mono, -1 to +1) that
 * can be directly encoded to WAV or mixed into a master buffer.
 *
 * Instruments:
 *   - kick()    — 808-style pitched sine + pitch envelope + saturation
 *   - snare()   — tone body + tuned noise burst + envelope
 *   - hihat()   — filtered metallic noise (closed and open variants)
 *   - clap()    — multiple noise bursts with reverb spread
 *   - perc()    — short metallic transient for ghost notes / percussion
 *
 * All parameters are tuneable so the DARKSCO variants (Daytime/Morning/Night)
 * can each have distinct drum character without any asset files.
 */

import {
  SAMPLE_RATE, TWO_PI,
  makeAdsr,
  makeBiquad, processBiquad,
  whiteNoise, PinkNoise,
  tanhSaturate, hardClip,
  sineWave, triangleWave,
} from "./wav-engine";

// ─── Shared Helper ─────────────────────────────────────────────────────────

function seconds(s: number) {
  return Math.ceil(s * SAMPLE_RATE);
}

// ─── Kick Drum ────────────────────────────────────────────────────────────────

export interface KickParams {
  /** Start frequency of the pitch sweep (Hz). Default 240. */
  startFreq?: number;
  /** End (sustain) frequency (Hz). Default 45. */
  endFreq?: number;
  /** Time for the pitch to sweep from start to end (sec). Default 0.06. */
  pitchDecay?: number;
  /** Total duration of the kick body (sec). Default 0.55. */
  durationSec?: number;
  /** Amplitude ADSR. */
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  /** Soft-clip drive — higher = more aggressive. Default 1.8. */
  drive?: number;
  /** How much click transient noise to mix in (0–1). Default 0.15. */
  clickLevel?: number;
}

/**
 * 808-style kick: pitched sine with exponential pitch envelope,
 * amplitude ADSR, tanh saturation, and an optional transient click.
 */
export function synthesiseKick(p: KickParams = {}): Float64Array {
  const startFreq = p.startFreq ?? 240;
  const endFreq   = p.endFreq   ?? 45;
  const pitchDecay = p.pitchDecay ?? 0.06;
  const dur       = p.durationSec ?? 0.55;
  const drive     = p.drive ?? 1.8;
  const clickLevel = p.clickLevel ?? 0.15;

  const len = seconds(dur);
  const out = new Float64Array(len);

  // Amplitude envelope
  const ampEnv = makeAdsr({
    attackSec:    p.attack  ?? 0.001,
    decaySec:     p.decay   ?? 0.35,
    sustainLevel: p.sustain ?? 0.0,
    releaseSec:   p.release ?? 0.15,
  }, dur);

  // Pitch envelope (exponential sweep)
  const pitchDecaySamples = pitchDecay * SAMPLE_RATE;
  let phase = 0;

  // Transient click: short HP-filtered noise
  const clickLen = seconds(0.01);
  const clickFilter = makeBiquad("highpass", 2000, 1.0);

  for (let i = 0; i < len; i++) {
    // Exponential pitch sweep
    const t = i / SAMPLE_RATE;
    const freq = endFreq + (startFreq - endFreq) * Math.exp(-i / pitchDecaySamples);
    phase += TWO_PI * freq / SAMPLE_RATE;

    const sine = sineWave(phase) * ampEnv[i];

    // Click transient
    let click = 0;
    if (i < clickLen) {
      click = processBiquad(clickFilter, whiteNoise()) * (1 - i / clickLen) * clickLevel;
    }

    out[i] = sine + click;
  }

  // Tanh saturation for analogue warmth
  tanhSaturate(out, drive);
  hardClip(out, 0.99);

  return out;
}

// ─── Snare ────────────────────────────────────────────────────────────────────

export interface SnareParams {
  /** Fundamental tone frequency (Hz). Default 180. */
  toneFreq?: number;
  /** Tone body duration (sec). Default 0.18. */
  durationSec?: number;
  /** Noise amount relative to tone (0–1). Default 0.65. */
  noiseLevel?: number;
  /** Noise high-pass cutoff (Hz). Default 1200. */
  noiseHpHz?: number;
  /** Tone ADSR. */
  toneAttack?: number;
  toneDecay?: number;
  /** Snare "snap" character — higher Q = more ringy. Default 0.9. */
  snap?: number;
}

export function synthesiseSnare(p: SnareParams = {}): Float64Array {
  const toneFreq   = p.toneFreq   ?? 180;
  const dur        = p.durationSec ?? 0.18;
  const noiseLevel = p.noiseLevel  ?? 0.65;
  const noiseHpHz  = p.noiseHpHz   ?? 1200;
  const snap       = p.snap ?? 0.9;

  const len = seconds(dur);
  const out = new Float64Array(len);

  // Tone body — triangle oscillator + biquad bandpass for resonance
  const bpFilter = makeBiquad("bandpass", toneFreq, snap);
  const toneEnv = makeAdsr({
    attackSec: p.toneAttack ?? 0.002,
    decaySec: p.toneDecay ?? 0.08,
    sustainLevel: 0,
    releaseSec: 0.04,
  }, dur);

  // Noise layer — high-passed white noise
  const noiseEnv = makeAdsr({
    attackSec: 0.001,
    decaySec: 0.06,
    sustainLevel: 0.1,
    releaseSec: 0.08,
  }, dur);
  const hpFilter = makeBiquad("highpass", noiseHpHz, 0.7);

  let phase = 0;
  for (let i = 0; i < len; i++) {
    phase += TWO_PI * toneFreq / SAMPLE_RATE;
    const tone = processBiquad(bpFilter, triangleWave(phase)) * toneEnv[i];
    const noise = processBiquad(hpFilter, whiteNoise()) * noiseEnv[i] * noiseLevel;
    out[i] = tone + noise;
  }

  tanhSaturate(out, 1.3);
  hardClip(out, 0.99);
  return out;
}

// ─── Hi-Hat ───────────────────────────────────────────────────────────────────

export interface HihatParams {
  /** Closed hi-hat if true, open if false. Default true (closed). */
  closed?: boolean;
  /** Duration (sec). Closed default 0.05, open default 0.25. */
  durationSec?: number;
  /** Metallic character filter frequency (Hz). Default 8000. */
  filterHz?: number;
  /** Filter Q. Default 1.5. */
  filterQ?: number;
  /** Dark/bright balance — 0=dark, 1=bright. Default 0.6. */
  brightness?: number;
}

export function synthesiseHihat(p: HihatParams = {}): Float64Array {
  const closed  = p.closed ?? true;
  const dur     = p.durationSec ?? (closed ? 0.055 : 0.28);
  const filterHz = p.filterHz ?? 8000;
  const filterQ  = p.filterQ ?? 1.5;
  const brightness = p.brightness ?? 0.6;

  const len = seconds(dur);
  const out = new Float64Array(len);

  const decaySec = closed ? 0.03 : 0.18;
  const env = makeAdsr({
    attackSec: 0.001,
    decaySec,
    sustainLevel: 0,
    releaseSec: closed ? 0.015 : 0.08,
  }, dur);

  // Mix of white and pink noise for metallic character
  const pink = new PinkNoise();
  const hpFilter  = makeBiquad("highpass", filterHz * (0.5 + brightness * 0.5), filterQ);
  const bpFilter  = makeBiquad("bandpass", filterHz * 1.2, 2.0);
  const lpFilter  = makeBiquad("lowpass", 16000, 0.5);

  for (let i = 0; i < len; i++) {
    const w = whiteNoise();
    const pk = pink.next();
    const mixed = w * brightness + pk * (1 - brightness);
    const hp = processBiquad(hpFilter, mixed);
    const bp = processBiquad(bpFilter, hp) * 0.3;
    out[i] = processBiquad(lpFilter, hp + bp) * env[i];
  }

  return out;
}

// ─── Clap ─────────────────────────────────────────────────────────────────────

export interface ClapParams {
  /** Number of noise burst layers that simulate multiple hands. Default 3. */
  layers?: number;
  /** Smear between layers (sec). Default 0.008. */
  smearSec?: number;
  /** Total clap duration (sec). Default 0.2. */
  durationSec?: number;
  /** Filter frequency for the body (HP cutoff Hz). Default 900. */
  bodyHpHz?: number;
}

export function synthesiseClap(p: ClapParams = {}): Float64Array {
  const layers    = p.layers  ?? 3;
  const smearSec  = p.smearSec ?? 0.008;
  const dur       = p.durationSec ?? 0.2;
  const bodyHpHz  = p.bodyHpHz ?? 900;

  const len = seconds(dur);
  const out = new Float64Array(len);

  const hpFilter = makeBiquad("highpass", bodyHpHz, 0.8);
  const tailEnv = makeAdsr({ attackSec: 0.001, decaySec: 0.12, sustainLevel: 0.0, releaseSec: 0.07 }, dur);

  // Noise tail for body
  for (let i = 0; i < len; i++) {
    out[i] += processBiquad(hpFilter, whiteNoise()) * tailEnv[i] * 0.5;
  }

  // Layered transient bursts
  for (let l = 0; l < layers; l++) {
    const offsetSamples = Math.round(l * smearSec * SAMPLE_RATE);
    const burstDur = 0.012;
    const burstLen = seconds(burstDur);
    const burstFilter = makeBiquad("bandpass", 1200 + l * 300, 1.2);
    const burstEnv = makeAdsr({ attackSec: 0.0005, decaySec: burstDur * 0.6, sustainLevel: 0, releaseSec: burstDur * 0.4 }, burstDur);

    for (let i = 0; i < burstLen; i++) {
      const outIdx = offsetSamples + i;
      if (outIdx >= len) break;
      out[outIdx] += processBiquad(burstFilter, whiteNoise()) * burstEnv[i];
    }
  }

  tanhSaturate(out, 1.1);
  hardClip(out, 0.99);
  return out;
}

// ─── Perc (ghost / accent transient) ─────────────────────────────────────────

export interface PercParams {
  /** Centre frequency of the metallic body (Hz). Default 600. */
  freqHz?: number;
  /** Total duration (sec). Default 0.08. */
  durationSec?: number;
  /** Pitch sweep amount: how many Hz the pitch drops. Default 80. */
  pitchSweep?: number;
}

export function synthesisePerc(p: PercParams = {}): Float64Array {
  const freqHz    = p.freqHz     ?? 600;
  const dur       = p.durationSec ?? 0.08;
  const sweep     = p.pitchSweep ?? 80;

  const len = seconds(dur);
  const out = new Float64Array(len);

  const env = makeAdsr({ attackSec: 0.001, decaySec: dur * 0.5, sustainLevel: 0.1, releaseSec: dur * 0.4 }, dur);
  const sweepSamples = dur * 0.3 * SAMPLE_RATE;
  let phase = 0;

  const noiseFilter = makeBiquad("bandpass", freqHz, 3.0);

  for (let i = 0; i < len; i++) {
    const freq = freqHz - sweep * Math.exp(-i / sweepSamples);
    phase += TWO_PI * freq / SAMPLE_RATE;
    const tone  = sineWave(phase) * 0.6;
    const noise = processBiquad(noiseFilter, whiteNoise()) * 0.4;
    out[i] = (tone + noise) * env[i];
  }

  return out;
}

// ─── Pattern Sequencer ────────────────────────────────────────────────────────

export interface DrumPattern {
  kick?:  number[];  // 16th-note positions (0–15)
  snare?: number[];
  hihat?: number[];
  openHihat?: number[];
  clap?:  number[];
  perc?:  number[];
}

export interface DrumBusParams {
  bpm: number;
  bars: number;
  kickParams?:    KickParams;
  snareParams?:   SnareParams;
  hihatParams?:   HihatParams;
  openHihatParams?: HihatParams;
  clapParams?:    ClapParams;
  percParams?:    PercParams;
  /** Per-drum gain in dB */
  levels?: {
    kick?: number;
    snare?: number;
    hihat?: number;
    clap?: number;
    perc?: number;
  };
  /** Swing amount 0–1. Default 0 (straight). */
  swing?: number;
}

function dbToGain(db: number) {
  return Math.pow(10, db / 20);
}

/**
 * Render a full drum bus from a 16-step pattern over `bars` bars.
 * Returns a mono Float64Array at SAMPLE_RATE.
 */
export function renderDrumBus(pattern: DrumPattern, params: DrumBusParams): Float64Array {
  const { bpm, bars } = params;
  const beatsPerBar = 4;
  const totalBeats = bars * beatsPerBar;
  const samplesPerBeat = (SAMPLE_RATE * 60) / bpm;
  const samplesPerSixteenth = samplesPerBeat / 4;
  const swing = (params.swing ?? 0) * samplesPerSixteenth * 0.5;

  const totalSamples = Math.ceil(totalBeats * samplesPerBeat);
  const out = new Float64Array(totalSamples);

  // Pre-synthesise one-shot samples
  const kickSample  = synthesiseKick(params.kickParams);
  const snareSample = synthesiseSnare(params.snareParams);
  const hihatSample = synthesiseHihat({ ...(params.hihatParams ?? {}), closed: true });
  const openHihatSample = synthesiseHihat({ ...(params.openHihatParams ?? {}), closed: false });
  const clapSample  = synthesiseClap(params.clapParams);
  const percSample  = synthesisePerc(params.percParams);

  const lvl = params.levels ?? {};
  const kickGain  = dbToGain(lvl.kick  ?? 0);
  const snareGain = dbToGain(lvl.snare ?? -1);
  const hihatGain = dbToGain(lvl.hihat ?? -3);
  const clapGain  = dbToGain(lvl.clap  ?? -2);
  const percGain  = dbToGain(lvl.perc  ?? -5);

  function stampAt(sample: Float64Array, startSample: number, gain: number) {
    const end = Math.min(out.length, startSample + sample.length);
    for (let i = startSample; i < end; i++) {
      out[i] += sample[i - startSample] * gain;
    }
  }

  const stepsPerBar = 16;
  const totalSteps = bars * stepsPerBar;

  for (let step = 0; step < totalSteps; step++) {
    const patternStep = step % stepsPerBar;
    // Swing: push odd 16th notes back slightly
    const swingOffset = step % 2 === 1 ? swing : 0;
    const startSample = Math.round(step * samplesPerSixteenth + swingOffset);

    if (pattern.kick?.includes(patternStep))     stampAt(kickSample,     startSample, kickGain);
    if (pattern.snare?.includes(patternStep))    stampAt(snareSample,    startSample, snareGain);
    if (pattern.hihat?.includes(patternStep))    stampAt(hihatSample,    startSample, hihatGain);
    if (pattern.openHihat?.includes(patternStep)) stampAt(openHihatSample, startSample, hihatGain);
    if (pattern.clap?.includes(patternStep))     stampAt(clapSample,     startSample, clapGain);
    if (pattern.perc?.includes(patternStep))     stampAt(percSample,     startSample, percGain);
  }

  return out;
}
