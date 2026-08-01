autowatch = 1;
inlets = 1;
outlets = 2;
var trackRefs = {};
var snapshots = {};
var snapshotCounter = 0;

function dictionary(name) { var source = new Dict(name); execute(JSON.parse(source.stringify())); }
function anything() { var raw = arrayfromargs(messagename, arguments).join(" "); try { execute(JSON.parse(raw)); } catch (error) { acknowledge(null, false, null, "Invalid JSON: " + error.message); } }
function execute(command) {
    var id = command.bridge_id || null;
    try { var result = dispatch(command); acknowledge(id, true, result || {}, null); outlet(1, "executed", command.type, id || "untracked"); }
    catch (error) { acknowledge(id, false, null, error.message || String(error)); outlet(1, "error", command.type || "unknown", error.message || String(error)); }
}

function dispatch(c) {
    switch (c.type) {
    case "set_tempo": api("live_set").set("tempo", c.bpm); return {tempo:c.bpm};
    case "launch_scene": api("live_set scenes " + integer(c.scene,"scene")).call("fire"); return {scene:c.scene};
    case "stop_all_clips": api("live_set").call("stop_all_clips"); return {};
    case "set_track_volume": setNormalized("live_set tracks " + track(c) + " mixer_device volume",c.volume); return {track:track(c),volume:c.volume};
    case "set_track_pan": setNative("live_set tracks " + track(c) + " mixer_device panning",c.pan); return {track:track(c),pan:c.pan};
    case "set_macro": return setMacro(c);
    case "create_midi_track": return createTrack(c,"create_midi_track");
    case "create_audio_track": return createTrack(c,"create_audio_track");
    case "arm_track": api("live_set tracks " + track(c)).set("arm",c.armed?1:0); return {track:track(c),armed:!!c.armed};
    case "set_device_parameter": return setDeviceParameter(c);
    case "create_midi_clip": return createMidiClip(c);
    case "undo": api("live_set").call("undo"); return {target_command_id:c.target_command_id||null};
    case "start_playback": api("live_set").set("is_playing",1); return {is_playing:true};
    case "stop_playback": api("live_set").set("is_playing",0); return {is_playing:false};
    case "set_time_signature": api("live_set").set("signature_numerator",c.numerator); api("live_set").set("signature_denominator",c.denominator); return {numerator:c.numerator,denominator:c.denominator};
    case "set_metronome": api("live_set").set("metronome",c.enabled?1:0); return {enabled:!!c.enabled};
    case "set_song_loop": api("live_set").set("loop_start",Number(c.start)); api("live_set").set("loop_length",Number(c.length)); api("live_set").set("loop",c.enabled?1:0); return {start:c.start,length:c.length,enabled:!!c.enabled};
    case "create_scene": return createScene(c);
    case "duplicate_scene": api("live_set").call("duplicate_scene",integer(c.scene,"scene")); return {scene:c.scene};
    case "delete_scene": api("live_set").call("delete_scene",integer(c.scene,"scene")); return {scene:c.scene};
    case "duplicate_track": api("live_set").call("duplicate_track",track(c)); return {track:track(c)};
    case "delete_track": api("live_set").call("delete_track",track(c)); return {track:track(c)};
    case "set_track_mute": api("live_set tracks " + track(c)).set("mute",c.muted?1:0); return {track:track(c),muted:!!c.muted};
    case "set_track_solo": api("live_set tracks " + track(c)).set("solo",c.soloed?1:0); return {track:track(c),soloed:!!c.soloed};
    case "launch_clip": api(clipSlotPath(c)).call("fire"); return {track:track(c),clip:c.clip};
    case "stop_track_clips": api("live_set tracks " + track(c)).call("stop_all_clips"); return {track:track(c)};
    case "set_clip_name": api(clipPath(c)).set("name",String(c.name)); return {track:track(c),clip:c.clip,name:c.name};
    case "set_clip_color": api(clipPath(c)).set("color",integer(c.color,"color")); return {track:track(c),clip:c.clip,color:c.color};
    case "set_clip_loop": return setClipLoop(c);
    case "create_return_track": return createReturnTrack(c);
    case "set_return_volume": setNormalized("live_set return_tracks " + returnTrack(c) + " mixer_device volume",c.volume); return {return_track:returnTrack(c),volume:c.volume};
    case "set_return_pan": setNative("live_set return_tracks " + returnTrack(c) + " mixer_device panning",c.pan); return {return_track:returnTrack(c),pan:c.pan};
    case "set_track_send": setNormalized("live_set tracks " + track(c) + " mixer_device sends " + returnTrack(c),c.amount); return {track:track(c),return_track:returnTrack(c),amount:c.amount};
    case "set_return_device_parameter": return setReturnDeviceParameter(c);
    case "get_live_state": return getLiveState();
    case "list_tracks": return {tracks:listTracks()};
    case "inspect_track": return inspectTrack(track(c));
    case "list_returns": return {returns:listReturns()};
    case "inspect_device_chain": return inspectDeviceChain(c);
    case "inspect_device_parameters": return inspectDeviceParameters(c);
    case "inspect_clip": return inspectClip(c);
    case "inspect_master": return inspectMaster();
    case "capture_mixer_snapshot": return captureMixerSnapshot(c);
    case "restore_mixer_snapshot": return restoreMixerSnapshot(c);
    case "capture_device_snapshot": return captureDeviceSnapshot(c);
    case "restore_device_snapshot": return restoreDeviceSnapshot(c);
    case "set_master_volume": setNormalized("live_set master_track mixer_device volume",c.volume); return {volume:c.volume};
    case "set_master_device_parameter": return setMasterDeviceParameter(c);
    case "set_master_device_enabled": return setMasterDeviceEnabled(c);
    default: throw new Error("Unsupported command type: " + c.type);
    }
}

function api(path) { var object=new LiveAPI(null,path); if(!object||object.id===0) throw new Error("Live API path not found: "+path); return object; }
function integer(value,name){ if(Math.floor(Number(value))!==Number(value)||Number(value)<0) throw new Error(name+" must be a non-negative integer"); return Number(value); }
function scalar(value){ if(value instanceof Array) return value.length>1&&value[0]==="id"?value[1]:value[value.length-1]; return value; }
function numberProp(object,name){ return Number(scalar(object.get(name))); }
function nameOf(object){ return String(scalar(object.get("name"))); }
function safeGet(object,name,fallback){ try{return scalar(object.get(name));}catch(e){return fallback;} }
function normalizedValue(path){ var p=api(path),min=numberProp(p,"min"),max=numberProp(p,"max"),value=numberProp(p,"value"); return max===min?0:(value-min)/(max-min); }
function nativeValue(path){ return numberProp(api(path),"value"); }
function setNative(path,value){ api(path).set("value",Number(value)); }
function setNormalized(path,normalized){ var p=api(path),min=numberProp(p,"min"),max=numberProp(p,"max"),value=min+(max-min)*Number(normalized); p.set("value",value); return value; }

function findTrackByName(name){ var desired=String(name).trim().toLowerCase(),song=api("live_set"),count=song.getcount("tracks"); for(var i=0;i<count;i++) if(nameOf(api("live_set tracks "+i)).trim().toLowerCase()===desired) return i; return -1; }
function rememberTrack(ref,index,name){ if(ref!==undefined&&ref!==null) trackRefs[String(ref)]={index:Number(index),name:String(name)}; }
function track(c){
    if(c.track_name!==undefined){var named=findTrackByName(c.track_name);if(named>=0)return named;throw new Error("Track not found: "+c.track_name);}
    if(c.track_ref!==undefined){var ref=String(c.track_ref),saved=trackRefs[ref];if(saved===undefined)throw new Error("Unknown track_ref: "+ref);if(typeof saved==="number")return saved;var count=api("live_set").getcount("tracks");if(saved.index>=0&&saved.index<count&&nameOf(api("live_set tracks "+saved.index))===saved.name)return saved.index;var recovered=findTrackByName(saved.name);if(recovered>=0){saved.index=recovered;return recovered;}throw new Error("Track reference no longer resolves: "+ref);}
    return integer(c.track,"track");
}
function returnTrack(c){ if(c.return_name!==undefined){var desired=String(c.return_name).trim().toLowerCase(),count=api("live_set").getcount("return_tracks");for(var i=0;i<count;i++)if(nameOf(api("live_set return_tracks "+i)).trim().toLowerCase()===desired)return i;throw new Error("Return track not found: "+c.return_name);}return integer(c.return,"return"); }
function clipSlotPath(c){return "live_set tracks "+track(c)+" clip_slots "+integer(c.clip,"clip");}
function clipPath(c){return clipSlotPath(c)+" clip";}
function targetPath(c){ if(c.target_kind==="master")return "live_set master_track"; if(c.target_kind==="return")return "live_set return_tracks "+returnTrack(c); if(c.target_kind==="track")return "live_set tracks "+track(c); throw new Error("Unsupported target_kind: "+c.target_kind); }
function generatedSnapshotId(prefix){ snapshotCounter+=1; return prefix+"-"+(new Date().getTime())+"-"+snapshotCounter; }

function setMacro(c){var ti=track(c),dp="live_set tracks "+ti+" devices 0",count=api(dp).getcount("parameters"),target=null,desired="macro "+integer(c.macro,"macro");for(var i=0;i<count;i++){var p=api(dp+" parameters "+i);if(nameOf(p).toLowerCase()===desired){target=p;break;}}if(!target)throw new Error("Rack macro not found: "+desired);var min=numberProp(target,"min"),max=numberProp(target,"max");target.set("value",min+(max-min)*Number(c.value));return {track:ti,track_ref:c.track_ref||null,macro:c.macro,value:c.value};}
function createTrack(c,method){var existing=findTrackByName(c.name);if(existing>=0){rememberTrack(c.track_ref,existing,c.name);return {track:existing,track_ref:c.track_ref||null,name:String(c.name),existing:true};}var song=api("live_set"),before=song.getcount("tracks"),requested=c.track_ref!==undefined?-1:(c.index===undefined?-1:integer(c.index,"index")),created=requested<0?before:requested;song.call(method,requested);api("live_set tracks "+created).set("name",String(c.name));rememberTrack(c.track_ref,created,c.name);return {track:created,track_ref:c.track_ref||null,name:String(c.name),existing:false};}
function createScene(c){var song=api("live_set"),index=c.index===undefined?-1:integer(c.index,"index");song.call("create_scene",index);var created=index<0?song.getcount("scenes")-1:index;if(c.name!==undefined)api("live_set scenes "+created).set("name",String(c.name));return {scene:created,name:c.name||null};}
function createReturnTrack(c){var desired=String(c.name).trim().toLowerCase(),song=api("live_set"),before=song.getcount("return_tracks");for(var i=0;i<before;i++)if(nameOf(api("live_set return_tracks "+i)).trim().toLowerCase()===desired)return {return_track:i,name:String(c.name),existing:true};song.call("create_return_track");api("live_set return_tracks "+before).set("name",String(c.name));return {return_track:before,name:String(c.name),existing:false};}
function setClipLoop(c){var clip=api(clipPath(c));clip.set("loop_start",Number(c.start));clip.set("loop_end",Number(c.start)+Number(c.length));clip.set("looping",c.enabled?1:0);return {track:track(c),clip:c.clip,start:c.start,length:c.length,enabled:!!c.enabled};}

function findDevice(path,name){var count=api(path).getcount("devices");for(var i=0;i<count;i++)if(nameOf(api(path+" devices "+i))===String(name))return {index:i,path:path+" devices "+i};throw new Error("Device not found: "+name);}
function findParameter(devicePath,name){var count=api(devicePath).getcount("parameters");for(var i=0;i<count;i++){var p=api(devicePath+" parameters "+i);if(nameOf(p)===String(name))return {index:i,path:devicePath+" parameters "+i,api:p};}throw new Error("Parameter not found: "+name);}
function setParameterOnPath(path,device,parameter,value){var d=findDevice(path,device),p=findParameter(d.path,parameter),min=numberProp(p.api,"min"),max=numberProp(p.api,"max");p.api.set("value",min+(max-min)*Number(value));return {device_index:d.index,parameter_index:p.index};}
function setDeviceParameter(c){var ti=track(c),r=setParameterOnPath("live_set tracks "+ti,c.device,c.parameter,c.value);return {track:ti,device:c.device,parameter:c.parameter,value:c.value,device_index:r.device_index,parameter_index:r.parameter_index};}
function setReturnDeviceParameter(c){var ri=returnTrack(c),r=setParameterOnPath("live_set return_tracks "+ri,c.device,c.parameter,c.value);return {return_track:ri,device:c.device,parameter:c.parameter,value:c.value,device_index:r.device_index,parameter_index:r.parameter_index};}
function setMasterDeviceParameter(c){var r=setParameterOnPath("live_set master_track",c.device,c.parameter,c.value);return {device:c.device,parameter:c.parameter,value:c.value,device_index:r.device_index,parameter_index:r.parameter_index};}
function setMasterDeviceEnabled(c){var d=findDevice("live_set master_track",c.device),p=findParameter(d.path,"Device On");p.api.set("value",c.enabled?1:0);return {device:c.device,enabled:!!c.enabled,device_index:d.index};}

function createMidiClip(c){var ti=track(c),slotPath="live_set tracks "+ti+" clip_slots "+integer(c.clip,"clip"),slot=api(slotPath);if(!Number(scalar(slot.get("has_clip"))))slot.call("create_clip",Number(c.beats));var clip=api(slotPath+" clip"),offset=(Number(c.bar)-1)*4;clip.call("select_all_notes");clip.call("replace_selected_notes");clip.call("notes",c.notes.length);for(var i=0;i<c.notes.length;i++){var n=c.notes[i];clip.call("note",n.pitch,offset+Number(n.start),Number(n.duration),n.velocity,0);}clip.call("done");return {track:ti,track_ref:c.track_ref||null,clip:c.clip,notes:c.notes.length};}

function mixerState(path){var obj=api(path);return {volume:normalizedValue(path+" mixer_device volume"),pan:nativeValue(path+" mixer_device panning"),mute:!!Number(safeGet(obj,"mute",0)),solo:!!Number(safeGet(obj,"solo",0)),arm:!!Number(safeGet(obj,"arm",0)),name:nameOf(obj)};}
function sendsState(path){var mixer=api(path+" mixer_device"),count=mixer.getcount("sends"),out=[];for(var i=0;i<count;i++)out.push(normalizedValue(path+" mixer_device sends "+i));return out;}
function listTracks(){var count=api("live_set").getcount("tracks"),out=[];for(var i=0;i<count;i++){var s=mixerState("live_set tracks "+i);s.index=i;s.sends=sendsState("live_set tracks "+i);s.devices=api("live_set tracks "+i).getcount("devices");s.clip_slots=api("live_set tracks "+i).getcount("clip_slots");out.push(s);}return out;}
function listReturns(){var count=api("live_set").getcount("return_tracks"),out=[];for(var i=0;i<count;i++){var s=mixerState("live_set return_tracks "+i);s.index=i;s.devices=api("live_set return_tracks "+i).getcount("devices");out.push(s);}return out;}
function inspectTrack(index){var s=mixerState("live_set tracks "+index);s.index=index;s.sends=sendsState("live_set tracks "+index);s.device_chain=inspectChainAtPath("live_set tracks "+index);s.clip_slots=api("live_set tracks "+index).getcount("clip_slots");return s;}
function inspectMaster(){var s=mixerState("live_set master_track");s.device_chain=inspectChainAtPath("live_set master_track");return s;}
function getLiveState(){var song=api("live_set");return {tempo:Number(scalar(song.get("tempo"))),is_playing:!!Number(scalar(song.get("is_playing"))),metronome:!!Number(scalar(song.get("metronome"))),loop:!!Number(scalar(song.get("loop"))),loop_start:Number(scalar(song.get("loop_start"))),loop_length:Number(scalar(song.get("loop_length"))),signature_numerator:Number(scalar(song.get("signature_numerator"))),signature_denominator:Number(scalar(song.get("signature_denominator"))),track_count:song.getcount("tracks"),return_count:song.getcount("return_tracks"),scene_count:song.getcount("scenes"),master:inspectMaster()};}
function inspectChainAtPath(path){var count=api(path).getcount("devices"),out=[];for(var i=0;i<count;i++){var d=api(path+" devices "+i);out.push({index:i,name:nameOf(d),class_name:String(safeGet(d,"class_name","")),parameter_count:d.getcount("parameters")});}return out;}
function inspectDeviceChain(c){var path=targetPath(c);return {target_kind:c.target_kind,target_path:path,devices:inspectChainAtPath(path)};}
function inspectParametersAtPath(path,device){var d=findDevice(path,device),count=api(d.path).getcount("parameters"),out=[];for(var i=0;i<count;i++){var p=api(d.path+" parameters "+i),min=numberProp(p,"min"),max=numberProp(p,"max"),value=numberProp(p,"value");out.push({index:i,name:nameOf(p),min:min,max:max,value:value,normalized:max===min?0:(value-min)/(max-min),is_quantized:!!Number(safeGet(p,"is_quantized",0))});}return {device_index:d.index,device:device,parameters:out};}
function inspectDeviceParameters(c){var path=targetPath(c),result=inspectParametersAtPath(path,c.device);result.target_kind=c.target_kind;result.target_path=path;return result;}
function inspectClip(c){var slot=api(clipSlotPath(c)),has=!!Number(scalar(slot.get("has_clip"))),result={track:track(c),clip:c.clip,has_clip:has};if(has){var clip=api(clipPath(c));result.name=nameOf(clip);result.color=Number(safeGet(clip,"color",0));result.looping=!!Number(safeGet(clip,"looping",0));result.loop_start=Number(safeGet(clip,"loop_start",0));result.loop_end=Number(safeGet(clip,"loop_end",0));result.length=Number(safeGet(clip,"length",0));}return result;}

function captureMixerSnapshot(c){var id=c.snapshot_id||generatedSnapshotId("mixer"),snapshot={kind:"mixer",tracks:listTracks(),returns:listReturns(),master:inspectMaster()};snapshots[id]=snapshot;return {snapshot_id:id,track_count:snapshot.tracks.length,return_count:snapshot.returns.length};}
function restoreMixerSnapshot(c){var s=snapshots[String(c.snapshot_id)];if(!s||s.kind!=="mixer")throw new Error("Mixer snapshot not found: "+c.snapshot_id);var trackCount=api("live_set").getcount("tracks"),returnCount=api("live_set").getcount("return_tracks");if(trackCount!==s.tracks.length||returnCount!==s.returns.length)throw new Error("Mixer topology changed since snapshot");for(var i=0;i<s.tracks.length;i++){var p="live_set tracks "+i,t=s.tracks[i];setNormalized(p+" mixer_device volume",t.volume);setNative(p+" mixer_device panning",t.pan);api(p).set("mute",t.mute?1:0);api(p).set("solo",t.solo?1:0);try{api(p).set("arm",t.arm?1:0);}catch(e){}for(var j=0;j<t.sends.length;j++)setNormalized(p+" mixer_device sends "+j,t.sends[j]);}for(var r=0;r<s.returns.length;r++){var rp="live_set return_tracks "+r,rt=s.returns[r];setNormalized(rp+" mixer_device volume",rt.volume);setNative(rp+" mixer_device panning",rt.pan);api(rp).set("mute",rt.mute?1:0);api(rp).set("solo",rt.solo?1:0);}setNormalized("live_set master_track mixer_device volume",s.master.volume);return {snapshot_id:c.snapshot_id,restored:true};}
function captureDeviceSnapshot(c){var id=c.snapshot_id||generatedSnapshotId("device"),path=targetPath(c),state=inspectParametersAtPath(path,c.device);snapshots[id]={kind:"device",target_kind:c.target_kind,target_path:path,device:c.device,parameters:state.parameters};return {snapshot_id:id,device:c.device,parameter_count:state.parameters.length};}
function restoreDeviceSnapshot(c){var s=snapshots[String(c.snapshot_id)];if(!s||s.kind!=="device")throw new Error("Device snapshot not found: "+c.snapshot_id);var d=findDevice(s.target_path,s.device),count=api(d.path).getcount("parameters");if(count!==s.parameters.length)throw new Error("Device parameter topology changed since snapshot");for(var i=0;i<s.parameters.length;i++)api(d.path+" parameters "+i).set("value",Number(s.parameters[i].value));return {snapshot_id:c.snapshot_id,device:s.device,restored_parameters:s.parameters.length};}

function acknowledge(id,ok,result,error){var payload={bridge_id:id,ok:!!ok};if(result!==null)payload.result=result;if(error!==null)payload.error=error;outlet(0,"/bridge_ack",JSON.stringify(payload));}
