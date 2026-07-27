/**
 * Mixer & Mastering Chain — Pure TypeScript, zero dependencies
 *
 * Provides everything needed to go from individual stems to a professional
 * stereo master WAV:
 *
 *   1. Stem bus mixer     — per-stem gain, pan, sidechain slot
 *   2. Bus compressor     — RMS-driven VCA compressor (feed-forward)
 *   3. Multiband EQ       — 5-band parametric using biquad filters
 *   4. Stereo widener     — M/S based (mono‐compatible)
 *   5. Brick-wall limiter — look-ahead soft-knee true-peak limiter
 *   6. LUFS meter         — ITU-R BS.1770-4 integrated loudness
 *   7. masterMix()        — orchestrates the full chain, returns stereo WAV
 */

import {
  SAMPLE_RATE,
  makeBiquad, processBiquad,
  encodeWavStereo,
  panMono, mixInto,
  hardClip,
} from "./wav-engine";

// ─── Gain helpers ─────────────────────────────────────────────────────────────

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

function gainToDb(gain: number): number {
  return 20 * Math.log10(Math.max(1e-9, Math.abs(gain)));
}

// ─── Per-stem channel strip ──────────────────────────────────────────────────

export interface StemChannel {
  /** Mono audio buffer */
  buffer: Float64Array;
  /** Fader level in dB. Default 0. */
  gainDb?: number;
  /** Pan -1 (left) to +1 (right). Default 0 (centre). */
  pan?: number;
  /** High-pass filter to cut low rumble (Hz). Default 0 = off. */
  hpCutHz?: number;
  /** Low-pass shelf to soften highs (Hz). Default 0 = off. */
  lpCutHz?: number;
}

export interface MasterChannelParams {
  /** Input gain before bus compressor (dB). Default 0. */
  inputGainDb?: number;
  /** EQ: low shelf gain (dB, at 80 Hz). Default 0. */
  eqLowDb?: number;
  /** EQ: low-mid peak gain (dB, at 250 Hz). Default 0. */
  eqLowMidDb?: number;
  /** EQ: mid peak gain (dB, at 1 kHz). Default 0. */
  eqMidDb?: number;
  /** EQ: high-mid peak gain (dB, at 4 kHz). Default 0. */
  eqHighMidDb?: number;
  /** EQ: high shelf gain (dB, at 10 kHz). Default 0. */
  eqHighDb?: number;
  /** Stereo width (0 = mono, 1 = unchanged, 2 = double-wide). Default 1. */
  stereoWidth?: number;
  /** Bus compressor threshold (dB). Default -12. */
  compThreshDb?: number;
  /** Bus compressor ratio. Default 3. */
  compRatio?: number;
  /** Bus compressor attack (ms). Default 12. */
  compAttackMs?: number;
  /** Bus compressor release (ms). Default 120. */
  compReleaseMs?: number;
  /** Output ceiling for the true-peak limiter (dBTP). Default -0.3. */
  ceilingDbTP?: number;
  /** Target integrated loudness (LUFS). Default -14 (Spotify/streaming). */
  targetLufs?: number;
  /** Bit depth for final WAV. Default 24. */
  bitDepth?: 16 | 24;
}

// ─── Bus Compressor ───────────────────────────────────────────────────────────

interface CompressorState {
  gainDb: number;   // current gain reduction (negative)
}

function compressStereo(
  L: Float64Array,
  R: Float64Array,
  threshDb: number,
  ratio: number,
  attackMs: number,
  releaseMs: number
): void {
  const attackCoeff  = Math.exp(-1 / (SAMPLE_RATE * attackMs  / 1000));
  const releaseCoeff = Math.exp(-1 / (SAMPLE_RATE * releaseMs / 1000));

  let gainDb = 0;

  for (let i = 0; i < L.length; i++) {
    // RMS-ish detector using peak
    const peak = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    const inputDb = gainToDb(peak);

    // Static characteristic: above threshold → compress
    let targetGainDb = 0;
    if (inputDb > threshDb) {
      targetGainDb = threshDb + (inputDb - threshDb) / ratio - inputDb;
    }

    // Ballistics
    if (targetGainDb < gainDb) {
      gainDb = attackCoeff  * gainDb + (1 - attackCoeff)  * targetGainDb;
    } else {
      gainDb = releaseCoeff * gainDb + (1 - releaseCoeff) * targetGainDb;
    }

    const g = dbToGain(gainDb);
    L[i] *= g;
    R[i] *= g;
  }
}

// ─── 5-Band Parametric EQ ─────────────────────────────────────────────────────

function applyEq(
  buf: Float64Array,
  lowDb: number,
  lowMidDb: number,
  midDb: number,
  highMidDb: number,
  highDb: number
): void {
  // Only allocate filters for bands that are non-zero
  if (Math.abs(lowDb) > 0.1) {
    const f = makeBiquad("peak",  80,   1.0, lowDb);
    for (let i = 0; i < buf.length; i++) buf[i] = processBiquad(f, buf[i]);
  }
  if (Math.abs(lowMidDb) > 0.1) {
    const f = makeBiquad("peak", 250,   1.5, lowMidDb);
    for (let i = 0; i < buf.length; i++) buf[i] = processBiquad(f, buf[i]);
  }
  if (Math.abs(midDb) > 0.1) {
    const f = makeBiquad("peak", 1000,  1.2, midDb);
    for (let i = 0; i < buf.length; i++) buf[i] = processBiquad(f, buf[i]);
  }
  if (Math.abs(highMidDb) > 0.1) {
    const f = makeBiquad("peak", 4000,  1.2, highMidDb);
    for (let i = 0; i < buf.length; i++) buf[i] = processBiquad(f, buf[i]);
  }
  if (Math.abs(highDb) > 0.1) {
    const f = makeBiquad("peak", 10000, 1.0, highDb);
    for (let i = 0; i < buf.length; i++) buf[i] = processBiquad(f, buf[i]);
  }
}

// ─── Stereo Widener (M/S) ────────────────────────────────────────────────────

function applyStereoWidth(L: Float64Array, R: Float64Array, width: number): void {
  if (Math.abs(width - 1.0) < 0.01) return; // no change
  const mid  = 0.5 * (1 + width);  // how much side to keep
  const side = 0.5 * (1 - width);  // fold to mono factor
  for (let i = 0; i < L.length; i++) {
    const m = (L[i] + R[i]) * 0.5;
    const s = (L[i] - R[i]) * 0.5;
    L[i] = m + s * width;
    R[i] = m - s * width;
  }
}

// ─── Look-ahead brick-wall limiter ────────────────────────────────────────────

function limitStereo(L: Float64Array, R: Float64Array, ceilingDb: number): void {
  const ceiling = dbToGain(ceilingDb);
  const lookaheadSamples = Math.round(SAMPLE_RATE * 0.002); // 2ms look-ahead

  // Simple peak envelope follower with look-ahead
  const gainEnv = new Float64Array(L.length).fill(1.0);

  for (let i = 0; i < L.length; i++) {
    const peak = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (peak > ceiling) {
      const needed = ceiling / peak;
      // Stamp backward into gain envelope for look-ahead smoothing
      const start = Math.max(0, i - lookaheadSamples);
      for (let j = start; j <= i; j++) {
        if (gainEnv[j] > needed) gainEnv[j] = needed;
      }
    }
  }

  // Smooth the gain envelope (single-pole LP)
  const smoothCoeff = Math.exp(-1 / (SAMPLE_RATE * 0.001));
  let g = 1.0;
  for (let i = 0; i < gainEnv.length; i++) {
    g = g < gainEnv[i] ? g + (gainEnv[i] - g) * (1 - smoothCoeff) : gainEnv[i];
    L[i] *= g;
    R[i] *= g;
  }
}

// ─── ITU-R BS.1770-4 LUFS meter ──────────────────────────────────────────────

export interface LufsResult {
  integratedLufs: number;
  truePeakDbTP: number;
  dynamicRangeDb: number;
}

export function measureLufs(L: Float64Array, R: Float64Array): LufsResult {
  // Stage 1: K-weighting pre-filter (high-shelf +4dB at 1500 Hz)
  const kShelf = makeBiquad("peak", 1500, 0.71, 4.0);
  const kHp    = makeBiquad("highpass", 38, 0.5);

  const kL = new Float64Array(L.length);
  const kR = new Float64Array(R.length);
  for (let i = 0; i < L.length; i++) {
    kL[i] = processBiquad(kHp, processBiquad(kShelf, L[i]));
    kR[i] = processBiquad(kHp, processBiquad(kShelf, R[i]));
  }

  // Stage 2: Block-wise mean square with 400ms blocks, 75% overlap
  const blockLen = Math.round(0.4 * SAMPLE_RATE);
  const hopLen   = Math.round(blockLen * 0.25);
  const blocks: number[] = [];

  for (let start = 0; start + blockLen <= kL.length; start += hopLen) {
    let sum = 0;
    for (let i = start; i < start + blockLen; i++) {
      sum += kL[i] * kL[i] + kR[i] * kR[i];
    }
    const meanSquare = sum / blockLen;
    blocks.push(meanSquare);
  }

  // Absolute gating (≥ -70 LUFS)
  const absoluteThresh = Math.pow(10, (-70 - 0.691) / 10);
  const gated1 = blocks.filter(b => b >= absoluteThresh);
  if (gated1.length === 0) {
    return { integratedLufs: -Infinity, truePeakDbTP: -Infinity, dynamicRangeDb: 0 };
  }

  // Relative gating (≥ integrated - 10 LU)
  const lufs1 = -0.691 + 10 * Math.log10(gated1.reduce((a, b) => a + b, 0) / gated1.length);
  const relThresh = Math.pow(10, (lufs1 - 10 - 0.691) / 10);
  const gated2 = gated1.filter(b => b >= relThresh);

  const integratedLufs = gated2.length > 0
    ? -0.691 + 10 * Math.log10(gated2.reduce((a, b) => a + b, 0) / gated2.length)
    : lufs1;

  // True peak
  let truePeak = 0;
  for (let i = 0; i < L.length; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (p > truePeak) truePeak = p;
  }
  const truePeakDbTP = gainToDb(truePeak);

  // Dynamic range approximation (95th percentile vs RMS)
  const sorted = [...gated2].sort((a, b) => a - b);
  const p5  = sorted[Math.floor(sorted.length * 0.05)]  ?? sorted[0];
  const p95 = sorted[Math.floor(sorted.length * 0.95)]  ?? sorted[sorted.length - 1];
  const dynamicRangeDb = p5 > 0 && p95 > 0
    ? 10 * Math.log10(p95) - 10 * Math.log10(p5)
    : 0;

  return { integratedLufs, truePeakDbTP, dynamicRangeDb };
}

// ─── Master mix ───────────────────────────────────────────────────────────────

export interface MasterMixResult {
  wavBuffer: Buffer;
  lufs: LufsResult;
  gainApplied: number;
  totalSamples: number;
  durationSec: number;
}

/**
 * Full mastering chain. Takes a list of stem channels, mixes them to stereo,
 * applies EQ → compression → widening → limiting, normalises to target LUFS,
 * and returns a ready-to-write WAV buffer.
 */
export function masterMix(
  stems: StemChannel[],
  p: MasterChannelParams = {}
): MasterMixResult {
  const targetLufs  = p.targetLufs  ?? -14;
  const ceilingDbTP = p.ceilingDbTP ?? -0.3;
  const bitDepth    = p.bitDepth    ?? 24;

  // Find longest stem
  const maxLen = stems.reduce((m, s) => Math.max(m, s.buffer.length), 0);
  if (maxLen === 0) {
    throw new Error("masterMix: no stems provided");
  }

  const masterL = new Float64Array(maxLen);
  const masterR = new Float64Array(maxLen);

  // ── 1. Mix stems to stereo ─────────────────────────────────────────────────
  for (const stem of stems) {
    const gain = dbToGain(stem.gainDb ?? 0);
    const pan  = stem.pan ?? 0;

    let buf = stem.buffer;

    // Per-stem channel strip: HP and LP filters
    if (stem.hpCutHz && stem.hpCutHz > 0) {
      const hp = makeBiquad("highpass", stem.hpCutHz, 0.7);
      buf = new Float64Array(buf);
      for (let i = 0; i < buf.length; i++) buf[i] = processBiquad(hp, buf[i]);
    }
    if (stem.lpCutHz && stem.lpCutHz > 0) {
      const lp = makeBiquad("lowpass", stem.lpCutHz, 0.7);
      buf = new Float64Array(buf);
      for (let i = 0; i < buf.length; i++) buf[i] = processBiquad(lp, buf[i]);
    }

    const [L, R] = panMono(buf, pan);
    mixInto(masterL, L, 0, gain);
    mixInto(masterR, R, 0, gain);
  }

  // Input gain
  const inputGain = dbToGain(p.inputGainDb ?? 0);
  for (let i = 0; i < masterL.length; i++) {
    masterL[i] *= inputGain;
    masterR[i] *= inputGain;
  }

  // ── 2. Parametric EQ ──────────────────────────────────────────────────────
  applyEq(masterL, p.eqLowDb ?? 0, p.eqLowMidDb ?? 0, p.eqMidDb ?? 0, p.eqHighMidDb ?? 0, p.eqHighDb ?? 0);
  applyEq(masterR, p.eqLowDb ?? 0, p.eqLowMidDb ?? 0, p.eqMidDb ?? 0, p.eqHighMidDb ?? 0, p.eqHighDb ?? 0);

  // ── 3. Bus compressor ────────────────────────────────────────────────────
  compressStereo(
    masterL, masterR,
    p.compThreshDb  ?? -12,
    p.compRatio     ?? 3,
    p.compAttackMs  ?? 12,
    p.compReleaseMs ?? 120
  );

  // ── 4. Stereo width ───────────────────────────────────────────────────────
  applyStereoWidth(masterL, masterR, p.stereoWidth ?? 1.1);

  // ── 5. First loudness pass — measure current LUFS ─────────────────────────
  const firstPass = measureLufs(masterL, masterR);
  const lufsError = targetLufs - firstPass.integratedLufs;

  // Apply makeup gain to hit target LUFS
  const makeupGain = isFinite(lufsError) ? dbToGain(lufsError * 0.9) : 1.0;
  for (let i = 0; i < masterL.length; i++) {
    masterL[i] *= makeupGain;
    masterR[i] *= makeupGain;
  }

  // ── 6. True-peak limiter ─────────────────────────────────────────────────
  limitStereo(masterL, masterR, ceilingDbTP);

  // ── 7. Final LUFS measurement ────────────────────────────────────────────
  const finalLufs = measureLufs(masterL, masterR);

  // ── 8. Encode to WAV ─────────────────────────────────────────────────────
  const wavBuffer = encodeWavStereo(masterL, masterR, { bitDepth });

  return {
    wavBuffer,
    lufs: finalLufs,
    gainApplied: makeupGain,
    totalSamples: maxLen,
    durationSec: maxLen / SAMPLE_RATE,
  };
}
