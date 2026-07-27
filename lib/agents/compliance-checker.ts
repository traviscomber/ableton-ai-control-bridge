/**
 * ComplianceChecker Agent
 *
 * Validates the final production against major streaming platform requirements
 * (Spotify, Apple Music, YouTube, Bandcamp, Beatport, SoundCloud) and
 * DARKSCO release standards.
 *
 * Gate: all platforms green before WAV export is approved.
 */

import type { WavMetadata, QualityScores } from "@/lib/music-schema";

export interface ComplianceCheckerInput {
  loudness_lufs: number;
  headroom_db: number;
  true_peak_dbtp: number;
  sample_rate: number;
  bit_depth: number;
  duration_seconds: number;
  style: string;
  bpm: number;
  key: string;
  stems_count: number;
  midi_tracks_count: number;
  arrangement_sections: number;
}

export interface ComplianceCheckerResponse {
  platforms: PlatformResult[];
  darksco_standard: DARKSCOStandard;
  overall_compliant: boolean;
  quality_scores: Partial<QualityScores>;
  compliance_report: string;
  release_ready: boolean;
}

interface PlatformResult {
  platform: string;
  compliant: boolean;
  loudness_ok: boolean;
  true_peak_ok: boolean;
  format_ok: boolean;
  notes: string;
  loudness_target: string;
  action_required?: string;
}

interface DARKSCOStandard {
  compliant: boolean;
  style_verified: boolean;
  stems_complete: boolean;
  midi_complete: boolean;
  arrangement_complete: boolean;
  professional_grade: boolean;
  score: number;
  notes: string[];
}

// ─── Platform Requirements ────────────────────────────────────────────

const PLATFORM_REQUIREMENTS = [
  {
    platform: "Spotify",
    target_lufs: -14,
    max_true_peak: -1.0,
    tolerance: 1.0,
    min_sample_rate: 44100,
    min_bit_depth: 16,
  },
  {
    platform: "Apple Music",
    target_lufs: -16,
    max_true_peak: -1.0,
    tolerance: 1.0,
    min_sample_rate: 44100,
    min_bit_depth: 16,
  },
  {
    platform: "YouTube",
    target_lufs: -14,
    max_true_peak: -1.0,
    tolerance: 2.0,
    min_sample_rate: 44100,
    min_bit_depth: 16,
  },
  {
    platform: "Beatport",
    target_lufs: -8,
    max_true_peak: -0.3,
    tolerance: 2.0,
    min_sample_rate: 44100,
    min_bit_depth: 16,
  },
  {
    platform: "SoundCloud",
    target_lufs: -14,
    max_true_peak: -1.0,
    tolerance: 2.0,
    min_sample_rate: 44100,
    min_bit_depth: 16,
  },
  {
    platform: "Bandcamp",
    target_lufs: -14,
    max_true_peak: -0.1,
    tolerance: 3.0,
    min_sample_rate: 44100,
    min_bit_depth: 16,
  },
] as const;

// ─── Compliance Checks ────────────────────────────────────────────────

function checkPlatform(
  req: (typeof PLATFORM_REQUIREMENTS)[number],
  input: ComplianceCheckerInput
): PlatformResult {
  const loudnessDiff = Math.abs(input.loudness_lufs - req.target_lufs);
  const loudnessOk = loudnessDiff <= req.tolerance;
  const truePeakOk = input.true_peak_dbtp <= req.max_true_peak;
  const formatOk =
    input.sample_rate >= req.min_sample_rate &&
    input.bit_depth >= req.min_bit_depth;

  const compliant = loudnessOk && truePeakOk && formatOk;

  const actionParts: string[] = [];
  if (!loudnessOk) {
    const diff = input.loudness_lufs - req.target_lufs;
    actionParts.push(
      `Adjust loudness by ${diff > 0 ? "−" : "+"}${Math.abs(diff).toFixed(1)} LUFS to reach ${req.target_lufs} LUFS`
    );
  }
  if (!truePeakOk) {
    actionParts.push(`Reduce true peak to ≤ ${req.max_true_peak} dBTP`);
  }
  if (!formatOk) {
    actionParts.push(`Upgrade format to ≥ ${req.min_sample_rate}Hz / ${req.min_bit_depth}-bit`);
  }

  return {
    platform: req.platform,
    compliant,
    loudness_ok: loudnessOk,
    true_peak_ok: truePeakOk,
    format_ok: formatOk,
    loudness_target: `${req.target_lufs} LUFS ±${req.tolerance}`,
    notes: compliant
      ? `Fully compliant. LUFS: ${input.loudness_lufs}, True Peak: ${input.true_peak_dbtp} dBTP`
      : `Issues: ${actionParts.join("; ")}`,
    action_required: actionParts.length ? actionParts.join("; ") : undefined,
  };
}

function checkDARKSCOStandard(input: ComplianceCheckerInput): DARKSCOStandard {
  const styleVerified = ["darksco", "minimal-techno", "dark-techno", "dark disco", "funk techno"]
    .some(s => input.style.toLowerCase().includes(s));
  const stemsComplete = input.stems_count >= 6;
  const midiComplete = input.midi_tracks_count >= 4;
  const arrangementComplete = input.arrangement_sections >= 4;
  const professionalGrade =
    input.sample_rate >= 48000 &&
    input.bit_depth >= 24 &&
    input.loudness_lufs <= -10 &&
    input.loudness_lufs >= -18;

  const notes: string[] = [];
  if (!styleVerified) notes.push(`Style "${input.style}" not in DARKSCO accepted styles list`);
  if (!stemsComplete) notes.push(`${input.stems_count} stems — minimum 6 required for DARKSCO release`);
  if (!midiComplete) notes.push(`${input.midi_tracks_count} MIDI tracks — minimum 4 required`);
  if (!arrangementComplete) notes.push(`${input.arrangement_sections} arrangement sections — minimum 4 required`);
  if (!professionalGrade) notes.push("Not meeting professional audio grade (48kHz/24-bit, -18 to -10 LUFS)");

  const checks = [styleVerified, stemsComplete, midiComplete, arrangementComplete, professionalGrade];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return {
    compliant: checks.every(Boolean),
    style_verified: styleVerified,
    stems_complete: stemsComplete,
    midi_complete: midiComplete,
    arrangement_complete: arrangementComplete,
    professional_grade: professionalGrade,
    score,
    notes: notes.length ? notes : ["Fully compliant with DARKSCO professional release standards"],
  };
}

// ─── Main Agent ───────────────────────────────────────────────────────

export async function executeComplianceCheckerAgent(
  input: ComplianceCheckerInput
): Promise<ComplianceCheckerResponse> {
  const platformResults = PLATFORM_REQUIREMENTS.map(req => checkPlatform(req, input));
  const darkscoStandard = checkDARKSCOStandard(input);

  const allPlatformsOk = platformResults.every(p => p.compliant);
  const releaseReady = allPlatformsOk && darkscoStandard.compliant;

  const compliantCount = platformResults.filter(p => p.compliant).length;
  const complianceScore = Math.round(
    (compliantCount / platformResults.length) * 70 +
    (darkscoStandard.score / 100) * 30
  );

  const quality_scores: Partial<QualityScores> = {
    compliance: complianceScore,
  };

  const failedPlatforms = platformResults.filter(p => !p.compliant).map(p => p.platform);
  const complianceReport = releaseReady
    ? `Production is fully compliant across all ${platformResults.length} platforms and meets DARKSCO professional release standards. Loudness: ${input.loudness_lufs} LUFS, True Peak: ${input.true_peak_dbtp} dBTP, Format: ${input.sample_rate}Hz/${input.bit_depth}-bit.`
    : `Compliance issues on: ${failedPlatforms.join(", ")}. DARKSCO standard score: ${darkscoStandard.score}/100. ${darkscoStandard.notes.join(". ")}`;

  return {
    platforms: platformResults,
    darksco_standard: darkscoStandard,
    overall_compliant: allPlatformsOk,
    quality_scores,
    compliance_report: complianceReport,
    release_ready: releaseReady,
  };
}
