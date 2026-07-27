/**
 * GET /api/music/setup-production-db
 *
 * Checks whether the production tables exist.
 * If they do not, returns the SQL that needs to be run in the Supabase dashboard.
 * Does NOT attempt to execute DDL via RPC — that requires a custom pg function
 * that isn't present in the default Supabase project.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { MUSIC_PRODUCTIONS_SCHEMA } from "@/lib/music-schema";

export async function GET() {
  try {
    const supabase = await createClient();

    // Probe each table with a minimal select
    const probes = await Promise.all([
      supabase.from("music_productions").select("id").limit(1),
      supabase.from("music_reasoning_logs").select("id").limit(1),
      supabase.from("midi_tracks").select("id").limit(1),
    ]);

    const missing: string[] = [];
    const tableNames = ["music_productions", "music_reasoning_logs", "midi_tracks"];

    probes.forEach(({ error }, i) => {
      // code 42P01 = table does not exist
      if (error && (error.code === "42P01" || error.message?.includes("does not exist"))) {
        missing.push(tableNames[i]);
      }
    });

    if (missing.length === 0) {
      return NextResponse.json({
        success: true,
        status: "ready",
        message: "All production tables exist and are accessible.",
        tables: tableNames,
      });
    }

    return NextResponse.json({
      success: false,
      status: "missing_tables",
      message: `The following tables need to be created in your Supabase dashboard: ${missing.join(", ")}`,
      missing_tables: missing,
      instructions: [
        "1. Open your Supabase project dashboard",
        "2. Navigate to the SQL Editor",
        "3. Paste and run the SQL from the 'schema_sql' field below",
        "4. Call this endpoint again to verify",
      ],
      schema_sql: MUSIC_PRODUCTIONS_SCHEMA,
    }, { status: 200 });
  } catch (err) {
    return NextResponse.json({
      success: false,
      status: "error",
      error: String(err),
    }, { status: 500 });
  }
}
