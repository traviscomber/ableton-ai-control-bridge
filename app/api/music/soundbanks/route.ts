import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const projectId = request.nextUrl.searchParams.get("project_id");
    const profileId = request.nextUrl.searchParams.get("profile_id");

    let query = supabase.from("soundbanks").select("*");

    if (projectId) query = query.eq("project_id", projectId);
    if (profileId) query = query.eq("profile_id", profileId);

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ soundbanks: data });
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

    const { project_id, profile_id, name, description } = body;

    if (!project_id || !profile_id || !name) {
      return NextResponse.json(
        { error: "project_id, profile_id, and name are required" },
        { status: 400 }
      );
    }

    // Get profile to determine version number
    const { data: profile, error: profileError } = await supabase
      .from("sound_design_profiles")
      .select("*")
      .eq("id", profile_id)
      .single();

    if (profileError) throw profileError;

    // Get latest version for this profile
    const { data: existingSoundbanks, error: versionError } = await supabase
      .from("soundbanks")
      .select("version")
      .eq("profile_id", profile_id)
      .order("version", { ascending: false })
      .limit(1);

    if (versionError && versionError.code !== "PGRST116") throw versionError;

    const nextVersion = (existingSoundbanks?.[0]?.version || 0) + 1;

    const { data, error } = await supabase
      .from("soundbanks")
      .insert({
        project_id,
        profile_id,
        name,
        description,
        version: nextVersion,
        status: "draft",
        total_stems: 0,
        total_clips: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ soundbank: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
