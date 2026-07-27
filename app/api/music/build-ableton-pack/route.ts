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
import { uploadPack, updateProductionPackPath } from "@/lib/supabase/storage";
import type { FullPipelineResponse } from "@/app/api/music/generate-stems/route";

export const runtime = "nodejs";
export const maxDuration = 120; // Pack generation can take a few seconds

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      pipeline:      FullPipelineResponse;
      variant:       string;
      bpm:           number;
      bars:          number;
      key:           string;
      production_id?: string; // from generate-stems, used to link pack in DB
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
      // final_wav is optional in the ZIP — ALS project and stems are the primary deliverable.
      // Log a warning but continue rather than blocking the entire pack build.
      console.warn("[build-ableton-pack] final_wav missing — master WAV will be excluded from ZIP");
    }

    // Build the pack
    const result = await buildAbletonPack({ variant, bpm, bars, key, pipeline });

    // Upload ZIP to Supabase Storage (non-fatal if it fails)
    let packSignedUrl = "";
    try {
      const productionId = body.production_id ?? `${variant}-${bpm}-${Date.now()}`;
      const stored = await uploadPack({
        productionId,
        filename: result.filename,
        zipBuffer: result.zipBuffer,
      });
      packSignedUrl = stored.url;
      // Link pack path in DB if production_id was provided
      if (body.production_id) {
        await updateProductionPackPath(body.production_id, stored.path);
      }
    } catch (storageErr) {
      console.error("[build-ableton-pack] Storage upload failed:", storageErr);
    }

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
        ...(packSignedUrl ? { "X-Pack-Signed-Url": packSignedUrl } : {}),
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
