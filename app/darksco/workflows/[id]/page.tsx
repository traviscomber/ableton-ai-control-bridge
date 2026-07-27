import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkflowDetailClient } from "@/components/darksco/workflow-detail-client";

export default async function WorkflowDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  try {
    // Fetch workflow
    const { data: workflow, error: workflowError } = await supabase
      .from("darksco_workflows")
      .select("*")
      .eq("id", params.id)
      .single();

    if (workflowError || !workflow) {
      notFound();
    }

    return <WorkflowDetailClient workflowId={params.id} initialWorkflow={workflow} />;
  } catch (error) {
    console.error("Error loading workflow:", error);
    notFound();
  }
}
