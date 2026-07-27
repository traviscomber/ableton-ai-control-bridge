"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkflowStatusBoard } from "./workflow-status-board";
import { AgentOperationForm } from "./agent-operation-form";
import { ArrowLeft } from "lucide-react";

export function WorkflowDetailClient({
  workflowId,
  initialWorkflow,
}: {
  workflowId: string;
  initialWorkflow: any;
}) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );

  const handleAgentInvoke = (agentId: string) => {
    setSelectedAgent(agentId);
    setMessage(null);
  };

  const handleOperationSubmit = async (data: any) => {
    if (!selectedAgent) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/darksco/workflows/operate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_id: workflowId,
          agent_id: selectedAgent,
          operation_data: data,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Operation failed");
      }

      setMessage({
        type: "success",
        text: `${selectedAgent} operation completed: ${result.agent_response.status}`,
      });

      // Refresh workflow
      const workflowRes = await fetch(`/api/darksco/workflows/${workflowId}`);
      const workflowData = await workflowRes.json();
      if (workflowData.ok) {
        setWorkflow(workflowData.workflow);
      }

      setSelectedAgent(null);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: "bg-slate-100 text-slate-800",
      "in-progress": "bg-blue-100 text-blue-800",
      approved: "bg-green-100 text-green-800",
      revise: "bg-yellow-100 text-yellow-800",
      rejected: "bg-red-100 text-red-800",
    };
    return colors[status as keyof typeof colors] || colors.pending;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{workflow.objective}</h1>
              <p className="text-sm text-slate-600">
                {workflow.project_id} • Deadline:{" "}
                {new Date(workflow.deadline).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded text-sm font-semibold ${getStatusBadge(workflow.status)}`}>
            {workflow.status.toUpperCase()}
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div
            className={`p-4 rounded border-2 ${
              message.type === "success"
                ? "bg-green-50 border-green-300 text-green-800"
                : "bg-red-50 border-red-300 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Board */}
          <div className="lg:col-span-2">
            <WorkflowStatusBoard
              workflowId={workflowId}
              workflow={workflow}
              onAgentInvoke={handleAgentInvoke}
            />
          </div>

          {/* Operation Form */}
          <div>
            {selectedAgent ? (
              <AgentOperationForm
                agentId={selectedAgent}
                workflowId={workflowId}
                onSubmit={handleOperationSubmit}
                isLoading={isLoading}
              />
            ) : (
              <Card className="border-2 border-dashed">
                <CardHeader>
                  <CardTitle className="text-sm">Select Agent</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-600">
                    Click on an agent card to invoke their operation
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Audit Trail */}
        {workflow.audit_trail?.length > 0 && (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-sm">Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {workflow.audit_trail.map((event: any) => (
                  <div
                    key={event.id}
                    className="text-xs p-2 bg-slate-100 rounded border-l-2 border-slate-400"
                  >
                    <div className="font-mono font-semibold">
                      {event.agent_id || event.event_type}
                    </div>
                    <div className="text-slate-600">{event.action}</div>
                    <div className="text-slate-500 text-xs">
                      {new Date(event.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
