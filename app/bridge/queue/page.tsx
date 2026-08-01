"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CircleStop, Gauge, Play, RefreshCw, Save, SlidersHorizontal, Wifi, WifiOff } from "lucide-react";
import { fetchCommands, fetchHealth, readBridgeConnection, saveBridgeConnection, sendCommand } from "@/lib/bridge-client";
import type { BridgeCommand, BridgeHealth } from "@/lib/types";

const STEMS = [
  ["kick", "01 KICK", 0.82, 0], ["bass", "02 ROUND BASS", 0.72, 0], ["percussion", "03 PERCUSSION", 0.56, -0.08],
  ["groove_hats", "04 GROOVE HAT", 0.48, 0.12], ["open_hats", "05 OPEN HAT", 0.42, -0.16], ["synth_stab", "06 SYNTH STAB", 0.46, 0.08],
  ["melody", "07 MELODY", 0.43, -0.06], ["pad", "08 PAD", 0.34, 0.12], ["fx_riser", "09 FX RISER", 0.34, -0.18],
  ["fx_impact", "10 FX IMPACT", 0.40, 0.14], ["voice", "11 VOICE", 0.44, 0], ["ambient", "12 AMBIENT", 0.30, 0.18],
] as const;

const RETURNS = [
  ["A", "SHORT ROOM", "Reverb · 29.3 ms predelay · 351.6 ms decay"],
  ["B", "DUB DELAY", "Echo · tempo-synced stereo delay"],
  ["C", "LONG SPACE", "Hybrid Reverb · long atmospheric tail"],
  ["D", "PARALLEL DRIVE", "Drum Buss / Glue · parallel density"],
] as const;

export default function TitanConsole() {
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const [commands, setCommands] = useState<BridgeCommand[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tempo, setTempo] = useState(128);
  const [connection, setConnection] = useState({ url: "http://127.0.0.1:8765", token: "" });
  const [levels, setLevels] = useState<Record<string, number>>(() => Object.fromEntries(STEMS.map(([ref,,v]) => [ref, v])));
  const [pans, setPans] = useState<Record<string, number>>(() => Object.fromEntries(STEMS.map(([ref,,,p]) => [ref, p])));

  const refresh = useCallback(async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
      setCommands(await fetchCommands({ limit: 30 }));
      setError("");
    } catch (e) {
      setHealth(null);
      setError(e instanceof Error ? e.message : "Bridge unavailable");
    }
  }, []);

  useEffect(() => {
    setConnection(readBridgeConnection());
    refresh();
    const id = setInterval(refresh, 2500);
    return () => clearInterval(id);
  }, [refresh]);

  const run = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try { await sendCommand(payload); setError(""); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Command failed"); }
    finally { setBusy(false); }
  };

  const applyPremix = async () => {
    setBusy(true);
    try {
      for (const [ref] of STEMS) {
        await sendCommand({ type: "set_track_volume", track_ref: ref, volume: levels[ref] });
        await sendCommand({ type: "set_track_pan", track_ref: ref, pan: pans[ref] });
      }
      setError(""); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Premix failed"); }
    finally { setBusy(false); }
  };

  const acked = useMemo(() => commands.filter(c => c.status === "acknowledged").length, [commands]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_0%,#12231d_0,transparent_28%)] bg-[#080a0b] text-[#eef2f3] p-4 md:p-7">
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 mb-6">
        <div><div className="text-[#61f2b5] text-xs font-bold tracking-[.2em]">TITAN PRODUCTION SYSTEM</div><h1 className="text-3xl font-bold mt-1">Ableton Live 11 Control Console</h1><p className="text-[#88949b] mt-1">12 stems · 4 returns · canonical mixer · local bridge</p></div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Status ok={!!health} label={health ? `Bridge v${health.version}` : "Bridge offline"} />
          <Status ok={!!health?.max_receiver_seen} label={health?.max_receiver_seen ? "Receiver connected" : "Receiver waiting"} />
          <span className="px-3 py-2 rounded-full border border-[#293137] bg-[#111518] text-[#88949b]">ACK {acked}/{commands.length}</span>
        </div>
      </header>

      <section className="grid lg:grid-cols-[1fr_auto] gap-3 mb-5 bg-[#111518] border border-[#293137] rounded-xl p-4">
        <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3">
          <input value={connection.url} onChange={e=>setConnection({...connection,url:e.target.value})} className="bg-[#080a0b] border border-[#293137] rounded-lg px-3 py-2" placeholder="Bridge URL" />
          <input type="password" value={connection.token} onChange={e=>setConnection({...connection,token:e.target.value})} className="bg-[#080a0b] border border-[#293137] rounded-lg px-3 py-2" placeholder="Local bridge token" />
          <button onClick={()=>{saveBridgeConnection(connection.url,connection.token);refresh();}} className="bg-[#61f2b5] text-black font-bold rounded-lg px-4 py-2 flex items-center gap-2"><Save size={15}/>Connect</button>
        </div>
        <button onClick={refresh} className="border border-[#293137] rounded-lg px-4 py-2 flex items-center gap-2"><RefreshCw size={15}/>Refresh</button>
      </section>

      {error && <div className="mb-5 border border-red-500/40 bg-red-950/30 text-red-300 rounded-xl p-3 text-sm">{error}. Start the desktop bridge, keep the Receiver loaded, then paste the token from config.json.</div>}

      <section className="grid md:grid-cols-4 gap-3 mb-6">
        <Metric icon={<Wifi size={18}/>} label="Bridge" value={health ? "Online" : "Offline"}/>
        <Metric icon={health?.max_receiver_seen?<Wifi size={18}/>:<WifiOff size={18}/>} label="Ableton" value={health?.max_receiver_seen ? "Connected" : "Waiting"}/>
        <Metric icon={<Gauge size={18}/>} label="Tempo" value={`${tempo} BPM`}/>
        <Metric icon={<Activity size={18}/>} label="Mode" value={health?.approval_required ? "Approval" : "Autonomous"}/>
      </section>

      <section className="bg-[#111518] border border-[#293137] rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={busy} onClick={()=>run({type:"start_playback"})} className="bg-[#61f2b5] text-black rounded-lg px-4 py-2 font-bold flex gap-2 items-center"><Play size={16}/>Play</button>
          <button disabled={busy} onClick={()=>run({type:"stop_playback"})} className="bg-[#20262a] rounded-lg px-4 py-2 flex gap-2 items-center"><CircleStop size={16}/>Stop</button>
          <input type="number" value={tempo} onChange={e=>setTempo(Number(e.target.value))} className="w-24 bg-[#080a0b] border border-[#293137] rounded-lg px-3 py-2"/>
          <button disabled={busy} onClick={()=>run({type:"set_tempo",bpm:tempo})} className="border border-[#293137] rounded-lg px-4 py-2">Set tempo</button>
          <button disabled={busy} onClick={applyPremix} className="ml-auto bg-[#f1b84b] text-black font-bold rounded-lg px-4 py-2 flex gap-2 items-center"><SlidersHorizontal size={16}/>Apply canonical premix</button>
        </div>
      </section>

      <section className="mb-7">
        <div className="flex items-end justify-between mb-3"><div><h2 className="text-xl font-bold">Stem Mixer</h2><p className="text-sm text-[#88949b]">Volume, pan, mute and solo for the canonical session</p></div></div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {STEMS.map(([ref,name]) => <div key={ref} className="bg-[#111518] border border-[#293137] rounded-xl p-4">
            <div className="flex justify-between gap-2 mb-4"><b>{name}</b><span className="text-[10px] font-mono text-[#61f2b5]">{ref}</span></div>
            <label className="text-xs text-[#88949b]">Volume {levels[ref].toFixed(2)}</label>
            <input className="w-full accent-[#61f2b5]" type="range" min="0" max="1" step="0.01" value={levels[ref]} onChange={e=>setLevels({...levels,[ref]:Number(e.target.value)})}/>
            <label className="text-xs text-[#88949b]">Pan {pans[ref].toFixed(2)}</label>
            <input className="w-full accent-[#f1b84b]" type="range" min="-1" max="1" step="0.01" value={pans[ref]} onChange={e=>setPans({...pans,[ref]:Number(e.target.value)})}/>
            <div className="grid grid-cols-4 gap-2 mt-3">
              <button onClick={()=>run({type:"set_track_volume",track_ref:ref,volume:levels[ref]})} className="col-span-2 border border-[#293137] rounded-md py-1.5 text-xs">Apply</button>
              <button onClick={()=>run({type:"set_track_mute",track_ref:ref,muted:true})} className="border border-[#293137] rounded-md py-1.5 text-xs">M</button>
              <button onClick={()=>run({type:"set_track_solo",track_ref:ref,soloed:true})} className="border border-[#293137] rounded-md py-1.5 text-xs">S</button>
            </div>
          </div>)}
        </div>
      </section>

      <section className="mb-7"><h2 className="text-xl font-bold mb-3">Return Architecture</h2><div className="grid md:grid-cols-4 gap-3">{RETURNS.map(([letter,name,desc])=><div key={letter} className="bg-[#111518] border border-[#293137] rounded-xl p-4"><div className="text-[#61f2b5] font-mono text-sm">RETURN {letter}</div><b className="block mt-1">{name}</b><p className="text-xs text-[#88949b] mt-2">{desc}</p></div>)}</div></section>

      <section><h2 className="text-xl font-bold mb-3">Recent Activity</h2><div className="bg-[#111518] border border-[#293137] rounded-xl divide-y divide-[#293137]">{commands.length?commands.slice(0,12).map(c=><div key={c.id} className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-2"><div><b className="font-mono text-sm">{c.command_type}</b><div className="text-[11px] text-[#88949b]">{c.id}</div></div><span className={`text-xs font-mono ${c.status==="acknowledged"?"text-[#61f2b5]":c.status==="error"?"text-red-400":"text-[#f1b84b]"}`}>{c.status}</span></div>):<div className="p-8 text-center text-[#88949b]">No commands yet</div>}</div></section>
    </main>
  );
}

function Status({ok,label}:{ok:boolean;label:string}){return <span className={`px-3 py-2 rounded-full border bg-[#111518] ${ok?"text-[#61f2b5] border-emerald-900":"text-[#f1b84b] border-amber-900"}`}>{label}</span>}
function Metric({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){return <div className="bg-[#111518] border border-[#293137] rounded-xl p-4"><div className="text-[#61f2b5] mb-3">{icon}</div><div className="text-xs uppercase tracking-wider text-[#88949b]">{label}</div><b className="text-xl block mt-1">{value}</b></div>}
