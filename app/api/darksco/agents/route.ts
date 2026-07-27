import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { AgentResponse } from "@/lib/types";

// Generic agent operation handler implementing shared protocol
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { workflow_id, agent_id, operation_data } = body;

    if (!workflow_id || !agent_id) {
      return NextResponse.json(
        { error: "Missing workflow_id or agent_id", ok: false },
        { status: 400 }
      );
    }

    // Get workflow context
    const { data: workflow, error: workflowError } = await supabase
      .from("darksco_workflows")
      .select("*")
      .eq("id", workflow_id)
      .single();

    if (workflowError || !workflow) {
      throw new Error("Workflow not found");
    }

    // Get previous agent responses for context
    const { data: previousResponses } = await supabase
      .from("agent_responses")
      .select("*")
      .eq("workflow_id", workflow_id);

    // Execute agent-specific logic
    const response = await executeAgentOperation(
      agent_id,
      operation_data,
      workflow,
      previousResponses || []
    );

    // Store response in database
    const { data: storedResponse, error: storeError } = await supabase
      .from("agent_responses")
      .upsert({
        workflow_id,
        agent_id,
        status: response.status,
        confidence: response.confidence,
        facts: response.facts,
        findings: response.findings,
        decision: response.decision,
        recommendation: response.recommendation,
        actions: response.actions,
        risks: response.risks,
        blockers: response.blockers,
        next_agent: response.nextAgent,
        required_input: response.requiredInput,
        responded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (storeError) throw storeError;

    // Update quality gates if applicable
    await updateQualityGates(supabase, workflow_id, agent_id, response);

    // Handle escalations to Doom if blockers exist
    if (response.blockers && response.blockers.length > 0) {
      await createEscalation(
        supabase,
        workflow_id,
        agent_id,
        response.blockers
      );
    }

    // Log audit event
    await supabase.from("workflow_audit").insert({
      workflow_id,
      event_type: "AGENT_RESPONSE",
      agent_id,
      action: `${agent_id} responded with status: ${response.status}`,
      details: { status: response.status, confidence: response.confidence },
    });

    // Update workflow status
    if (response.nextAgent) {
      await supabase
        .from("darksco_workflows")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", workflow_id);
    }

    return NextResponse.json({ response: storedResponse, ok: true });
  } catch (error: any) {
    console.error("[v0] Agent operation error:", error.message);
    return NextResponse.json(
      { error: error.message, ok: false },
      { status: 500 }
    );
  }
}

async function executeAgentOperation(
  agentId: string,
  operationData: any,
  workflow: any,
  previousResponses: any[]
): Promise<AgentResponse> {
  // Agent-specific implementation logic
  const baseResponse: AgentResponse = {
    agentId: agentId as any,
    status: "PENDING" as any,
    confidence: "MEDIUM",
    facts: [],
    findings: [],
    actions: [],
    risks: [],
    blockers: [],
    respondedAt: new Date().toISOString(),
  };

  switch (agentId.toLowerCase()) {
    case "venom":
      return executeVenomOperation(operationData, baseResponse);
    case "hela":
      return executeHelaOperation(operationData, baseResponse);
    case "loki":
      return executeLokiOperation(operationData, baseResponse);
    case "bane":
      return executeBaneOperation(operationData, baseResponse);
    case "thanos":
      return executeThanosOperation(operationData, baseResponse);
    case "doom":
      return executeDoomOperation(operationData, previousResponses, baseResponse);
    case "darkside":
      return executeDarksideOperation(operationData, previousResponses, baseResponse);
    default:
      throw new Error(`Unknown agent: ${agentId}`);
  }
}

function executeVenomOperation(
  data: any,
  response: AgentResponse
): AgentResponse {
  // Venom: Chief Music Officer - Protect sonic identity, reject weak material, build release quality
  
  const { tracks, sessions, catalogue_state } = data || {};
  
  // Music quality scoring system
  const scoreMusic = (track: any): { score: number; gaps: string[] } => {
    const gaps: string[] = [];
    let score = 0;

    // Sonic identity and DARKSCO continuity (weight: 20%)
    if (!track.darksco_identity) gaps.push("Lacks DARKSCO sonic signature");
    else score += 20;

    // Mix readiness and technical quality (weight: 20%)
    if (track.headroom_db < 3) gaps.push("Insufficient headroom for mastering");
    if (track.frequency_balance !== "balanced") gaps.push("Frequency imbalance detected");
    if (!gaps.some(g => g.includes("headroom") || g.includes("Frequency"))) score += 20;

    // Composition and arrangement (weight: 15%)
    if (track.arrangement_clarity) score += 15;
    else gaps.push("Arrangement lacks clarity or purpose");

    // Emotional impact and repeat-listening value (weight: 15%)
    if (track.emotional_depth) score += 15;
    else gaps.push("Insufficient emotional payload");

    // Originality and distinctiveness (weight: 15%)
    if (track.originality_rating >= 7) score += 15;
    else gaps.push("Originality below release threshold (7/10 minimum)");

    // Session function and catalogue fit (weight: 10%)
    if (track.session_function && track.catalogue_placement) score += 10;
    else gaps.push("Session function or catalogue placement undefined");

    // Licensing potential and commercial viability (weight: 5%)
    if (track.licensing_ready) score += 5;

    return { score, gaps };
  };

  // Evaluate all tracks
  const trackEvals = (tracks || []).map((t: any) => ({
    ...t,
    ...scoreMusic(t),
  }));

  // Separate into approve/revise/reject
  const approved = trackEvals.filter((t: any) => t.score >= 80 && t.gaps.length === 0);
  const revise = trackEvals.filter((t: any) => t.score >= 60 && t.score < 80);
  const reject = trackEvals.filter((t: any) => t.score < 60);

  // Never fill duration with weak material
  const shouldApprove = approved.length > 0 && reject.length === 0;
  const catalogueStrengthened = approved.length >= (tracks?.length || 1) * 0.7;

  response.status = shouldApprove && catalogueStrengthened ? "APPROVE" : revise.length > 0 ? "REVISE" : "REJECT";
  response.confidence = reject.length === 0 ? "HIGH" : "MEDIUM";

  response.facts = [
    `Material evaluated: ${tracks?.length || 0} tracks`,
    `Approved: ${approved.length} (score ≥80)`,
    `Requires revision: ${revise.length} (score 60-79)`,
    `Rejected: ${reject.length} (score <60 or quality failures)`,
    `Catalogue state: ${catalogue_state || "needs classification"}`,
  ];

  response.findings = [
    ...reject.flatMap((t: any) => t.gaps.map((g: string) => `${t.name}: ${g}`)),
    ...revise.flatMap((t: any) => 
      t.gaps.map((g: string) => `[REVISE] ${t.name}: ${g}`)
    ),
  ];

  response.decision =
    response.status === "APPROVE"
      ? `${approved.length} tracks approved for release. Catalogue strengthened.`
      : response.status === "REVISE"
        ? `${revise.length} tracks require revision before approval. ${reject.length} rejected (sub-threshold).`
        : `All ${reject.length} tracks rejected. Catalogue protection enforced. No weak material proceeds.`;

  // Assign session functions and next steps
  response.actions = [
    ...approved.map((t: any) => ({
      owner: "venom" as any,
      description: `Classify "${t.name}" as ${t.session_function || "undefined"} and assign catalogue placement`,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      successMetric: "Session function and Morning/Noon/Night placement defined",
    })),
    ...revise.map((t: any) => ({
      owner: "venom" as any,
      description: `Guide revision: "${t.name}" (${t.score}/100). Target: fix ${t.gaps.slice(0, 2).join(", ")}`,
      deadline: new Date(Date.now() + 259200000).toISOString(),
      successMetric: "Track resubmitted and scored ≥80",
    })),
  ];

  response.risks = [
    ...(reject.length > 0 ? [`${reject.length} rejected tracks may be repurposed for catalogue growth experiments`] : []),
    ...(revise.length > 0 ? [`Revision timeline: +${revise.length * 2}-${revise.length * 4} days per track`] : []),
  ];

  response.nextAgent = response.status === "APPROVE" ? "hela" : "doom";
  return response;
}

function executeHelaOperation(
  data: any,
  response: AgentResponse
): AgentResponse {
  // Hela: Chief Design Officer - Make DARKSCO visually recognisable before the audience reads the name
  
  const { music_direction, approved_assets, visual_system } = data || {};
  
  // Visual consistency check against DARKSCO architecture
  const validateVisualSystem = (assets: any[]): { valid: boolean; issues: string[] } => {
    const issues: string[] = [];
    
    // Check DARKSCO continuity (Morning/Noon/Night architecture)
    const morning = assets.filter((a: any) => a.classification === "morning");
    const noon = assets.filter((a: any) => a.classification === "noon");
    const night = assets.filter((a: any) => a.classification === "night");
    
    if (morning.length === 0) issues.push("Morning palette (mist, water, pale light) missing");
    if (noon.length === 0) issues.push("Noon palette (brutalism, geometry, daylight) missing");
    if (night.length === 0) issues.push("Night palette (subterranean, machinery, plasma light) missing");
    
    // Check for generic/cliché rejection
    const generic = assets.filter((a: any) => a.tags?.includes("generic-cyberpunk") || a.tags?.includes("ai-generic"));
    if (generic.length > 0) issues.push(`${generic.length} generic/AI-generated assets. Require human art direction.`);
    
    // Check source records and rights
    const incomplete_rights = assets.filter((a: any) => !a.source_record || !a.rights_verified);
    if (incomplete_rights.length > 0) issues.push(`${incomplete_rights.length} assets missing source records or rights verification`);
    
    // Check motion language consistency
    const motion_assets = assets.filter((a: any) => a.has_motion);
    if (motion_assets.length > 0) {
      const inconsistent_motion = motion_assets.filter((a: any) => !a.motion_language_aligned);
      if (inconsistent_motion.length > 0) issues.push(`Motion language inconsistent in ${inconsistent_motion.length} assets`);
    }
    
    // Check thumbnail legibility
    const thumbnails = assets.filter((a: any) => a.format === "thumbnail");
    if (thumbnails.length > 0) {
      const illegible = thumbnails.filter((a: any) => !a.legible_at_small_scale);
      if (illegible.length > 0) issues.push(`${illegible.length} thumbnails fail legibility at YouTube scale`);
    }
    
    return { valid: issues.length === 0, issues };
  };
  
  const validation = validateVisualSystem(approved_assets || []);
  
  response.status = validation.valid ? "APPROVE" : validation.issues.length <= 2 ? "REVISE" : "REJECT";
  response.confidence = validation.valid ? "HIGH" : validation.issues.length <= 1 ? "MEDIUM" : "LOW";
  
  response.facts = [
    `Visual assets evaluated: ${approved_assets?.length || 0}`,
    `DARKSCO continuity: ${!validation.issues.some(i => i.includes("palette")) ? "✓ Complete" : "✗ Gaps"}`,
    `Consistency check: ${validation.issues.length === 0 ? "PASS" : "FAIL"}`,
    `Source records: ${approved_assets?.filter((a: any) => a.source_record && a.rights_verified).length || 0}/${approved_assets?.length || 0}`,
  ];
  
  response.findings = validation.issues;
  
  response.decision =
    response.status === "APPROVE"
      ? "Visual system approved. DARKSCO identity preserved. Ready for publishing."
      : response.status === "REVISE"
        ? "Visual issues identified. Fixable revisions required. See blockers."
        : "Visual system fails critical DARKSCO standards. Escalating to Doom.";
  
  response.blockers = validation.issues;
  
  response.actions = validation.issues.map((issue: string) => ({
    owner: "hela" as any,
    description: `Resolve: ${issue}`,
    deadline: new Date(Date.now() + 172800000).toISOString(),
    successMetric: `Issue resolved and verified. Asset resubmitted for approval.`,
  }));
  
  response.risks = [
    ...(validation.issues.length > 0 ? [`Schedule impact: +${validation.issues.length} days per revision cycle`] : []),
    ...(approved_assets?.filter((a: any) => !a.source_record || !a.rights_verified).length > 0 ? ["Rights verification delay possible with third-party assets"] : []),
  ];
  
  response.nextAgent = response.status === "APPROVE" ? "loki" : "doom";
  return response;
}

function executeLokiOperation(
  data: any,
  response: AgentResponse
): AgentResponse {
  // Loki: Chief Publishing Officer - Turn approved work into precise, discoverable releases
  
  const { metadata, audio_file, video_file, captions, credits, playlist, premiere_schedule } = data || {};
  
  // Publishing QA checklist (all must pass before marking READY)
  const publishingQA = {
    audio_verified: !!audio_file?.format && audio_file?.duration > 0,
    video_verified: !!video_file?.format && video_file?.resolution,
    metadata_complete: !!metadata?.title && !!metadata?.description && !!metadata?.chapters,
    captions_present: !!captions && captions.length > 0,
    credits_verified: !!credits && credits.length > 0,
    thumbnail_verified: !!video_file?.thumbnail_path,
    playlist_placement: !!playlist?.name && !!playlist?.position,
    rights_cleared: metadata?.rights_status === "cleared",
    premiere_scheduled: !!premiere_schedule?.timestamp,
    end_screens_configured: !!metadata?.end_screens,
  };
  
  const qa_passed = Object.values(publishingQA).filter(Boolean).length;
  const qa_total = Object.keys(publishingQA).length;
  const qa_complete = qa_passed === qa_total;
  
  // Before marking READY, all checks must pass
  const blockers: string[] = [];
  if (!publishingQA.audio_verified) blockers.push("Audio file verification failed");
  if (!publishingQA.video_verified) blockers.push("Video file or resolution invalid");
  if (!publishingQA.metadata_complete) blockers.push("Metadata incomplete (title, description, chapters required)");
  if (!publishingQA.captions_present) blockers.push("Captions missing");
  if (!publishingQA.credits_verified) blockers.push("Credits incomplete");
  if (!publishingQA.thumbnail_verified) blockers.push("Thumbnail not verified");
  if (!publishingQA.rights_cleared) blockers.push("Rights clearance not confirmed");
  if (!publishingQA.premiere_scheduled) blockers.push("Premiere timestamp not scheduled");
  
  response.status = qa_complete ? "READY" : blockers.length <= 2 ? "BLOCKED" : "BLOCKED";
  response.confidence = qa_complete ? "HIGH" : "LOW";
  
  response.facts = [
    `Publishing QA: ${qa_passed}/${qa_total} checks passed`,
    `Audio file: ${audio_file?.format || "missing"} (${audio_file?.duration || 0}s)`,
    `Video file: ${video_file?.format || "missing"} (${video_file?.resolution || "unknown"})`,
    `Premiere: ${premiere_schedule?.timestamp ? new Date(premiere_schedule.timestamp).toUTCString() : "not scheduled"}`,
    `Playlist: ${playlist?.name || "not assigned"}`,
  ];
  
  response.findings = [
    `Metadata quality: ${metadata?.title?.length || 0} chars in title, ${metadata?.description?.length || 0} chars in description`,
    `Captions: ${captions?.length || 0} language tracks`,
    `Credits: ${credits?.length || 0} contributors documented`,
  ];
  
  response.decision =
    response.status === "READY"
      ? `Publishing package complete. All QA checks passed (${qa_total}/${qa_total}). Ready for premiere.`
      : `Publishing blocked. ${blockers.length} critical checks failed. See blockers.`;
  
  response.blockers = blockers;
  
  response.actions = [
    {
      owner: "loki" as any,
      description: `Schedule premiere: ${premiere_schedule?.timestamp ? new Date(premiere_schedule.timestamp).toUTCString() : "undefined"}`,
      deadline: new Date(Date.now() + 604800000).toISOString(),
      successMetric: "Premiere goes live and broadcasts without errors",
    },
    {
      owner: "loki" as any,
      description: "Post-publication verification: confirm all metadata live, chapters present, end-screens active",
      deadline: new Date(Date.now() + 3600000).toISOString(),
      successMetric: "All public-facing elements verified correct",
    },
  ];
  
  response.risks = [
    ...(blockers.length > 0 ? [`Publishing delay: ${blockers.length} issues to resolve`] : []),
    ...(captions.length === 0 ? ["No captions: reduced accessibility and international reach"] : []),
    ...(!playlist?.name ? ["Not in playlist: discovery impact on first 48 hours"] : []),
  ];
  
  response.nextAgent = response.status === "READY" ? "bane" : "doom";
  return response;
}

function executeBaneOperation(
  data: any,
  response: AgentResponse
): AgentResponse {
  // Bane: Chief Intelligence Officer - Produce reliable evidence without confusing correlation with causation
  
  const { baseline_metrics, comparison_cohorts, experiment_hypothesis, release_data } = data || {};
  
  // Evidence validation: separate facts from assumptions
  const validateEvidence = (metrics: any): { valid: boolean; gaps: string[]; confidence: string } => {
    const gaps: string[] = [];
    
    if (!metrics?.impressions) gaps.push("Impressions data missing");
    if (!metrics?.click_through_rate) gaps.push("Click-through rate unavailable");
    if (!metrics?.retention_30sec) gaps.push("30-second retention data missing");
    if (!metrics?.average_view_duration) gaps.push("Average view duration not calculated");
    if (!metrics?.returning_viewers) gaps.push("Returning viewer cohort not identified");
    if (!metrics?.subscriber_acquisition) gaps.push("Subscriber acquisition tracking missing");
    
    // Confidence based on data completeness
    const completeness = (6 - gaps.length) / 6;
    let confidence = "LOW";
    if (completeness >= 0.85) confidence = "HIGH";
    else if (completeness >= 0.65) confidence = "MEDIUM";
    
    return { valid: gaps.length === 0, gaps, confidence };
  };
  
  const evidence = validateEvidence(baseline_metrics || {});
  
  // Experiment design validation
  const experimentValid = 
    !!experiment_hypothesis?.variable &&
    !!experiment_hypothesis?.control &&
    !!experiment_hypothesis?.test &&
    !!experiment_hypothesis?.duration_days &&
    !!experiment_hypothesis?.success_metric;
  
  response.status = evidence.valid && experimentValid ? "VALID SIGNAL" : evidence.valid ? "INCONCLUSIVE" : "ACTION REQUIRED";
  response.confidence = evidence.confidence as any;
  
  response.facts = [
    `Baseline metrics: ${Object.keys(baseline_metrics || {}).length} KPIs tracked`,
    `Cohorts analyzed: ${comparison_cohorts?.length || 0}`,
    `Data completeness: ${((6 - evidence.gaps.length) / 6 * 100).toFixed(0)}%`,
    `Experiment hypothesis: ${experimentValid ? "valid" : "incomplete"}`,
  ];
  
  response.findings = [
    ...evidence.gaps,
    ...(!experimentValid ? ["Experiment design incomplete or missing required variables"] : []),
    ...(release_data?.age_days && release_data.age_days < 3 ? ["Data collection window too short (< 3 days). Early signals only."] : []),
  ];
  
  response.decision =
    response.status === "VALID SIGNAL"
      ? `Evidence quality: HIGH. Baseline established, experiment design valid, ${comparison_cohorts?.length || 0} cohorts ready for analysis.`
      : response.status === "INCONCLUSIVE"
        ? "Metrics present but incomplete. More data collection needed before experiment launch."
        : "Critical measurement gaps. Define baseline before proceeding with A/B testing.";
  
  response.recommendation =
    response.status === "VALID SIGNAL"
      ? `Launch controlled experiment: ${experiment_hypothesis?.variable} variant vs. control. Success metric: ${experiment_hypothesis?.success_metric}`
      : "Establish complete baseline metrics before A/B testing. See gaps below.";
  
  response.actions = [
    {
      owner: "bane" as any,
      description: `Setup tracking dashboard: ${baseline_metrics ? "impressions, CTR, 30-sec retention, AVD, retention, subscribers" : "all KPIs"}`,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      successMetric: "Real-time dashboard operational and verified",
    },
    {
      owner: "bane" as any,
      description: `Launch experiment: Test ${experiment_hypothesis?.variable || "undefined variable"}. Control vs. treatment. Duration: ${experiment_hypothesis?.duration_days || "undefined"}`,
      deadline: new Date(Date.now() + 604800000).toISOString(),
      successMetric: `Collect ${experiment_hypothesis?.duration_days || 7}-day window of data. Success metric: ${experiment_hypothesis?.success_metric || "undefined"}`,
    },
  ];
  
  response.risks = [
    ...(evidence.gaps.length > 0 ? [`${evidence.gaps.length} data gaps increase decision uncertainty`] : []),
    ...(!experimentValid ? ["Experiment design incomplete; results may be inconclusive"] : []),
    ...(release_data?.age_days && release_data.age_days < 7 ? ["Early-stage data: patterns may reverse as audience matures"] : []),
    "Do not optimize only for clicks. Do not change DARKSCO identity based on single release.",
  ];
  
  response.nextAgent = response.status === "VALID SIGNAL" ? "thanos" : "doom";
  return response;
}

function executeThanosOperation(
  data: any,
  response: AgentResponse
): AgentResponse {
  // Thanos: Chief Business Officer - Block any publication with uncertain ownership or usage rights
  
  const { rights_records, contributors, samples, visual_rights, master_rights, licensing_offers } = data || {};
  
  // Rights verification checklist
  const verifyRights = (records: any): { blocked: string[]; cleared: string[]; offers: any[] } => {
    const blocked: string[] = [];
    const cleared: string[] = [];
    
    // Master recording rights
    if (!records?.master_ownership) blocked.push("Master recording ownership not verified");
    else cleared.push("Master recording rights");
    
    // Composition rights
    if (!records?.composition_ownership) blocked.push("Composition ownership not verified");
    else cleared.push("Composition rights");
    
    // Samples
    if (records?.samples && records.samples.length > 0) {
      const uncleared_samples = records.samples.filter((s: any) => !s.license_verified);
      if (uncleared_samples.length > 0) blocked.push(`${uncleared_samples.length} samples without verified licenses`);
      else cleared.push(`${records.samples.length} samples licensed`);
    }
    
    // Visual assets
    if (records?.visual_assets && records.visual_assets.length > 0) {
      const uncleared_assets = records.visual_assets.filter((a: any) => !a.rights_verified);
      if (uncleared_assets.length > 0) blocked.push(`${uncleared_assets.length} visual assets without rights verification`);
      else cleared.push(`${records.visual_assets.length} visual assets cleared`);
    }
    
    // Contributors
    if (records?.contributors && records.contributors.length > 0) {
      const undocumented = records.contributors.filter((c: any) => !c.role_documented || !c.compensation_agreed);
      if (undocumented.length > 0) blocked.push(`${undocumented.length} contributors without documented roles or compensation`);
      else cleared.push(`${records.contributors.length} contributors documented`);
    }
    
    // Metadata completeness
    if (!records?.metadata_complete) blocked.push("Metadata incomplete (ISRC, UPC, writers, producers, etc.)");
    else cleared.push("Metadata complete");
    
    return { blocked, cleared, offers: licensing_offers || [] };
  };
  
  const verification = verifyRights(rights_records || {});
  
  response.status = verification.blocked.length === 0 ? "COMMERCIAL READY" : "BLOCKED";
  response.confidence = verification.blocked.length === 0 ? "HIGH" : "LOW";
  
  response.facts = [
    `Rights verification: ${verification.blocked.length} blockers, ${verification.cleared.length} cleared`,
    ...verification.cleared,
    `Contributors: ${contributors?.length || 0} documented`,
    `Licensing offers: ${verification.offers.length} potential revenue streams`,
  ];
  
  response.findings = [
    ...verification.blocked.map((b: string) => `BLOCKER: ${b}`),
    ...(!verification.blocked.length ? ["All rights verified. Commercial readiness confirmed."] : []),
  ];
  
  response.decision =
    response.status === "COMMERCIAL READY"
      ? `Commercial release approved. ${verification.cleared.length} cleared items. Ready for publication and licensing.`
      : `Commercial release BLOCKED. ${verification.blocked.length} critical issues must be resolved before publication.`;
  
  response.blockers = verification.blocked;
  
  response.actions = [
    ...verification.blocked.map((blocker: string) => ({
      owner: "thanos" as any,
      description: `Resolve: ${blocker}`,
      deadline: new Date(Date.now() + 259200000).toISOString(),
      successMetric: "Issue resolved, verified, and documented",
    })),
    {
      owner: "thanos" as any,
      description: `Evaluate ${verification.offers.length} licensing opportunities. Model economics and recommend top 3.`,
      deadline: new Date(Date.now() + 604800000).toISOString(),
      successMetric: "3 ranked licensing offers with revenue projections",
    },
  ];
  
  response.risks = [
    ...(verification.blocked.length > 0 ? ["Publication and commercial use blocked until rights resolved."] : []),
    ...(!rights_records?.metadata_complete ? ["Metadata gaps may delay distribution to partners."] : []),
    "Exclusive or ownership-transfer agreements require Doom escalation.",
  ];
  
  response.nextAgent = response.status === "COMMERCIAL READY" ? "doom" : "doom";
  return response;
}

function executeDoomOperation(
  data: any,
  previousResponses: any[],
  response: AgentResponse
): AgentResponse {
  // Doom: Chief Strategy Officer - Final strategic decision-maker. Quality outranks frequency. Identity outranks trends.
  
  // Consolidate agent reports and identify conflicts
  const agentStatuses = previousResponses.map(r => ({
    agent: r.agent_id,
    status: r.status,
    confidence: r.confidence,
    blockers: r.blockers || [],
    findings: r.findings || [],
  }));
  
  // Check all mandatory quality gates
  const mandatoryGates = [
    { agent: "venom", required: ["APPROVE"] },
    { agent: "hela", required: ["APPROVE"] },
    { agent: "loki", required: ["READY"] },
    { agent: "bane", required: ["VALID SIGNAL"] },
    { agent: "thanos", required: ["COMMERCIAL READY"] },
  ];
  
  const gatesStatus = mandatoryGates.map(gate => {
    const agentResponse = agentStatuses.find(a => a.agent === gate.agent);
    return {
      gate: `${gate.agent} - quality gate`,
      passed: agentResponse && gate.required.includes(agentResponse.status),
      status: agentResponse?.status || "MISSING",
      confidence: agentResponse?.confidence || "LOW",
    };
  });
  
  const allGatesPassed = gatesStatus.every(g => g.passed);
  const blockers = previousResponses.flatMap(r => r.blockers || []).filter(Boolean);
  
  // Decision logic: Quality > Frequency, Identity > Trends, Rights > Speed
  const shouldApprove = allGatesPassed && blockers.length === 0;
  const shouldRevise = !allGatesPassed && blockers.length <= 3;
  
  response.status = shouldApprove ? "APPROVED" : shouldRevise ? "REVISE" : "REJECT";
  response.confidence = shouldApprove ? "HIGH" : "MEDIUM";
  
  response.facts = [
    `Quality gates: ${gatesStatus.filter(g => g.passed).length}/${gatesStatus.length} passed`,
    ...gatesStatus.map(g => `${g.gate}: ${g.passed ? "PASS" : "FAIL"} (${g.status})`),
    `Critical blockers: ${blockers.length}`,
    `Average agent confidence: ${(agentStatuses.reduce((acc, a) => acc + (a.confidence === "HIGH" ? 3 : a.confidence === "MEDIUM" ? 2 : 1), 0) / agentStatuses.length).toFixed(1)}/3.0`,
  ];
  
  response.findings = [
    "Decision principle: Quality outranks frequency. Identity outranks trends. Rights outrank speed.",
    ...blockers.map(b => `BLOCKER: ${b}`),
    ...(allGatesPassed ? ["All mandatory quality gates passed."] : []),
  ];
  
  response.decision =
    response.status === "APPROVED"
      ? `APPROVED for release. All ${gatesStatus.length} quality gates passed. Go to execution.`
      : response.status === "REVISE"
        ? `REVISE required. ${blockers.length} blockers must be resolved. ${gatesStatus.filter(g => !g.passed).length} gates not yet passed.`
        : `REJECTED. ${gatesStatus.filter(g => !g.passed).length} gates failed. ${blockers.length} critical blockers. Escalate to roadmap review.`;
  
  response.actions = [
    {
      owner: "darkside" as any,
      description: response.status === "APPROVED" 
        ? "Execute release plan. Route to publishing and measurement teams."
        : "Coordinate with agents to resolve blockers. Re-submit when gates pass.",
      deadline: new Date(Date.now() + (response.status === "APPROVED" ? 604800000 : 1209600000)).toISOString(),
      successMetric: response.status === "APPROVED" 
        ? "Release goes live and measurement begins"
        : "All blockers resolved, gates re-evaluated",
    },
  ];
  
  response.nextAgent = response.status === "APPROVED" ? "darkside" : undefined;
  return response;
}

function executeDarksideOperation(
  data: any,
  previousResponses: any[],
  response: AgentResponse
): AgentResponse {
  // Darkside: Team Orchestrator - Convert goals into execution plans. Route to correct agents. Enforce dependencies.
  
  const { objective, deadline, constraints, available_inputs } = data || {};
  
  // Identify required agents based on task scope
  const determineRequiredAgents = (objective: string): string[] => {
    const required: string[] = [];
    
    // Always start with Venom for music quality
    if (objective?.includes("release") || objective?.includes("music") || objective?.includes("track")) {
      required.push("venom");
    }
    
    // Add Hela for visual elements
    if (objective?.includes("visual") || objective?.includes("thumbnail") || objective?.includes("cinema")) {
      required.push("hela");
    }
    
    // Add Loki for publishing
    if (objective?.includes("publish") || objective?.includes("premiere") || objective?.includes("youtube")) {
      required.push("loki");
    }
    
    // Add Bane for measurement
    if (objective?.includes("measure") || objective?.includes("experiment") || objective?.includes("analytics")) {
      required.push("bane");
    }
    
    // Add Thanos for commercial/rights
    if (objective?.includes("commercial") || objective?.includes("license") || objective?.includes("sell")) {
      required.push("thanos");
    }
    
    // Doom for strategic decisions
    required.push("doom");
    
    return required;
  };
  
  const requiredAgents = determineRequiredAgents(objective);
  
  // Map dependencies: agents that must complete before others start
  const agentDependencies: { [key: string]: string[] } = {
    "venom": [],
    "hela": ["venom"],
    "loki": ["venom", "hela"],
    "bane": ["loki"],
    "thanos": ["venom"],
    "doom": ["venom", "hela", "loki", "bane", "thanos"],
  };
  
  // Detect blockers from previous responses
  const previousBlockers = previousResponses.flatMap(r => r.blockers || []).filter(Boolean);
  const previousConflicts = previousResponses.filter(r => r.status === "REVISE" || r.status === "BLOCKED").map(r => r.agent_id);
  
  // Build execution plan
  const executionPlan: any[] = [];
  requiredAgents.forEach(agent => {
    const deps = agentDependencies[agent] || [];
    executionPlan.push({
      agent,
      dependencies: deps,
      task: `${agent}: Execute quality gate review`,
      deadline: new Date(Date.now() + 86400000 * (executionPlan.length + 1)).toISOString(),
      successMetric: `${agent} returns decision with HIGH or MEDIUM confidence`,
    });
  });
  
  response.status = "ACTIVE";
  response.confidence = "HIGH";
  
  response.facts = [
    `Objective: ${objective || "undefined"}`,
    `Deadline: ${deadline ? new Date(deadline).toUTCString() : "not set"}`,
    `Required agents: ${requiredAgents.join(", ")}`,
    `Dependencies mapped: ${requiredAgents.length} agents, ${Math.max(...requiredAgents.map(a => (agentDependencies[a] || []).length))} levels deep`,
    `Previous blockers: ${previousBlockers.length}`,
  ];
  
  response.findings = [
    `Execution sequence: ${requiredAgents.join(" → ")}`,
    ...previousBlockers.map(b => `BLOCKER DETECTED: ${b}`),
    ...(previousConflicts.length > 0 ? [`${previousConflicts.length} agents returned conflicting recommendations`] : []),
  ];
  
  response.decision = `Orchestrating release pipeline. ${requiredAgents.length} agents required. Execution order enforces dependencies.`;
  
  response.actions = executionPlan.map((plan, idx) => ({
    owner: "darkside" as any,
    description: `[${idx + 1}/${executionPlan.length}] Route to ${plan.agent}: ${plan.task}`,
    deadline: plan.deadline,
    successMetric: plan.successMetric,
  }));
  
  response.risks = [
    ...previousBlockers.map(b => `Blocker: ${b}`),
    ...(previousConflicts.length > 0 ? [`Conflicting recommendations from ${previousConflicts.join(", ")}. Escalate to Doom.`] : []),
    ...(requiredAgents.length > 5 ? ["Complex pipeline. Risk of execution delays."] : []),
  ];
  
  response.nextAgent = (requiredAgents[0] || "venom") as any;
  return response;
}

async function updateQualityGates(
  supabase: any,
  workflowId: string,
  agentId: string,
  response: AgentResponse
) {
  const gateMap: { [key: string]: string } = {
    venom: "Music approved",
    hela: "Visual approved",
    loki: "Publishing ready",
    bane: "Evidence valid",
    thanos: "Rights clear",
    doom: "Final approval",
  };

  const gateName = gateMap[agentId.toLowerCase()];
  if (!gateName) return;

  const gateStatus =
    response.status === "APPROVE" ||
    response.status === "APPROVED" ||
    response.status === "READY" ||
    response.status === "VALID SIGNAL" ||
    response.status === "COMMERCIAL READY"
      ? "passed"
      : response.blockers && response.blockers.length > 0
        ? "failed"
        : "pending";

  await supabase
    .from("quality_gates")
    .update({
      status: gateStatus,
      checked_at: new Date().toISOString(),
    })
    .eq("workflow_id", workflowId)
    .eq("gate_name", gateName);
}

async function createEscalation(
  supabase: any,
  workflowId: string,
  agentId: string,
  blockers: string[]
) {
  await supabase.from("escalations").insert({
    workflow_id: workflowId,
    escalated_from_agent: agentId,
    reason: blockers.join("; "),
    doom_status: "PENDING",
  });
}
