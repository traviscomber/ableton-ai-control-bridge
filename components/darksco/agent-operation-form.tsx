"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface AgentOperationFormProps {
  agentId: string;
  workflowId: string;
  onSubmit: (data: any) => Promise<void>;
  isLoading?: boolean;
}

export function AgentOperationForm({
  agentId,
  workflowId,
  onSubmit,
  isLoading = false,
}: AgentOperationFormProps) {
  const [formData, setFormData] = useState<any>({});
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await onSubmit(formData);
    } catch (err: any) {
      setError(err.message || "Operation failed");
    }
  };

  const renderFormFields = () => {
    switch (agentId) {
      case "venom":
        return (
          <>
            <div>
              <label className="text-sm font-semibold">Number of Tracks</label>
              <Input
                type="number"
                defaultValue={1}
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    track_count: parseInt(e.target.value),
                  }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Catalogue State</label>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm"
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    catalogue_state: e.target.value,
                  }))
                }
              >
                <option value="new">New</option>
                <option value="established">Established</option>
              </select>
            </div>
          </>
        );
      case "hela":
        return (
          <>
            <div>
              <label className="text-sm font-semibold">Visual Assets Count</label>
              <Input
                type="number"
                defaultValue={3}
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    asset_count: parseInt(e.target.value),
                  }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Design Brief</label>
              <Textarea
                placeholder="Describe visual direction..."
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    visual_brief: e.target.value,
                  }))
                }
              />
            </div>
          </>
        );
      case "loki":
        return (
          <>
            <div>
              <label className="text-sm font-semibold">Premiere Date/Time</label>
              <Input
                type="datetime-local"
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    premiere_timestamp: new Date(e.target.value).toISOString(),
                  }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Metadata Title</label>
              <Input
                placeholder="Track title..."
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
              />
            </div>
          </>
        );
      case "bane":
        return (
          <>
            <div>
              <label className="text-sm font-semibold">Baseline KPI Target</label>
              <Input
                type="number"
                placeholder="e.g., 10000 views"
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    kpi_target: parseInt(e.target.value),
                  }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Experiment Type</label>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm"
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    experiment_type: e.target.value,
                  }))
                }
              >
                <option value="none">No experiment</option>
                <option value="ab_test">A/B Test</option>
                <option value="multivariate">Multivariate</option>
              </select>
            </div>
          </>
        );
      case "thanos":
        return (
          <>
            <div>
              <label className="text-sm font-semibold">All Rights Verified?</label>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm"
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    all_rights_verified: e.target.value === "yes",
                  }))
                }
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold">Licensing Opportunities</label>
              <Input
                type="number"
                placeholder="Number of offers"
                defaultValue={0}
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    licensing_count: parseInt(e.target.value),
                  }))
                }
              />
            </div>
          </>
        );
      case "darkside":
        return (
          <>
            <div>
              <label className="text-sm font-semibold">Release Objective</label>
              <Textarea
                placeholder="Describe the release goal..."
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    objective: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Release Deadline</label>
              <Input
                type="datetime-local"
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    deadline: new Date(e.target.value).toISOString(),
                  }))
                }
              />
            </div>
          </>
        );
      default:
        return (
          <div>
            <label className="text-sm font-semibold">Operation Data (JSON)</label>
            <Textarea
              placeholder="{}"
              onChange={(e) => {
                try {
                  setFormData(JSON.parse(e.target.value));
                  setError("");
                } catch (err) {
                  setError("Invalid JSON");
                }
              }}
            />
          </div>
        );
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-sm">
          {agentId.charAt(0).toUpperCase() + agentId.slice(1)} Operation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {renderFormFields()}

          {error && (
            <div className="p-2 bg-red-100 border border-red-300 rounded text-sm text-red-800">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
            size="sm"
          >
            {isLoading ? "Operating..." : "Execute Operation"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
