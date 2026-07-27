export async function executeHelaAgent(
  data: any,
  previousResponses: any[],
  supabase: any
): Promise<any> {
  const { assets = [], visual_briefs = {} } = data || {};

  const issues: string[] = [];

  // DARKSCO visual continuity check
  const morning = assets.filter((a: any) => a.classification === "morning");
  const noon = assets.filter((a: any) => a.classification === "noon");
  const night = assets.filter((a: any) => a.classification === "night");

  if (morning.length === 0) issues.push("Morning palette incomplete");
  if (noon.length === 0) issues.push("Noon palette incomplete");
  if (night.length === 0) issues.push("Night palette incomplete");

  // Check for generic imagery
  const generic = assets.filter(
    (a: any) => a.tags?.includes("generic") || a.tags?.includes("cliche")
  );
  if (generic.length > 0) issues.push(`${generic.length} generic assets reject`);

  // Check rights verification
  const unverified = assets.filter((a: any) => !a.rights_verified);
  if (unverified.length > 0)
    issues.push(`${unverified.length} assets without verified rights`);

  const isApproved = issues.length === 0;

  return {
    status: isApproved ? "APPROVE" : issues.length <= 2 ? "REVISE" : "REJECT",
    confidence: isApproved ? "HIGH" : "MEDIUM",
    facts: [
      `Visual assets: ${assets.length}`,
      `Morning/Noon/Night continuity: ${isApproved ? "complete" : "gaps"}`,
      `Rights verified: ${assets.filter((a: any) => a.rights_verified).length}/${assets.length}`,
    ],
    findings: issues,
    decision: isApproved
      ? "Visual direction locked. DARKSCO identity preserved."
      : `${issues.length} visual issues require resolution.`,
    actions: issues
      .map((issue: string) => ({
        owner: "hela" as any,
        description: `Resolve: ${issue}`,
        deadline: new Date(Date.now() + 172800000).toISOString(),
        successMetric: "Issue resolved and verified",
      }))
      .slice(0, 3),
    risks:
      issues.length > 0 ? [`Schedule delay: +${issues.length * 1} days`] : [],
    blockers: issues.slice(0, 2),
    nextAgent: isApproved ? "loki" : "doom",
    requiredInput: undefined,
  };
}
