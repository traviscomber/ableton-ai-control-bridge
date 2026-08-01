"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CircleStop, Gauge, Play, RefreshCw, Save, SlidersHorizontal, Wifi, WifiOff } from "lucide-react";
import { fetchCommands, fetchHealth, readBridgeConnection, saveBridgeConnection, sendCommand } from "@/lib/bridge-client";
import type { BridgeCommand, BridgeHealth } from "@/lib/types";

const STEMS = [
  ["kick", "01 KICK", 0.82, 0, [0, .01, .01, .08]],
  ["bass", "02 ROUND BASS", 0.72, 0, [.02, .02, .01, .03]],
  ["percussion", "03 PERCUSSION", 0.56, -.08, [.14, .03, .02, .18]],
  ["groove_hats", "04 GROOVE HAT", 0.48, .12, [.10, .03, .02, .08]],
  ["open_hats", "05 OPEN HAT", 0.42, -.16, [.13, .05, .04, .02]],
  ["synth_stab", "06 SYNTH STAB", 0.46, .08, [.08, .10, .07, .11]],
  ["melody", "07 MELODY", 0.43, -.06, [.07, .12, .09, .03]],
  ["pad", "08 PAD", 0.34, .12, [.04, .04, .16, .01]],
  ["fx_riser", "09 FX RISER", 0.34, -.18, [.04, .08, .14, 0]],
  ["fx_impact", "10 FX IMPACT", 0.40, .14, [.06, .03, .08, .04]],
  ["voice", "11 VOICE", 0.44, 0, [.12, .15, .12, .03]],
  ["ambient", "12 AMBIENT", 0.30, .18, [.03, .03, .20, 0]],
] as const;

const RETURNS = [
  [0, "A", "SHORT ROOM", "Reverb · 29.3 ms predelay · 351.6 ms decay", .34, 0],
  [1, "B", "DUB DELAY", "Echo · tempo-synced stereo delay", .28, 0],
  [2, "C", "LONG SPACE", "Hybrid Reverb · long atmospheric tail", .24, 0],
  [3, "D", "PARALLEL DRIVE", "Drum Buss / Glue · parallel density", .20, 0],
] as const;

type UiState = "target" | "pending" | "confirmed" | "error";

export default function TitanConsole() {
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const [commands, setCommands] = useState<BridgeCommand[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tempo, setTempo] = useState(128);
  const [connection, setConnection] = useState({ url: "http://127.0.0.1:8765", token: "" });
  const [levels, setLevels] = useState<Record<string, number>>(() => Object.fromEntries(STEMS.map(([ref,,v]) => [ref, v])));
  const [pans, setPans] = useState<Record<string, number>>(() => Object.fromEntries(STEMS.map(([ref,,,p]) => [ref, p])));
  const [sends, setSends] = useState<Record<string, number[]>>(() => Object.fromEntries(STEMS.map(([ref,,,,s]) => [ref, [...s]])));
  const [muted, setMuted] = useState<Record<string, boolean>>(() => Object.fromEntries(STEMS.map(([ref]) => [ref, false])));
  const [soloed, setSoloed] = useState<Record<string, boolean>>(() => Object.fromEntries(STEMS.map(([ref]) => [ref, false])));
  const [returnLevels, setReturnLevels] = useState<Record<number, number>>(() => Object.fromEntries(RETURNS.map(([i,,,,v]) => [i, v])));
  const [returnPans, setReturnPans] = useState<Record<number, number>>(() => Object.fromEntries(RETURNS.map(([i,,,,,p]) => [i, p])));
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
      setCommands(await fetchCommands({ limit: 100 }));
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

  const run = async (payload: Record<string, unknown>, key?: string) => {
    if (key) setPendingKeys(prev => new Set(prev).add(key));
    setBusy(true);
    try {
      await sendCommand(payload);
      setError("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Command failed");
      throw e;
    } finally {
      if (key) setPendingKeys(prev => { const next = new Set(prev); next.delete(key); return next; });
      setBusy(false);
    }
  };

  const runBatch = async (items: Array<{payload: Record<string, unknown>; key?: string}>) => {
    setBusy(true);
    try {
      for (const item of items) {
        if (item.key) setPendingKeys(prev => new Set(prev).add(item.key!));
        await sendCommand(item.payload);
      }
      setError("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch command failed");
    } finally {
      setPendingKeys(new Set());
      setBusy(false);
    }
  };

  const latestState = (matcher: (c: BridgeCommand) => boolean, key: string): UiState => {
    if (pendingKeys.has(key)) return "pending";
    const command = commands.find(matcher);
    if (!command) return "target";
    if (command.status === "acknowledged" || command.status === "simulated") return "confirmed";
    if (command.status === "error" || command.status === "rejected") return "error";
    return "pending";
  };

  const applyTrack = async (ref: string) => runBatch([
    { payload: { type: "set_track_volume", track_ref: ref, volume: levels[ref] }, key: `${ref}:mix` },
    { payload: { type: "set_track_pan", track_ref: ref, pan: pans[ref] }, key: `${ref}:mix` },
  ]);

  const applySends = async (ref: string) => runBatch(sends[ref].map((amount, index) => ({
    payload: { type: "set_track_send", track_ref: ref, return: index, amount },
    key: `${ref}:sends`,
  })));

  const applyPremix = async () => {
    const items: Array<{payload: Record<string, unknown>; key?: string}> = [];
    for (const [ref] of STEMS) {
      items.push({ payload: { type: "set_track_volume", track_ref: ref, volume: levels[ref] }, key: `${ref}:mix` });
      items.push({ payload: { type: "set_track_pan", track_ref: ref, pan: pans[ref] }, key: `${ref}:mix` });
      sends[ref].forEach((amount, index) => items.push({ payload: { type: "set_track_send", track_ref: ref, return: index, amount }, key: `${ref}:sends` }));
    }
    await runBatch(items);
  };

  const toggleMute = async (ref: string) => {
    const next = !muted[ref];
    setMuted(prev => ({ ...prev, [ref]: next }));
    try { await run({ type: "set_track_mute", track_ref: ref, muted: next }, `${ref}:mute`); }
    catch { setMuted(prev => ({ ...prev, [ref]: !next })); }
  };

  const toggleSolo = async (ref: string) => {
    const next = !soloed[ref];
    setSoloed(prev => ({ ...prev, [ref]: next }));
    try { await run({ type: "set_track_solo", track_ref: ref, soloed: next }, `${ref}:solo`); }
    catch { setSoloed(prev => ({ ...prev, [ref]: !next })); }
  };

  const applyReturn = async (index: number) => runBatch([
    { payload: { type: "set_return_volume", return: index, volume: returnLevels[index] }, key: `return:${index}` },
    { payload: { type: "set_return_pan", return: index, pan: returnPans[index] }, key: `return:${index}` },
  ]);

  const ackAgeSeconds = health?.last_ack_at ? Math.max(0, Math.floor((Date.now() - new Date(health.last_ack_at).getTime()) / 1000)) : null;
  const receiverFresh = health?.max_receiver_seen === true && ackAgeSeconds !== null && ackAgeSeconds <= 60;
  const acked = useMemo(() => commands.filter(c => c.status === "acknowledged").length, [commands]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_0%,#12231d_0,transparent_28%)] bg-[#080a0b] text-[#eef2f3] p-4 md:p-7">
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 mb-6">
        <div><div className="text-[#61f2b5] text-xs font-bold tracking-[.2em]">TITAN PRODUCTION SYSTEM</div><h1 className="text-3xl font-bold mt-1">Ableton Live 11 Control Console</h1><p className="text-[#88949b] mt-1">Targets are presets. Confirmed means Ableton returned an ACK.</p></div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Status state={health ? "confirmed" : "error"} label={health ? `Bridge v${health.version}` : "Bridge offline"} />
          <Status state={receiverFresh ? "confirmed" : health?.max_receiver_seen ? "pending" : "target"} label={receiverFresh ? "Receiver confirmed" : health?.max_receiver_seen ? `ACK stale · ${ackAgeSeconds}s` : "Receiver waiting"} />
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

      {error && <div className="mb-5 border border-red-500/40 bg-red-950/30 text-red-300 rounded-xl p-3 text-sm">{error}. Open the desktop bridge; the installed launcher supplies connection data automatically.</div>}

      <section className="grid md:grid-cols-4 gap-3 mb-6">
        <Metric icon={<Wifi size={18}/>} label="Bridge" value={health ? "Online" : "Offline"}/>
        <Metric icon={receiverFresh?<Wifi size={18}/>:<WifiOff size={18}/>} label="Ableton ACK" value={receiverFresh ? "Fresh" : health?.max_receiver_seen ? "Stale" : "None"}/>
        <Metric icon={<Gauge size={18}/>} label="Tempo target" value={`${tempo} BPM`}/>
        <Metric icon={<Activity size={18}/>} label="Mode" value={health?.approval_required ? "Approval" : "Autonomous"}/>
      </section>

      <section className="bg-[#111518] border border-[#293137] rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={busy} onClick={()=>run({type:"start_playback"})} className="bg-[#61f2b5] text-black rounded-lg px-4 py-2 font-bold flex gap-2 items-center"><Play size={16}/>Play</button>
          <button disabled={busy} onClick={()=>run({type:"stop_playback"})} className="bg-[#20262a] rounded-lg px-4 py-2 flex gap-2 items-center"><CircleStop size={16}/>Stop</button>
          <input type="number" value={tempo} onChange={e=>setTempo(Number(e.target.value))} className="w-24 bg-[#080a0b] border border-[#293137] rounded-lg px-3 py-2"/>
          <button disabled={busy} onClick={()=>run({type:"set_tempo",bpm:tempo},"tempo")} className="border border-[#293137] rounded-lg px-4 py-2">Set tempo</button>
          <button disabled={busy} onClick={applyPremix} className="ml-auto bg-[#f1b84b] text-black font-bold rounded-lg px-4 py-2 flex gap-2 items-center"><SlidersHorizontal size={16}/>Apply full premix</button>
        </div>
      </section>

      <section className="mb-7">
        <div className="flex items-end justify-between mb-3"><div><h2 className="text-xl font-bold">Stem Mixer</h2><p className="text-sm text-[#88949b]">Targets become confirmed only after ACK. Apply Mix sends volume and pan; Apply Sends sends A–D.</p></div></div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {STEMS.map(([ref,name]) => {
            const mixState = latestState(c => ["set_track_volume","set_track_pan"].includes(c.command_type) && c.payload.track_ref === ref, `${ref}:mix`);
            return <div key={ref} className="bg-[#111518] border border-[#293137] rounded-xl p-4">
              <div className="flex justify-between gap-2 mb-3"><b>{name}</b><StateBadge state={mixState}/></div>
              <label className="text-xs text-[#88949b]">Volume target {levels[ref].toFixed(2)}</label>
              <input className="w-full accent-[#61f2b5]" type="range" min="0" max="1" step="0.01" value={levels[ref]} onChange={e=>setLevels({...levels,[ref]:Number(e.target.value)})}/>
              <label className="text-xs text-[#88949b]">Pan target {pans[ref].toFixed(2)}</label>
              <input className="w-full accent-[#f1b84b]" type="range" min="-1" max="1" step="0.01" value={pans[ref]} onChange={e=>setPans({...pans,[ref]:Number(e.target.value)})}/>
              <div className="grid grid-cols-4 gap-2 mt-3">{sends[ref].map((value,index)=><label key={index} className="text-[10px] text-[#88949b]">{String.fromCharCode(65+index)} {value.toFixed(2)}<input className="w-full accent-[#6ea8ff]" type="range" min="0" max="1" step="0.01" value={value} onChange={e=>setSends({...sends,[ref]:sends[ref].map((v,i)=>i===index?Number(e.target.value):v)})}/></label>)}</div>
              <div className="grid grid-cols-4 gap-2 mt-3">
                <button disabled={busy} onClick={()=>applyTrack(ref)} className="border border-[#293137] rounded-md py-1.5 text-xs">Apply Mix</button>
                <button disabled={busy} onClick={()=>applySends(ref)} className="border border-[#293137] rounded-md py-1.5 text-xs">Apply Sends</button>
                <button disabled={busy} onClick={()=>toggleMute(ref)} className={`border rounded-md py-1.5 text-xs ${muted[ref]?"bg-[#f1b84b] text-black border-[#f1b84b]":"border-[#293137]"}`}>M {muted[ref]?"ON":"OFF"}</button>
                <button disabled={busy} onClick={()=>toggleSolo(ref)} className={`border rounded-md py-1.5 text-xs ${soloed[ref]?"bg-[#61f2b5] text-black border-[#61f2b5]":"border-[#293137]"}`}>S {soloed[ref]?"ON":"OFF"}</button>
              </div>
            </div>})}
        </div>
      </section>

      <section className="mb-7"><div className="flex items-end justify-between mb-3"><div><h2 className="text-xl font-bold">Return Controls</h2><p className="text-sm text-[#88949b]">A=0, B=1, C=2, D=3. Device chains remain validated separately.</p></div></div><div className="grid md:grid-cols-4 gap-3">{RETURNS.map(([index,letter,name,desc])=>{
        const state = latestState(c => ["set_return_volume","set_return_pan"].includes(c.command_type) && c.payload.return === index, `return:${index}`);
        return <div key={letter} className="bg-[#111518] border border-[#293137] rounded-xl p-4"><div className="flex justify-between"><div className="text-[#61f2b5] font-mono text-sm">RETURN {letter}</div><StateBadge state={state}/></div><b className="block mt-1">{name}</b><p className="text-xs text-[#88949b] mt-2 min-h-8">{desc}</p><label className="text-xs text-[#88949b]">Volume target {returnLevels[index].toFixed(2)}</label><input className="w-full accent-[#61f2b5]" type="range" min="0" max="1" step="0.01" value={returnLevels[index]} onChange={e=>setReturnLevels({...returnLevels,[index]:Number(e.target.value)})}/><label className="text-xs text-[#88949b]">Pan target {returnPans[index].toFixed(2)}</label><input className="w-full accent-[#f1b84b]" type="range" min="-1" max="1" step="0.01" value={returnPans[index]} onChange={e=>setReturnPans({...returnPans,[index]:Number(e.target.value)})}/><button disabled={busy} onClick={()=>applyReturn(index)} className="mt-3 w-full border border-[#293137] rounded-md py-2 text-xs">Apply Return</button></div>})}</div></section>

      <section className="mb-7 bg-[#111518] border border-[#293137] rounded-xl p-4"><div className="flex justify-between gap-4"><div><h2 className="text-xl font-bold">Master Chain</h2><p className="text-sm text-[#88949b] mt-1">EQ Eight → Glue Compressor → Saturator → Limiter</p></div><StateBadge state="target" label="NOT AUTOMATED"/></div><p className="text-xs text-[#88949b] mt-3">This is a documented target only. Titan will not claim or apply Master settings until dedicated master-device commands and readback are implemented.</p></section>

      <section><h2 className="text-xl font-bold mb-3">Recent Activity</h2><div className="bg-[#111518] border border-[#293137] rounded-xl divide-y divide-[#293137]">{commands.length?commands.slice(0,16).map(c=><div key={c.id} className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-2"><div><b className="font-mono text-sm">{c.command_type}</b><div className="text-[11px] text-[#88949b]">{c.id}</div>{c.error&&<div className="text-xs text-red-400 mt-1">{c.error}</div>}</div><span className={`text-xs font-mono ${c.status==="acknowledged"?"text-[#61f2b5]":c.status==="error"?"text-red-400":"text-[#f1b84b]"}`}>{c.status}</span></div>):<div className="p-8 text-center text-[#88949b]">No commands yet</div>}</div></section>
    </main>
  );
}

function Status({state,label}:{state:UiState;label:string}){const cls=state==="confirmed"?"text-[#61f2b5] border-emerald-900":state==="error"?"text-red-400 border-red-900":"text-[#f1b84b] border-amber-900";return <span className={`px-3 py-2 rounded-full border bg-[#111518] ${cls}`}>{label}</span>}
function StateBadge({state,label}:{state:UiState;label?:string}){const text=label??state.toUpperCase();const cls=state==="confirmed"?"text-[#61f2b5] border-emerald-900":state==="error"?"text-red-400 border-red-900":state==="pending"?"text-[#f1b84b] border-amber-900":"text-[#88949b] border-[#293137]";return <span className={`text-[9px] font-mono px-2 py-1 rounded-full border ${cls}`}>{text}</span>}
function Metric({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){return <div className="bg-[#111518] border border-[#293137] rounded-xl p-4"><div className="text-[#61f2b5] mb-3">{icon}</div><div className="text-xs uppercase tracking-wider text-[#88949b]">{label}</div><b className="text-xl block mt-1">{value}</b></div>}
