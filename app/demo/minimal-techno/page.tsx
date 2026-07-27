"use client";

import { useState } from "react";
import { Music, Zap, Download, Play, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function MinimalTechnoDemoPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSeed = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/music/seed-minimal-techno");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create soundbank");
      }

      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <Link href="/music-hub">
            <button className="text-slate-400 hover:text-white text-sm mb-4">← Back to Hub</button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg">
              <Music className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Minimal Techno Demo</h1>
              <p className="text-slate-400 mt-1">Professional soundbank with 6 stems, 5 clips, ready for validation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Instructions */}
          <div className="lg:col-span-1 space-y-6">
            <div className="p-6 bg-slate-800 border border-slate-700 rounded-lg">
              <h2 className="text-xl font-bold text-white mb-4">What's Included</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-white">Sound Design Profile</p>
                    <p className="text-slate-400">Minimal techno, 128 BPM, A minor</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-white">6 Professional Stems</p>
                    <p className="text-slate-400">48kHz/24-bit WAV format</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-white">5 Production Clips</p>
                    <p className="text-slate-400">Loop-synced and tagged</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-white">Complete Metadata</p>
                    <p className="text-slate-400">Frequency, dynamics, processing info</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-800 border border-slate-700 rounded-lg">
              <h2 className="text-xl font-bold text-white mb-4">Stems Included</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Sub Bass 40Hz</span>
                  <span className="text-slate-500">32s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Kick Drum 909</span>
                  <span className="text-slate-500">1.2s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Hi-Hat Loop</span>
                  <span className="text-slate-500">8s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Ambient Pad</span>
                  <span className="text-slate-500">48s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Noise FX Sweep</span>
                  <span className="text-slate-500">16s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Perc Stab</span>
                  <span className="text-slate-500">2.4s</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Action & Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* Action Button */}
            {!result && (
              <div className="p-8 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg">
                <h2 className="text-2xl font-bold text-white mb-4">Create Demo Soundbank</h2>
                <p className="text-slate-400 mb-6">
                  Click below to instantly create a professional minimal techno soundbank with all stems and clips. This will populate your database with a complete, production-ready example.
                </p>

                <button
                  onClick={handleSeed}
                  disabled={loading}
                  className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-bold rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Zap className="w-5 h-5" />
                  {loading ? "Creating Soundbank..." : "Create Minimal Techno Soundbank"}
                </button>

                <p className="text-slate-500 text-sm mt-4">
                  This will create all database records and be visible in /music-hub immediately.
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-6 bg-red-900/20 border border-red-700/50 rounded-lg flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-bold text-red-300 mb-2">Error Creating Soundbank</p>
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Success Results */}
            {result && (
              <div className="space-y-6">
                <div className="p-6 bg-green-900/20 border border-green-700/50 rounded-lg flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-green-300 mb-2">Soundbank Created Successfully!</p>
                    <p className="text-green-200 text-sm">
                      Professional minimal techno soundbank is now in your database and visible in the Music Hub.
                    </p>
                  </div>
                </div>

                {/* Profile Summary */}
                <div className="p-6 bg-slate-800 border border-slate-700 rounded-lg">
                  <h3 className="text-lg font-bold text-white mb-4">Sound Design Profile</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Name</span>
                      <span className="text-white font-medium">{result.data.profile.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Style</span>
                      <span className="text-white font-medium">{result.data.profile.style}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">BPM</span>
                      <span className="text-white font-medium">{result.data.profile.bpm}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Key</span>
                      <span className="text-white font-medium">{result.data.profile.key}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-700">
                      <span className="text-slate-400">Instrumentation</span>
                      <div className="text-right">
                        <div className="flex flex-wrap gap-1 justify-end">
                          {result.data.profile.instrumentation.map((inst: string) => (
                            <span key={inst} className="px-2 py-1 bg-slate-700 text-slate-200 text-xs rounded">
                              {inst}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Soundbank Summary */}
                <div className="p-6 bg-slate-800 border border-slate-700 rounded-lg">
                  <h3 className="text-lg font-bold text-white mb-4">Soundbank</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-slate-400 text-sm">Name</p>
                      <p className="text-white font-bold mt-1">{result.data.soundbank.name}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Version</p>
                      <p className="text-white font-bold mt-1">v{result.data.soundbank.version}.0</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Status</p>
                      <p className="text-green-400 font-bold mt-1">{result.data.soundbank.status}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Total Stems</p>
                      <p className="text-white font-bold mt-1">{result.data.soundbank.total_stems}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Total Clips</p>
                      <p className="text-white font-bold mt-1">{result.data.soundbank.total_clips}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Key / BPM</p>
                      <p className="text-white font-bold mt-1">{result.data.soundbank.key} / {result.data.soundbank.bpm}</p>
                    </div>
                  </div>
                </div>

                {/* Stems List */}
                <div className="p-6 bg-slate-800 border border-slate-700 rounded-lg">
                  <h3 className="text-lg font-bold text-white mb-4">Professional Stems</h3>
                  <div className="space-y-3">
                    {result.data.stems.map((stem: any, idx: number) => (
                      <div key={stem.id} className="flex items-start justify-between p-3 bg-slate-700/50 rounded-lg">
                        <div>
                          <p className="font-medium text-white">{stem.name}</p>
                          <p className="text-slate-400 text-sm mt-1">
                            {stem.instrument_type} • {stem.duration_seconds}s • {stem.frequency_range?.[0]}-{stem.frequency_range?.[1]}Hz
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-slate-600 text-slate-200 text-xs rounded whitespace-nowrap">
                          {stem.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Clips List */}
                <div className="p-6 bg-slate-800 border border-slate-700 rounded-lg">
                  <h3 className="text-lg font-bold text-white mb-4">Production-Ready Clips</h3>
                  <div className="space-y-3">
                    {result.data.clips.map((clip: any) => (
                      <div key={clip.id} className="flex items-start justify-between p-3 bg-slate-700/50 rounded-lg">
                        <div>
                          <p className="font-medium text-white">{clip.name}</p>
                          <p className="text-slate-400 text-sm mt-1">
                            {clip.duration_seconds}s • {clip.tags.join(", ")}
                          </p>
                        </div>
                        <span className={`px-3 py-1 text-xs rounded whitespace-nowrap font-medium ${
                          clip.loop_ready
                            ? "bg-green-900/30 text-green-300"
                            : "bg-slate-600 text-slate-200"
                        }`}>
                          {clip.loop_ready ? "Loop Ready" : "Single"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next Steps */}
                <div className="p-6 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                  <h3 className="text-lg font-bold text-blue-300 mb-4">Next Steps</h3>
                  <ol className="space-y-2 text-sm text-blue-200">
                    {result.data.next_steps.map((step: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-bold flex-shrink-0">{idx + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* View in Hub */}
                <Link href="/music-hub">
                  <button className="w-full px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-2">
                    <Play className="w-5 h-5" />
                    View in Music Hub
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Documentation Link */}
        <div className="mt-12 pt-8 border-t border-slate-800">
          <Link href="/MINIMAL_TECHNO_SOUNDBANK.md">
            <button className="flex items-center gap-2 text-blue-400 hover:text-blue-300">
              <Download className="w-5 h-5" />
              View Complete Soundbank Documentation
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}
