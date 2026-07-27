/**
 * POST /api/music/analyze-reasoning
 *
 * Runs the ReasoningArchitect agent using OpenAI o1.
 * Receives production_id, fetches the production + soundbank stems,
 * calls the OpenAI reasoning model, stores the structure and log, and
 * advances production status to "reasoning".
 *
 * This is the most expensive and most important step — it produces the
 * complete music theory blueprint consumed by all downstream agents.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeReasoningArchitectAgent } from "@/lib/agents/reasoning-architect";

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { production_id, total_bars = 64 } = body;

    if (!production_id) {
      return NextResponse.json({ error: "production_id is required" }, { status: 400 });
    }

    // 1. Fetch production
    const { data: production, error: prodError } = await supabase
      .from("music_productions")
      .select("*")
      .eq("id", production_id)
      .single();

    if (prodError || !production) {
      return NextResponse.json({ error: "Production not found" }, { status: 404 });
    }

    // 2. Fetch soundbank stems (if soundbank linked)
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

    // Fallback stems if none linked
    if (stems.length === 0) {
      stems = [
        { name: "Sub Bass", instrument_type: "bass", frequency_range: [30, 120], duration_seconds: 32, category: "foundational" },
        { name: "Kick Drum", instrument_type: "drum", frequency_range: [40, 300], duration_seconds: 1, category: "percussive" },
        { name: "Hi-Hat Loop", instrument_type: "drum", frequency_range: [4000, 15000], duration_seconds: 8, category: "percussive" },
        { name: "Pad Synth", instrument_type: "pad", frequency_range: [200, 3000], duration_seconds: 32, category: "textural" },
        { name: "Noise FX", instrument_type: "fx", frequency_range: [500, 12000], duration_seconds: 16, category: "textural" },
        { name: "Perc Stab", instrument_type: "percussion", frequency_range: [400, 4000], duration_seconds: 2, category: "percussive" },
      ];
    }

    // 3. Run ReasoningArchitect
    const result = await executeReasoningArchitectAgent({
      brief: production.brief,
      style: production.style,
      bpm: production.bpm,
      key: production.key,
      mood_keywords: production.mood_keywords ?? [],
      soundbank_stems: stems,
      total_bars,
    });

    // 4. Store reasoning log
    await supabase.from("music_reasoning_logs").insert({
      production_id,
      model_used: result.log.model_used,
      prompt_tokens: result.log.prompt_tokens,
      completion_tokens: result.log.completion_tokens,
      total_tokens: result.log.total_tokens,
      cost_usd: result.log.cost_usd,
      duration_ms: result.log.duration_ms,
      raw_response: result.log.raw_response,
      parsed_structure: result.log.parsed_structure,
    });

    // 5. Update production with structure
    const { data: updated, error: updateError } = await supabase
      .from("music_productions")
      .update({
        openai_structure: result.structure,
        reasoning_tokens: result.log.total_tokens,
        reasoning_cost: result.log.cost_usd,
        status: "reasoning",
        updated_at: new Date().toISOString(),
      })
      .eq("id", production_id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      production: updated,
      structure: result.structure,
      log: {
        model: result.log.model_used,
        tokens: result.log.total_tokens,
        cost_usd: result.log.cost_usd,
        duration_ms: result.log.duration_ms,
        sections: result.structure.sections.length,
        chords: result.structure.chords.length,
        midi_tracks: result.structure.midi_plan.tracks.length,
      },
      error: result.error ?? null,
    });
  } catch (err) {
    console.error("[v0] analyze-reasoning error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
