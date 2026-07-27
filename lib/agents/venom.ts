export async function executeVenomAgent(
  data: any,
  previousResponses: any[],
  supabase: any
): Promise<any> {
  const { tracks = [], catalogue_state = "new" } = data || {};

  // Music quality scoring (1-100 scale)
  const scoreTrack = (track: any): number => {
    let score = 0;

    // DARKSCO identity (20%)
    if (track.darksco_identity) score += 20;

    // Mix readiness and technical (20%)
    if (track.headroom_db > 3) score += 10;
    if (track.frequency_balance === "balanced") score += 10;

    // Arrangement and composition (15%)
    if (track.arrangement_clarity) score += 15;

    // Emotional depth (15%)
    if (track.emotional_depth) score += 15;

    // Originality (15%)
    if (track.originality_rating >= 7) score += 15;

    // Session function and catalogue (10%)
    if (track.session_function && track.catalogue_placement) score += 10;

    // Licensing ready (5%)
    if (track.licensing_ready) score += 5;

    return score;
  };

  const evaluated = tracks.map((t: any) => ({
    ...t,
    score: scoreTrack(t),
  }));

  const approved = evaluated.filter((t: any) => t.score >= 80);
  const revise = evaluated.filter((t: any) => t.score >= 60 && t.score < 80);
  const rejected = evaluated.filter((t: any) => t.score < 60);

  const shouldApprove = approved.length > 0 && rejected.length === 0;

  return {
    status: shouldApprove ? "APPROVE" : revise.length > 0 ? "REVISE" : "REJECT",
    confidence: rejected.length === 0 ? "HIGH" : "MEDIUM",
    facts: [
      `Material evaluated: ${tracks.length} tracks`,
      `Approved: ${approved.length} (score ≥80)`,
      `Revision needed: ${revise.length} (score 60-79)`,
      `Rejected: ${rejected.length} (score <60)`,
    ],
    findings: [
      ...rejected.map((t: any) => `REJECT: ${t.name} (${t.score}/100)`),
      ...revise.map((t: any) => `REVISE: ${t.name} (${t.score}/100)`),
    ],
    decision:
      shouldApprove && catalogue_state === "established"
        ? `${approved.length} tracks approved. Catalogue strengthened.`
        : shouldApprove
          ? `${approved.length} tracks approved for new catalogue.`
          : `Material quality below threshold. ${rejected.length} rejected, ${revise.length} require revision.`,
    actions: approved
      .map((t: any) => ({
        owner: "venom" as any,
        description: `Classify "${t.name}" and assign to catalogue placement`,
        deadline: new Date(Date.now() + 86400000).toISOString(),
        successMetric: "Session function and placement defined",
      }))
      .slice(0, 3),
    risks:
      rejected.length > 0
        ? [`${rejected.length} rejected tracks may need rework`]
        : [],
    blockers:
      revise.length > 0
        ? [
            `${revise.length} tracks require revision before approval`,
          ]
        : [],
    nextAgent: shouldApprove ? "hela" : "doom",
    requiredInput: undefined,
  };
}
