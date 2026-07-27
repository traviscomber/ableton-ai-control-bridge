/**
 * POST /api/music/build-ableton-pack
 *
 * Accepts the same body as generate-stems (variant, bars, bpm) OR
 * accepts a pre-computed pipeline result directly to skip re-synthesis.
 *
 * Body (option A — pipeline already computed client-side):
 * {
 *   pipeline: FullPipelineResponse   ← from generate-stems response
 *   variant:  "night" | "daytime" | "morning"
 *   bpm:      number
 *   bars:     number
 *   key:      string
 * }
 *
 * Returns:
 *   Content-Type: application/zip
 *   Content-Disposition: attachment; filename="DARKSCO_Night_120bpm.zip"
 *   Binary ZIP body
 *
 * The ZIP contains:
 *   DARKSCO_Night_120bpm.als              Ableton Live 11/12 project
 *   Samples/Originals/*.wav              48kHz/24-bit WAV stems
 *   MIDI Clips/*.mid                     Format-0 MIDI per stem
 *   Max for Live Devices/DARKSCO_Sampler.amxd
 *   README.txt
 */

import { NextRequest, NextResponse } from "next/server";
import { buildAbletonPack } from "@/lib/synth/ableton-pack-builder";
import type { FullPipelineResponse } from "@/app/api/music/generate-stems/route";

export const runtime = "nodejs";
export const maxDuration = 120; // Pack generation can take a few seconds

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      pipeline: FullPipelineResponse;
      variant: string;
      bpm: number;
      bars: number;
      key: string;
    };

    const { pipeline, variant, bpm, bars, key } = body;

    if (!pipeline || !variant || !bpm || !bars || !key) {
      return NextResponse.json(
        { error: "Missing required fields: pipeline, variant, bpm, bars, key" },
        { status: 400 }
      );
    }

    // Validate pipeline has required stages
    if (!pipeline.samplepack?.stems?.length) {
      return NextResponse.json(
        { error: "Pipeline must include samplepack stems (run generate-stems first)" },
        { status: 400 }
      );
    }
    if (!pipeline.final_wav?.wav_b64) {
      return NextResponse.json(
        { error: "Pipeline must include final_wav (run generate-stems with includeMix: true)" },
        { status: 400 }
      );
    }

    // Build the pack
    const result = await buildAbletonPack({ variant, bpm, bars, key, pipeline });

    // Return as binary ZIP download — slice to a clean ArrayBuffer for NextResponse
    const zipAb = result.zipBuffer.buffer.slice(
      result.zipBuffer.byteOffset,
      result.zipBuffer.byteOffset + result.zipBuffer.byteLength
    );
    return new NextResponse(zipAb as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": String(result.sizeBytes),
        "X-Pack-Project-Name": result.projectName,
        "X-Pack-File-Count": String(result.contents.length),
        "X-Pack-Size-Bytes": String(result.sizeBytes),
      },
    });
  } catch (err) {
    console.error("[build-ableton-pack]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pack build failed" },
      { status: 500 }
    );
  }
}
