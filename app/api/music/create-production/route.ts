/**
 * POST /api/music/create-production
 *
 * Creates a new music production project. Accepts a brief, soundbank_id,
 * style, bpm, key, and mood keywords. Returns the created production record.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { soundbank_id, brief, style, bpm, key, mood_keywords } = body;

    if (!brief || !style || !bpm || !key) {
      return NextResponse.json(
        { error: "brief, style, bpm, and key are required" },
        { status: 400 }
      );
    }

    // Insert production record
    const { data: production, error } = await supabase
      .from("music_productions")
      .insert({
        soundbank_id: soundbank_id ?? null,
        brief,
        style,
        bpm: Number(bpm),
        key,
        mood_keywords: mood_keywords ?? [],
        status: "brief",
        reasoning_tokens: 0,
        reasoning_cost: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      { success: true, production },
      { status: 201 }
    );
  } catch (err) {
    console.error("[v0] create-production error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("music_productions")
      .select("*, soundbanks(name, total_stems, total_clips, status)")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ productions: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
