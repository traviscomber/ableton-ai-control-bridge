"use client";

import { useState } from "react";
import {
  Music,
  Zap,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Clock,
  Layers,
} from "lucide-react";
import Link from "next/link";

export default function ProjectDetailPage() {
  const project = {
    id: "night-protocol-002",
    name: "Night Protocol 002",
    style: "dark techno",
    bpm: 120,
    key: "A minor",
    phases: [
      {
        id: "design",
        name: "Sound Design",
        status: "completed",
        date: "2026-07-24",
      },
      {
        id: "soundbank",
        name: "Soundbank",
        status: "completed",
        date: "2026-07-25",
        stems: 7,
      },
      {
        id: "soundsmith",
        name: "Soundsmith Validation",
        status: "in-progress",
        score: 82,
      },
      {
        id: "venom",
        name: "Venom Quality Scoring",
        status: "pending",
      },
      {
        id: "darksco",
        name: "DARKSCO Workflow",
        status: "pending",
      },
    ],
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-900/20 text-green-400 border-green-700/50";
      case "in-progress":
        return "bg-yellow-900/20 text-yellow-400 border-yellow-700/50";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <Link href="/music-hub">
            <button className="text-slate-400 hover:text-white text-sm mb-4 transition">
              ← Back to Hub
            </button>
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white">{project.name}</h1>
              <div className="flex items-center gap-4 mt-3 text-slate-400">
                <span>{project.style}</span>
                <span>•</span>
                <span>{project.bpm} BPM</span>
                <span>•</span>
                <span>{project.key}</span>
              </div>
            </div>
            <Link href="/music">
              <button className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg transition">
                Open Project
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-white mb-8">Production Timeline</h2>

        <div className="space-y-4">
          {project.phases.map((phase, idx) => (
            <div key={phase.id} className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-slate-800 border border-slate-700 flex-shrink-0">
                {phase.status === "completed" && (
                  <CheckCircle className="w-6 h-6 text-green-400" />
                )}
                {phase.status === "in-progress" && (
                  <Clock className="w-6 h-6 text-yellow-400" />
                )}
                {phase.status === "pending" && (
                  <AlertCircle className="w-6 h-6 text-slate-500" />
                )}
              </div>
              <div className="flex-1 p-6 bg-slate-800 border border-slate-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">{phase.name}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                      phase.status
                    )}`}
                  >
                    {phase.status}
                  </span>
                </div>
                {phase.date && (
                  <p className="text-slate-400 text-sm">Completed: {phase.date}</p>
                )}
                {phase.stems && <p className="text-slate-400 text-sm mt-2">Stems: {phase.stems}</p>}
                {phase.score && (
                  <p className="text-slate-400 text-sm mt-2">Assessment: {phase.score}/100</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 border-t border-slate-800">
        <h2 className="text-2xl font-bold text-white mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/music">
            <button className="w-full p-6 bg-slate-800 hover:bg-slate-800/80 border border-slate-700 rounded-lg text-left transition">
              <Music className="w-6 h-6 text-indigo-400 mb-2" />
              <p className="font-bold text-white">Edit Project</p>
              <p className="text-slate-400 text-sm mt-1">Modify sound design or stems</p>
            </button>
          </Link>

          <Link href="/darksco/workflows">
            <button className="w-full p-6 bg-slate-800 hover:bg-slate-800/80 border border-slate-700 rounded-lg text-left transition">
              <Zap className="w-6 h-6 text-purple-400 mb-2" />
              <p className="font-bold text-white">View in DARKSCO</p>
              <p className="text-slate-400 text-sm mt-1">See full approval workflow</p>
            </button>
          </Link>

          <Link href="/music-hub">
            <button className="w-full p-6 bg-slate-800 hover:bg-slate-800/80 border border-slate-700 rounded-lg text-left transition">
              <Layers className="w-6 h-6 text-green-400 mb-2" />
              <p className="font-bold text-white">Back to Hub</p>
              <p className="text-slate-400 text-sm mt-1">View all projects</p>
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}
