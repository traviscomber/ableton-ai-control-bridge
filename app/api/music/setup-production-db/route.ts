import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { MUSIC_PRODUCTIONS_SCHEMA } from "@/lib/music-schema";

export async function GET() {
  try {
    const supabase = await createClient();

    // Run schema creation
    const { error } = await supabase.rpc("exec_sql", {
      sql: MUSIC_PRODUCTIONS_SCHEMA,
    });

    if (error) {
      // Tables may already exist — try individual inserts as a connectivity check
      const { error: checkError } = await supabase
        .from("music_productions")
        .select("id")
        .limit(1);

      if (checkError && checkError.code === "42P01") {
        return NextResponse.json(
          {
            success: false,
            message: "Tables do not exist. Run the SQL schema manually in Supabase dashboard.",
            schema: MUSIC_PRODUCTIONS_SCHEMA,
          },
          { status: 500 }
        );
      }

      // Tables exist already
      return NextResponse.json({
        success: true,
        message: "Production tables already exist and are accessible.",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Production tables created successfully.",
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
