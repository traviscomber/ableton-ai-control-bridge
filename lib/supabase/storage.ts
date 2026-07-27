/**
 * lib/supabase/storage.ts
 *
 * Service-role Supabase client + storage upload helpers for DARKSCO productions.
 * Used exclusively in API routes (server-side only).
 *
 * Buckets:
 *   darksco-wavs     — full stems (48kHz/24-bit WAV, up to 50 MB each)
 *   darksco-midi     — MIDI files per stem
 *   darksco-samples  — one-shot samples (WAV + MIDI)
 *   darksco-packs    — Ableton Live ZIP packs (up to 100 MB)
 *
 * Files are stored under a production-scoped path:
 *   <productionId>/<filename>
 *
 * Signed URLs expire in 24 hours by default.
 */

import { createClient } from "@supabase/supabase-js";

// ─── Service-role client (bypasses RLS — API routes only) ────────────────────

function getServiceClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredFile {
  bucket: string;
  path:   string;
  url:    string;   // signed URL valid for 24h
  size:   number;   // bytes
}

export interface ProductionPaths {
  id:           string;
  stems:        Record<string, StoredFile>;   // stem_type → stored WAV
  midis:        Record<string, StoredFile>;   // stem_type → stored MIDI
  sampleGroups: Record<string, StoredFile[]>; // stem_type → stored one-shot WAVs
  masterWav:    StoredFile;
}

// ─── Upload helpers ───────────────────────────────────────────────────────────

const SIGNED_URL_TTL = 60 * 60 * 24; // 24 hours

async function uploadBuf(
  bucket: string,
  path:   string,
  buf:    Buffer | Uint8Array,
  mime:   string,
): Promise<StoredFile> {
  const supabase = getServiceClient();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buf, { contentType: mime, upsert: true });

  if (error) throw new Error(`Storage upload failed [${bucket}/${path}]: ${error.message}`);

  const { data: signed, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (signErr || !signed) throw new Error(`Signed URL failed [${bucket}/${path}]: ${signErr?.message}`);

  return { bucket, path, url: signed.signedUrl, size: buf.byteLength };
}

function b64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}

// ─── Production upload orchestrator ──────────────────────────────────────────

export async function uploadProduction(params: {
  productionId: string;
  variant:      string;
  bpm:          number;
  stems:        Array<{ stem_type: string; name: string; wav_b64: string }>;
  midis:        Array<{ stem: string; filename: string; midi_b64: string }>;
  sampleGroups: Array<{ stem: string; samples: Array<{ name: string; wav_b64: string; midi_b64: string }> }>;
  masterWav:    { wav_b64: string };
}): Promise<ProductionPaths> {
  const { productionId, variant, bpm } = params;
  const tag = `${productionId}`;

  // Upload all files concurrently per type
  const [stemFiles, midiFiles, sampleGroupFiles, masterFile] = await Promise.all([

    // Stems
    Promise.all(
      params.stems.map(async (s) => {
        const file = await uploadBuf(
          "darksco-wavs",
          `${tag}/${s.stem_type}.wav`,
          b64ToBuffer(s.wav_b64),
          "audio/wav"
        );
        return [s.stem_type, file] as [string, StoredFile];
      })
    ),

    // MIDI files
    Promise.all(
      params.midis.map(async (m) => {
        const file = await uploadBuf(
          "darksco-midi",
          `${tag}/${m.filename}`,
          b64ToBuffer(m.midi_b64),
          "audio/midi"
        );
        return [m.stem, file] as [string, StoredFile];
      })
    ),

    // One-shot samples
    Promise.all(
      params.sampleGroups.map(async (g) => {
        const files = await Promise.all(
          g.samples.map((s) =>
            uploadBuf(
              "darksco-samples",
              `${tag}/${g.stem}/${s.name}.wav`,
              b64ToBuffer(s.wav_b64),
              "audio/wav"
            )
          )
        );
        return [g.stem, files] as [string, StoredFile[]];
      })
    ),

    // Master WAV
    uploadBuf(
      "darksco-wavs",
      `${tag}/master_mix.wav`,
      b64ToBuffer(params.masterWav.wav_b64),
      "audio/wav"
    ),
  ]);

  return {
    id:           productionId,
    stems:        Object.fromEntries(stemFiles),
    midis:        Object.fromEntries(midiFiles),
    sampleGroups: Object.fromEntries(sampleGroupFiles),
    masterWav:    masterFile,
  };
}

// ─── Upload a finished ZIP pack ───────────────────────────────────────────────

export async function uploadPack(params: {
  productionId: string;
  filename:     string;
  zipBuffer:    Buffer;
}): Promise<StoredFile> {
  return uploadBuf(
    "darksco-packs",
    `${params.productionId}/${params.filename}`,
    params.zipBuffer,
    "application/zip"
  );
}

// ─── Refresh signed URLs (called if URLs are near expiry) ────────────────────

export async function getSignedUrl(bucket: string, path: string): Promise<string> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data) throw new Error(`getSignedUrl failed: ${error?.message}`);
  return data.signedUrl;
}

// ─── Persist production metadata to DB ───────────────────────────────────────

export async function saveProductionRecord(params: {
  productionId:    string;
  variant:         string;
  bpm:             number;
  key:             string;
  bars:            number;
  structureJson:   object;
  qualityJson:     object;
  finalWavMeta:    object;
  stemsPaths:      Record<string, string>;   // stem → storage path
  midiPaths:       Record<string, string>;
  samplePaths:     Record<string, string[]>;
  pipelineMs:      number;
  totalSizeBytes:  number;
}): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("productions")
    .upsert({
      id:              params.productionId,
      variant:         params.variant,
      bpm:             params.bpm,
      key:             params.key,
      bars:            params.bars,
      structure_json:  params.structureJson,
      quality_json:    params.qualityJson,
      final_wav_meta:  params.finalWavMeta,
      stems_paths:     params.stemsPaths,
      midi_paths:      params.midiPaths,
      sample_paths:    params.samplePaths,
      pipeline_ms:     params.pipelineMs,
      total_size_bytes: params.totalSizeBytes,
    });
  if (error) throw new Error(`saveProductionRecord failed: ${error.message}`);
}

// ─── Update production with pack path ────────────────────────────────────────

export async function updateProductionPackPath(productionId: string, packPath: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("productions")
    .update({ pack_path: packPath })
    .eq("id", productionId);
  if (error) throw new Error(`updateProductionPackPath failed: ${error.message}`);
}
