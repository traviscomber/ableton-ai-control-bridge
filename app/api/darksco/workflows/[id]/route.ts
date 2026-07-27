import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: workflowId } = await params;

    // Fetch workflow
    const { data: workflow, error: workflowError } = await supabase
      .from("darksco_workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: "Workflow not found", ok: false },
        { status: 404 }
      );
    }

    // Fetch all agent responses
    const { data: responses, error: responsesError } = await supabase
      .from("agent_responses")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("responded_at", { ascending: true });

    if (responsesError) throw responsesError;

    // Fetch quality gates
    const { data: gates, error: gatesError } = await supabase
      .from("quality_gates")
      .select("*")
      .eq("workflow_id", workflowId);

    if (gatesError) throw gatesError;

    // Fetch escalations
    const { data: escalations, error: escalationsError } = await supabase
      .from("escalations")
      .select("*")
      .eq("workflow_id", workflowId)
      .eq("doom_status", "PENDING");

    if (escalationsError) throw escalationsError;

    // Fetch audit trail
    const { data: audit, error: auditError } = await supabase
      .from("workflow_audit")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (auditError) throw auditError;

    // Transform agent responses into states
    const agent_states: Record<string, any> = {};
    responses?.forEach((r) => {
      agent_states[r.agent_id] = {
        status: r.status,
        confidence: r.confidence,
        facts: r.facts,
        findings: r.findings,
        decision: r.decision,
        blockers: r.blockers,
        risks: r.risks,
        actions: r.actions,
        nextAgent: r.next_agent,
        respondedAt: r.responded_at,
      };
    });

    return NextResponse.json({
      ok: true,
      workflow: {
        ...workflow,
        quality_gates: gates,
        escalations: escalations,
        agent_states,
        audit_trail: audit,
      },
    });
  } catch (error: any) {
    console.error("[v0] Workflow GET error:", error.message);
    return NextResponse.json(
      { error: error.message, ok: false },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: workflowId } = await params;
    const body = await request.json();

    const { status, agent_override } = body;

    if (status) {
      const { error: updateError } = await supabase
        .from("darksco_workflows")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", workflowId);

      if (updateError) throw updateError;

      await supabase.from("workflow_audit").insert({
        workflow_id: workflowId,
        event_type: "status_change",
        action: `Status updated to ${status}`,
        details: { agent_override },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[v0] Workflow PATCH error:", error.message);
    return NextResponse.json(
      { error: error.message, ok: false },
      { status: 500 }
    );
  }
}
