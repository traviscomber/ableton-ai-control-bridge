"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AGENTS = [
  {
    id: "darkside",
    name: "Darkside",
    role: "Orchestrator",
    icon: "⚙️",
  },
  {
    id: "venom",
    name: "Venom",
    role: "Music Officer",
    icon: "🎵",
  },
  {
    id: "hela",
    name: "Hela",
    role: "Visual Officer",
    icon: "🎨",
  },
  {
    id: "loki",
    name: "Loki",
    role: "Publishing Officer",
    icon: "📺",
  },
  {
    id: "bane",
    name: "Bane",
    role: "Intelligence Officer",
    icon: "📊",
  },
  {
    id: "thanos",
    name: "Thanos",
    role: "Business Officer",
    icon: "⚖️",
  },
  {
    id: "doom",
    name: "Doom",
    role: "Strategic Director",
    icon: "👑",
  },
];

export function WorkflowStatusBoard({
  workflowId,
  workflow,
  onAgentInvoke,
}: {
  workflowId: string;
  workflow: any;
  onAgentInvoke: (agentId: string) => void;
}) {
  const [agentStates, setAgentStates] = useState<Record<string, any>>({});

  useEffect(() => {
    // Fetch latest agent responses
    const fetchStates = async () => {
      try {
        const res = await fetch(`/api/darksco/workflows/${workflowId}`);
        const data = await res.json();
        if (data.ok) {
          setAgentStates(data.workflow?.agent_states || {});
        }
      } catch (error) {
        console.error("Failed to fetch workflow states:", error);
      }
    };

    fetchStates();
    const interval = setInterval(fetchStates, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [workflowId]);

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case "APPROVE":
      case "READY":
      case "APPROVED":
      case "VALID SIGNAL":
      case "COMMERCIAL READY":
        return "bg-green-500/20 border-green-500 text-green-700";
      case "ACTIVE":
      case "REVISE":
        return "bg-yellow-500/20 border-yellow-500 text-yellow-700";
      case "BLOCKED":
      case "REJECT":
      case "REJECTED":
        return "bg-red-500/20 border-red-500 text-red-700";
      default:
        return "bg-slate-500/20 border-slate-500 text-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {AGENTS.map((agent) => {
          const state = agentStates[agent.id];
          const status = state?.status || "PENDING";
          const hasBlockers = state?.blockers?.length > 0;

          return (
            <Card
              key={agent.id}
              className={`border-2 cursor-pointer transition-all hover:shadow-lg ${getStatusColor(status)}`}
              onClick={() => onAgentInvoke(agent.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold">
                      {agent.icon} {agent.name}
                    </CardTitle>
                    <p className="text-xs opacity-70 mt-1">{agent.role}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs">
                  <span className="font-semibold">Status: </span>
                  <span className="font-mono">{status}</span>
                </div>
                {state?.confidence && (
                  <div className="text-xs">
                    <span className="font-semibold">Confidence: </span>
                    <span className="font-mono">{state.confidence}</span>
                  </div>
                )}
                {hasBlockers && (
                  <div className="text-xs text-red-600 mt-2">
                    ⚠️ {state.blockers.length} blockers
                  </div>
                )}
                {state?.facts?.length > 0 && (
                  <ul className="text-xs space-y-1 mt-2 opacity-70">
                    {state.facts.slice(0, 2).map((fact: string, i: number) => (
                      <li key={i} className="line-clamp-1">
                        • {fact}
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  size="sm"
                  className="w-full mt-3 h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAgentInvoke(agent.id);
                  }}
                  disabled={!state || status === "ACTIVE"}
                >
                  {status === "ACTIVE" ? "Running..." : "Invoke"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quality Gates Summary */}
      <Card className="border-2 border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm">Quality Gates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {workflow?.quality_gates?.map((gate: any) => (
              <div
                key={gate.id}
                className={`p-2 rounded text-xs text-center font-mono ${
                  gate.status === "passed"
                    ? "bg-green-100 text-green-800"
                    : gate.status === "failed"
                      ? "bg-red-100 text-red-800"
                      : "bg-slate-100 text-slate-800"
                }`}
              >
                {gate.gate_name.split(" ")[0]}
                <div className="text-xs opacity-70">{gate.status}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
