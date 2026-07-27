/**
 * POST /api/music/generate-midi
 *
 * Runs the MidiComposer + AudioEngineer agents in sequence.
 * Generates MIDI tracks from the OpenAI structure, validates audio engineering
 * specs, and stores the arrangement data and MIDI metadata.
 * Advances production status to "midi" then "arrangement".
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeMidiComposerAgent } from "@/lib/agents/midi-composer";
import { executeAudioEngineerAgent } from "@/lib/agents/audio-engineer";

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { production_id, total_bars = 64 } = body;

    if (!production_id) {
      return NextResponse.json({ error: "production_id is required" }, { status: 400 });
    }

    // 1. Fetch production with openai_structure
    const { data: production, error: prodError } = await supabase
      .from("music_productions")
      .select("*")
      .eq("id", production_id)
      .single();

    if (prodError || !production) {
      return NextResponse.json({ error: "Production not found" }, { status: 404 });
    }

    if (!production.openai_structure) {
      return NextResponse.json(
        { error: "Run analyze-reasoning first to generate the OpenAI structure" },
        { status: 400 }
      );
    }

    // 2. Fetch soundbank stems
    let stems: Array<{
      name: string;
      instrument_type: string;
      frequency_range: [number, number];
      duration_seconds: number;
      category: string;
    }> = [];

    if (production.soundbank_id) {
      const { data: stemData } = await supabase
        .from("stems")
        .select("name, instrument_type, frequency_range, duration_seconds, category")
        .eq("soundbank_id", production.soundbank_id);

      stems = (stemData ?? []).map(s => ({
        name: s.name,
        instrument_type: s.instrument_type,
        frequency_range: s.frequency_range as [number, number],
        duration_seconds: s.duration_seconds,
        category: s.category,
      }));
    }

    // 3. Run MidiComposer
    const midiResult = await executeMidiComposerAgent({
      production_id,
      structure: production.openai_structure,
      bpm: production.bpm,
      key: production.key,
      total_bars,
    });

    // 4. Store MIDI tracks in DB
    if (midiResult.tracks.length > 0) {
      const { error: tracksError } = await supabase
        .from("midi_tracks")
        .insert(midiResult.tracks);

      if (tracksError) {
        console.error("[v0] midi_tracks insert error:", tracksError);
      }
    }

    // 5. Run AudioEngineer
    const audioResult = await executeAudioEngineerAgent({
      structure: production.openai_structure,
      midi_tracks_count: midiResult.tracks.length,
      soundbank_stems: stems.length > 0 ? stems : [
        { name: "Sub Bass", instrument_type: "bass", frequency_range: [30, 120], duration_seconds: 32, category: "foundational" },
        { name: "Kick Drum", instrument_type: "drum", frequency_range: [40, 300], duration_seconds: 1, category: "percussive" },
        { name: "Pad Synth", instrument_type: "pad", frequency_range: [200, 3000], duration_seconds: 32, category: "textural" },
      ],
      bpm: production.bpm,
      total_bars,
      style: production.style,
    });

    // Inject bpm into arrangement_data ableton_export
    if (audioResult.arrangement_data?.ableton_export) {
      audioResult.arrangement_data.ableton_export.tempo = production.bpm;
      audioResult.arrangement_data.ableton_export.project_name = `DARKSCO_${production.style.replace(/\s+/g, "_")}_${Date.now()}`;
    }

    // 6. Update production
    const existingScores = (production.quality_scores ?? {}) as Record<string, unknown>;
    const mergedScores = { ...existingScores, ...audioResult.quality_scores };

    const { data: updated, error: updateError } = await supabase
      .from("music_productions")
      .update({
        midi_path: `midi/${production_id}/project.mid`,
        midi_metadata: midiResult.metadata,
        arrangement_data: audioResult.arrangement_data,
        quality_scores: mergedScores,
        status: "arrangement",
        updated_at: new Date().toISOString(),
      })
      .eq("id", production_id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      production: updated,
      midi: {
        tracks_generated: midiResult.tracks.length,
        total_notes: midiResult.tracks.reduce((sum, t) => sum + t.notes.length, 0),
        metadata: midiResult.metadata,
        ableton_instructions: midiResult.ableton_instructions,
      },
      audio_engineering: {
        gate_passed: audioResult.gate_passed,
        mix_score: audioResult.mixing_report.mix_score,
        issues: audioResult.issues,
        wav_export_spec: audioResult.wav_export_spec,
        mixing_report: audioResult.mixing_report,
      },
      ableton_project: midiResult.ableton_instructions,
      error: midiResult.error ?? null,
    });
  } catch (err) {
    console.error("[v0] generate-midi error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
