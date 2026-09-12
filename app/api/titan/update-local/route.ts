import { NextResponse } from "next/server";

const UPDATER_URL =
  "https://raw.githubusercontent.com/traviscomber/ableton-ai-control-bridge/main/windows/update-titan-chain-audit.ps1";

export async function GET() {
  const response = await fetch(UPDATER_URL, { cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json(
      { ok: false, error: `Updater source unavailable (${response.status})` },
      { status: 502 },
    );
  }

  const script = await response.text();
  if (!script.includes("TITAN Chain Audit updater") || script.length < 500) {
    return NextResponse.json(
      { ok: false, error: "Updater source failed integrity sanity check" },
      { status: 502 },
    );
  }

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="UPDATE-TITAN-CHAIN-AUDIT.ps1"',
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
