import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const soundbankId = request.nextUrl.searchParams.get("soundbank_id");

    if (!soundbankId) {
      return NextResponse.json(
        { error: "soundbank_id is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("stems")
      .select("*")
      .eq("soundbank_id", soundbankId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ stems: data });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      soundbank_id,
      name,
      instrument_type,
      category,
      file_path,
      file_size,
      duration_seconds,
      sample_rate,
      bit_depth,
      format,
      metadata,
    } = body;

    if (!soundbank_id || !name || !instrument_type || !file_path) {
      return NextResponse.json(
        { error: "soundbank_id, name, instrument_type, and file_path are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("stems")
      .insert({
        soundbank_id,
        name,
        instrument_type,
        category: category || "general",
        file_path,
        file_size: file_size || 0,
        duration_seconds: duration_seconds || 0,
        sample_rate: sample_rate || 48000,
        bit_depth: bit_depth || 24,
        format: format || "WAV",
        metadata: metadata || {},
        status: "raw",
      })
      .select()
      .single();

    if (error) throw error;

    // Update soundbank stem count
    const { data: soundbank } = await supabase
      .from("soundbanks")
      .select("total_stems")
      .eq("id", soundbank_id)
      .single();

    if (soundbank) {
      await supabase
        .from("soundbanks")
        .update({ total_stems: (soundbank.total_stems || 0) + 1, status: "stems-collected" })
        .eq("id", soundbank_id);
    }

    return NextResponse.json({ stem: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
