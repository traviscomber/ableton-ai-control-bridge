"use client";

import { useState, useCallback } from "react";
import type { DarkscoWorkflow, AgentResponse } from "@/lib/types";

interface UseWorkflowOpsState {
  workflows: DarkscoWorkflow[];
  currentWorkflow: DarkscoWorkflow | null;
  agentResponses: Record<string, AgentResponse>;
  loading: boolean;
  error: string | null;
}

export function useWorkflowOps() {
  const [state, setState] = useState<UseWorkflowOpsState>({
    workflows: [],
    currentWorkflow: null,
    agentResponses: {},
    loading: false,
    error: null,
  });

  // Fetch all workflows
  const fetchWorkflows = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch("/api/darksco/workflows");
      const data = await res.json();

      if (!data.ok) throw new Error(data.error);

      setState((prev) => ({
        ...prev,
        workflows: data.workflows || [],
        loading: false,
      }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        error: error.message,
        loading: false,
      }));
    }
  }, []);

  // Create new workflow
  const createWorkflow = useCallback(
    async (projectId: string, objective: string, deadline: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetch("/api/darksco/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: projectId, objective, deadline }),
        });

        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        setState((prev) => ({
          ...prev,
          workflows: [data.workflow, ...prev.workflows],
          currentWorkflow: data.workflow,
          loading: false,
        }));

        return data.workflow;
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          error: error.message,
          loading: false,
        }));
        throw error;
      }
    },
    []
  );

  // Invoke agent operation
  const invokeAgent = useCallback(
    async (
      workflowId: string,
      agentId: string,
      operationData?: Record<string, any>
    ) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetch("/api/darksco/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflow_id: workflowId,
            agent_id: agentId,
            operation_data: operationData || {},
          }),
        });

        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        const agentResponse: AgentResponse = data.response;

        setState((prev) => ({
          ...prev,
          agentResponses: {
            ...prev.agentResponses,
            [agentId]: agentResponse,
          },
          loading: false,
        }));

        // Refresh workflows to get updated status
        await fetchWorkflows();

        return agentResponse;
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          error: error.message,
          loading: false,
        }));
        throw error;
      }
    },
    [fetchWorkflows]
  );

  // Set current workflow
  const setCurrentWorkflow = useCallback((workflow: DarkscoWorkflow | null) => {
    setState((prev) => ({ ...prev, currentWorkflow: workflow }));
  }, []);

  return {
    ...state,
    fetchWorkflows,
    createWorkflow,
    invokeAgent,
    setCurrentWorkflow,
  };
}
