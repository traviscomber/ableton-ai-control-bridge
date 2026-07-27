import { createClient } from "@/lib/supabase/client";

export interface SoundsmithInput {
  profile_id: string;
  soundbank_id: string;
  style: string;
  instrumentation: string[];
  mood_keywords: string[];
  stems_count: number;
  total_duration: number;
  reference_description?: string;
}

export interface SoundsmithResponse {
  status: "VALID" | "INCOMPLETE" | "NEEDS_REVISION";
  confidence: number;
  facts: string[];
  findings: string[];
  sound_design_assessment: {
    style_authenticity: number;
    instrumentation_coherence: number;
    mood_alignment: number;
    production_readiness: number;
  };
  stem_requirements: {
    instrument: string;
    characteristics: string[];
    suggested_processing: string[];
    priority: "essential" | "important" | "optional";
  }[];
  quality_checks: {
    name: string;
    status: "pass" | "fail" | "warning";
    details: string;
  }[];
  next_action: string;
  blockers: string[];
  recommendation: string;
}

export async function executeSoundsmithAgent(
  input: SoundsmithInput,
  previousResponses: Record<string, unknown> = {}
): Promise<SoundsmithResponse> {
  // Validate sound design profile completeness
  const styleValidation = validateStyle(input.style);
  const instrumentation = validateInstrumentation(input.instrumentation);
  const moodAlignment = validateMoodKeywords(input.mood_keywords);
  
  // Assess sound design coherence
  const coherenceScore = calculateCoherence(
    input.style,
    input.instrumentation,
    input.mood_keywords
  );

  // Check stem organization
  const stemQualityAssessment = assessStemOrganization(
    input.stems_count,
    input.instrumentation
  );

  // Determine if sound design is production-ready
  const isProductionReady =
    styleValidation.valid &&
    instrumentation.valid &&
    coherenceScore >= 75 &&
    stemQualityAssessment.organized;

  const qualityChecks: Array<{
    name: string;
    status: "pass" | "fail" | "warning";
    details: string;
  }> = [
    {
      name: "Style Definition",
      status: styleValidation.valid ? ("pass" as const) : ("fail" as const),
      details: styleValidation.feedback,
    },
    {
      name: "Instrumentation Coverage",
      status: instrumentation.valid ? ("pass" as const) : ("fail" as const),
      details: instrumentation.feedback,
    },
    {
      name: "Mood-Style Alignment",
      status: moodAlignment.aligned ? ("pass" as const) : ("warning" as const),
      details: moodAlignment.feedback,
    },
    {
      name: "Stem Organization",
      status: stemQualityAssessment.organized ? ("pass" as const) : ("warning" as const),
      details: stemQualityAssessment.feedback,
    },
  ];

  const blockers: string[] = [];
  if (!styleValidation.valid) blockers.push("Style not clearly defined");
  if (!instrumentation.valid) blockers.push("Instrumentation incomplete");

  const soundDesignAssessment = {
    style_authenticity: styleValidation.score,
    instrumentation_coherence: instrumentation.score,
    mood_alignment: moodAlignment.score,
    production_readiness: Math.min(
      ...qualityChecks.map((q) => (q.status === "pass" ? 100 : 60))
    ),
  };

  const findings = [
    `Style: ${input.style} - ${styleValidation.feedback}`,
    `Instrumentation: ${input.instrumentation.join(", ")} - Coherence ${instrumentation.score}%`,
    `Mood Keywords: ${input.mood_keywords.join(", ")} - Alignment ${moodAlignment.score}%`,
    `Stems Organized: ${input.stems_count} stems across ${new Set(input.instrumentation).size} instruments`,
  ];

  const stemRequirements = generateStemRequirements(
    input.style,
    input.instrumentation
  );

  // Determine decision
  let status: "VALID" | "INCOMPLETE" | "NEEDS_REVISION" = "VALID";
  let recommendation = "Sound design is ready for soundbank creation and clip extraction.";

  if (blockers.length > 0) {
    status = "NEEDS_REVISION";
    recommendation = `Address blockers: ${blockers.join("; ")}. Then resubmit for validation.`;
  } else if (coherenceScore < 60) {
    status = "INCOMPLETE";
    recommendation =
      "Sound design concept needs more development. Review mood keywords and instrumentation alignment.";
  }

  return {
    status,
    confidence: Math.min(
      ...Object.values(soundDesignAssessment).map((v) => Math.max(0, Math.min(100, v)))
    ),
    facts: findings,
    findings: qualityChecks.map((q) => `${q.name}: ${q.details}`),
    sound_design_assessment: soundDesignAssessment,
    stem_requirements: stemRequirements,
    quality_checks: qualityChecks,
    next_action:
      status === "VALID" ? "Proceed to Venom for quality scoring" : "Request revisions",
    blockers,
    recommendation,
  };
}

// Helper functions
function validateStyle(style: string): { valid: boolean; score: number; feedback: string } {
  const validStyles = [
    "dark techno",
    "ambient",
    "experimental",
    "cinematic",
    "electronic",
    "industrial",
    "downtempo",
    "techno",
    "house",
    "progressive",
  ];

  const isValid = validStyles.some((s) =>
    style.toLowerCase().includes(s.toLowerCase())
  );

  return {
    valid: isValid,
    score: isValid ? 90 : 40,
    feedback: isValid
      ? `${style} is a recognized music production style`
      : `${style} is unclear or non-standard. Consider revising.`,
  };
}

function validateInstrumentation(instruments: string[]): {
  valid: boolean;
  score: number;
  feedback: string;
} {
  const minInstruments = 3;
  const hasVariety = instruments.length >= minInstruments;
  const validCategories = instruments.filter((i) =>
    ["bass", "pad", "lead", "drums", "fx", "strings", "synth", "percussion"].some(
      (cat) => i.toLowerCase().includes(cat)
    )
  );

  return {
    valid: hasVariety && validCategories.length >= 2,
    score: Math.min(100, (validCategories.length / instruments.length) * 100),
    feedback:
      validCategories.length >= 2
        ? `Good instrumentation coverage: ${instruments.join(", ")}`
        : `Instrumentation needs more variety. Current: ${instruments.join(", ")}`,
  };
}

function validateMoodKeywords(keywords: string[]): {
  aligned: boolean;
  score: number;
  feedback: string;
} {
  const meaningfulKeywords = keywords.filter((k) => k.length > 2);
  const hasEnoughKeywords = meaningfulKeywords.length >= 2;

  return {
    aligned: hasEnoughKeywords,
    score: hasEnoughKeywords ? 85 : 50,
    feedback:
      hasEnoughKeywords
        ? `Mood keywords well-defined: ${keywords.join(", ")}`
        : "Mood keywords are sparse. Add more descriptive words.",
  };
}

function calculateCoherence(
  style: string,
  instrumentation: string[],
  moodKeywords: string[]
): number {
  let score = 50;

  // Style clarity bonus
  if (style.length > 5) score += 15;

  // Instrumentation diversity bonus
  if (instrumentation.length >= 4) score += 15;
  else if (instrumentation.length >= 3) score += 10;

  // Mood keywords bonus
  if (moodKeywords.length >= 3) score += 15;
  else if (moodKeywords.length >= 2) score += 10;

  // Check for thematic consistency (simple heuristic)
  const darkMoods = ["dark", "intense", "ominous", "heavy"];
  const lightMoods = ["bright", "ethereal", "uplifting", "joyful"];

  const hasDarkKeywords = moodKeywords.some((k) =>
    darkMoods.some((m) => k.toLowerCase().includes(m))
  );
  const hasLightKeywords = moodKeywords.some((k) =>
    lightMoods.some((m) => k.toLowerCase().includes(m))
  );

  // If mixing dark and light, slightly penalize inconsistency
  if (hasDarkKeywords && hasLightKeywords) score -= 10;

  return Math.min(100, Math.max(0, score));
}

function assessStemOrganization(
  stemsCount: number,
  instrumentation: string[]
): { organized: boolean; score: number; feedback: string } {
  const averageStemsPerInstrument = stemsCount / instrumentation.length;
  const isWellOrganized =
    stemsCount >= 5 && averageStemsPerInstrument >= 1 && averageStemsPerInstrument <= 10;

  return {
    organized: isWellOrganized,
    score: isWellOrganized ? 90 : 65,
    feedback: isWellOrganized
      ? `${stemsCount} stems well-distributed across ${instrumentation.length} instruments`
      : `${stemsCount} stems - consider reorganizing for clarity`,
  };
}

function generateStemRequirements(
  style: string,
  instrumentation: string[]
): Array<{
  instrument: string;
  characteristics: string[];
  suggested_processing: string[];
  priority: "essential" | "important" | "optional";
}> {
  const requirements: Array<{
    instrument: string;
    characteristics: string[];
    suggested_processing: string[];
    priority: "essential" | "important" | "optional";
  }> = [];

  // Base requirements by style
  const isDark = style.toLowerCase().includes("dark");
  const isAmbient = style.toLowerCase().includes("ambient");

  instrumentation.forEach((instrument) => {
    const instrumentLower = instrument.toLowerCase();

    if (instrumentLower.includes("bass")) {
      requirements.push({
        instrument: "Bass",
        characteristics: isDark
          ? ["deep", "sub-frequency", "punchy"]
          : ["warm", "musical", "well-defined"],
        suggested_processing: ["EQ", "compression", "saturation"],
        priority: "essential",
      });
    } else if (
      instrumentLower.includes("pad") ||
      instrumentLower.includes("synth")
    ) {
      requirements.push({
        instrument: "Pad/Synth",
        characteristics: isAmbient
          ? ["sustained", "evolving", "textural"]
          : ["dynamic", "articulate", "present"],
        suggested_processing: ["reverb", "filter automation", "chorus"],
        priority: "important",
      });
    } else if (
      instrumentLower.includes("drum") ||
      instrumentLower.includes("percussion")
    ) {
      requirements.push({
        instrument: "Drums",
        characteristics: ["punchy", "clear", "well-separated"],
        suggested_processing: ["compression", "EQ", "saturation"],
        priority: "essential",
      });
    }
  });

  // Add FX requirements
  requirements.push({
    instrument: "Effects/Texture",
    characteristics: ["atmospheric", "unique", "supporting"],
    suggested_processing: ["reverb", "delay", "distortion", "granulation"],
    priority: "optional",
  });

  return requirements;
}
