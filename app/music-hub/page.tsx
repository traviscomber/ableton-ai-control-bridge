"use client";

import { useState, useEffect } from "react";
import {
  Music,
  Zap,
  Disc3,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Plus,
} from "lucide-react";
import Link from "next/link";

interface ProjectCard {
  id: string;
  name: string;
  style: string;
  status: "design" | "soundbank" | "clips" | "validation" | "approval" | "released";
  phase: string;
  progress: number;
  metrics: {
    stems: number;
    clips: number;
    score?: number;
  };
  blockers: string[];
  nextAction: string;
  daysUntil?: number;
}

export default function MusicHubPage() {
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [stats, setStats] = useState({
    totalProjects: 0,
    inProgress: 0,
    readyForApproval: 0,
    released: 0,
  });
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for demonstration
    const mockProjects: ProjectCard[] = [
      {
        id: "night-protocol-002",
        name: "Night Protocol 002",
        style: "dark techno",
        status: "validation",
        phase: "soundsmith",
        progress: 65,
        metrics: { stems: 7, clips: 24, score: 82 },
        blockers: [],
        nextAction: "Run Soundsmith validation",
        daysUntil: 1,
      },
      {
        id: "ambient-dreams-001",
        name: "Ambient Dreams v1",
        style: "ambient",
        status: "approval",
        phase: "venom",
        progress: 75,
        metrics: { stems: 5, clips: 18, score: 78 },
        blockers: ["Atmosphere lacks depth"],
        nextAction: "Address Venom feedback on atmosphere",
        daysUntil: 2,
      },
      {
        id: "industrial-chaos-01",
        name: "Industrial Chaos 01",
        style: "experimental",
        status: "soundbank",
        phase: "stems",
        progress: 40,
        metrics: { stems: 3, clips: 0 },
        blockers: [],
        nextAction: "Upload remaining stems",
        daysUntil: 1,
      },
    ];

    setProjects(mockProjects);
    setStats({
      totalProjects: 3,
      inProgress: 2,
      readyForApproval: 1,
      released: 0,
    });
    setLoading(false);
  }, []);

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    design: { bg: "bg-slate-900", text: "text-slate-400", border: "border-slate-700" },
    soundbank: { bg: "bg-blue-900/20", text: "text-blue-400", border: "border-blue-700/50" },
    clips: { bg: "bg-purple-900/20", text: "text-purple-400", border: "border-purple-700/50" },
    validation: {
      bg: "bg-yellow-900/20",
      text: "text-yellow-400",
      border: "border-yellow-700/50",
    },
    approval: { bg: "bg-orange-900/20", text: "text-orange-400", border: "border-orange-700/50" },
    released: { bg: "bg-green-900/20", text: "text-green-400", border: "border-green-700/50" },
  };

  const getPhaseIcon = (phase: string) => {
    const icons: Record<string, any> = {
      brief: Music,
      stems: Disc3,
      extraction: Zap,
      soundsmith: TrendingUp,
      venom: CheckCircle,
      darksco: Disc3,
    };
    return icons[phase] || Music;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg">
                <Music className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">Music Production Hub</h1>
                <p className="text-slate-400 mt-1">
                  Orchestrate: Design → Soundbank → Validation → Release
                </p>
              </div>
            </div>
            <Link href="/music">
              <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg transition">
                <Plus className="w-5 h-5" />
                New Project
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Projects", value: stats.totalProjects, icon: Music, color: "from-blue-600 to-indigo-600" },
            { label: "In Progress", value: stats.inProgress, icon: Clock, color: "from-yellow-600 to-orange-600" },
            { label: "Ready for Approval", value: stats.readyForApproval, icon: AlertCircle, color: "from-orange-600 to-red-600" },
            { label: "Released", value: stats.released, icon: CheckCircle, color: "from-green-600 to-emerald-600" },
          ].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
                    <p className="text-4xl font-bold text-white mt-2">{stat.value}</p>
                  </div>
                  <div className={`p-4 bg-gradient-to-br ${stat.color} rounded-lg`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Projects Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Active Projects</h2>
            <button className="text-slate-400 hover:text-slate-300 text-sm font-medium">
              View All
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-slate-400">Loading projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
              <Music className="w-12 h-12 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400 mb-4">No projects yet</p>
              <Link href="/music">
                <button className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition">
                  Create Your First Project
                </button>
              </Link>
            </div>
          ) : (
            projects.map((project) => {
              const statusConfig = statusColors[project.status];
              const PhaseIcon = getPhaseIcon(project.phase);

              return (
                <button
                  key={project.id}
                  onClick={() => setSelectedProject(project.id)}
                  className="w-full p-6 bg-slate-800 hover:bg-slate-800/80 border border-slate-700 rounded-lg transition text-left group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white">{project.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border}`}>
                          {project.status}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm">{project.style}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-slate-300 transition" />
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <PhaseIcon className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-400 font-medium">{project.phase}</span>
                      </div>
                      <span className="text-sm text-slate-400">{project.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-300"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-slate-700">
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wider">Stems</p>
                      <p className="text-lg font-bold text-white mt-1">{project.metrics.stems}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wider">Clips</p>
                      <p className="text-lg font-bold text-white mt-1">{project.metrics.clips}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wider">Score</p>
                      <p className="text-lg font-bold text-white mt-1">
                        {project.metrics.score ? `${project.metrics.score}/100` : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Blockers */}
                  {project.blockers.length > 0 && (
                    <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-red-300 text-sm font-medium">Blockers</p>
                        <p className="text-red-200 text-xs mt-1">{project.blockers.join(", ")}</p>
                      </div>
                    </div>
                  )}

                  {/* Next Action */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Next Action</p>
                      <p className="text-white font-medium">{project.nextAction}</p>
                    </div>
                    {project.daysUntil !== undefined && (
                      <div className="text-right">
                        <p className="text-slate-500 text-xs">Due in</p>
                        <p className="text-white font-bold text-lg">{project.daysUntil}d</p>
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Workflow Guide */}
      <div className="container mx-auto px-4 py-12 border-t border-slate-800">
        <h2 className="text-2xl font-bold text-white mb-8">Workflow Stages</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { title: "1. Design", desc: "Create sound design profile", icon: Music },
            { title: "2. Soundbank", desc: "Upload stems by instrument", icon: Disc3 },
            { title: "3. Clips", desc: "Extract playable segments", icon: Zap },
            { title: "4. Soundsmith", desc: "Validate sound design", icon: TrendingUp },
            { title: "5. Venom", desc: "Quality scoring (100pt)", icon: CheckCircle },
            { title: "6. DARKSCO", desc: "Final approval & release", icon: Music },
          ].map((stage, idx) => {
            const Icon = stage.icon;
            return (
              <div key={idx} className="p-4 bg-slate-800 border border-slate-700 rounded-lg text-center">
                <div className="p-2 bg-slate-700 rounded-lg inline-block mb-3">
                  <Icon className="w-6 h-6 text-indigo-400" />
                </div>
                <p className="font-bold text-white text-sm mb-1">{stage.title}</p>
                <p className="text-slate-400 text-xs">{stage.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
