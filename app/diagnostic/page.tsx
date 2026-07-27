'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Zap } from 'lucide-react';

interface DiagnosticStatus {
  bridge_running: boolean;
  bridge_port: number;
  bridge_url: string;
  max_receiver_detected: boolean;
  cors_enabled: boolean;
  authentication_required: boolean;
  last_command: string | null;
  last_ack: string | null;
  system_info: {
    python_version: string;
    platform: string;
  };
  ports: {
    bridge: number;
    ableton_send: number;
    ableton_recv: number;
  };
  error: string | null;
}

export default function DiagnosticPage() {
  const [status, setStatus] = useState<DiagnosticStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchDiagnostic = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/diagnostic');
      const data: DiagnosticStatus = await res.json();
      setStatus(data);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch diagnostic');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostic();
    const interval = setInterval(fetchDiagnostic, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Ableton Bridge Diagnostic</h1>
            <p className="text-muted-foreground mt-1">Real-time system health check</p>
          </div>
          <button
            onClick={fetchDiagnostic}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            {loading ? 'Checking...' : 'Refresh'}
          </button>
        </div>

        {/* Last refresh */}
        {lastRefresh && (
          <p className="text-xs text-muted-foreground mb-6">
            Last check: {lastRefresh.toLocaleTimeString()}
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4 mb-6 text-destructive">
            <p className="font-medium">Error fetching diagnostic</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Status Cards */}
        {status && (
          <div className="space-y-4">
            {/* Bridge Status */}
            <div className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    {status.bridge_running ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    Bridge Service
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {status.bridge_running
                      ? `Running on ${status.bridge_url}`
                      : 'Not running — Start: python -m ableton_bridge'}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    status.bridge_running
                      ? 'bg-green-500/20 text-green-600'
                      : 'bg-red-500/20 text-red-600'
                  }`}
                >
                  {status.bridge_running ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            {/* Max Device Status */}
            <div className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    {status.max_receiver_detected ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                    Max for Live Device
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {status.max_receiver_detected
                      ? 'AI-Control-Bridge-Receiver detected in Ableton'
                      : 'Device not loaded — Add MIDI effect in Live'}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    status.max_receiver_detected
                      ? 'bg-green-500/20 text-green-600'
                      : 'bg-yellow-500/20 text-yellow-600'
                  }`}
                >
                  {status.max_receiver_detected ? 'Detected' : 'Not Found'}
                </span>
              </div>
            </div>

            {/* CORS Status */}
            <div className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    {status.cors_enabled ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    CORS Configuration
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {status.cors_enabled
                      ? 'Browser can call bridge directly'
                      : 'CORS headers missing — restart bridge'}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    status.cors_enabled
                      ? 'bg-green-500/20 text-green-600'
                      : 'bg-red-500/20 text-red-600'
                  }`}
                >
                  {status.cors_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Authentication */}
            <div className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Authentication
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {status.authentication_required
                      ? 'Token required — check bridge.config.json'
                      : 'No authentication required (zero-trust mode)'}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    !status.authentication_required
                      ? 'bg-green-500/20 text-green-600'
                      : 'bg-yellow-500/20 text-yellow-600'
                  }`}
                >
                  {status.authentication_required ? 'Required' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Port Configuration */}
            <div className="border border-border rounded-lg p-4 bg-card">
              <h3 className="font-semibold text-foreground mb-3">Port Configuration</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Bridge API</p>
                  <p className="font-mono text-foreground mt-1">127.0.0.1:{status.ports.bridge}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ableton Send</p>
                  <p className="font-mono text-foreground mt-1">127.0.0.1:{status.ports.ableton_send}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ableton Receive</p>
                  <p className="font-mono text-foreground mt-1">127.0.0.1:{status.ports.ableton_recv}</p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="border border-border rounded-lg p-4 bg-card">
              <h3 className="font-semibold text-foreground mb-3">Recent Activity</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Last Command</p>
                  <p className="font-mono text-foreground mt-1">
                    {status.last_command || 'No commands sent yet'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Acknowledgment</p>
                  <p className="font-mono text-foreground mt-1">
                    {status.last_ack || 'No acknowledgments received yet'}
                  </p>
                </div>
              </div>
            </div>

            {/* System Info */}
            <div className="border border-border rounded-lg p-4 bg-card">
              <h3 className="font-semibold text-foreground mb-3">System Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Python Version</p>
                  <p className="font-mono text-foreground mt-1">{status.system_info.python_version}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Platform</p>
                  <p className="font-mono text-foreground mt-1">{status.system_info.platform}</p>
                </div>
              </div>
            </div>

            {/* Troubleshooting Guide */}
            <div className="border border-border rounded-lg p-4 bg-card mt-6">
              <h3 className="font-semibold text-foreground mb-3">Quick Fix Guide</h3>
              <div className="space-y-2 text-sm">
                {!status.bridge_running && (
                  <div className="p-2 bg-red-500/10 border border-red-500/30 rounded">
                    <p className="text-red-600 font-medium">Bridge offline</p>
                    <p className="text-red-600/80">Double-click start-bridge.bat or run: python -m ableton_bridge</p>
                  </div>
                )}
                {!status.max_receiver_detected && (
                  <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                    <p className="text-yellow-600 font-medium">Max device missing</p>
                    <p className="text-yellow-600/80">Add MIDI Effect in Ableton track, search for "AI Control Bridge Receiver"</p>
                  </div>
                )}
                {!status.cors_enabled && (
                  <div className="p-2 bg-red-500/10 border border-red-500/30 rounded">
                    <p className="text-red-600 font-medium">CORS disabled</p>
                    <p className="text-red-600/80">Restart the bridge — it should enable CORS automatically</p>
                  </div>
                )}
                {status.authentication_required && (
                  <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                    <p className="text-yellow-600 font-medium">Auth required</p>
                    <p className="text-yellow-600/80">Token configured — set ABLETON_BRIDGE_TOKEN= before launching</p>
                  </div>
                )}
                {status.bridge_running &&
                  status.max_receiver_detected &&
                  status.cors_enabled &&
                  !status.authentication_required && (
                    <div className="p-2 bg-green-500/10 border border-green-500/30 rounded">
                      <p className="text-green-600 font-medium">All systems operational</p>
                      <p className="text-green-600/80">Everything is working! Go to /test-tempo and send a command.</p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
