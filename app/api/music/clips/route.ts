import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const soundbankId = request.nextUrl.searchParams.get("soundbank_id");
    const stemId = request.nextUrl.searchParams.get("stem_id");

    let query = supabase.from("clips").select("*");

    if (soundbankId) query = query.eq("soundbank_id", soundbankId);
    if (stemId) query = query.eq("stem_id", stemId);

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ clips: data });
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
      stem_id,
      soundbank_id,
      name,
      start_time,
      end_time,
      loop_points,
      tempo_sync,
      file_path,
      tags,
      metadata,
    } = body;

    if (!stem_id || !soundbank_id || !name || start_time === undefined || end_time === undefined) {
      return NextResponse.json(
        { error: "stem_id, soundbank_id, name, start_time, and end_time are required" },
        { status: 400 }
      );
    }

    if (start_time >= end_time) {
      return NextResponse.json(
        { error: "start_time must be less than end_time" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("clips")
      .insert({
        stem_id,
        soundbank_id,
        name,
        start_time,
        end_time,
        loop_points: loop_points || null,
        tempo_sync: tempo_sync || false,
        file_path: file_path || "",
        tags: tags || [],
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    // Update soundbank clip count
    const { data: soundbank } = await supabase
      .from("soundbanks")
      .select("total_clips")
      .eq("id", soundbank_id)
      .single();

    if (soundbank) {
      await supabase
        .from("soundbanks")
        .update({ 
          total_clips: (soundbank.total_clips || 0) + 1,
          status: "clips-extracted"
        })
        .eq("id", soundbank_id);
    }

    return NextResponse.json({ clip: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
