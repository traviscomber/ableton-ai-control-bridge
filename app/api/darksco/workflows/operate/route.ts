import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

    // Fetch current workflow
    const { data: workflow, error: workflowError } = await supabase
      .from("darksco_workflows")
      .select("*")
      .eq("id", workflow_id)
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: "Workflow not found", ok: false },
        { status: 404 }
      );
    }

    // Update workflow status to in-progress
    await supabase
      .from("darksco_workflows")
      .update({ status: "in-progress", updated_at: new Date().toISOString() })
      .eq("id", workflow_id);

    // Execute agent operation
    const agentResponse = await executeAgent(
      agent_id,
      operation_data,
      workflow_id,
      supabase
    );

    // Store agent response
    const { error: responseError } = await supabase
      .from("agent_responses")
      .upsert({
        workflow_id,
        agent_id,
        status: agentResponse.status,
        confidence: agentResponse.confidence,
        facts: agentResponse.facts,
        findings: agentResponse.findings,
        decision: agentResponse.decision,
        recommendation: agentResponse.recommendation,
        actions: agentResponse.actions,
        risks: agentResponse.risks,
        blockers: agentResponse.blockers,
        next_agent: agentResponse.nextAgent,
        required_input: agentResponse.requiredInput,
        responded_at: new Date().toISOString(),
      });

    if (responseError) throw responseError;

    // Update quality gate status if applicable
    if (agent_id === "venom") {
      await supabase
        .from("quality_gates")
        .update({
          status:
            agentResponse.status === "APPROVE" ||
            agentResponse.status === "APPROVE"
              ? "passed"
              : agentResponse.status === "REJECT"
                ? "failed"
                : "pending",
          checked_at: new Date().toISOString(),
        })
        .eq("workflow_id", workflow_id)
        .eq("gate_name", "Music approved");
    } else if (agent_id === "hela") {
      await supabase
        .from("quality_gates")
        .update({
          status:
            agentResponse.status === "APPROVE"
              ? "passed"
              : agentResponse.blockers?.length > 0
                ? "failed"
                : "pending",
          checked_at: new Date().toISOString(),
        })
        .eq("workflow_id", workflow_id)
        .eq("gate_name", "Visual approved");
    } else if (agent_id === "loki") {
      await supabase
        .from("quality_gates")
        .update({
          status:
            agentResponse.status === "READY"
              ? "passed"
              : agentResponse.blockers?.length > 0
                ? "failed"
                : "pending",
          checked_at: new Date().toISOString(),
        })
        .eq("workflow_id", workflow_id)
        .eq("gate_name", "Publishing ready");
    } else if (agent_id === "bane") {
      await supabase
        .from("quality_gates")
        .update({
          status:
            agentResponse.status === "VALID SIGNAL"
              ? "passed"
              : agentResponse.status === "ACTION REQUIRED"
                ? "failed"
                : "pending",
          checked_at: new Date().toISOString(),
        })
        .eq("workflow_id", workflow_id)
        .eq("gate_name", "Evidence valid");
    } else if (agent_id === "thanos") {
      await supabase
        .from("quality_gates")
        .update({
          status:
            agentResponse.status === "COMMERCIAL READY"
              ? "passed"
              : agentResponse.blockers?.length > 0
                ? "failed"
                : "pending",
          checked_at: new Date().toISOString(),
        })
        .eq("workflow_id", workflow_id)
        .eq("gate_name", "Rights clear");
    }

    // Handle blockers/escalations
    if (agentResponse.blockers?.length > 0 && agent_id !== "doom") {
      const { error: escalationError } = await supabase
        .from("escalations")
        .insert({
          workflow_id,
          escalated_from_agent: agent_id,
          reason: `${agent_id} returned blockers: ${agentResponse.blockers.join("; ")}`,
          decision_needed: `${agentResponse.blockers.join(", ")}`,
          doom_status: "PENDING",
          escalated_at: new Date().toISOString(),
        });

      if (escalationError) console.error("Escalation error:", escalationError);
    }

    // Log audit event
    await supabase.from("workflow_audit").insert({
      workflow_id,
      event_type: "agent_operation",
      agent_id,
      action: `${agent_id} operation completed: ${agentResponse.status}`,
      details: {
        confidence: agentResponse.confidence,
        blockers: agentResponse.blockers?.length || 0,
      },
    });

    // Determine next workflow status
    let nextWorkflowStatus = "in-progress";
    if (agent_id === "doom") {
      if (agentResponse.status === "APPROVED") {
        nextWorkflowStatus = "approved";
      } else if (agentResponse.status === "REJECT") {
        nextWorkflowStatus = "rejected";
      } else if (agentResponse.status === "REVISE") {
        nextWorkflowStatus = "revise";
      }
    }

    if (nextWorkflowStatus !== "in-progress") {
      await supabase
        .from("darksco_workflows")
        .update({
          status: nextWorkflowStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workflow_id);
    }

    return NextResponse.json({
      ok: true,
      agent_response: agentResponse,
      next_agent: agentResponse.nextAgent,
      workflow_status: nextWorkflowStatus,
    });
  } catch (error: any) {
    console.error("[v0] Workflow operate error:", error.message);
    return NextResponse.json(
      { error: error.message, ok: false },
      { status: 500 }
    );
  }
}

async function executeAgent(
  agent_id: string,
  operation_data: any,
  workflow_id: string,
  supabase: any
): Promise<any> {
  // Fetch all previous agent responses for context
  const { data: previousResponses } = await supabase
    .from("agent_responses")
    .select("*")
    .eq("workflow_id", workflow_id)
    .order("responded_at", { ascending: true });

  // Import agent functions dynamically
  const agentHandlers: { [key: string]: (data: any, prevResponses: any[], supabase: any) => Promise<any> } = {
    venom: require("@/lib/agents/venom").executeVenomAgent,
    hela: require("@/lib/agents/hela").executeHelaAgent,
    loki: require("@/lib/agents/loki").executeLokiAgent,
    bane: require("@/lib/agents/bane").executeBaneAgent,
    thanos: require("@/lib/agents/thanos").executeThanosAgent,
    doom: require("@/lib/agents/doom").executeDoomAgent,
    darkside: require("@/lib/agents/darkside").executeDarksideAgent,
  };

  const handler = agentHandlers[agent_id];
  if (!handler) {
    throw new Error(`Unknown agent: ${agent_id}`);
  }

  return await handler(operation_data, previousResponses || [], supabase);
}
