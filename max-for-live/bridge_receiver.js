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
    case "set_track_volume": return setMixerNormalized("track",track(c),"volume",c.volume);
    case "set_track_pan": return setMixerNative("track",track(c),"panning",c.pan);
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
    case "set_return_volume": return setMixerNormalized("return",returnTrack(c),"volume",c.volume);
    case "set_return_pan": return setMixerNative("return",returnTrack(c),"panning",c.pan);
    case "set_track_send": return setTrackSend(c);
    case "set_return_device_parameter": return setReturnDeviceParameter(c);
    case "get_live_state": return getLiveState();
    case "list_tracks": return {tracks:listTracks()};
    case "inspect_track": return inspectTrack(track(c));
    case "list_returns": return {returns:listReturns()};
    case "inspect_device_chain": return inspectDeviceChain(c);
    case "inspect_device_parameters": return inspectDeviceParameters(c);
    case "inspect_device_parameters_page": return inspectDeviceParametersPage(c);
    case "inspect_clip": return inspectClip(c);
    case "inspect_master": return inspectMaster();
    case "capture_mixer_snapshot": return captureMixerSnapshot(c);
    case "restore_mixer_snapshot": return restoreMixerSnapshot(c);
    case "capture_device_snapshot": return captureDeviceSnapshot(c);
    case "restore_device_snapshot": return restoreDeviceSnapshot(c);
    case "set_master_volume": return setMasterVolume(c.volume);
    case "set_master_device_parameter": return setMasterDeviceParameter(c);
    case "set_master_device_enabled": return setMasterDeviceEnabled(c);
    default: throw new Error("Unsupported command type: " + c.type);
    }
}

function api(path) { var object=new LiveAPI(null,path); if(!object||object.id===0) throw new Error("Live API path not found: "+path); return object; }
function integer(value,name){ if(Math.floor(Number(value))!==Number(value)||Number(value)<0) throw new Error(name+" must be a non-negative integer"); return Number(value); }
function scalar(value){ if(value instanceof Array) return value.length>1&&value[0]==="id"?value[1]:value[value.length-1]; return value; }
function finiteNumber(value,name){ var n=Number(value); if(!isFinite(n)) throw new Error((name||"value")+" must be finite"); return n; }
function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }
function clamp01(value){ return clamp(finiteNumber(value,"normalized value"),0,1); }
function numberProp(object,name){ return finiteNumber(scalar(object.get(name)),name); }
function nameOf(object){ return String(scalar(object.get("name"))); }
function safeGet(object,name,fallback){ try{return scalar(object.get(name));}catch(e){return fallback;} }
function rawSafeGet(object,name,fallback){ try{return object.get(name);}catch(e){return fallback;} }
function valueItemsOf(object){ var raw=rawSafeGet(object,"value_items",[]); if(!(raw instanceof Array)) return []; var out=[]; for(var i=0;i<raw.length;i++){var item=raw[i];if(item!==undefined&&item!==null&&String(item)!=="value_items")out.push(String(item));} return out; }
function parameterMeta(object,index){
    var min=numberProp(object,"min"),max=numberProp(object,"max"),value=numberProp(object,"value"),quantized=!!Number(safeGet(object,"is_quantized",0));
    if(max<min) throw new Error("Invalid parameter range for "+nameOf(object)+": max < min");
    var normalized=max===min?0:clamp01((value-min)/(max-min));
    return {index:index,name:nameOf(object),min:min,max:max,value:value,normalized:normalized,is_quantized:quantized,is_enabled:!!Number(safeGet(object,"is_enabled",1)),value_items:valueItemsOf(object)};
}
function nativeFromNormalized(meta,normalized){
    var n=clamp01(normalized); if(meta.max===meta.min)return meta.min;
    var native=meta.min+(meta.max-meta.min)*n;
    if(meta.is_quantized){
        var steps=meta.value_items&&meta.value_items.length>1?meta.value_items.length-1:Math.max(1,Math.round(meta.max-meta.min));
        var step=(meta.max-meta.min)/steps;
        native=meta.min+Math.round((native-meta.min)/step)*step;
    }
    return clamp(native,meta.min,meta.max);
}
function normalizedValue(path){ return parameterMeta(api(path),null).normalized; }
function nativeValue(path){ return parameterMeta(api(path),null).value; }
function setNative(path,value){ var p=api(path),meta=parameterMeta(p,null),requested=finiteNumber(value,"native value"),native=clamp(requested,meta.min,meta.max); if(meta.is_quantized)native=nativeFromNormalized(meta,meta.max===meta.min?0:(native-meta.min)/(meta.max-meta.min)); p.set("value",native); var readback=parameterMeta(p,null); return {requested_native:requested,applied_native:native,readback_native:readback.value,readback_normalized:readback.normalized,is_quantized:meta.is_quantized}; }
function setNormalized(path,normalized){ var p=api(path),meta=parameterMeta(p,null); if(!meta.is_enabled)throw new Error("Parameter is disabled: "+meta.name); var requested=clamp01(normalized),native=nativeFromNormalized(meta,requested); p.set("value",native); var readback=parameterMeta(p,null); return {requested_normalized:requested,applied_native:native,readback_native:readback.value,readback_normalized:readback.normalized,is_quantized:meta.is_quantized,min:meta.min,max:meta.max}; }

function findTrackByName(name){ var desired=String(name).trim().toLowerCase(),song=api("live_set"),count=song.getcount("tracks"); for(var i=0;i<count;i++) if(nameOf(api("live_set tracks "+i)).trim().toLowerCase()===desired) return i; return -1; }
function rememberTrack(ref,index,name){ if(ref!==undefined&&ref!==null) trackRefs[String(ref)]={index:Number(index),name:String(name)}; }
function track(c){
    if(c.track_name!==undefined){var named=findTrackByName(c.track_name);if(named>=0)return named;throw new Error("Track not found: "+c.track_name);}
    if(c.track_ref!==undefined){var ref=String(c.track_ref),saved=trackRefs[ref];if(saved===undefined)throw new Error("Unknown track_ref: "+ref);if(typeof saved==="number")return saved;var count=api("live_set").getcount("tracks");if(saved.index>=0&&saved.index<count&&nameOf(api("live_set tracks "+saved.index))===saved.name)return saved.index;var recovered=findTrackByName(saved.name);if(recovered>=0){saved.index=recovered;return saved.index;}throw new Error("Track reference no longer resolves: "+ref);}
    return integer(c.track,"track");
}
function returnTrack(c){ if(c.return_name!==undefined){var desired=String(c.return_name).trim().toLowerCase(),count=api("live_set").getcount("return_tracks");for(var i=0;i<count;i++)if(nameOf(api("live_set return_tracks "+i)).trim().toLowerCase()===desired)return i;throw new Error("Return track not found: "+c.return_name);}return integer(c.return,"return"); }
function clipSlotPath(c){return "live_set tracks "+track(c)+" clip_slots "+integer(c.clip,"clip");}
function clipPath(c){return clipSlotPath(c)+" clip";}
function targetPath(c){ if(c.target_kind==="master")return "live_set master_track"; if(c.target_kind==="return")return "live_set return_tracks "+returnTrack(c); if(c.target_kind==="track")return "live_set tracks "+track(c); throw new Error("Unsupported target_kind: "+c.target_kind); }
function generatedSnapshotId(prefix){ snapshotCounter+=1; return prefix+"-"+(new Date().getTime())+"-"+snapshotCounter; }
function mixerBasePath(kind,index){if(kind==="track")return "live_set tracks "+index;if(kind==="return")return "live_set return_tracks "+index;throw new Error("Unsupported mixer kind: "+kind);}
function setMixerNormalized(kind,index,parameter,value){var base=mixerBasePath(kind,index),r=setNormalized(base+" mixer_device "+parameter,value);var out={parameter:parameter};out[kind==="track"?"track":"return_track"]=index;out.readback=r;return out;}
function setMixerNative(kind,index,parameter,value){var base=mixerBasePath(kind,index),r=setNative(base+" mixer_device "+parameter,value);var out={parameter:parameter};out[kind==="track"?"track":"return_track"]=index;out.readback=r;return out;}
function setTrackSend(c){var ti=track(c),ri=returnTrack(c),r=setNormalized("live_set tracks "+ti+" mixer_device sends "+ri,c.amount);return {track:ti,return_track:ri,amount:c.amount,readback:r};}
function setMasterVolume(value){return {volume:value,readback:setNormalized("live_set master_track mixer_device volume",value)};}

function setMacro(c){var ti=track(c),dp="live_set tracks "+ti+" devices 0",count=api(dp).getcount("parameters"),targetIndex=-1,desired="macro "+integer(c.macro,"macro");for(var i=0;i<count;i++){var p=api(dp+" parameters "+i);if(nameOf(p).toLowerCase()===desired){targetIndex=i;break;}}if(targetIndex<0)throw new Error("Rack macro not found: "+desired);var readback=setNormalized(dp+" parameters "+targetIndex,c.value);return {track:ti,track_ref:c.track_ref||null,macro:c.macro,value:c.value,parameter_index:targetIndex,readback:readback};}
function createTrack(c,method){var existing=findTrackByName(c.name);if(existing>=0){rememberTrack(c.track_ref,existing,c.name);return {track:existing,track_ref:c.track_ref||null,name:String(c.name),existing:true};}var song=api("live_set"),before=song.getcount("tracks"),requested=c.track_ref!==undefined?-1:(c.index===undefined?-1:integer(c.index,"index")),created=requested<0?before:requested;song.call(method,requested);api("live_set tracks "+created).set("name",String(c.name));rememberTrack(c.track_ref,created,c.name);return {track:created,track_ref:c.track_ref||null,name:String(c.name),existing:false};}
function createScene(c){var song=api("live_set"),index=c.index===undefined?-1:integer(c.index,"index");song.call("create_scene",index);var created=index<0?song.getcount("scenes")-1:index;if(c.name!==undefined)api("live_set scenes "+created).set("name",String(c.name));return {scene:created,name:c.name||null};}
function createReturnTrack(c){var desired=String(c.name).trim().toLowerCase(),song=api("live_set"),before=song.getcount("return_tracks");for(var i=0;i<before;i++)if(nameOf(api("live_set return_tracks "+i)).trim().toLowerCase()===desired)return {return_track:i,name:String(c.name),existing:true};song.call("create_return_track");api("live_set return_tracks "+before).set("name",String(c.name));return {return_track:before,name:String(c.name),existing:false};}
function setClipLoop(c){var clip=api(clipPath(c));clip.set("loop_start",Number(c.start));clip.set("loop_end",Number(c.start)+Number(c.length));clip.set("looping",c.enabled?1:0);return {track:track(c),clip:c.clip,start:c.start,length:c.length,enabled:!!c.enabled};}

function findDevice(path,name){var count=api(path).getcount("devices"),matches=[];for(var i=0;i<count;i++)if(nameOf(api(path+" devices "+i))===String(name))matches.push(i);if(matches.length===0)throw new Error("Device not found: "+name);if(matches.length>1)throw new Error("Ambiguous duplicate device name: "+name+"; use unique Live device names");var index=matches[0];return {index:index,path:path+" devices "+index};}
function deviceAtIndex(path,index){var i=integer(index,"device_index"),count=api(path).getcount("devices");if(i>=count)throw new Error("Device index out of range: "+i+" >= "+count);var devicePath=path+" devices "+i,d=api(devicePath);return {index:i,path:devicePath,name:nameOf(d),api:d};}
function findParameter(devicePath,name){var count=api(devicePath).getcount("parameters"),matches=[];for(var i=0;i<count;i++){var p=api(devicePath+" parameters "+i);if(nameOf(p)===String(name))matches.push(i);}if(matches.length===0)throw new Error("Parameter not found: "+name);if(matches.length>1)throw new Error("Ambiguous duplicate parameter name: "+name);var index=matches[0],target=api(devicePath+" parameters "+index);return {index:index,path:devicePath+" parameters "+index,api:target};}
function parameterAtIndex(devicePath,index){var i=integer(index,"parameter_index"),count=api(devicePath).getcount("parameters");if(i>=count)throw new Error("Parameter index out of range: "+i+" >= "+count);var parameterPath=devicePath+" parameters "+i,p=api(parameterPath);return {index:i,path:parameterPath,api:p,name:nameOf(p)};}
function setParameterOnPath(path,device,parameter,value){var d=findDevice(path,device),p=findParameter(d.path,parameter),meta=parameterMeta(p.api,p.index);if(!meta.is_enabled)throw new Error("Parameter is disabled: "+parameter);var readback=setNormalized(p.path,value);return {device_index:d.index,device:nameOf(api(d.path)),parameter_index:p.index,parameter:meta,readback:readback};}
function setParameterIndexedOnPath(path,deviceIndex,parameterIndex,value){var d=deviceAtIndex(path,deviceIndex),p=parameterAtIndex(d.path,parameterIndex),meta=parameterMeta(p.api,p.index);if(!meta.is_enabled)throw new Error("Parameter is disabled at index "+p.index+": "+meta.name);var readback=setNormalized(p.path,value);return {device_index:d.index,device:d.name,parameter_index:p.index,parameter:meta,readback:readback};}
function setParameterTargetOnPath(path,c){if(c.device_index!==undefined||c.parameter_index!==undefined)return setParameterIndexedOnPath(path,c.device_index,c.parameter_index,c.value);return setParameterOnPath(path,c.device,c.parameter,c.value);}
function setDeviceParameter(c){var ti=track(c),r=setParameterTargetOnPath("live_set tracks "+ti,c);return {track:ti,device:r.device,parameter:r.parameter.name,value:c.value,device_index:r.device_index,parameter_index:r.parameter_index,readback:r.readback};}
function setReturnDeviceParameter(c){var ri=returnTrack(c),r=setParameterTargetOnPath("live_set return_tracks "+ri,c);return {return_track:ri,device:r.device,parameter:r.parameter.name,value:c.value,device_index:r.device_index,parameter_index:r.parameter_index,readback:r.readback};}
function setMasterDeviceParameter(c){var r=setParameterTargetOnPath("live_set master_track",c);return {device:r.device,parameter:r.parameter.name,value:c.value,device_index:r.device_index,parameter_index:r.parameter_index,readback:r.readback};}
function setMasterDeviceEnabled(c){var d=findDevice("live_set master_track",c.device),p=findParameter(d.path,"Device On"),readback=setNative(p.path,c.enabled?1:0);return {device:c.device,enabled:!!c.enabled,device_index:d.index,parameter_index:p.index,readback:readback};}

function createMidiClip(c){var ti=track(c),slotPath="live_set tracks "+ti+" clip_slots "+integer(c.clip,"clip"),slot=api(slotPath);if(!Number(scalar(slot.get("has_clip"))))slot.call("create_clip",Number(c.beats));var clip=api(slotPath+" clip"),offset=(Number(c.bar)-1)*4;clip.call("select_all_notes");clip.call("replace_selected_notes");clip.call("notes",c.notes.length);for(var i=0;i<c.notes.length;i++){var n=c.notes[i];clip.call("note",n.pitch,offset+Number(n.start),Number(n.duration),n.velocity,0);}clip.call("done");return {track:ti,track_ref:c.track_ref||null,clip:c.clip,notes:c.notes.length};}

function mixerState(path){var obj=api(path);return {volume:normalizedValue(path+" mixer_device volume"),pan:nativeValue(path+" mixer_device panning"),mute:!!Number(safeGet(obj,"mute",0)),solo:!!Number(safeGet(obj,"solo",0)),arm:!!Number(safeGet(obj,"arm",0)),name:nameOf(obj)};}
function sendsState(path){var mixer=api(path+" mixer_device"),count=mixer.getcount("sends"),out=[];for(var i=0;i<count;i++)out.push(normalizedValue(path+" mixer_device sends "+i));return out;}
function listTracks(){var count=api("live_set").getcount("tracks"),out=[];for(var i=0;i<count;i++){var s=mixerState("live_set tracks "+i);s.index=i;s.sends=sendsState("live_set tracks "+i);s.devices=api("live_set tracks "+i).getcount("devices");s.clip_slots=api("live_set tracks "+i).getcount("clip_slots");out.push(s);}return out;}
function listReturns(){var count=api("live_set").getcount("return_tracks"),out=[];for(var i=0;i<count;i++){var s=mixerState("live_set return_tracks "+i);s.index=i;s.devices=api("live_set return_tracks "+i).getcount("devices");out.push(s);}return out;}
function inspectTrack(index){var s=mixerState("live_set tracks "+index);s.index=index;s.sends=sendsState("live_set tracks "+index);s.device_chain=inspectChainAtPath("live_set tracks "+index);s.clip_slots=api("live_set tracks "+index).getcount("clip_slots");return s;}
function inspectMaster(){var s=mixerState("live_set master_track");s.device_chain=inspectChainAtPath("live_set master_track");return s;}
function getLiveState(){var song=api("live_set");return {tempo:Number(scalar(song.get("tempo"))),is_playing:!!Number(scalar(song.get("is_playing"))),metronome:!!Number(scalar(song.get("metronome"))),loop:!!Number(scalar(song.get("loop"))),loop_start:Number(scalar(song.get("loop_start"))),loop_length:Number(scalar(song.get("loop_length"))),signature_numerator:Number(scalar(song.get("signature_numerator"))),signature_denominator:Number(scalar(song.get("signature_denominator"))),track_count:song.getcount("tracks"),return_count:song.getcount("return_tracks"),scene_count:song.getcount("scenes"),master:inspectMaster()};}
function inspectChainAtPath(path){var count=api(path).getcount("devices"),out=[],names={};for(var i=0;i<count;i++){var d=api(path+" devices "+i),name=nameOf(d);names[name]=(names[name]||0)+1;out.push({index:i,name:name,class_name:String(safeGet(d,"class_name","")),parameter_count:d.getcount("parameters")});}for(var j=0;j<out.length;j++)out[j].duplicate_name=names[out[j].name]>1;return out;}
function inspectDeviceChain(c){var path=targetPath(c);return {target_kind:c.target_kind,target_path:path,devices:inspectChainAtPath(path)};}
function inspectParametersAtPath(path,device){var d=findDevice(path,device),count=api(d.path).getcount("parameters"),out=[],names={};for(var i=0;i<count;i++){var meta=parameterMeta(api(d.path+" parameters "+i),i);names[meta.name]=(names[meta.name]||0)+1;out.push(meta);}for(var j=0;j<out.length;j++)out[j].duplicate_name=names[out[j].name]>1;return {device_index:d.index,device:device,parameters:out};}
function inspectDeviceParameters(c){var path=targetPath(c),result=inspectParametersAtPath(path,c.device);result.target_kind=c.target_kind;result.target_path=path;return result;}
function inspectDeviceParametersPage(c){
    var path=targetPath(c),d=deviceAtIndex(path,c.device_index),total=d.api.getcount("parameters"),start=integer(c.start,"start"),limit=integer(c.limit,"limit");
    if(limit<1||limit>24)throw new Error("limit must be between 1 and 24");
    if(start>total)throw new Error("start out of range: "+start+" > "+total);
    var end=Math.min(total,start+limit),out=[],names={};
    for(var n=0;n<total;n++){var pn=nameOf(api(d.path+" parameters "+n));names[pn]=(names[pn]||0)+1;}
    for(var i=start;i<end;i++){var meta=parameterMeta(api(d.path+" parameters "+i),i);meta.duplicate_name=names[meta.name]>1;out.push(meta);}
    return {target_kind:c.target_kind,target_path:path,device_index:d.index,device:d.name,parameter_count:total,start:start,limit:limit,next_start:end<total?end:null,parameters:out};
}
function inspectClip(c){var slot=api(clipSlotPath(c)),has=!!Number(scalar(slot.get("has_clip"))),result={track:track(c),clip:c.clip,has_clip:has};if(has){var clip=api(clipPath(c));result.name=nameOf(clip);result.color=Number(safeGet(clip,"color",0));result.looping=!!Number(safeGet(clip,"looping",0));result.loop_start=Number(safeGet(clip,"loop_start",0));result.loop_end=Number(safeGet(clip,"loop_end",0));result.length=Number(safeGet(clip,"length",0));}return result;}

function captureMixerSnapshot(c){var id=c.snapshot_id||generatedSnapshotId("mixer"),snapshot={kind:"mixer",tracks:listTracks(),returns:listReturns(),master:inspectMaster()};snapshots[id]=snapshot;return {snapshot_id:id,track_count:snapshot.tracks.length,return_count:snapshot.returns.length};}
function restoreMixerSnapshot(c){var s=snapshots[String(c.snapshot_id)];if(!s||s.kind!=="mixer")throw new Error("Mixer snapshot not found: "+c.snapshot_id);var trackCount=api("live_set").getcount("tracks"),returnCount=api("live_set").getcount("return_tracks");if(trackCount!==s.tracks.length||returnCount!==s.returns.length)throw new Error("Mixer topology changed since snapshot");for(var i=0;i<s.tracks.length;i++){var p="live_set tracks "+i,t=s.tracks[i];setNormalized(p+" mixer_device volume",t.volume);setNative(p+" mixer_device panning",t.pan);api(p).set("mute",t.mute?1:0);api(p).set("solo",t.solo?1:0);try{api(p).set("arm",t.arm?1:0);}catch(e){}for(var j=0;j<t.sends.length;j++)setNormalized(p+" mixer_device sends "+j,t.sends[j]);}for(var r=0;r<s.returns.length;r++){var rp="live_set return_tracks "+r,rt=s.returns[r];setNormalized(rp+" mixer_device volume",rt.volume);setNative(rp+" mixer_device panning",rt.pan);api(rp).set("mute",rt.mute?1:0);api(rp).set("solo",rt.solo?1:0);}setNormalized("live_set master_track mixer_device volume",s.master.volume);return {snapshot_id:c.snapshot_id,restored:true};}
function captureDeviceSnapshot(c){var id=c.snapshot_id||generatedSnapshotId("device"),path=targetPath(c),state=inspectParametersAtPath(path,c.device);snapshots[id]={kind:"device",target_kind:c.target_kind,target_path:path,device:c.device,device_index:state.device_index,parameters:state.parameters};return {snapshot_id:id,device:c.device,device_index:state.device_index,parameter_count:state.parameters.length};}
function restoreDeviceSnapshot(c){var s=snapshots[String(c.snapshot_id)];if(!s||s.kind!=="device")throw new Error("Device snapshot not found: "+c.snapshot_id);var d=findDevice(s.target_path,s.device),count=api(d.path).getcount("parameters");if(d.index!==s.device_index||count!==s.parameters.length)throw new Error("Device topology changed since snapshot");for(var i=0;i<s.parameters.length;i++){var p=api(d.path+" parameters "+i),currentName=nameOf(p),saved=s.parameters[i];if(currentName!==saved.name)throw new Error("Device parameter topology changed at index "+i+": expected "+saved.name+", found "+currentName);setNative(d.path+" parameters "+i,saved.value);}return {snapshot_id:c.snapshot_id,device:s.device,restored_parameters:s.parameters.length};}

function acknowledge(id,ok,result,error){var payload={bridge_id:id,ok:!!ok};if(result!==null)payload.result=result;if(error!==null)payload.error=error;outlet(0,"/bridge_ack",JSON.stringify(payload));}