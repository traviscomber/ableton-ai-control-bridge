"use client";

import { useState } from "react";
import { Music, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface SoundDesignBriefProps {
  projectId: string;
  onProfileCreated?: (profile: any) => void;
}

export function SoundDesignBrief({ projectId, onProfileCreated }: SoundDesignBriefProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moodKeywords, setMoodKeywords] = useState<string[]>([]);
  const [instrumentInput, setInstrumentInput] = useState("");
  const [moodInput, setMoodInput] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    style: "",
    description: "",
    bpm: "",
    key: "",
    instrumentation: [] as string[],
    mood_keywords: [] as string[],
  });

  const handleAddInstrument = () => {
    if (instrumentInput.trim()) {
      setFormData({
        ...formData,
        instrumentation: [...formData.instrumentation, instrumentInput.trim()],
      });
      setInstrumentInput("");
    }
  };

  const handleAddMood = () => {
    if (moodInput.trim()) {
      setFormData({
        ...formData,
        mood_keywords: [...formData.mood_keywords, moodInput.trim()],
      });
      setMoodInput("");
    }
  };

  const handleRemoveInstrument = (index: number) => {
    setFormData({
      ...formData,
      instrumentation: formData.instrumentation.filter((_, i) => i !== index),
    });
  };

  const handleRemoveMood = (index: number) => {
    setFormData({
      ...formData,
      mood_keywords: formData.mood_keywords.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/music/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          name: formData.name,
          style: formData.style,
          description: formData.description,
          bpm: formData.bpm ? parseInt(formData.bpm) : undefined,
          key: formData.key,
          instrumentation: formData.instrumentation,
          mood_keywords: formData.mood_keywords,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create profile");
      }

      const data = await response.json();
      onProfileCreated?.(data.profile);

      // Reset form
      setFormData({
        name: "",
        style: "",
        description: "",
        bpm: "",
        key: "",
        instrumentation: [],
        mood_keywords: [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-center gap-3 mb-6">
        <Music className="w-6 h-6 text-indigo-400" />
        <h2 className="text-2xl font-bold text-white">Sound Design Brief</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Project Name
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Night Protocol 002"
              className="bg-slate-800 border-slate-600 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Style
            </label>
            <Input
              type="text"
              value={formData.style}
              onChange={(e) => setFormData({ ...formData, style: e.target.value })}
              placeholder="e.g., dark techno"
              className="bg-slate-800 border-slate-600 text-white"
              required
            />
          </div>
        </div>

        {/* BPM & Key */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              BPM (optional)
            </label>
            <Input
              type="number"
              value={formData.bpm}
              onChange={(e) => setFormData({ ...formData, bpm: e.target.value })}
              placeholder="120"
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Key (optional)
            </label>
            <Input
              type="text"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder="A minor"
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-2">
            Description
          </label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the overall vision and production goals..."
            className="bg-slate-800 border-slate-600 text-white min-h-24"
          />
        </div>

        {/* Instrumentation */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-2">
            Instrumentation
          </label>
          <div className="flex gap-2 mb-3">
            <Input
              type="text"
              value={instrumentInput}
              onChange={(e) => setInstrumentInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddInstrument()}
              placeholder="e.g., bass, pad, drums"
              className="bg-slate-800 border-slate-600 text-white flex-1"
            />
            <Button
              type="button"
              onClick={handleAddInstrument}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.instrumentation.map((inst, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-600/20 border border-indigo-500/50 rounded-full text-sm text-indigo-200"
              >
                {inst}
                <button
                  type="button"
                  onClick={() => handleRemoveInstrument(idx)}
                  className="hover:text-indigo-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Mood Keywords */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-2">
            Mood Keywords
          </label>
          <div className="flex gap-2 mb-3">
            <Input
              type="text"
              value={moodInput}
              onChange={(e) => setMoodInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddMood()}
              placeholder="e.g., cinematic, intense, atmospheric"
              className="bg-slate-800 border-slate-600 text-white flex-1"
            />
            <Button
              type="button"
              onClick={handleAddMood}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.mood_keywords.map((mood, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-2 px-3 py-1 bg-purple-600/20 border border-purple-500/50 rounded-full text-sm text-purple-200"
              >
                {mood}
                <button
                  type="button"
                  onClick={() => handleRemoveMood(idx)}
                  className="hover:text-purple-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold h-10"
        >
          {loading ? "Creating Profile..." : "Create Sound Design Profile"}
        </Button>
      </form>
    </div>
  );
}
