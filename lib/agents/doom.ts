export async function executeDoomAgent(
  data: any,
  previousResponses: any[],
  supabase: any
): Promise<any> {
  // Doom reviews all agent decisions and makes final call
  const responses = previousResponses || [];

  // Get each agent's status
  const agentStatus = responses.reduce(
    (acc, r) => {
      acc[r.agent_id] = r.status;
      return acc;
    },
    {} as Record<string, string>
  );

  // Mandatory gates
  const gates = {
    music: agentStatus.venom === "APPROVE",
    visual: agentStatus.hela === "APPROVE",
    publishing: agentStatus.loki === "READY",
    evidence: agentStatus.bane === "VALID SIGNAL",
    rights: agentStatus.thanos === "COMMERCIAL READY",
  };

  const gatesPassed = Object.values(gates).filter(Boolean).length;
  const gatesTotal = Object.keys(gates).length;

  // Collect all blockers
  const allBlockers = responses.flatMap((r) => r.blockers || []);

  // Decision logic: Quality > Frequency
  const shouldApprove =
    gatesPassed === gatesTotal && allBlockers.length === 0;
  const shouldRevise = gatesPassed >= 3 && allBlockers.length <= 2;

  return {
    status: shouldApprove ? "APPROVED" : shouldRevise ? "REVISE" : "REJECT",
    confidence: shouldApprove ? "HIGH" : shouldRevise ? "MEDIUM" : "LOW",
    facts: [
      `Quality gates: ${gatesPassed}/${gatesTotal} passed`,
      `Music: ${gates.music ? "✓" : "✗"}`,
      `Visual: ${gates.visual ? "✓" : "✗"}`,
      `Publishing: ${gates.publishing ? "✓" : "✗"}`,
      `Evidence: ${gates.evidence ? "✓" : "✗"}`,
      `Rights: ${gates.rights ? "✓" : "✗"}`,
      `Blockers: ${allBlockers.length}`,
    ],
    findings: allBlockers.map((b: string) => `BLOCKER: ${b}`),
    decision:
      shouldApprove
        ? `APPROVED. All ${gatesTotal} gates passed. Proceed to execution.`
        : shouldRevise
          ? `REVISE REQUIRED. ${gatesPassed}/${gatesTotal} gates passed. ${allBlockers.length} blockers.`
          : `REJECTED. Only ${gatesPassed}/${gatesTotal} gates passed. Quality threshold not met.`,
    actions: shouldApprove
      ? [
          {
            owner: "darkside" as any,
            description: "Execute release plan. Proceed to distribution.",
            deadline: new Date(Date.now() + 604800000).toISOString(),
            successMetric: "Release published and measurement begins",
          },
        ]
      : [],
    risks:
      allBlockers.length > 0
        ? ["Blockers prevent publication until resolved"]
        : [],
    blockers: allBlockers.slice(0, 3),
    nextAgent: shouldApprove ? "darkside" : undefined,
    requiredInput:
      shouldRevise || !shouldApprove
        ? `Resolve blockers and resubmit: ${allBlockers.slice(0, 2).join("; ")}`
        : undefined,
  };
}
