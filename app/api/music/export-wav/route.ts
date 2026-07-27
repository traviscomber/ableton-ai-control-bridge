/**
 * POST /api/music/export-wav
 *
 * Final export stage. Runs ComplianceChecker, calculates final quality scores,
 * assembles the WAV metadata spec, and advances production status to "exported".
 *
 * In a real pipeline this would trigger a render job (e.g. via a worker that
 * calls a DAW render engine or headless audio processor). Here we produce the
 * complete WAV specification + Ableton export instructions so the engineer can
 * execute the final bounce.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeComplianceCheckerAgent } from "@/lib/agents/compliance-checker";
import type { QualityScores } from "@/lib/music-schema";

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { production_id } = body;

    if (!production_id) {
      return NextResponse.json({ error: "production_id is required" }, { status: 400 });
    }

    // 1. Fetch full production
    const { data: production, error: prodError } = await supabase
      .from("music_productions")
      .select("*")
      .eq("id", production_id)
      .single();

    if (prodError || !production) {
      return NextResponse.json({ error: "Production not found" }, { status: 404 });
    }

    if (!production.openai_structure || !production.arrangement_data) {
      return NextResponse.json(
        { error: "Run analyze-reasoning and generate-midi first" },
        { status: 400 }
      );
    }

    // 2. Count MIDI tracks
    const { count: midiTracksCount } = await supabase
      .from("midi_tracks")
      .select("id", { count: "exact", head: true })
      .eq("production_id", production_id);

    // 3. Fetch stems count
    let stemsCount = 0;
    if (production.soundbank_id) {
      const { count } = await supabase
        .from("stems")
        .select("id", { count: "exact", head: true })
        .eq("soundbank_id", production.soundbank_id);
      stemsCount = count ?? 0;
    }

    // 4. Get WAV spec from arrangement_data
    const arrangement = production.arrangement_data as {
      mixing_chain?: { master?: { loudness_target?: number } };
      timeline?: unknown[];
    };
    const targetLufs = arrangement?.mixing_chain?.master?.loudness_target ?? -14;
    const durationSeconds = production.bpm
      ? (((production.midi_metadata as { total_bars?: number } | null)?.total_bars ?? 64) * 4 * 60) / production.bpm
      : 180;

    // 5. Run ComplianceChecker
    const complianceResult = await executeComplianceCheckerAgent({
      loudness_lufs: targetLufs,
      headroom_db: -6,
      true_peak_dbtp: -1.0,
      sample_rate: 48000,
      bit_depth: 24,
      duration_seconds: durationSeconds,
      style: production.style,
      bpm: production.bpm,
      key: production.key,
      stems_count: stemsCount,
      midi_tracks_count: midiTracksCount ?? 0,
      arrangement_sections: (arrangement?.timeline as unknown[])?.length ?? 0,
    });

    // 6. Calculate final quality scores
    const structure = production.openai_structure as {
      sections?: unknown[];
      chords?: unknown[];
      midi_plan?: { tracks?: unknown[] };
    };
    const existingScores = (production.quality_scores ?? {}) as Partial<QualityScores>;

    const reasoningCoherence = production.reasoning_tokens > 0 ? 95 : 70;
    const midiAccuracy = (midiTracksCount ?? 0) >= 4 ? 90 : 65;
    const arrangementIntegrity = existingScores.arrangement_integrity ?? 80;
    const audioEngineering = existingScores.audio_engineering ?? 80;
    const compliance = complianceResult.quality_scores.compliance ?? 85;
    const venomFinal = Math.round(
      (reasoningCoherence * 0.2) +
      (midiAccuracy * 0.2) +
      (arrangementIntegrity * 0.2) +
      (audioEngineering * 0.2) +
      (compliance * 0.2)
    );

    const gatesPassed = [
      reasoningCoherence >= 80,
      midiAccuracy >= 80,
      arrangementIntegrity >= 80,
      audioEngineering >= 70,
      compliance >= 80,
      venomFinal >= 75,
    ].filter(Boolean).length;

    const finalScores: QualityScores = {
      reasoning_coherence: reasoningCoherence,
      midi_accuracy: midiAccuracy,
      arrangement_integrity: arrangementIntegrity,
      audio_engineering: audioEngineering,
      compliance,
      venom_final: venomFinal,
      overall: venomFinal,
      gates_passed: gatesPassed,
      gates_total: 6,
    };

    // 7. Assemble WAV metadata
    const wavMetadata = {
      sample_rate: 48000,
      bit_depth: 24,
      channels: 2,
      duration_seconds: durationSeconds,
      file_size_bytes: Math.round(durationSeconds * 48000 * 2 * 3), // 24-bit stereo estimate
      loudness_lufs: targetLufs,
      headroom_db: -6,
      platform: "stereo-master",
      mastering_chain: (production.openai_structure as { quality_target?: { mastering_chain?: string[] } })
        ?.quality_target?.mastering_chain ?? ["EQ", "Multiband Compressor", "Limiter"],
      export_date: new Date().toISOString(),
    };

    // 8. Update production to exported
    const { data: updated, error: updateError } = await supabase
      .from("music_productions")
      .update({
        wav_path: `wav/${production_id}/master.wav`,
        wav_metadata: wavMetadata,
        loudness_lufs: targetLufs,
        headroom_db: -6,
        quality_scores: finalScores,
        status: "exported",
        updated_at: new Date().toISOString(),
      })
      .eq("id", production_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 9. Build complete export package
    const abletonExport = production.arrangement_data as {
      ableton_export?: Record<string, unknown>;
      mixing_chain?: Record<string, unknown>;
    };

    return NextResponse.json({
      success: true,
      production: updated,
      export_package: {
        wav_spec: wavMetadata,
        compliance: {
          overall: complianceResult.overall_compliant,
          release_ready: complianceResult.release_ready,
          platforms: complianceResult.platforms,
          darksco_standard: complianceResult.darksco_standard,
          report: complianceResult.compliance_report,
        },
        quality_scores: finalScores,
        ableton_project: {
          project_name: abletonExport?.ableton_export?.project_name ?? `DARKSCO_${Date.now()}`,
          tempo: production.bpm,
          key: production.key,
          total_bars: (production.midi_metadata as { total_bars?: number } | null)?.total_bars ?? 64,
          midi_tracks: midiTracksCount ?? 0,
          stems_used: stemsCount,
          export_steps: [
            "1. Open project in Ableton Live 11/12",
            "2. Load MIDI tracks from midi_path onto MIDI channels",
            "3. Assign soundbank WAV stems to each Simpler/Sampler instrument",
            "4. Apply mixing_chain processing per stem (see arrangement_data)",
            "5. Set master chain: EQ → Multiband Comp → Limiter (ceiling -0.3dBTP)",
            `6. Render master stereo WAV: 48kHz / 24-bit / -14 LUFS`,
            "7. Run loudness normalization to target LUFS",
            "8. Export individual stem WAV files for distribution",
          ],
          mixing_chain: abletonExport?.mixing_chain ?? {},
        },
        wav_file: {
          path: `wav/${production_id}/master.wav`,
          size_mb: (wavMetadata.file_size_bytes / 1024 / 1024).toFixed(1),
          duration: `${Math.floor(durationSeconds / 60)}:${Math.round(durationSeconds % 60).toString().padStart(2, "0")}`,
          format: "48kHz / 24-bit / Stereo / WAV",
          loudness: `${targetLufs} LUFS`,
        },
      },
    });
  } catch (err) {
    console.error("[v0] export-wav error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
