'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Music, Zap, Moon, Sun, Clock } from 'lucide-react';

type VariantKey = 'daytime' | 'morning' | 'night';
type Creating = VariantKey | null;

interface SoundbankResult {
  profile: {
    id: string;
    name: string;
    style: string;
    bpm: number;
    key: string;
  };
  soundbank: {
    id: string;
    name: string;
    total_stems: number;
    total_clips: number;
  };
  stems: Array<{
    id: string;
    name: string;
    type: string;
    duration: number;
    frequency_range: [number, number];
  }>;
  clips: Array<{
    id: string;
    name: string;
    duration: number;
    loop_ready: boolean;
  }>;
  next_steps: string[];
}

export default function DARKSCOTrilogyDemo() {
  const [creating, setCreating] = useState<Creating>(null);
  const [results, setResults] = useState<Record<VariantKey, SoundbankResult | null>>({
    daytime: null,
    morning: null,
    night: null,
  });

  const variants = [
    {
      id: 'daytime',
      name: 'DARKSCO Daytime',
      subtitle: 'Bright Dark Disco',
      description: 'Energetic, uplifting dark disco funk for peak-time dancefloor',
      icon: Zap,
      color: 'from-yellow-500 to-orange-500',
      textColor: 'text-yellow-600',
      bpm: 124,
      key: 'C major',
      mood: 'Playful, Groovy, Energetic',
    },
    {
      id: 'morning',
      name: 'DARKSCO Morning',
      subtitle: 'Fresh Dark Disco',
      description: 'Fresh, groovy dark disco funk for morning sets with soulful vibes',
      icon: Sun,
      color: 'from-green-500 to-emerald-500',
      textColor: 'text-green-600',
      bpm: 116,
      key: 'G major',
      mood: 'Soulful, Funky, Smooth',
    },
    {
      id: 'night',
      name: 'DARKSCO Night',
      subtitle: 'Deep Dark Disco',
      description: 'Deep, dark dark disco funk for late-night introspective grooves',
      icon: Moon,
      color: 'from-purple-600 to-indigo-600',
      textColor: 'text-purple-600',
      bpm: 120,
      key: 'F minor',
      mood: 'Mysterious, Groovy, Dark',
    },
  ];

  const createSoundbank = async (variant: VariantKey) => {
    setCreating(variant);
    try {
      const response = await fetch(
        `/api/music/seed-darksco-${variant}`
      );
      const data = await response.json();

      if (data.success) {
        setResults((prev) => ({
          ...prev,
          [variant]: data.data,
        }));
      }
    } catch (error) {
      console.error('[v0] Error creating DARKSCO soundbank:', error);
    } finally {
      setCreating(null);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Music className="w-8 h-8 text-purple-500" />
            <h1 className="text-4xl font-bold">DARKSCO Trilogy</h1>
          </div>
          <p className="text-xl text-slate-300">
            Dark Disco Funk Techno - Three Variants, One Vision
          </p>
          <p className="text-slate-400 mt-2">
            Professional soundbanks for Daytime, Morning, and Night productions
          </p>
        </div>

        {/* Variant Cards Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {variants.map((variant) => {
            const Icon = variant.icon;
            const variantKey = variant.id as VariantKey;
            const result = results[variantKey];
            const isCreating = creating === variant.id;

            return (
              <div
                key={variant.id}
                className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden hover:border-slate-500 transition"
              >
                {/* Gradient Header */}
                <div
                  className={`h-24 bg-gradient-to-r ${variant.color} flex items-center justify-center`}
                >
                  <Icon className="w-12 h-12 text-white opacity-80" />
                </div>

                {/* Content */}
                <div className="p-6">
                  <h2 className={`text-2xl font-bold mb-1 ${variant.textColor}`}>
                    {variant.name}
                  </h2>
                  <p className="text-sm text-slate-400 mb-4">{variant.subtitle}</p>
                  <p className="text-sm text-slate-300 mb-4">{variant.description}</p>

                  {/* Specs */}
                  <div className="space-y-2 mb-6 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">BPM:</span>
                      <span className="font-semibold">{variant.bpm}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Key:</span>
                      <span className="font-semibold">{variant.key}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Mood:</span>
                      <span className="font-semibold">{variant.mood}</span>
                    </div>
                  </div>

                  {result ? (
                    // Results Display
                    <div className="space-y-4">
                      <div className="bg-slate-700/50 rounded p-3">
                        <p className="text-xs text-slate-400 mb-2">Soundbank Created</p>
                        <p className="font-semibold text-sm">{result.soundbank.name}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {result.soundbank.total_stems} stems • {result.soundbank.total_clips}{' '}
                          clips
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-400">Stems:</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {result.stems.map((stem) => (
                            <div
                              key={stem.id}
                              className="text-xs bg-slate-700/30 rounded px-2 py-1 text-slate-300"
                            >
                              <div className="flex justify-between">
                                <span>{stem.name}</span>
                                <span className="text-slate-500">
                                  {stem.frequency_range[0]}-{stem.frequency_range[1]}Hz
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t border-slate-700">
                        <Link
                          href="/music-hub"
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded text-sm font-medium text-center transition flex items-center justify-center gap-2"
                        >
                          <span>View in Hub</span>
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ) : (
                    // Create Button
                    <button
                      onClick={() => createSoundbank(variant.id as VariantKey)}
                      disabled={isCreating}
                      className={`w-full py-2 px-4 rounded font-medium text-sm transition flex items-center justify-center gap-2 ${
                        isCreating
                          ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                          : `bg-gradient-to-r ${variant.color} text-white hover:opacity-90`
                      }`}
                    >
                      {isCreating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Music className="w-4 h-4" />
                          Create Soundbank
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Information Section */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">About DARKSCO Trilogy</h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Daytime Variant
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Bright, energetic dark disco funk perfect for peak-time dancefloor energy.
                Features punchy kicks, sharp hi-hats, and bright synths at 124 BPM in C major.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Sun className="w-5 h-5 text-green-500" />
                Morning Variant
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Fresh, soulful dark disco funk for morning sets with warm organic feel. Features
                groovy bass, organic drums, and warm pads at 116 BPM in G major.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Moon className="w-5 h-5 text-purple-500" />
                Night Variant
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Deep, dark dark disco funk for late-night introspective grooves. Features deep
                bass, tight kick, and dark pads at 120 BPM in F minor.
              </p>
            </div>
          </div>
        </div>

        {/* Specifications */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Complete Specifications</h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold mb-4 text-lg">Stems per Variant</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>✓ 8 Professional stems (48kHz/24-bit WAV)</li>
                <li>✓ Complete frequency coverage</li>
                <li>✓ Full metadata and tagging</li>
                <li>✓ Production-grade specifications</li>
                <li>✓ Ready for sequencing</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-lg">Clips per Variant</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>✓ 5 Production-ready clips</li>
                <li>✓ Loop-synced to tempo</li>
                <li>✓ Properly categorized</li>
                <li>✓ Mix and arrangement ready</li>
                <li>✓ Ready for next workflow stage</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-700 text-center">
          <p className="text-slate-400">
            Total: 3 variants × 8 stems = 24 professional stems
          </p>
          <p className="text-slate-400">
            Total: 3 variants × 5 clips = 15 production-ready clips
          </p>
          <div className="mt-4">
            <Link
              href="/music-hub"
              className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition"
            >
              View all projects in Music Hub
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
