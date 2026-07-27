/**
 * ReasoningArchitect Agent
 *
 * Uses OpenAI o1 (best reasoning model) to perform deep music theory analysis.
 * Outputs a complete production blueprint: chord progressions, arrangement sections,
 * drum patterns, bass movement, synthesis instructions, MIDI plan, and quality targets.
 *
 * This output is passed downstream to MidiComposer, ArrangementMaster, and quality agents.
 */

import OpenAI from "openai";
import type { OpenAIStructure, ReasoningLog } from "@/lib/music-schema";

export interface ReasoningArchitectInput {
  brief: string;             // "Dark disco funk techno, hypnotic, night energy"
  style: string;             // "darksco" | "minimal-techno" | "dark-techno"
  bpm: number;               // 120
  key: string;               // "F minor"
  mood_keywords: string[];   // ["dark", "hypnotic", "groovy"]
  soundbank_stems: Array<{
    name: string;
    instrument_type: string;
    frequency_range: [number, number];
    duration_seconds: number;
    category: string;
  }>;
  total_bars?: number;       // Default 64
  reference_tracks?: string[];
}

export interface ReasoningArchitectResponse {
  structure: OpenAIStructure;
  log: Omit<ReasoningLog, "id" | "production_id" | "created_at">;
  error?: string;
}

// Price per 1M tokens (o1 pricing as of 2025)
const O1_INPUT_PRICE_PER_1M = 15.0;
const O1_OUTPUT_PRICE_PER_1M = 60.0;

function buildPrompt(input: ReasoningArchitectInput): string {
  const stemsDescription = input.soundbank_stems
    .map(
      (s) =>
        `- ${s.name} (${s.instrument_type}, ${s.frequency_range[0]}-${s.frequency_range[1]}Hz, ${s.duration_seconds}s, category: ${s.category})`
    )
    .join("\n");

  const totalBars = input.total_bars ?? 64;

  return `You are a world-class music producer and music theorist with deep expertise in electronic music, specifically ${input.style} music. Your task is to create a complete, professional production blueprint for a ${totalBars}-bar track.

## PRODUCTION BRIEF
- Style: ${input.style}
- BPM: ${input.bpm}
- Key / Scale: ${input.key}
- Brief: ${input.brief}
- Mood Keywords: ${input.mood_keywords.join(", ")}
${input.reference_tracks?.length ? `- Reference Tracks: ${input.reference_tracks.join(", ")}` : ""}

## AVAILABLE SOUNDBANK STEMS
${stemsDescription}

## YOUR TASK
Create a detailed, professional music production blueprint. Think deeply about music theory, arrangement, groove, and production quality. Be extremely specific and actionable.

Return a JSON object with this EXACT structure (no markdown, raw JSON only):

{
  "sections": [
    {
      "name": "intro" | "build" | "verse" | "chorus" | "bridge" | "breakdown" | "outro" | "drop" | "peak",
      "duration_bars": <number>,
      "elements": ["<stem_name_1>", "<stem_name_2>"],
      "dynamics": "minimal" | "moderate" | "intense",
      "notes": "<specific production notes for this section>"
    }
  ],
  "chords": [
    {
      "bar": <bar_number>,
      "root": "<note_name e.g. F>",
      "quality": "<e.g. minor, major, dim7, m7, sus4, maj7>",
      "inversion": <0|1|2>,
      "voicing_notes": "<specific voicing instruction>"
    }
  ],
  "drum_pattern": {
    "kick": [<16th_note_positions_0_to_15>],
    "snare": [<16th_note_positions>],
    "hihat": [<16th_note_positions>],
    "open_hihat": [<16th_note_positions>],
    "perc": [<16th_note_positions>],
    "description": "<detailed description of the groove and feel>"
  },
  "bass_movement": "<detailed description of bass line movement, notes, rhythm, groove>",
  "synthesis_notes": "<specific synthesis parameters: filter settings, LFO rates, envelope shapes, modulation>",
  "production_tips": [
    "<specific actionable tip 1>",
    "<specific actionable tip 2>",
    "<specific actionable tip 3>",
    "<specific actionable tip 4>",
    "<specific actionable tip 5>"
  ],
  "arrangement_arc": "<description of the overall energy arc from start to finish>",
  "energy_curve": "<bar-by-bar energy description e.g. bars 1-8: low tension, bars 9-16: rising>",
  "reference_analysis": "<analysis of what makes this style work and how to achieve it>",
  "midi_plan": {
    "tracks": [
      {
        "name": "<track name>",
        "instrument": "<instrument type>",
        "range": ["<lowest_MIDI_note e.g. C1>", "<highest_MIDI_note e.g. C4>"],
        "density": "sparse" | "moderate" | "dense",
        "suggested_stems": ["<stem_name>"],
        "velocity_range": [<min_0_127>, <max_0_127>],
        "humanization": "<description of velocity/timing variation>"
      }
    ]
  },
  "quality_target": {
    "loudness_lufs": <number e.g. -14>,
    "dynamic_range": "<e.g. 8-12 dB>",
    "frequency_balance": "neutral" | "bright" | "warm" | "dark",
    "mix_reference": "<production that has similar mix characteristics>",
    "mastering_chain": ["<processor 1>", "<processor 2>", "<processor 3>"]
  },
  "raw_reasoning": "<your step-by-step reasoning about the musical decisions>"
}

CRITICAL REQUIREMENTS:
1. Sections must sum to exactly ${totalBars} bars
2. Chord progression must be musically valid for ${input.key}
3. Drum pattern positions are 0-15 (16th notes per bar)
4. Kick patterns must drive the groove (typically positions 0, 4, 8, 12 for 4-on-the-floor with variations)
5. Bass movement must complement the chord progression
6. Synthesis notes must be specific to ${input.style} sound design
7. MIDI tracks must map to the available stems listed above
8. Quality target loudness must match platform standards (-14 LUFS for streaming)
9. All tips must be specific, actionable, and professional-grade
10. raw_reasoning must explain your musical decision-making process in detail

Think like a top-tier producer. Consider groove, tension/release, frequency masking, dynamics, transitions, and what makes ${input.style} music distinctive.`;
}

function parseFallback(raw: string): OpenAIStructure | null {
  // Try to extract JSON from markdown code blocks if model wraps it
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : raw.trim();
  try {
    return JSON.parse(jsonStr) as OpenAIStructure;
  } catch {
    return null;
  }
}

function buildFallbackStructure(input: ReasoningArchitectInput): OpenAIStructure {
  const totalBars = input.total_bars ?? 64;
  return {
    sections: [
      { name: "intro", duration_bars: 8, elements: ["pad", "hihat"], dynamics: "minimal", notes: "Gradual atmosphere build" },
      { name: "build", duration_bars: 8, elements: ["pad", "hihat", "bass"], dynamics: "moderate", notes: "Introduce bass" },
      { name: "drop", duration_bars: 16, elements: ["kick", "bass", "hihat", "pad"], dynamics: "intense", notes: "Full energy drop" },
      { name: "breakdown", duration_bars: 8, elements: ["pad", "fx"], dynamics: "minimal", notes: "Strip back to atmosphere" },
      { name: "peak", duration_bars: 16, elements: ["kick", "bass", "hihat", "pad", "synth"], dynamics: "intense", notes: "Peak energy section" },
      { name: "outro", duration_bars: Math.max(8, totalBars - 56), elements: ["pad", "hihat"], dynamics: "minimal", notes: "Gradual fade out" },
    ],
    chords: [
      { bar: 1, root: input.key.split(" ")[0], quality: "minor", inversion: 0, voicing_notes: "Root position" },
      { bar: 9, root: input.key.split(" ")[0], quality: "minor", inversion: 1, voicing_notes: "First inversion for movement" },
    ],
    drum_pattern: {
      kick: [0, 4, 8, 12],
      snare: [4, 12],
      hihat: [0, 2, 4, 6, 8, 10, 12, 14],
      open_hihat: [7, 15],
      perc: [2, 10],
      description: "Classic 4-on-the-floor kick with syncopated snare and 8th-note hi-hats",
    },
    bass_movement: "Static root note on beat 1, rising minor third on bar 3, chromatic descent into bar 4",
    synthesis_notes: "Pad: slow-attack (800ms), long sustain, LFO on cutoff at 0.25Hz. Bass: Moog-style ladder filter, resonance 40%, envelope follower on amp",
    production_tips: [
      "Sidechain compress the pad and synth to the kick for pumping groove",
      "Use a subtle stereo widener on hi-hats to open the high end",
      "Add 8th-note delay on the bass with 15% feedback for depth",
      "Automate the filter cutoff upward during the build section",
      "Use parallel compression (NY compression) on the drum bus",
    ],
    arrangement_arc: "Low tension intro → gradual build → explosive drop → atmospheric breakdown → peak intensity → gentle outro",
    energy_curve: "Bars 1-8: 20% energy, Bars 9-16: 40% energy, Bars 17-32: 80% energy, Bars 33-40: 30% energy, Bars 41-56: 90% energy, Bars 57-64: 20% energy",
    reference_analysis: `${input.style} music is defined by hypnotic repetition, deep sub-bass, and evolving textures. Key elements: tight kick, sub-bass groove, atmospheric pads, and dynamic filter automation.`,
    midi_plan: {
      tracks: input.soundbank_stems.slice(0, 6).map((s, i) => ({
        name: s.name,
        instrument: s.instrument_type,
        range: ["C1", "C4"] as [string, string],
        density: i === 0 ? "dense" : i < 3 ? "moderate" : "sparse",
        suggested_stems: [s.name],
        velocity_range: [70, 100] as [number, number],
        humanization: "Subtle velocity variation ±10",
      })),
    },
    quality_target: {
      loudness_lufs: -14,
      dynamic_range: "8-12 dB",
      frequency_balance: "dark",
      mix_reference: "Reference: Professional dark techno release",
      mastering_chain: ["Mid/Side EQ", "Multiband compressor", "Limiter", "True-peak limiter"],
    },
    raw_reasoning: "Fallback structure generated. OpenAI reasoning was unavailable.",
  };
}

export async function executeReasoningArchitectAgent(
  input: ReasoningArchitectInput
): Promise<ReasoningArchitectResponse> {
  const startTime = Date.now();
  const model = "o1";

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = buildPrompt(input);

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      // o1 does not support system messages or temperature
    });

    const durationMs = Date.now() - startTime;
    const rawContent = completion.choices[0]?.message?.content ?? "";
    const usage = completion.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    const costUsd =
      (usage.prompt_tokens / 1_000_000) * O1_INPUT_PRICE_PER_1M +
      (usage.completion_tokens / 1_000_000) * O1_OUTPUT_PRICE_PER_1M;

    // Parse the JSON response
    let parsed: OpenAIStructure | null = null;
    try {
      parsed = JSON.parse(rawContent) as OpenAIStructure;
    } catch {
      parsed = parseFallback(rawContent);
    }

    if (!parsed) {
      // Return fallback if parsing completely failed
      const fallback = buildFallbackStructure(input);
      return {
        structure: { ...fallback, raw_reasoning: rawContent },
        log: {
          model_used: model,
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
          cost_usd: costUsd,
          duration_ms: durationMs,
          raw_response: rawContent,
          parsed_structure: null,
        },
        error: "JSON parse failed — fallback structure used. Raw response stored.",
      };
    }

    return {
      structure: parsed,
      log: {
        model_used: model,
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        cost_usd: costUsd,
        duration_ms: durationMs,
        raw_response: rawContent,
        parsed_structure: parsed,
      },
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const fallback = buildFallbackStructure(input);
    return {
      structure: fallback,
      log: {
        model_used: model,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        cost_usd: 0,
        duration_ms: durationMs,
        raw_response: String(err),
        parsed_structure: null,
      },
      error: `OpenAI call failed: ${String(err)}`,
    };
  }
}
