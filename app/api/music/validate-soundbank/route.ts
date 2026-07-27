import { createClient } from "@/lib/supabase/server";
import { executeSoundsmithAgent } from "@/lib/agents/soundsmith";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { soundbank_id } = body;

    if (!soundbank_id) {
      return NextResponse.json(
        { error: "soundbank_id is required" },
        { status: 400 }
      );
    }

    // Fetch soundbank with profile
    const { data: soundbank, error: sbError } = await supabase
      .from("soundbanks")
      .select("*, sound_design_profiles(*)")
      .eq("id", soundbank_id)
      .single();

    if (sbError) throw sbError;

    if (!soundbank || !soundbank.sound_design_profiles) {
      return NextResponse.json(
        { error: "Soundbank or profile not found" },
        { status: 404 }
      );
    }

    const profile = soundbank.sound_design_profiles;

    // Fetch stems for this soundbank
    const { data: stems, error: stemsError } = await supabase
      .from("stems")
      .select("*")
      .eq("soundbank_id", soundbank_id);

    if (stemsError) throw stemsError;

    // Calculate total duration
    const totalDuration = stems?.reduce((sum, stem) => sum + (stem.duration_seconds || 0), 0) || 0;

    // Execute Soundsmith agent
    const soundsmithResponse = await executeSoundsmithAgent({
      profile_id: profile.id,
      soundbank_id,
      style: profile.style,
      instrumentation: profile.instrumentation || [],
      mood_keywords: profile.mood_keywords || [],
      stems_count: soundbank.total_stems || 0,
      total_duration: totalDuration,
      reference_description: profile.description,
    });

    // Store feedback in database
    const { data: feedback, error: feedbackError } = await supabase
      .from("production_feedback")
      .insert({
        soundbank_id,
        agent_id: "soundsmith",
        feedback_type: "quality-score",
        score: Math.round(soundsmithResponse.confidence),
        findings: soundsmithResponse.findings,
        recommendations: soundsmithResponse.sound_design_assessment
          ? Object.entries(soundsmithResponse.sound_design_assessment)
              .map(([key, value]) => `${key}: ${value}`)
          : [],
        blockers: soundsmithResponse.blockers,
        decision: soundsmithResponse.status === "VALID" ? "approve" : 
                 soundsmithResponse.status === "NEEDS_REVISION" ? "revise" : "approve",
        agent_response: soundsmithResponse,
      })
      .select()
      .single();

    if (feedbackError) throw feedbackError;

    // Update soundbank status based on decision
    let newStatus = "quality-check";
    if (soundsmithResponse.status === "VALID") {
      newStatus = "approved";
    }

    const { error: updateError } = await supabase
      .from("soundbanks")
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", soundbank_id);

    if (updateError) throw updateError;

    return NextResponse.json({
      soundbank_id,
      validation_result: soundsmithResponse,
      feedback_id: feedback.id,
      soundbank_status: newStatus,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
