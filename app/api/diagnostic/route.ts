import { NextResponse } from 'next/server';

const BRIDGE_URL = 'http://127.0.0.1:8765';

export async function GET() {
  try {
    // Try to reach the bridge
    let bridgeRunning = false;
    let bridgeData: any = null;

    try {
      const res = await fetch(`${BRIDGE_URL}/health`, { cache: 'no-store' });
      if (res.ok) {
        bridgeRunning = true;
        bridgeData = await res.json();
      }
    } catch {
      bridgeRunning = false;
    }

    const diagnostic = {
      bridge_running: bridgeRunning,
      bridge_port: 8765,
      bridge_url: BRIDGE_URL,
      max_receiver_detected: bridgeData?.max_receiver_seen ?? false,
      cors_enabled: bridgeRunning, // If bridge responds, CORS is enabled
      authentication_required: bridgeData?.authentication_required ?? false,
      last_command: bridgeData?.last_command ?? null,
      last_ack: bridgeData?.last_ack_at ?? null,
      system_info: {
        python_version: bridgeData?.version ?? 'unknown',
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'server-side',
      },
      ports: {
        bridge: 8765,
        ableton_send: bridgeData?.udp_target?.split(':')[1] ? parseInt(bridgeData.udp_target.split(':')[1]) : 9001,
        ableton_recv: bridgeData?.ack_listener?.split(':')[1] ? parseInt(bridgeData.ack_listener.split(':')[1]) : 9002,
      },
      error: null,
    };

    return NextResponse.json(diagnostic);
  } catch (error) {
    return NextResponse.json(
      {
        bridge_running: false,
        bridge_port: 8765,
        bridge_url: BRIDGE_URL,
        max_receiver_detected: false,
        cors_enabled: false,
        authentication_required: false,
        last_command: null,
        last_ack: null,
        system_info: {
          python_version: 'unknown',
          platform: 'unknown',
        },
        ports: {
          bridge: 8765,
          ableton_send: 9001,
          ableton_recv: 9002,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 200 }
    );
  }
}
