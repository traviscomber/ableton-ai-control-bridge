from __future__ import annotations

from . import server
from .webui_pro import PRO_CONTROL_UI


INSPECTION_TIMEOUT_PATCH = (
    "async function exec(payload){return waitAck(await submit(payload))}",
    "async function exec(payload){const timeout=payload&&payload.type==='inspect_device_parameters'?30000:7000;return waitAck(await submit(payload),timeout)}",
)

LAZY_DISCOVERY_PATCH = (
    "async function discover(){try{setBusy(true);setError();const state=(await exec({type:'get_live_state'})).result||{};const tracks=(await exec({type:'list_tracks'})).result?.tracks||[];live.state=state;live.tracks=[];for(const t of tracks){const track={...t,role:inferRole(t.name),deviceDetails:[]};const chain=(await exec({type:'inspect_device_chain',target_kind:'track',track_name:t.name})).result||{};track.device_chain=chain.devices||[];for(const d of track.device_chain){const detail=(await exec({type:'inspect_device_parameters',target_kind:'track',track_name:t.name,device:d.name})).result||{};track.deviceDetails.push(detail)}track.bindings=buildBindings(track);live.tracks.push(track)}render();await loadHistory();document.querySelector('#discoveryPill').className='pill ok';document.querySelector('#discoveryPill').textContent='DISCOVERED'}catch(e){setError(e.message);document.querySelector('#discoveryPill').className='pill bad';document.querySelector('#discoveryPill').textContent='DISCOVERY ERROR'}finally{setBusy(false)}}",
    "async function discover(){try{setBusy(true);setError();const state=(await exec({type:'get_live_state'})).result||{};const tracks=(await exec({type:'list_tracks'})).result?.tracks||[];live.state=state;live.tracks=[];for(const t of tracks){const track={...t,role:inferRole(t.name),deviceDetails:[]};const chain=(await exec({type:'inspect_device_chain',target_kind:'track',track_name:t.name})).result||{};track.device_chain=chain.devices||[];track.bindings=buildBindings(track);live.tracks.push(track)}render();await loadHistory();document.querySelector('#discoveryPill').className='pill ok';document.querySelector('#discoveryPill').textContent='DISCOVERED · READBACK PER TRACK'}catch(e){setError(e.message);document.querySelector('#discoveryPill').className='pill bad';document.querySelector('#discoveryPill').textContent='DISCOVERY ERROR'}finally{setBusy(false)}}",
)

DEVICE_COUNT_PATCH = (
    "devices+=t.deviceDetails.length;",
    "devices+=(t.device_chain||[]).length;",
)

TRACK_LABEL_PATCH = (
    "Track ${t.index} · ${t.deviceDetails.length} devices · vol ${Number(t.volume||0).toFixed(2)} · pan ${Number(t.pan||0).toFixed(2)}",
    "Track ${t.index} · ${(t.device_chain||[]).length} devices · vol ${Number(t.volume||0).toFixed(2)} · pan ${Number(t.pan||0).toFixed(2)}",
)


def _patched_ui() -> str:
    ui = PRO_CONTROL_UI
    for old, new in (
        INSPECTION_TIMEOUT_PATCH,
        LAZY_DISCOVERY_PATCH,
        DEVICE_COUNT_PATCH,
        TRACK_LABEL_PATCH,
    ):
        if old not in ui:
            raise RuntimeError("TITAN UI patch target not found")
        ui = ui.replace(old, new, 1)
    return ui


def main() -> None:
    server.APPROVAL_UI = _patched_ui()
    server.main()


if __name__ == "__main__":
    main()
