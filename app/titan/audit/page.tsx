"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CommandRecord = {
  id: string;
  status: string;
  result?: unknown;
  error?: string | null;
};

type Device = {
  index: number;
  name: string;
  class_name?: string;
  parameter_count?: number;
};

type Parameter = {
  index: number;
  name: string;
  min: number;
  max: number;
  value: number;
  normalized: number;
  is_quantized?: boolean;
  is_enabled?: boolean;
  value_items?: string[];
};

type Issue = {
  target: string;
  device?: string;
  parameter?: string;
  code: string;
  detail: string;
};

type AuditSummary = {
  tracks: number;
  returns: number;
  devices: number;
  parameters: number;
  duplicateDevices: number;
  skippedDevices: number;
  timeouts: number;
  issues: number;
};

const BRIDGE = "http://127.0.0.1:8765";
const POLL_MS = 180;
const COMMAND_TIMEOUT_MS = 12000;
const EPSILON = 1e-6;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function runCommand(payload: Record<string, unknown>): Promise<unknown> {
  const submitted = await jsonFetch(`${BRIDGE}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const initial = submitted?.command as CommandRecord | undefined;
  if (!initial?.id) throw new Error(`Bridge did not return command id for ${payload.type}`);

  const deadline = Date.now() + COMMAND_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const state = await jsonFetch(`${BRIDGE}/api/commands/${initial.id}`);
    const command = state?.command as CommandRecord | undefined;
    if (!command) throw new Error(`Command disappeared: ${initial.id}`);
    if (command.status === "acknowledged") return command.result;
    if (["error", "rejected"].includes(command.status)) {
      throw new Error(command.error || `${payload.type} failed with status ${command.status}`);
    }
    await sleep(POLL_MS);
  }
  throw new Error(`TIMEOUT ${payload.type}`);
}

function validateParameter(target: string, device: string, parameter: Parameter): Issue[] {
  const issues: Issue[] = [];
  const values = [parameter.min, parameter.max, parameter.value, parameter.normalized];
  if (!values.every(Number.isFinite)) {
    issues.push({ target, device, parameter: parameter.name, code: "NON_FINITE", detail: "min/max/value/normalized contains a non-finite value" });
    return issues;
  }
  if (parameter.max < parameter.min) {
    issues.push({ target, device, parameter: parameter.name, code: "INVALID_RANGE", detail: `max ${parameter.max} < min ${parameter.min}` });
  }
  if (parameter.value < parameter.min - EPSILON || parameter.value > parameter.max + EPSILON) {
    issues.push({ target, device, parameter: parameter.name, code: "VALUE_OUT_OF_RANGE", detail: `value ${parameter.value} outside [${parameter.min}, ${parameter.max}]` });
  }
  if (parameter.normalized < -EPSILON || parameter.normalized > 1 + EPSILON) {
    issues.push({ target, device, parameter: parameter.name, code: "NORMALIZED_OUT_OF_RANGE", detail: `normalized ${parameter.normalized} outside 0..1` });
  }
  const expected = parameter.max === parameter.min ? 0 : (parameter.value - parameter.min) / (parameter.max - parameter.min);
  if (Math.abs(expected - parameter.normalized) > 1e-5) {
    issues.push({ target, device, parameter: parameter.name, code: "NORMALIZATION_MISMATCH", detail: `expected ${expected}, got ${parameter.normalized}` });
  }
  if (parameter.is_quantized && Array.isArray(parameter.value_items) && parameter.value_items.length > 1) {
    const steps = parameter.value_items.length - 1;
    const step = (parameter.max - parameter.min) / steps;
    if (step > 0) {
      const nearest = parameter.min + Math.round((parameter.value - parameter.min) / step) * step;
      if (Math.abs(nearest - parameter.value) > 1e-4) {
        issues.push({ target, device, parameter: parameter.name, code: "QUANTIZATION_MISMATCH", detail: `value ${parameter.value} is not aligned to ${steps} reported quantized steps` });
      }
    }
  }
  return issues;
}

export default function TitanChainAuditPage() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Waiting");
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const append = useCallback((line: string) => {
    setLog((current) => [...current.slice(-159), line]);
  }, []);

  const auditTarget = useCallback(async (
    targetKind: "track" | "return" | "master",
    selector: Record<string, unknown>,
    label: string,
    counters: AuditSummary,
    foundIssues: Issue[],
  ) => {
    let chain: { devices?: Device[] } | undefined;
    try {
      chain = (await runCommand({ type: "inspect_device_chain", target_kind: targetKind, ...selector })) as { devices?: Device[] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("TIMEOUT")) counters.timeouts += 1;
      foundIssues.push({ target: label, code: "CHAIN_READ_FAILED", detail: message });
      append(`${label}: chain failed — ${message}`);
      return;
    }

    const devices = Array.isArray(chain?.devices) ? chain.devices : [];
    counters.devices += devices.length;
    const counts = new Map<string, number>();
    for (const device of devices) counts.set(device.name, (counts.get(device.name) || 0) + 1);

    for (const device of devices) {
      if ((counts.get(device.name) || 0) > 1) {
        counters.duplicateDevices += 1;
        counters.skippedDevices += 1;
        foundIssues.push({ target: label, device: device.name, code: "DUPLICATE_DEVICE_NAME", detail: `device index ${device.index}; rename devices uniquely before semantic binding` });
        append(`${label} / ${device.name}: skipped duplicate name`);
        continue;
      }

      try {
        const inspected = (await runCommand({
          type: "inspect_device_parameters",
          target_kind: targetKind,
          ...selector,
          device: device.name,
        })) as { parameters?: Parameter[] };
        const parameters = Array.isArray(inspected?.parameters) ? inspected.parameters : [];
        counters.parameters += parameters.length;
        const parameterNames = new Map<string, number>();
        for (const parameter of parameters) {
          parameterNames.set(parameter.name, (parameterNames.get(parameter.name) || 0) + 1);
          foundIssues.push(...validateParameter(label, device.name, parameter));
        }
        for (const [name, count] of parameterNames.entries()) {
          if (count > 1) {
            foundIssues.push({ target: label, device: device.name, parameter: name, code: "DUPLICATE_PARAMETER_NAME", detail: `${count} parameters share this exact name` });
          }
        }
        append(`${label} / ${device.name}: ${parameters.length} parameters`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("TIMEOUT")) counters.timeouts += 1;
        counters.skippedDevices += 1;
        foundIssues.push({ target: label, device: device.name, code: "PARAMETER_READ_FAILED", detail: message });
        append(`${label} / ${device.name}: parameter read failed — ${message}`);
      }
    }
  }, [append]);

  const runAudit = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setStatus("Connecting to local bridge");
    setSummary(null);
    setIssues([]);
    setLog([]);

    const counters: AuditSummary = {
      tracks: 0,
      returns: 0,
      devices: 0,
      parameters: 0,
      duplicateDevices: 0,
      skippedDevices: 0,
      timeouts: 0,
      issues: 0,
    };
    const foundIssues: Issue[] = [];

    try {
      const health = await jsonFetch(`${BRIDGE}/health`);
      if (!health?.ok) throw new Error("Bridge health is not OK");
      append(`bridge ${health.version || "unknown"} · ACK ${health.max_receiver_seen ? "yes" : "no"}`);

      setStatus("Reading track topology");
      const tracksResult = (await runCommand({ type: "list_tracks" })) as { tracks?: Array<{ index: number; name: string }> };
      const returnsResult = (await runCommand({ type: "list_returns" })) as { returns?: Array<{ index: number; name: string }> };
      const tracks = Array.isArray(tracksResult?.tracks) ? tracksResult.tracks : [];
      const returns = Array.isArray(returnsResult?.returns) ? returnsResult.returns : [];
      counters.tracks = tracks.length;
      counters.returns = returns.length;

      for (let i = 0; i < tracks.length; i += 1) {
        const track = tracks[i];
        setStatus(`Auditing track ${i + 1}/${tracks.length}: ${track.name}`);
        await auditTarget("track", { track: track.index }, `TRACK ${track.index} · ${track.name}`, counters, foundIssues);
      }

      for (let i = 0; i < returns.length; i += 1) {
        const ret = returns[i];
        setStatus(`Auditing return ${i + 1}/${returns.length}: ${ret.name}`);
        await auditTarget("return", { return: ret.index }, `RETURN ${ret.index} · ${ret.name}`, counters, foundIssues);
      }

      setStatus("Auditing master chain");
      await auditTarget("master", {}, "MASTER", counters, foundIssues);

      counters.issues = foundIssues.length;
      setIssues(foundIssues);
      setSummary({ ...counters });
      setStatus(foundIssues.length === 0 && counters.timeouts === 0 ? "PASS" : "ATTENTION");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      foundIssues.push({ target: "BRIDGE", code: "AUDIT_ABORTED", detail: message });
      counters.issues = foundIssues.length;
      setIssues(foundIssues);
      setSummary({ ...counters });
      setStatus(`FAILED: ${message}`);
    } finally {
      setRunning(false);
    }
  }, [append, auditTarget, running]);

  useEffect(() => {
    void runAudit();
    // Intentionally run once on mount; the button can re-run manually.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pass = useMemo(() => !!summary && summary.issues === 0 && summary.timeouts === 0, [summary]);

  return (
    <main style={{ minHeight: "100vh", background: "#070b0a", color: "#e8f1ee", padding: 28, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
      <div style={{ maxWidth: 1480, margin: "0 auto" }}>
        <div style={{ color: "#63f5bd", fontSize: 12, letterSpacing: "0.16em", marginBottom: 8 }}>TITAN · READ-ONLY CHAIN AUDIT</div>
        <h1 style={{ fontSize: 30, margin: 0 }}>Live Set Parameter Integrity</h1>
        <p style={{ color: "#95a5a0", maxWidth: 860 }}>Reads every visible track, return, master device and parameter from the local Ableton bridge. It does not write to Live.</p>

        <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "20px 0" }}>
          <button disabled={running} onClick={() => void runAudit()} style={{ border: "1px solid #2d6f58", background: running ? "#16201d" : "#63f5bd", color: running ? "#8aa099" : "#07110e", padding: "10px 16px", fontWeight: 800, cursor: running ? "default" : "pointer" }}>
            {running ? "AUDITING…" : "RUN FULL AUDIT"}
          </button>
          <span style={{ border: `1px solid ${pass ? "#2d6f58" : "#735d24"}`, padding: "8px 12px", color: pass ? "#63f5bd" : "#f4bd4d" }}>{status}</span>
        </div>

        {summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(120px, 1fr))", gap: 8, marginBottom: 18 }}>
            {([
              ["Tracks", summary.tracks], ["Returns", summary.returns], ["Devices", summary.devices], ["Parameters", summary.parameters],
              ["Duplicates", summary.duplicateDevices], ["Timeouts", summary.timeouts], ["Issues", summary.issues],
            ] as Array<[string, number]>).map(([label, value]) => (
              <div key={label} style={{ border: "1px solid #24332f", background: "#0d1412", padding: 12 }}>
                <div style={{ color: "#7f918b", fontSize: 11 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        <section style={{ border: "1px solid #24332f", background: "#0a100e", padding: 14, marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, marginTop: 0 }}>Issues</h2>
          {issues.length === 0 ? <div style={{ color: "#63f5bd" }}>No parameter integrity issues detected so far.</div> : issues.map((issue, index) => (
            <div key={`${issue.code}-${index}`} style={{ borderTop: index ? "1px solid #1c2824" : undefined, padding: "8px 0" }}>
              <strong>{issue.code}</strong> · {issue.target}{issue.device ? ` · ${issue.device}` : ""}{issue.parameter ? ` · ${issue.parameter}` : ""}
              <div style={{ color: "#a9b5b1", marginTop: 2 }}>{issue.detail}</div>
            </div>
          ))}
        </section>

        <section style={{ border: "1px solid #24332f", background: "#0a100e", padding: 14 }}>
          <h2 style={{ fontSize: 15, marginTop: 0 }}>Audit log</h2>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, color: "#a9b5b1", fontSize: 12, maxHeight: 520, overflow: "auto" }}>{log.join("\n") || "No events yet."}</pre>
        </section>
      </div>
    </main>
  );
}
