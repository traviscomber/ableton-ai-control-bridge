"use client";

import { useState } from "react";
import { Upload, Music2, CheckCircle, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Stem {
  id: string;
  name: string;
  instrument_type: string;
  duration_seconds: number;
  file_size: number;
  format: string;
  status: string;
}

interface SoundbankCreatorProps {
  projectId: string;
  profileId: string;
  onSoundbankCreated?: (soundbank: any) => void;
}

export function SoundbankCreator({
  projectId,
  profileId,
  onSoundbankCreated,
}: SoundbankCreatorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundbankName, setSoundbankName] = useState("");
  const [soundbankDesc, setSoundbankDesc] = useState("");
  const [stems, setStems] = useState<Stem[]>([]);
  const [soundbankId, setSoundbankId] = useState<string | null>(null);
  const [stage, setStage] = useState<"create" | "upload">("create");

  const handleCreateSoundbank = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/music/soundbanks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          profile_id: profileId,
          name: soundbankName,
          description: soundbankDesc,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create soundbank");
      }

      const data = await response.json();
      setSoundbankId(data.soundbank.id);
      setStage("upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleAddStem = async (stemData: any) => {
    if (!soundbankId) return;

    try {
      const response = await fetch("/api/music/stems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soundbank_id: soundbankId,
          ...stemData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add stem");
      }

      const data = await response.json();
      setStems([...stems, data.stem]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add stem");
    }
  };

  const handleRemoveStem = (stemId: string) => {
    setStems(stems.filter((s) => s.id !== stemId));
  };

  const handleFinalize = () => {
    if (soundbankId && stems.length > 0) {
      onSoundbankCreated?.({
        id: soundbankId,
        name: soundbankName,
        stems_count: stems.length,
      });
    }
  };

  if (stage === "create") {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border border-slate-700">
        <div className="flex items-center gap-3 mb-6">
          <Music2 className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold text-white">Create Soundbank</h2>
        </div>

        <form onSubmit={handleCreateSoundbank} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Soundbank Name
            </label>
            <Input
              type="text"
              value={soundbankName}
              onChange={(e) => setSoundbankName(e.target.value)}
              placeholder="e.g., Night Protocol v1.0"
              className="bg-slate-800 border-slate-600 text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Description
            </label>
            <Textarea
              value={soundbankDesc}
              onChange={(e) => setSoundbankDesc(e.target.value)}
              placeholder="Describe the soundbank contents and intended use..."
              className="bg-slate-800 border-slate-600 text-white min-h-20"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold h-10"
          >
            {loading ? "Creating..." : "Create Soundbank"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-center gap-3 mb-6">
        <Upload className="w-6 h-6 text-green-400" />
        <h2 className="text-2xl font-bold text-white">Add Stems to Soundbank</h2>
      </div>

      <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
        <p className="text-slate-200 font-medium mb-2">Soundbank: {soundbankName}</p>
        <p className="text-slate-400 text-sm">{stems.length} stems added</p>
      </div>

      <div className="space-y-4 mb-6">
        <div className="p-8 border-2 border-dashed border-slate-600 rounded-lg hover:border-slate-500 transition text-center">
          <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <p className="text-slate-300 font-medium mb-2">Upload Stems</p>
          <p className="text-slate-400 text-sm mb-4">
            Drag and drop WAV files or click to browse
          </p>
          <Button className="bg-slate-700 hover:bg-slate-600 text-white">
            Browse Files
          </Button>
        </div>
      </div>

      {stems.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Stems</h3>
          <div className="space-y-2">
            {stems.map((stem) => (
              <div
                key={stem.id}
                className="flex items-center justify-between p-3 bg-slate-800 border border-slate-700 rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-white font-medium">{stem.name}</p>
                  <p className="text-slate-400 text-sm">
                    {stem.instrument_type} • {(stem.file_size / 1024 / 1024).toFixed(1)}MB •{" "}
                    {stem.duration_seconds}s
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveStem(stem.id)}
                  className="text-slate-400 hover:text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={() => setStage("create")}
          className="flex-1 bg-slate-700 hover:bg-slate-600 text-white"
        >
          Back
        </Button>
        <Button
          onClick={handleFinalize}
          disabled={stems.length === 0}
          className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Finalize Soundbank
        </Button>
      </div>
    </div>
  );
}
