"use client";

import { useState, useEffect } from "react";
import { Music, Waves, Package, Radio } from "lucide-react";
import { SoundDesignBrief } from "@/components/music/sound-design-brief";
import { SoundbankCreator } from "@/components/music/soundbank-creator";

export default function MusicProductionPage() {
  const [currentStage, setCurrentStage] = useState<
    "design" | "soundbank" | "workflow"
  >("design");
  const [projectId] = useState("music-project-001");
  const [profile, setProfile] = useState<any>(null);
  const [soundbank, setSoundbank] = useState<any>(null);

  const handleProfileCreated = (newProfile: any) => {
    setProfile(newProfile);
    setCurrentStage("soundbank");
  };

  const handleSoundbankCreated = (newSoundbank: any) => {
    setSoundbank(newSoundbank);
    setCurrentStage("workflow");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg">
                <Music className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Music Production</h1>
                <p className="text-slate-400">
                  Sound Design → Soundbank → Quality → DARKSCO Release
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stage Progress */}
      <div className="border-b border-slate-800 bg-slate-900/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {[
              { id: "design", label: "Sound Design", icon: Waves },
              { id: "soundbank", label: "Soundbank", icon: Package },
              { id: "workflow", label: "DARKSCO Workflow", icon: Radio },
            ].map((stage, idx, arr) => (
              <div key={stage.id} className="flex items-center flex-1">
                <button
                  onClick={() =>
                    setCurrentStage(stage.id as "design" | "soundbank" | "workflow")
                  }
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                    currentStage === stage.id
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <stage.icon className="w-4 h-4" />
                  {stage.label}
                </button>

                {idx < arr.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      (currentStage === "soundbank" && stage.id === "design") ||
                      (currentStage === "workflow" &&
                        (stage.id === "design" || stage.id === "soundbank"))
                        ? "bg-gradient-to-r from-indigo-600 to-transparent"
                        : "bg-slate-800"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        {currentStage === "design" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                Define Your Sound Design
              </h2>
              <p className="text-slate-400 max-w-xl mx-auto">
                Start by creating a sound design profile. Define the style, instrumentation,
                and mood of your production.
              </p>
            </div>
            <SoundDesignBrief
              projectId={projectId}
              onProfileCreated={handleProfileCreated}
            />
          </div>
        )}

        {currentStage === "soundbank" && profile && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                Create Soundbank
              </h2>
              <p className="text-slate-400 max-w-xl mx-auto">
                Upload stems for: <span className="text-indigo-400 font-semibold">{profile.style}</span>
              </p>
            </div>
            <SoundbankCreator
              projectId={projectId}
              profileId={profile.id}
              onSoundbankCreated={handleSoundbankCreated}
            />
          </div>
        )}

        {currentStage === "workflow" && soundbank && (
          <div className="max-w-2xl mx-auto p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border border-slate-700 text-center">
            <div className="mb-6">
              <Radio className="w-12 h-12 mx-auto text-green-400 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">
                Soundbank Ready for Quality Check
              </h2>
              <p className="text-slate-400 mb-4">
                {soundbank.name} with {soundbank.stems_count} stems
              </p>
            </div>

            <div className="space-y-4 mb-8 p-6 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="text-left">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Next Steps:
                </h3>
                <ol className="space-y-2 text-slate-300 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="text-indigo-400 font-bold">1.</span>
                    <span>Soundsmith validates sound design profile</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-indigo-400 font-bold">2.</span>
                    <span>Extract clips from stems</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-indigo-400 font-bold">3.</span>
                    <span>Venom scores quality (100-point system)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-indigo-400 font-bold">4.</span>
                    <span>Send to DARKSCO workflow for full approval</span>
                  </li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => alert("Validation starting... Check console")}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-lg transition"
            >
              Validate with Soundsmith
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
