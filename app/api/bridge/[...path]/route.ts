/**
 * /api/bridge/[...path]
 *
 * Transparent proxy to the local Ableton AI Control Bridge running at
 * BRIDGE_URL (defaults to http://127.0.0.1:8765).
 *
 * Because the v0 preview iframe cannot reach localhost directly (CORS +
 * network isolation), all bridge calls go through this server-side proxy.
 * The Next.js server runs inside the same VM as the dev server, so it CAN
 * reach 127.0.0.1:8765.
 *
 * Usage: fetch("/api/bridge/health") → proxied to http://127.0.0.1:8765/health
 *        fetch("/api/bridge/api/commands") → → http://127.0.0.1:8765/api/commands
 */

import { NextRequest, NextResponse } from "next/server";

const BRIDGE_URL = process.env.BRIDGE_URL ?? "http://127.0.0.1:8765";

async function proxy(req: NextRequest, params: { path: string[] }) {
  const { path } = params;
  const upstreamPath = "/" + path.join("/");
  const search = req.nextUrl.search ?? "";
  const upstream = `${BRIDGE_URL}${upstreamPath}${search}`;

  // Forward only safe headers — drop host, cookie, and content-length
  const forwardHeaders: HeadersInit = {};
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (["host", "cookie", "content-length", "transfer-encoding"].includes(lower)) return;
    forwardHeaders[key] = value;
  });

  let body: BodyInit | undefined;
  if (!["GET", "HEAD"].includes(req.method)) {
    body = await req.arrayBuffer();
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream, {
      method: req.method,
      headers: forwardHeaders,
      body,
      // @ts-expect-error — Node 18+ fetch supports this
      duplex: "half",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Bridge unreachable", detail: String(err), bridge: BRIDGE_URL },
      { status: 502 }
    );
  }

  const resBody = await upstreamRes.arrayBuffer();
  const resHeaders = new Headers();
  upstreamRes.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (["transfer-encoding", "connection"].includes(lower)) return;
    resHeaders.set(key, value);
  });
  // Allow the browser to call this proxy from any origin inside the app
  resHeaders.set("Access-Control-Allow-Origin", "*");

  return new NextResponse(resBody, {
    status: upstreamRes.status,
    headers: resHeaders,
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
