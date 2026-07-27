import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const projectId = request.nextUrl.searchParams.get("project_id");

    if (!projectId) {
      return NextResponse.json(
        { error: "project_id is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("sound_design_profiles")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ profiles: data });
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

    const { project_id, name, style, description, bpm, key, mood_keywords, instrumentation } = body;

    if (!project_id || !name || !style) {
      return NextResponse.json(
        { error: "project_id, name, and style are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("sound_design_profiles")
      .insert({
        project_id,
        name,
        style,
        description,
        bpm,
        key,
        mood_keywords: mood_keywords || [],
        instrumentation: instrumentation || [],
        production_stage: "brief",
        created_by: "user",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ profile: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
