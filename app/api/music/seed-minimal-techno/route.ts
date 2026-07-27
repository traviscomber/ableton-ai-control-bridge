import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Seed API: Creates a complete minimal techno soundbank with professional stems
 * Demonstrates the full workflow: Profile → Soundbank → Stems → Ready for validation
 * 
 * GET /api/music/seed-minimal-techno - Creates demo soundbank
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Step 1: Create Sound Design Profile for Minimal Techno
    const profileData = {
      project_id: "minimal-techno-001",
      name: "Minimal Techno - Deep Focus",
      style: "minimal techno",
      description: "Deep, hypnotic minimal techno track with focus on spatial elements and micro-variations. Designed for extended DJ sets with sustainable energy.",
      bpm: 128,
      key: "A minor",
      time_signature: "4/4",
      mood_keywords: ["meditative", "hypnotic", "spatial", "industrial", "pulsating"],
      instrumentation: ["sub bass", "kick drum", "hi-hat", "pad", "fx", "automation"],
      production_stage: "soundbank-ready",
      created_by: "system-seed",
    };

    const { data: profile, error: profileError } = await supabase
      .from("sound_design_profiles")
      .insert(profileData)
      .select()
      .single();

    if (profileError) throw new Error(`Profile creation failed: ${profileError.message}`);
    console.log("[v0] Profile created:", profile.id);

    // Step 2: Create Soundbank
    const soundbankData = {
      project_id: "minimal-techno-001",
      profile_id: profile.id,
      name: "Minimal Techno v1.0",
      description: "Complete stem collection for minimal techno production. All stems professionally recorded and normalized.",
      version: 1,
      status: "draft",
      total_stems: 0,
      total_clips: 0,
      key: "A minor",
      bpm: 128,
    };

    const { data: soundbank, error: soundbankError } = await supabase
      .from("soundbanks")
      .insert(soundbankData)
      .select()
      .single();

    if (soundbankError) throw new Error(`Soundbank creation failed: ${soundbankError.message}`);
    console.log("[v0] Soundbank created:", soundbank.id);

    // Step 3: Create Professional Stems for Minimal Techno
    const stems = [
      {
        name: "Sub Bass 40Hz",
        instrument_type: "bass",
        category: "foundational",
        duration_seconds: 32,
        frequency_range: [30, 60],
        dynamics: "sustain",
        description: "Deep sub bass element providing low-end foundation. Ultra-clean sine wave focused at 40Hz.",
      },
      {
        name: "Kick Drum 909",
        instrument_type: "drum",
        category: "percussive",
        duration_seconds: 1.2,
        frequency_range: [40, 400],
        dynamics: "percussive",
        description: "Classic 909-style kick with punchy attack. Tight, defined profile for minimal aesthetic.",
      },
      {
        name: "Hi-Hat Closed Loop",
        instrument_type: "drum",
        category: "percussive",
        duration_seconds: 8,
        frequency_range: [3000, 15000],
        dynamics: "percussive",
        description: "Tight closed hi-hat loop in 16th note pattern. Ready for tempo sync and looping.",
      },
      {
        name: "Ambient Pad 200Hz",
        instrument_type: "pad",
        category: "textural",
        duration_seconds: 48,
        frequency_range: [200, 2000],
        dynamics: "sustain",
        description: "Evolving ambient pad creating spatial depth. Subtle movement and modulation.",
      },
      {
        name: "Noise FX Filter Sweep",
        instrument_type: "fx",
        category: "textural",
        duration_seconds: 16,
        frequency_range: [500, 12000],
        dynamics: "dynamic",
        description: "Filtered noise sweep with cutoff automation. Creates building tension and transition element.",
      },
      {
        name: "Perc Stab Short",
        instrument_type: "percussion",
        category: "percussive",
        duration_seconds: 2.4,
        frequency_range: [400, 3000],
        dynamics: "percussive",
        description: "Short percussive stab for rhythmic punctuation. Bright and defined character.",
      },
    ];

    const stemsToInsert = stems.map((stem) => ({
      soundbank_id: soundbank.id,
      name: stem.name,
      instrument_type: stem.instrument_type,
      category: stem.category,
      file_path: `stems/minimal-techno-001/${stem.name.toLowerCase().replace(/\s+/g, "-")}.wav`,
      file_size: Math.floor(stem.duration_seconds * 48000 * 3 * 24 / 8), // Approximate: 48kHz, 24-bit
      duration_seconds: stem.duration_seconds,
      sample_rate: 48000,
      bit_depth: 24,
      format: "WAV",
      metadata: {
        frequency_range: [stem.frequency_range[0], stem.frequency_range[1]],
        dynamics: stem.dynamics,
        processing: ["master-bus-eq", "limiter"],
        description: stem.description,
      },
      status: "processed",
    }));

    const { data: insertedStems, error: stemsError } = await supabase
      .from("stems")
      .insert(stemsToInsert)
      .select();

    if (stemsError) throw new Error(`Stems creation failed: ${stemsError.message}`);
    console.log("[v0] Stems created:", insertedStems.length);

    // Step 4: Update soundbank with stem count and status
    const { error: updateError } = await supabase
      .from("soundbanks")
      .update({
        total_stems: insertedStems.length,
        status: "stems-collected",
      })
      .eq("id", soundbank.id);

    if (updateError) throw new Error(`Soundbank update failed: ${updateError.message}`);
    console.log("[v0] Soundbank status updated to stems-collected");

    // Step 5: Create sample clips from stems for demonstration
    const clips = [
      {
        stem_id: insertedStems[0].id, // Sub Bass
        name: "Sub Bass 32-bar Loop",
        start_time: 0,
        end_time: 32,
        loop_points: { start: 0, end: 32 },
        tempo_sync: true,
        tags: ["loop-ready", "foundational", "sustained"],
      },
      {
        stem_id: insertedStems[1].id, // Kick
        name: "Kick Single Hit",
        start_time: 0,
        end_time: 1.2,
        tags: ["single", "attack", "tight"],
      },
      {
        stem_id: insertedStems[2].id, // Hi-Hat
        name: "Hi-Hat 2-bar Loop",
        start_time: 0,
        end_time: 8,
        loop_points: { start: 0, end: 8 },
        tempo_sync: true,
        tags: ["loop-ready", "rhythmic", "tight"],
      },
      {
        stem_id: insertedStems[3].id, // Pad
        name: "Pad 8-bar Sustain",
        start_time: 0,
        end_time: 32,
        tags: ["sustain", "textural", "ambient"],
      },
      {
        stem_id: insertedStems[4].id, // FX
        name: "Noise Sweep Build",
        start_time: 0,
        end_time: 16,
        tags: ["transition", "dynamic", "tension"],
      },
    ];

    const clipsToInsert = clips.map((clip) => ({
      stem_id: clip.stem_id,
      soundbank_id: soundbank.id,
      name: clip.name,
      start_time: clip.start_time,
      end_time: clip.end_time,
      loop_points: clip.loop_points || null,
      tempo_sync: clip.tempo_sync || false,
      file_path: `clips/minimal-techno-001/${clip.name.toLowerCase().replace(/\s+/g, "-")}.wav`,
      tags: clip.tags,
      metadata: {
        key: "A minor",
        loudness_db: -6,
      },
    }));

    const { data: insertedClips, error: clipsError } = await supabase
      .from("clips")
      .insert(clipsToInsert)
      .select();

    if (clipsError) throw new Error(`Clips creation failed: ${clipsError.message}`);
    console.log("[v0] Clips created:", insertedClips.length);

    // Step 6: Final update - mark soundbank as ready for validation
    const { error: finalUpdateError } = await supabase
      .from("soundbanks")
      .update({
        total_clips: insertedClips.length,
        status: "clips-extracted",
      })
      .eq("id", soundbank.id);

    if (finalUpdateError) throw new Error(`Final soundbank update failed: ${finalUpdateError.message}`);
    console.log("[v0] Soundbank status updated to clips-extracted");

    // Return complete summary
    return NextResponse.json(
      {
        success: true,
        message: "Professional minimal techno soundbank created successfully",
        data: {
          profile: {
            id: profile.id,
            name: profile.name,
            style: profile.style,
            bpm: profile.bpm,
            key: profile.key,
            mood_keywords: profile.mood_keywords,
            instrumentation: profile.instrumentation,
          },
          soundbank: {
            id: soundbank.id,
            name: soundbank.name,
            version: soundbank.version,
            status: "clips-extracted",
            total_stems: insertedStems.length,
            total_clips: insertedClips.length,
          },
          stems: insertedStems.map((stem) => ({
            id: stem.id,
            name: stem.name,
            instrument_type: stem.instrument_type,
            category: stem.category,
            duration_seconds: stem.duration_seconds,
            frequency_range: stem.metadata?.frequency_range,
            status: stem.status,
          })),
          clips: insertedClips.map((clip) => ({
            id: clip.id,
            name: clip.name,
            duration_seconds: clip.duration_seconds,
            tags: clip.tags,
            loop_ready: clip.loop_points !== null,
          })),
          next_steps: [
            "✓ Sound Design Profile created",
            "✓ Soundbank created with 6 professional stems",
            "✓ 5 production-ready clips extracted",
            "→ Ready for Soundsmith validation",
            "→ Run: POST /api/music/validate-soundbank with soundbank_id",
          ],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[v0] Seed error:", error);
    return NextResponse.json(
      {
        error: String(error),
        message: "Failed to create minimal techno soundbank seed",
      },
      { status: 500 }
    );
  }
}
