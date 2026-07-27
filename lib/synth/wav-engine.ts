/**
 * WAV Engine — Pure TypeScript, zero dependencies
 *
 * Provides the fundamental DSP primitives used by every synthesizer module:
 *   - Sample buffer management (Float32 internally, converts to 16 or 24-bit PCM)
 *   - Oscillators  : sine, saw, square, triangle, noise (white + pink)
 *   - ADSR envelope generator
 *   - One-pole and biquad filters (low-pass, high-pass, band-pass, notch)
 *   - Hard + soft clip, tanh saturation
 *   - Stereo panning
 *   - WAV file builder (44-byte header, 16-bit or 24-bit PCM)
 *
 * All synthesis runs at SAMPLE_RATE (48 kHz). The engine is designed to run
 * server-side in a Next.js API route — no browser APIs required.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const SAMPLE_RATE = 48000;          // 48 kHz — studio standard
export const TWO_PI = 2 * Math.PI;

// ─── Sample Buffer ─────────────────────────────────────────────────────────

/** Allocate a Float32 stereo buffer [left[], right[]] for `durationSec` seconds */
export function allocBuffer(durationSec: number): [Float64Array, Float64Array] {
  const len = Math.ceil(SAMPLE_RATE * durationSec);
  return [new Float64Array(len), new Float64Array(len)];
}

/** Mix src into dst starting at sample `offset`, scaling src by `gain` */
export function mixInto(
  dst: Float64Array,
  src: Float64Array,
  offset = 0,
  gain = 1.0
): void {
  const end = Math.min(dst.length, offset + src.length);
  for (let i = offset; i < end; i++) {
    dst[i] += src[i - offset] * gain;
  }
}

/** Normalise a buffer so its peak is exactly `targetPeak` (default 0.98) */
export function normalisePeak(buf: Float64Array, targetPeak = 0.98): void {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    const abs = Math.abs(buf[i]);
    if (abs > peak) peak = abs;
  }
  if (peak < 1e-9) return;
  const scale = targetPeak / peak;
  for (let i = 0; i < buf.length; i++) buf[i] *= scale;
}

// ─── Oscillators ─────────────────────────────────────────────────────────────

export function sineWave(phase: number): number {
  return Math.sin(phase);
}

export function sawWave(phase: number): number {
  // Normalised sawtooth: -1 to +1
  return 1.0 - (phase % TWO_PI) / Math.PI;
}

export function squareWave(phase: number, pwm = 0.5): number {
  return (phase % TWO_PI) / TWO_PI < pwm ? 1.0 : -1.0;
}

export function triangleWave(phase: number): number {
  const t = (phase % TWO_PI) / TWO_PI;
  return t < 0.5 ? 4 * t - 1 : 3 - 4 * t;
}

/** White noise — uniformly distributed -1 to +1 */
export function whiteNoise(): number {
  return Math.random() * 2 - 1;
}

/** Pink noise approximation via Paul Kellett's method */
export class PinkNoise {
  private b0 = 0; private b1 = 0; private b2 = 0;
  private b3 = 0; private b4 = 0; private b5 = 0; private b6 = 0;

  next(): number {
    const white = whiteNoise();
    this.b0 = 0.99886 * this.b0 + white * 0.0555179;
    this.b1 = 0.99332 * this.b1 + white * 0.0750759;
    this.b2 = 0.96900 * this.b2 + white * 0.1538520;
    this.b3 = 0.86650 * this.b3 + white * 0.3104856;
    this.b4 = 0.55000 * this.b4 + white * 0.5329522;
    this.b5 = -0.7616 * this.b5 - white * 0.0168980;
    this.b6 = white * 0.115926;
    return (this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362) * 0.11;
  }
}

// ─── ADSR Envelope ────────────────────────────────────────────────────────────

export interface AdsrParams {
  attackSec: number;
  decaySec: number;
  sustainLevel: number;  // 0.0 – 1.0
  releaseSec: number;
}

/**
 * Generate a complete ADSR envelope as a Float64Array.
 * `durationSec` is the total note length (attack + decay + sustain + release).
 */
export function makeAdsr(params: AdsrParams, durationSec: number): Float64Array {
  const len = Math.ceil(SAMPLE_RATE * durationSec);
  const env = new Float64Array(len);

  const aSamples = Math.ceil(params.attackSec * SAMPLE_RATE);
  const dSamples = Math.ceil(params.decaySec * SAMPLE_RATE);
  const rSamples = Math.ceil(params.releaseSec * SAMPLE_RATE);
  const sEnd = Math.max(0, len - rSamples);

  for (let i = 0; i < len; i++) {
    if (i < aSamples) {
      env[i] = i / aSamples;
    } else if (i < aSamples + dSamples) {
      const t = (i - aSamples) / dSamples;
      env[i] = 1.0 - t * (1.0 - params.sustainLevel);
    } else if (i < sEnd) {
      env[i] = params.sustainLevel;
    } else {
      const t = (i - sEnd) / rSamples;
      env[i] = params.sustainLevel * (1.0 - t);
    }
  }

  return env;
}

// ─── Biquad Filter ────────────────────────────────────────────────────────────

export type FilterType = "lowpass" | "highpass" | "bandpass" | "notch" | "peak";

export interface FilterState {
  b0: number; b1: number; b2: number;
  a1: number; a2: number;
  x1: number; x2: number;
  y1: number; y2: number;
}

/** Compute biquad coefficients — Robert Bristow-Johnson Audio EQ Cookbook */
export function makeBiquad(
  type: FilterType,
  freqHz: number,
  q = 0.707,
  gainDb = 0.0
): FilterState {
  const w0 = TWO_PI * freqHz / SAMPLE_RATE;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * q);

  let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;

  switch (type) {
    case "lowpass":
      b0 = (1 - cosW0) / 2; b1 = 1 - cosW0; b2 = (1 - cosW0) / 2;
      a0 = 1 + alpha; a1 = -2 * cosW0; a2 = 1 - alpha;
      break;
    case "highpass":
      b0 = (1 + cosW0) / 2; b1 = -(1 + cosW0); b2 = (1 + cosW0) / 2;
      a0 = 1 + alpha; a1 = -2 * cosW0; a2 = 1 - alpha;
      break;
    case "bandpass":
      b0 = sinW0 / 2; b1 = 0; b2 = -sinW0 / 2;
      a0 = 1 + alpha; a1 = -2 * cosW0; a2 = 1 - alpha;
      break;
    case "notch":
      b0 = 1; b1 = -2 * cosW0; b2 = 1;
      a0 = 1 + alpha; a1 = -2 * cosW0; a2 = 1 - alpha;
      break;
    case "peak": {
      const A = Math.pow(10, gainDb / 40);
      b0 = 1 + alpha * A; b1 = -2 * cosW0; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * cosW0; a2 = 1 - alpha / A;
      break;
    }
  }

  return {
    b0: b0 / a0, b1: b1 / a0, b2: b2 / a0,
    a1: a1 / a0, a2: a2 / a0,
    x1: 0, x2: 0, y1: 0, y2: 0,
  };
}

/** Process one sample through a biquad filter (mutates state) */
export function processBiquad(state: FilterState, x: number): number {
  const y = state.b0 * x + state.b1 * state.x1 + state.b2 * state.x2
            - state.a1 * state.y1 - state.a2 * state.y2;
  state.x2 = state.x1; state.x1 = x;
  state.y2 = state.y1; state.y1 = y;
  return y;
}

/** Process an entire buffer through a biquad in-place */
export function filterBuffer(buf: Float64Array, state: FilterState): void {
  for (let i = 0; i < buf.length; i++) {
    buf[i] = processBiquad(state, buf[i]);
  }
}

// ─── Saturation / Clipping ───────────────────────────────────────────────────

/** Soft clip via tanh — smooth analogue saturation */
export function tanhSaturate(buf: Float64Array, drive = 1.0): void {
  for (let i = 0; i < buf.length; i++) {
    buf[i] = Math.tanh(buf[i] * drive) / Math.tanh(drive);
  }
}

/** Hard clip at ±ceiling */
export function hardClip(buf: Float64Array, ceiling = 1.0): void {
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] > ceiling) buf[i] = ceiling;
    else if (buf[i] < -ceiling) buf[i] = -ceiling;
  }
}

// ─── Stereo Panning ───────────────────────────────────────────────────────────

/**
 * Convert a mono buffer to stereo using constant-power panning.
 * pan: -1 = full left, 0 = centre, +1 = full right.
 */
export function panMono(
  mono: Float64Array,
  pan = 0.0
): [Float64Array, Float64Array] {
  const angle = (pan + 1) * Math.PI / 4; // 0 → π/2
  const gainL = Math.cos(angle);
  const gainR = Math.sin(angle);
  const L = new Float64Array(mono.length);
  const R = new Float64Array(mono.length);
  for (let i = 0; i < mono.length; i++) {
    L[i] = mono[i] * gainL;
    R[i] = mono[i] * gainR;
  }
  return [L, R];
}

// ─── Delay Line ───────────────────────────────────────────────────────────────

export class DelayLine {
  private buffer: Float64Array;
  private pos = 0;

  constructor(maxDelaySec: number) {
    this.buffer = new Float64Array(Math.ceil(SAMPLE_RATE * maxDelaySec) + 1);
  }

  process(input: number, delaySamples: number, feedback = 0.0): number {
    const readPos = (this.pos - Math.round(delaySamples) + this.buffer.length) % this.buffer.length;
    const delayed = this.buffer[readPos];
    this.buffer[this.pos] = input + delayed * feedback;
    this.pos = (this.pos + 1) % this.buffer.length;
    return delayed;
  }
}

// ─── Algorithmic Reverb (Schroeder / Freeverb simplified) ────────────────────

export class SimpleReverb {
  private delays: DelayLine[];
  private allpass: DelayLine[];
  private wet: number;
  private decay: number;

  constructor(roomSize = 0.5, wetMix = 0.25) {
    this.wet = wetMix;
    this.decay = 0.4 + roomSize * 0.5;
    // Comb filters at prime-ish delay lengths
    this.delays = [
      new DelayLine(0.1), new DelayLine(0.1),
      new DelayLine(0.1), new DelayLine(0.1),
    ];
    this.allpass = [new DelayLine(0.05), new DelayLine(0.05)];
  }

  process(input: number): number {
    const combs = [
      this.delays[0].process(input, 1557, this.decay),
      this.delays[1].process(input, 1617, this.decay),
      this.delays[2].process(input, 1491, this.decay),
      this.delays[3].process(input, 1422, this.decay),
    ];
    let sum = (combs[0] + combs[1] + combs[2] + combs[3]) * 0.25;
    sum = this.allpass[0].process(sum, 556, 0.5);
    sum = this.allpass[1].process(sum, 441, 0.5);
    return input * (1 - this.wet) + sum * this.wet;
  }
}

// ─── WAV File Writer ──────────────────────────────────────────────────────────

export interface WavOptions {
  sampleRate?: number;      // Default 48000
  bitDepth?: 16 | 24;       // Default 24
  channels?: 1 | 2;         // Default 1 (mono) — pass 2 stereo arrays via encodeWavStereo
}

/**
 * Encode a mono Float64Array as a WAV Buffer.
 * Samples must be in [-1, +1]. Values outside are hard-clipped.
 */
export function encodeWavMono(samples: Float64Array, opts: WavOptions = {}): Buffer {
  const sr = opts.sampleRate ?? SAMPLE_RATE;
  const bd = opts.bitDepth ?? 24;
  const bytesPerSample = bd / 8;
  const dataBytes = samples.length * bytesPerSample;
  const buf = Buffer.alloc(44 + dataBytes);

  // RIFF header
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);                     // PCM chunk size
  buf.writeUInt16LE(1, 20);                      // AudioFormat = PCM
  buf.writeUInt16LE(1, 22);                      // NumChannels
  buf.writeUInt32LE(sr, 24);                     // SampleRate
  buf.writeUInt32LE(sr * bytesPerSample, 28);    // ByteRate
  buf.writeUInt16LE(bytesPerSample, 32);         // BlockAlign
  buf.writeUInt16LE(bd, 34);                     // BitsPerSample
  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);

  if (bd === 16) {
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
    }
  } else {
    // 24-bit — write 3 bytes per sample little-endian
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      const v = Math.round(s * 8388607); // 2^23 - 1
      const offset = 44 + i * 3;
      buf[offset]     = v & 0xFF;
      buf[offset + 1] = (v >> 8) & 0xFF;
      buf[offset + 2] = (v >> 16) & 0xFF;
    }
  }

  return buf;
}

/**
 * Encode a stereo pair [left, right] as an interleaved WAV Buffer.
 * Both arrays must be the same length.
 */
export function encodeWavStereo(
  left: Float64Array,
  right: Float64Array,
  opts: WavOptions = {}
): Buffer {
  const sr = opts.sampleRate ?? SAMPLE_RATE;
  const bd = opts.bitDepth ?? 24;
  const bytesPerSample = bd / 8;
  const numSamples = Math.min(left.length, right.length);
  const dataBytes = numSamples * 2 * bytesPerSample;
  const buf = Buffer.alloc(44 + dataBytes);

  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);                           // stereo
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2 * bytesPerSample, 28);
  buf.writeUInt16LE(2 * bytesPerSample, 32);
  buf.writeUInt16LE(bd, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);

  if (bd === 16) {
    for (let i = 0; i < numSamples; i++) {
      const l = Math.max(-1, Math.min(1, left[i]));
      const r = Math.max(-1, Math.min(1, right[i]));
      buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
      buf.writeInt16LE(Math.round(r * 32767), 44 + i * 4 + 2);
    }
  } else {
    for (let i = 0; i < numSamples; i++) {
      const l = Math.max(-1, Math.min(1, left[i]));
      const r = Math.max(-1, Math.min(1, right[i]));
      const lv = Math.round(l * 8388607);
      const rv = Math.round(r * 8388607);
      const off = 44 + i * 6;
      buf[off]     = lv & 0xFF;        buf[off + 1] = (lv >> 8) & 0xFF; buf[off + 2] = (lv >> 16) & 0xFF;
      buf[off + 3] = rv & 0xFF;        buf[off + 4] = (rv >> 8) & 0xFF; buf[off + 5] = (rv >> 16) & 0xFF;
    }
  }

  return buf;
}
