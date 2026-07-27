import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { AgentResponse } from "@/lib/types";

// Generic agent operation handler implementing shared protocol
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
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
  response.status = "APPROVE";
  response.confidence = "HIGH";
  response.facts = [
    "Master audio received and verified",
    "Loudness normalized to -14 LUFS",
    "Mastering chain applied (Fab-Filter Pro-L3)",
  ];
  response.decision = "Music approved for release";
  response.actions = [
    {
      owner: "venom",
      description: "Generate stem exports",
      deadline: new Date(Date.now() + 86400000).toISOString(),
      successMetric: "All stems delivered in WAV format",
    },
  ];
  response.nextAgent = "hela";
  return response;
}

function executeHelaOperation(
  data: any,
  response: AgentResponse
): AgentResponse {
  response.status = "REVISE";
  response.confidence = "MEDIUM";
  response.blockers = [
    "Font license issue: custom typeface not cleared for commercial use",
  ];
  response.recommendation = "Switch to open-source font (Helvetica Neue)";
  response.risks = ["Schedule impact: +2 days for re-render"];
  response.decision = "Visual assets cannot be approved until resolved";
  response.nextAgent = "doom";
  return response;
}

function executeLokiOperation(
  data: any,
  response: AgentResponse
): AgentResponse {
  response.status = "READY";
  response.confidence = "HIGH";
  response.findings = [
    "YouTube metadata validated",
    "Premiere timestamp: 2026-02-14 at 18:00 UTC",
  ];
  response.decision = "Publishing ready";
  response.actions = [
    {
      owner: "loki",
      description: "Schedule YouTube premiere",
      deadline: new Date(Date.now() + 259200000).toISOString(),
      successMetric: "Premiere goes live without errors",
    },
  ];
  response.nextAgent = "bane";
  return response;
}

function executeBaneOperation(
  data: any,
  response: AgentResponse
): AgentResponse {
  response.status = "VALID SIGNAL";
  response.confidence = "HIGH";
  response.facts = [
    "KPI baseline established: 10K target listeners week 1",
    "A/B test setup: thumbnail variants A & B",
    "Measurement plan includes Spotify, YouTube, TikTok tracking",
  ];
  response.decision = "Analytics framework approved";
  response.nextAgent = "thanos";
  return response;
}

function executeThanosOperation(
  data: any,
  response: AgentResponse
): AgentResponse {
  response.status = "COMMERCIAL READY";
  response.confidence = "HIGH";
  response.facts = [
    "Master recording rights: cleared",
    "Composition rights: cleared",
    "Artwork: cleared for commercial use",
  ];
  response.decision = "All rights verified for release";
  response.nextAgent = "doom";
  return response;
}

function executeDoomOperation(
  data: any,
  previousResponses: any[],
  response: AgentResponse
): AgentResponse {
  // Consolidate all agent decisions
  const allApproved = previousResponses.every(
    (r) => !r.blockers || r.blockers.length === 0
  );

  response.status = allApproved ? "APPROVED" : "REVISE";
  response.confidence = "HIGH";
  response.facts = previousResponses.map(
    (r) => `${r.agent_id}: ${r.status}`
  );
  response.decision = allApproved
    ? "All agents approved. Release authorized."
    : "Blockers from agents detected. Require resolution.";
  response.blockers = previousResponses
    .flatMap((r) => r.blockers || [])
    .filter(Boolean);

  return response;
}

function executeDarksideOperation(
  data: any,
  previousResponses: any[],
  response: AgentResponse
): AgentResponse {
  response.status = "ACTIVE";
  response.confidence = "HIGH";
  response.facts = [
    "Release objective: Night Protocol 002",
    `Target date: ${new Date(Date.now() + 604800000).toLocaleDateString()}`,
  ];
  response.decision = "Orchestrating release pipeline";
  response.actions = [
    {
      owner: "darkside",
      description: "Route to Venom for music approval",
      deadline: new Date(Date.now() + 172800000).toISOString(),
      successMetric: "Venom responds with decision",
    },
  ];
  response.nextAgent = "venom";
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
