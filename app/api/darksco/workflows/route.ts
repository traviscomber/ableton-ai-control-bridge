import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createServerClient();
    
    const { data: workflows, error } = await supabase
      .from("darksco_workflows")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ workflows, ok: true });
  } catch (error: any) {
    console.error("[v0] Workflows GET error:", error.message);
    return NextResponse.json(
      { error: error.message, ok: false },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();

    const { project_id, objective, deadline } = body;

    if (!project_id || !objective || !deadline) {
      return NextResponse.json(
        { error: "Missing required fields", ok: false },
        { status: 400 }
      );
    }

    // Create workflow
    const { data: workflow, error: workflowError } = await supabase
      .from("darksco_workflows")
      .insert({
        project_id,
        objective,
        deadline: new Date(deadline).toISOString(),
        status: "pending",
      })
      .select()
      .single();

    if (workflowError) throw workflowError;

    // Initialize quality gates (6 mandatory checks)
    const gates = [
      "Music approved",
      "Visual approved",
      "Publishing ready",
      "Evidence valid",
      "Rights clear",
      "Final approval",
    ];

    const gateInserts = gates.map((gate_name) => ({
      workflow_id: workflow.id,
      gate_name,
      status: "pending",
      required_by_agent:
        gate_name === "Music approved"
          ? "venom"
          : gate_name === "Visual approved"
            ? "hela"
            : gate_name === "Publishing ready"
              ? "loki"
              : gate_name === "Evidence valid"
                ? "bane"
                : gate_name === "Rights clear"
                  ? "thanos"
                  : "doom",
    }));

    const { error: gatesError } = await supabase
      .from("quality_gates")
      .insert(gateInserts);

    if (gatesError) throw gatesError;

    // Log audit event
    await supabase.from("workflow_audit").insert({
      workflow_id: workflow.id,
      event_type: "CREATED",
      action: "Workflow created by Darkside",
      details: { project_id, objective },
    });

    return NextResponse.json({ workflow, ok: true });
  } catch (error: any) {
    console.error("[v0] Workflows POST error:", error.message);
    return NextResponse.json(
      { error: error.message, ok: false },
      { status: 500 }
    );
  }
}
