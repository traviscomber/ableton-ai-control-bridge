"use client";

import { useEffect, useState } from "react";
import { Activity, Camera, Database, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { fetchCommands, readBridgeConnection, sendCommand } from "@/lib/bridge-client";
import type { BridgeCommand } from "@/lib/types";

type Result = { type: string; status: string; result?: Record<string, unknown> | null; error?: string | null };

const INSPECTIONS = [
  ["Live state", { type: "get_live_state" }],
  ["Tracks", { type: "list_tracks" }],
  ["Returns", { type: "list_returns" }],
  ["Master", { type: "inspect_master" }],
] as const;

export default function LiveDiagnosticsPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [trackRef, setTrackRef] = useState("kick");
  const [device, setDevice] = useState("Operator");
  const [snapshotId, setSnapshotId] = useState("");
  const [masterVolume, setMasterVolume] = useState(0.85);
  const [connection, setConnection] = useState({ url: "", token: "" });

  useEffect(() => setConnection(readBridgeConnection()), []);

  async function execute(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const submitted = await sendCommand(payload);
      const id = submitted.id;
      const deadline = Date.now() + 15000;
      let record: BridgeCommand | undefined;
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 250));
        const commands = await fetchCommands({ limit: 100 });
        record = commands.find(command => command.id === id);
        if (record && ["acknowledged", "error", "rejected", "simulated"].includes(record.status)) break;
      }
      if (!record) throw new Error("Timed out waiting for Bridge ACK");
      const entry = { type: String(payload.type), status: record.status, result: record.result, error: record.error };
      setResults(previous => [entry, ...previous].slice(0, 20));
      if (payload.type === "capture_mixer_snapshot" && record.result?.snapshot_id) setSnapshotId(String(record.result.snapshot_id));
      if (record.status !== "acknowledged" && record.status !== "simulated") throw new Error(record.error || `${payload.type} failed`);
      return record;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Command failed");
      throw cause;
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-[#080a0b] text-[#eef2f3] p-4 md:p-7">
    <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
      <div><div className="text-[#61f2b5] text-xs font-bold tracking-[.2em]">TITAN LIVE 11</div><h1 className="text-3xl font-bold mt-1">Inspection, Recovery & Master</h1><p className="text-[#88949b] mt-1">Every operation waits for a terminal ACK from the active Receiver.</p></div>
      <div className="text-xs text-[#88949b] border border-[#293137] rounded-full px-3 py-2">{connection.url || "Bridge not configured"}</div>
    </header>

    {error && <div className="mb-5 border border-red-500/40 bg-red-950/30 text-red-300 rounded-xl p-3 text-sm">{error}</div>}

    <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
      {INSPECTIONS.map(([label,payload]) => <button key={label} disabled={busy} onClick={()=>execute(payload)} className="text-left bg-[#111518] border border-[#293137] rounded-xl p-4 hover:border-[#61f2b5]/50"><RefreshCw size={17} className="text-[#61f2b5] mb-3"/><b>{label}</b><p className="text-xs text-[#88949b] mt-1">Read-only LiveAPI inspection</p></button>)}
    </section>

    <section className="grid xl:grid-cols-3 gap-4 mb-6">
      <div className="bg-[#111518] border border-[#293137] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4"><Database size={18} className="text-[#61f2b5]"/><h2 className="font-bold">Track & device inspection</h2></div>
        <label className="text-xs text-[#88949b]">Track ref</label><input value={trackRef} onChange={e=>setTrackRef(e.target.value)} className="w-full mt-1 mb-3 bg-[#080a0b] border border-[#293137] rounded-lg px-3 py-2"/>
        <label className="text-xs text-[#88949b]">Device name</label><input value={device} onChange={e=>setDevice(e.target.value)} className="w-full mt-1 mb-3 bg-[#080a0b] border border-[#293137] rounded-lg px-3 py-2"/>
        <div className="grid grid-cols-2 gap-2"><button disabled={busy} onClick={()=>execute({type:"inspect_track",track_ref:trackRef})} className="border border-[#293137] rounded-lg py-2 text-sm">Inspect track</button><button disabled={busy} onClick={()=>execute({type:"inspect_device_parameters",target_kind:"track",track_ref:trackRef,device})} className="border border-[#293137] rounded-lg py-2 text-sm">Parameters</button></div>
      </div>

      <div className="bg-[#111518] border border-[#293137] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4"><Camera size={18} className="text-[#61f2b5]"/><h2 className="font-bold">Mixer snapshot</h2></div>
        <button disabled={busy} onClick={()=>execute({type:"capture_mixer_snapshot"})} className="w-full bg-[#61f2b5] text-black font-bold rounded-lg py-2 mb-3">Capture snapshot</button>
        <label className="text-xs text-[#88949b]">Snapshot ID</label><input value={snapshotId} onChange={e=>setSnapshotId(e.target.value)} className="w-full mt-1 mb-3 bg-[#080a0b] border border-[#293137] rounded-lg px-3 py-2" placeholder="Returned after capture"/>
        <button disabled={busy || !snapshotId} onClick={()=>execute({type:"restore_mixer_snapshot",snapshot_id:snapshotId})} className="w-full border border-[#f1b84b] text-[#f1b84b] rounded-lg py-2 flex items-center justify-center gap-2"><RotateCcw size={15}/>Restore by ACK</button>
      </div>

      <div className="bg-[#111518] border border-[#293137] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4"><ShieldCheck size={18} className="text-[#61f2b5]"/><h2 className="font-bold">Master control</h2></div>
        <label className="text-xs text-[#88949b]">Normalized volume {masterVolume.toFixed(2)}</label><input type="range" min="0" max="1" step="0.01" value={masterVolume} onChange={e=>setMasterVolume(Number(e.target.value))} className="w-full accent-[#61f2b5] my-3"/>
        <div className="grid grid-cols-2 gap-2"><button disabled={busy} onClick={()=>execute({type:"inspect_master"})} className="border border-[#293137] rounded-lg py-2 text-sm">Inspect</button><button disabled={busy} onClick={()=>execute({type:"set_master_volume",volume:masterVolume})} className="bg-[#f1b84b] text-black font-bold rounded-lg py-2 text-sm">Set volume</button></div>
        <p className="text-xs text-[#88949b] mt-3">Device parameters remain locked to names returned by inspection.</p>
      </div>
    </section>

    <section><div className="flex items-center gap-2 mb-3"><Activity size={18} className="text-[#61f2b5]"/><h2 className="text-xl font-bold">ACK results</h2></div><div className="bg-[#111518] border border-[#293137] rounded-xl divide-y divide-[#293137]">{results.length ? results.map((item,index)=><div key={`${item.type}-${index}`} className="p-3"><div className="flex justify-between gap-3"><b className="font-mono text-sm">{item.type}</b><span className={item.status==="acknowledged"?"text-[#61f2b5] text-xs":"text-red-400 text-xs"}>{item.status}</span></div>{item.error&&<p className="text-red-400 text-xs mt-2">{item.error}</p>}<pre className="mt-2 text-[11px] text-[#aab4ba] whitespace-pre-wrap overflow-auto">{JSON.stringify(item.result ?? {},null,2)}</pre></div>):<div className="p-8 text-center text-[#88949b]">No inspection executed in this session.</div>}</div></section>
  </main>;
}
