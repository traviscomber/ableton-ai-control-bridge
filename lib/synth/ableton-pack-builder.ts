/**
 * ableton-pack-builder.ts
 *
 * Assembles a complete Ableton Live Pack (.zip) from the full pipeline output.
 *
 * Pack structure:
 *   DARKSCO_{Variant}_{bpm}bpm/
 *   ├── DARKSCO_{Variant}_{bpm}bpm.als         ← Gzip-compressed XML Live Set
 *   ├── Samples/
 *   │   └── Originals/
 *   │       ├── kick.wav  (+ snare, hihat, bass, pad, stab, arp, noise)
 *   │       └── master_mix.wav
 *   ├── MIDI Clips/
 *   │   ├── kick.mid  (+ snare, hihat, bass, pad, stab, arp)
 *   │   └── ... (one per stem that has a MIDI file)
 *   └── Max for Live Devices/
 *       └── DARKSCO_Sampler.amxd
 *
 * ALS file:
 *   The .als is Gzip-compressed UTF-8 XML (Ableton Live 11/12 schema).
 *   Tracks: AudioTrack per drum stem, MidiTrack+Simpler per melodic stem,
 *   AudioTrack for master mix. BPM + time signature set globally.
 *   All sample references use relative paths.
 *
 * Agent skills used:
 *   ReasoningArchitect  → arrangement sections inform track groupings
 *   MidiComposer        → channel + noteMin/noteMax passed to M4L device
 *   AudioEngineer       → headroom + EQ info embedded in ALS track notes
 */

import { createGzip } from "zlib";
import { promisify } from "util";
import { buildZip, type ZipEntry } from "./zip-builder";
import { buildAmxdDevice } from "./max-for-live-device";
import type { FullPipelineResponse, SamplepPackStem, MidiFile } from "@/app/api/music/generate-stems/route";

const gzip = promisify(createGzip);

async function gzipBuffer(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { createGzip } = require("zlib") as typeof import("zlib");
    const chunks: Buffer[] = [];
    const gz = createGzip({ level: 6 });
    gz.on("data", (c: Buffer) => chunks.push(c));
    gz.on("end", () => resolve(Buffer.concat(chunks)));
    gz.on("error", reject);
    gz.end(input);
  });
}

// ─── Track colour map (Ableton Live colour IDs 0–70) ─────────────────────────

const TRACK_COLORS: Record<string, number> = {
  kick:   18,  // deep orange
  snare:  15,  // warm red
  hihat:  57,  // steel blue
  bass:   26,  // purple
  pad:    49,  // teal
  stab:   33,  // green
  arp:    40,  // light blue
  noise:   5,  // dark grey
  mix:    64,  // white
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

let trackIdCounter = 0;
const nextId = () => trackIdCounter++;

function xmlAttr(val: string | number) {
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Duration in beats from bars (4/4)
function barsToBeatTime(bars: number) {
  return bars * 4;
}

// ─── ALS XML builders ─────────────────────────────────────────────────────────

function buildFileRef(relativePath: string): string {
  return `
        <FileRef>
          <HasRelativePath Value="true" />
          <RelativePathType Value="3" />
          <RelativePath Value="${xmlAttr(relativePath)}" />
          <Name Value="${xmlAttr(relativePath.split("/").pop() ?? relativePath)}" />
          <Type Value="1" />
          <LivePackName Value="" />
          <LivePackId Value="" />
          <OriginalFileSize Value="0" />
          <OriginalCrc Value="0" />
        </FileRef>`;
}

function buildAudioClip(id: number, stem: SamplepPackStem, endBeat: number): string {
  return `
            <AudioClip Id="${id}" Time="0">
              <LomId Value="0" />
              <LomIdView Value="0" />
              <CurrentStart Value="0" />
              <CurrentEnd Value="${endBeat}" />
              <Loop>
                <LoopStart Value="0" />
                <LoopEnd Value="${endBeat}" />
                <StartRelative Value="0" />
                <LoopOn Value="true" />
                <OutMarker Value="${endBeat}" />
                <HiddenLoopStart Value="0" />
                <HiddenLoopEnd Value="${endBeat}" />
              </Loop>
              <Name Value="${xmlAttr(stem.stem_type)}" />
              <Annotation Value="" />
              <Color Value="-1" />
              <LaunchMode Value="0" />
              <LaunchQuantisation Value="0" />
              <SampleRef>${buildFileRef(`Samples/Originals/${stem.stem_type}.wav`)}
              </SampleRef>
              <Gain Value="1" />
              <VolumeAutomation />
              <SampleVolume Value="1" />
              <PitchCoarse Value="0" />
              <PitchFine Value="0" />
              <SampleStart Value="0" />
              <SampleEnd Value="${stem.durationSec * stem.sampleRate}" />
              <SlicePoints />
              <ManageWarps Value="true" />
              <WarpOn Value="true" />
              <AutoWarpTolerance Value="4" />
              <WarpMarkers />
              <WarpMode Value="0" />
              <GranularResolution Value="9" />
              <TransientResolution Value="6" />
              <TransientLoopMode Value="2" />
              <TransientEnvelopeTime Value="100" />
              <ComplexProFormants Value="1" />
              <ComplexProEnvelope Value="128" />
              <FlipSamplePlayback Value="false" />
              <EnableQuant Value="false" />
              <QuantizationAccuracy Value="0" />
              <ReverseSamplePlayback Value="false" />
            </AudioClip>`;
}

function buildMidiNote(pitch: number, time: number, duration: number, velocity: number, noteId: number): string {
  return `
                <KeyTrack Id="${noteId}">
                  <MidiKey Value="${pitch}" />
                  <Notes>
                    <MidiNoteEvent Time="${time}" Duration="${duration}" Velocity="${velocity}" OffVelocity="64" Probability="1" IsEnabled="true" NoteId="${noteId}" />
                  </Notes>
                  <DeviceChain />
                </KeyTrack>`;
}

function buildMidiClip(id: number, stemName: string, endBeat: number, rootPitch: number): string {
  // Simple single-note pattern for the clip (the real MIDI file is in MIDI Clips/)
  const noteEntries = Array.from({ length: Math.floor(endBeat) }, (_, i) =>
    buildMidiNote(rootPitch, i, 1, 90, i + 1)
  ).join("");

  return `
            <MidiClip Id="${id}" Time="0">
              <LomId Value="0" />
              <LomIdView Value="0" />
              <CurrentStart Value="0" />
              <CurrentEnd Value="${endBeat}" />
              <Loop>
                <LoopStart Value="0" />
                <LoopEnd Value="${endBeat}" />
                <StartRelative Value="0" />
                <LoopOn Value="true" />
                <OutMarker Value="${endBeat}" />
                <HiddenLoopStart Value="0" />
                <HiddenLoopEnd Value="${endBeat}" />
              </Loop>
              <Name Value="${xmlAttr(stemName)}" />
              <Annotation Value="" />
              <Color Value="-1" />
              <LaunchMode Value="0" />
              <LaunchQuantisation Value="0" />
              <Notes>
                <KeyTracks>${noteEntries}
                </KeyTracks>
                <PerNoteEventStore>
                  <EventLists />
                </PerNoteEventStore>
              </Notes>
              <NoteEditorFoldInZoom Value="-1" />
              <NoteEditorFoldInScroll Value="0" />
              <NoteEditorFoldOutZoom Value="512" />
              <NoteEditorFoldOutScroll Value="-1" />
              <NoteEditorFoldScaleZoom Value="-1" />
              <NoteEditorFoldScaleScroll Value="0" />
              <ScaleInformation>
                <RootNote Value="0" />
                <Name Value="" />
              </ScaleInformation>
              <IsInKey Value="false" />
            </MidiClip>`;
}

function buildAudioTrack(stem: SamplepPackStem, endBeat: number, isMix = false): string {
  const trackId = nextId();
  const clipId = nextId();
  const color = TRACK_COLORS[stem.stem_type] ?? TRACK_COLORS.mix;
  const label = isMix ? "Master Mix" : stem.stem_type.charAt(0).toUpperCase() + stem.stem_type.slice(1);

  return `
    <AudioTrack Id="${trackId}">
      <LomId Value="0" />
      <LomIdView Value="0" />
      <IsContentSelectedInDocument Value="false" />
      <PreferredContentViewMode Value="0" />
      <TrackDelay>
        <Value Value="0" />
        <IsValueSampleBased Value="false" />
      </TrackDelay>
      <Name>
        <EffectiveName Value="${xmlAttr(label)}" />
        <UserName Value="" />
        <Annotation Value="" />
        <MemorizedFirstClipName Value="" />
      </Name>
      <Color Value="${color}" />
      <AutomationEnvelopes>
        <Envelopes />
      </AutomationEnvelopes>
      <TrackGroupId Value="-1" />
      <TrackUnfolded Value="false" />
      <DevicesListWrapper LomId="0" />
      <ClipSlotsListWrapper LomId="0" />
      <ViewData Value="{}" />
      <TakeLanes>
        <TakeLane Id="0">
          <LomId Value="0" />
          <Name Value="${xmlAttr(label)}" />
          <Annotation Value="" />
          <IsContentSelectedInDocument Value="false" />
          <ClipSlotList>
            <ClipSlot Id="0">
              <Value>
                ${buildAudioClip(clipId, stem, endBeat)}
              </Value>
              <HasStopButton Value="true" />
              <NeedRefreeze Value="false" />
            </ClipSlot>
          </ClipSlotList>
        </TakeLane>
      </TakeLanes>
      <DeviceChain>
        <AutomationLanes>
          <AutomationLanes />
        </AutomationLanes>
        <ClipEnvelopeChooserViewState>
          <SelectedDevice Value="0" />
          <SelectedEnvelope Value="0" />
          <PreferModulationVisible Value="false" />
        </ClipEnvelopeChooserViewState>
        <AudioInputRouting>
          <Target Value="AudioIn/None" />
          <UpperDisplayString Value="No Input" />
          <LowerDisplayString Value="" />
        </AudioInputRouting>
        <AudioOutputRouting>
          <Target Value="AudioOut/Master" />
          <UpperDisplayString Value="Master" />
          <LowerDisplayString Value="" />
        </AudioOutputRouting>
        <MixerDevice Id="${nextId()}">
          <LomId Value="0" />
          <LomIdView Value="0" />
          <IsExpanded Value="true" />
          <On>
            <LomId Value="0" />
            <Manual Value="true" />
            <AutomationTarget Id="${nextId()}" />
            <ModulationTarget Id="${nextId()}" />
          </On>
          <Panorama>
            <LomId Value="0" />
            <Manual Value="0" />
            <AutomationTarget Id="${nextId()}" />
            <ModulationTarget Id="${nextId()}" />
          </Panorama>
          <Volume>
            <LomId Value="0" />
            <Manual Value="1" />
            <AutomationTarget Id="${nextId()}" />
            <ModulationTarget Id="${nextId()}" />
          </Volume>
        </MixerDevice>
      </DeviceChain>
    </AudioTrack>`;
}

function buildMidiTrackWithZones(
  stem:      SamplepPackStem,
  endBeat:   number,
  rootPitch: number,
  zones?:    SimplerZone[],
): string {
  const trackId = nextId();
  const clipId  = nextId();
  const color   = TRACK_COLORS[stem.stem_type] ?? 40;
  const label   = stem.stem_type.charAt(0).toUpperCase() + stem.stem_type.slice(1);

  // Decide Simpler path: if we have zones, the primary samplePath comes from the first zone.
  // Otherwise fall back to the single-stem WAV.
  const simplerFallbackPath = `Samples/Originals/${stem.stem_type}.wav`;
  const simplerXml = zones && zones.length > 0
    ? buildSimpler(zones[0].samplePath, rootPitch, zones)
    : buildSimpler(simplerFallbackPath, rootPitch);

  return `
    <MidiTrack Id="${trackId}">
      <LomId Value="0" />
      <LomIdView Value="0" />
      <IsContentSelectedInDocument Value="false" />
      <PreferredContentViewMode Value="0" />
      <TrackDelay>
        <Value Value="0" />
        <IsValueSampleBased Value="false" />
      </TrackDelay>
      <Name>
        <EffectiveName Value="${xmlAttr(label)}" />
        <UserName Value="" />
        <Annotation Value="" />
        <MemorizedFirstClipName Value="" />
      </Name>
      <Color Value="${color}" />
      <AutomationEnvelopes>
        <Envelopes />
      </AutomationEnvelopes>
      <TrackGroupId Value="-1" />
      <TrackUnfolded Value="false" />
      <DevicesListWrapper LomId="0" />
      <ClipSlotsListWrapper LomId="0" />
      <ViewData Value="{}" />
      <TakeLanes>
        <TakeLane Id="0">
          <LomId Value="0" />
          <Name Value="${xmlAttr(label)}" />
          <Annotation Value="" />
          <IsContentSelectedInDocument Value="false" />
          <ClipSlotList>
            <ClipSlot Id="0">
              <Value>
                ${buildMidiClip(clipId, label, endBeat, rootPitch)}
              </Value>
              <HasStopButton Value="true" />
              <NeedRefreeze Value="false" />
            </ClipSlot>
          </ClipSlotList>
        </TakeLane>
      </TakeLanes>
      <DeviceChain>
        <AutomationLanes>
          <AutomationLanes />
        </AutomationLanes>
        <ClipEnvelopeChooserViewState>
          <SelectedDevice Value="0" />
          <SelectedEnvelope Value="0" />
          <PreferModulationVisible Value="false" />
        </ClipEnvelopeChooserViewState>
        <MidiInputRouting>
          <Target Value="MidiIn/External.All/-1" />
          <UpperDisplayString Value="Ext: All Ins" />
          <LowerDisplayString Value="" />
        </MidiInputRouting>
        <MidiOutputRouting>
          <Target Value="MidiOut/None" />
          <UpperDisplayString Value="No Output" />
          <LowerDisplayString Value="" />
        </MidiOutputRouting>
        <Devices>
          ${simplerXml}
        </Devices>
        <MixerDevice Id="${nextId()}">
          <LomId Value="0" />
          <LomIdView Value="0" />
          <IsExpanded Value="true" />
          <On>
            <LomId Value="0" />
            <Manual Value="true" />
            <AutomationTarget Id="${nextId()}" />
            <ModulationTarget Id="${nextId()}" />
          </On>
          <Panorama>
            <LomId Value="0" />
            <Manual Value="0" />
            <AutomationTarget Id="${nextId()}" />
            <ModulationTarget Id="${nextId()}" />
          </Panorama>
          <Volume>
            <LomId Value="0" />
            <Manual Value="1" />
            <AutomationTarget Id="${nextId()}" />
            <ModulationTarget Id="${nextId()}" />
          </Volume>
        </MixerDevice>
      </DeviceChain>
    </MidiTrack>`;
}

/** Backward-compatible single-zone track */
function buildMidiTrack(stem: SamplepPackStem, endBeat: number, rootPitch: number): string {
  return buildMidiTrackWithZones(stem, endBeat, rootPitch);
}

// ─── Scene colours: one colour ID per arrangement section type ───────────────

const SCENE_COLORS: Record<string, number> = {
  intro:     57,  // steel blue
  build:     49,  // teal
  drop:      18,  // deep orange ����� peak energy
  verse:     40,  // light blue
  chorus:    15,  // warm red
  breakdown: 26,  // purple
  peak:      33,  // green
  outro:     64,  // white
};

// ─── Scenes builder ───────────────────────────────────────────────────────────

interface ArrangementSection {
  name:           string;
  duration_bars:  number;
  elements:       string[];
  dynamics:       string;
  notes:          string;
}

function buildScenesList(sections: ArrangementSection[], bpm: number): string {
  const scenes: string[] = [];
  let beatOffset = 0;

  for (let i = 0; i < sections.length; i++) {
    const sec        = sections[i];
    const sceneBars  = sec.duration_bars;
    const sceneBeats = sceneBars * 4;
    const color      = SCENE_COLORS[sec.name.toLowerCase()] ?? -1;
    const label      = sec.name.charAt(0).toUpperCase() + sec.name.slice(1)
                     + ` (${sceneBars}bars / ${sec.dynamics})`;
    const annotation = sec.notes.replace(/"/g, "'");

    scenes.push(`
      <Scene Id="${i}">
        <LomId Value="0" />
        <Name Value="${xmlAttr(label)}" />
        <Annotation Value="${xmlAttr(annotation)}" />
        <Color Value="${color}" />
        <Tempo Value="${bpm}" />
        <IsTempoEnabled Value="false" />
        <TimeSignatureId Value="0" />
        <IsTimeSignatureEnabled Value="false" />
        <NextAction>
          <NextAction>
            <ActionType Value="4" />
          </NextAction>
        </NextAction>
      </Scene>`);

    beatOffset += sceneBeats;
  }

  // Fallback: if no sections provided, emit one default scene
  if (scenes.length === 0) {
    scenes.push(`
      <Scene Id="0">
        <LomId Value="0" />
        <Name Value="Scene 1" />
        <Annotation Value="" />
        <Color Value="-1" />
        <Tempo Value="${bpm}" />
        <IsTempoEnabled Value="false" />
        <TimeSignatureId Value="0" />
        <IsTimeSignatureEnabled Value="false" />
        <NextAction>
          <NextAction>
            <ActionType Value="4" />
          </NextAction>
        </NextAction>
      </Scene>`);
  }

  return `<ScenesList>\n    ${scenes.join("\n    ")}\n    </ScenesList>`;
}

// ─── Multi-zone Simpler builder ────────────────────────────────────────────────
// For melodic stems: one MultiSamplePart per sampled MIDI note,
// key range splits at the midpoint between adjacent notes.
// Ableton Simpler will interpolate pitch between zones automatically.

interface SimplerZone {
  samplePath: string;
  rootNote:   number;
  keyMin:     number;
  keyMax:     number;
}

function buildSimpler(samplerPath: string, rootNote: number, zones?: SimplerZone[]): string {
  const simplerId = nextId();

  // Build SampleParts: one per zone, or single-zone fallback
  const buildPart = (zone: SimplerZone, zoneId: number) => `
                  <MultiSamplePart Id="${zoneId}" HasImportedSlicePoints="false" NeedsAnalysisData="false">
                    <LomId Value="0" />
                    <Name Value="" />
                    <Selection Value="${zoneId === 0 ? "true" : "false"}" />
                    <IsActive Value="true" />
                    <Solo Value="false" />
                    <KeyRange>
                      <Min Value="${zone.keyMin}" />
                      <Max Value="${zone.keyMax}" />
                      <CrossfadeMin Value="${zone.keyMin}" />
                      <CrossfadeMax Value="${zone.keyMax}" />
                    </KeyRange>
                    <VelocityRange>
                      <Min Value="1" />
                      <Max Value="127" />
                      <CrossfadeMin Value="1" />
                      <CrossfadeMax Value="127" />
                    </VelocityRange>
                    <SelectorRange>
                      <Min Value="0" />
                      <Max Value="127" />
                      <CrossfadeMin Value="0" />
                      <CrossfadeMax Value="127" />
                    </SelectorRange>
                    <RootKey Value="${zone.rootNote}" />
                    <Detune Value="0" />
                    <TuneScale Value="100" />
                    <Panorama Value="0" />
                    <Volume Value="1" />
                    <Lfo />
                    <Filter />
                    <SampleRef>${buildFileRef(zone.samplePath)}
                    </SampleRef>
                    <SlicePoints />
                    <ManageWarps Value="true" />
                    <WarpOn Value="false" />
                    <AutoWarpTolerance Value="4" />
                    <WarpMarkers />
                    <WarpMode Value="0" />
                  </MultiSamplePart>`;

  let partsXml: string;
  if (zones && zones.length > 0) {
    partsXml = zones.map((z, i) => buildPart(z, i)).join("");
  } else {
    // Single-zone fallback
    partsXml = buildPart({ samplePath: samplerPath, rootNote, keyMin: 0, keyMax: 127 }, 0);
  }

  return `
          <Simpler Id="${simplerId}">
            <LomId Value="0" />
            <LomIdView Value="0" />
            <IsExpanded Value="true" />
            <On>
              <LomId Value="0" />
              <Manual Value="true" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </On>
            <ParametersListWrapper LomId="0" />
            <Player>
              <MultiSampleMap>
                <SampleParts>${partsXml}
                </SampleParts>
              </MultiSampleMap>
            </Player>
          </Simpler>`;
}

// ─── Build Simpler zones for a stem's sample group ────────────────────────────
// samplePath is a template like "Samples/Originals/{stem}/{stem}_{note}.wav"

function buildZonesForMelodicStem(stem: string, midiNotes: number[]): SimplerZone[] {
  if (midiNotes.length === 0) return [];

  const sorted = [...midiNotes].sort((a, b) => a - b);
  const zones: SimplerZone[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const note   = sorted[i];
    const prev   = sorted[i - 1] ?? 0;
    const next   = sorted[i + 1] ?? 127;
    const keyMin = i === 0 ? 0   : Math.round((prev + note) / 2) + 1;
    const keyMax = i === sorted.length - 1 ? 127 : Math.round((note + next) / 2);

    zones.push({
      samplePath: `Samples/Instruments/${stem}/${stem}_${noteName(note)}_med.wav`,
      rootNote:   note,
      keyMin,
      keyMax,
    });
  }
  return zones;
}

function noteName(n: number): string {
  const NOTE_NAMES = ["C","Cs","D","Ds","E","F","Fs","G","Gs","A","As","B"];
  return NOTE_NAMES[n % 12] + (Math.floor(n / 12) - 1);
}

// ─── Native Ableton device builders ──────────────────────────────────────────
//
// All devices use Ableton's internal XML schema (Live 11/12).
// Parameter values are stored as floats matching Ableton's internal units.
// No third-party plugins — every device ships with Ableton Live Suite/Standard.

// ─── Shared: On/Off node ─────────────────────────────────────────────────────

function buildDeviceOn(on = true): string {
  return `<On>
              <LomId Value="0" />
              <Manual Value="${on}" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </On>`;
}

function buildAutoParam(manual: number | string, min = 0, max = 1): string {
  return `<LomId Value="0" />
              <Manual Value="${manual}" />
              <MidiControllerRange>
                <Min Value="${min}" />
                <Max Value="${max}" />
              </MidiControllerRange>
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />`;
}

// ─── EQ Eight ────────────────────────────────────────────────────────────────
// Ableton's 8-band parametric EQ.  Band Mode: 0=LP48, 1=LP12, 2=HP48, 3=HP12,
// 4=LowShelf, 5=Bell, 6=Notch, 7=HighShelf, 8=BP

interface EqBand {
  freq:  number;   // Hz
  gain:  number;   // dB
  q:     number;   // Q factor (0.1–10)
  mode:  number;   // see above
  on:    boolean;
}

function buildEqEight(bands: EqBand[]): string {
  const id = nextId();
  // Ableton stores 8 fixed bands regardless; unused ones have On=false
  const allBands = Array.from({ length: 8 }, (_, i) => bands[i] ?? {
    freq: 1000, gain: 0, q: 0.71, mode: 5, on: false,
  });

  const bandXml = allBands.map((b, i) => `
            <Band${i} Id="${i}">
              <LomId Value="0" />
              <Freq>
                ${buildAutoParam(b.freq.toFixed(2), 10, 22000)}
              </Freq>
              <Gain>
                ${buildAutoParam(b.gain.toFixed(2), -15, 15)}
              </Gain>
              <Q>
                ${buildAutoParam(b.q.toFixed(3), 0.1, 10)}
              </Q>
              <Mode>
                <LomId Value="0" />
                <Manual Value="${b.mode}" />
                <AutomationTarget Id="${nextId()}" />
              </Mode>
              <IsOn>
                <LomId Value="0" />
                <Manual Value="${b.on}" />
                <AutomationTarget Id="${nextId()}" />
              </IsOn>
            </Band${i}>`).join("");

  return `
          <Eq8 Id="${id}">
            <LomId Value="0" />
            <LomIdView Value="0" />
            <IsExpanded Value="true" />
            ${buildDeviceOn()}
            <ParametersListWrapper LomId="0" />
            <Precision Value="1" />
            ${bandXml}
            <Bands8 Value="false" />
          </Eq8>`;
}

// ─── Glue Compressor ────────────────────────────────────────────────���─────────
// Ableton's "Glue Compressor" (SSL-style bus compressor).

interface GlueConfig {
  threshold: number;   // dB  (default -12)
  ratio:     number;   // 2 | 4 | 10 | 20 | 100 represented as index 0-4
  attack:    number;   // index: 0=0.1ms, 1=0.3ms, 2=1ms, 3=3ms, 4=10ms, 5=30ms
  release:   number;   // 0=auto, 0.1=100ms, 0.2=200ms, 0.4=400ms, 0.8=800ms, 1.6s
  makeup:    number;   // dB
  dryWet:    number;   // 0–1
}

const GLUE_RATIO_VALUES = [2, 4, 10, 20, 100];
const GLUE_ATTACK_VALUES = [0.1, 0.3, 1, 3, 10, 30];

function buildGlueCompressor(cfg: Partial<GlueConfig> = {}): string {
  const c: GlueConfig = {
    threshold: cfg.threshold ?? -12,
    ratio:     cfg.ratio     ?? 1,    // index into GLUE_RATIO_VALUES (default 4:1)
    attack:    cfg.attack    ?? 2,    // index into GLUE_ATTACK_VALUES (default 1ms)
    release:   cfg.release   ?? 0,    // 0 = auto
    makeup:    cfg.makeup    ?? 0,
    dryWet:    cfg.dryWet    ?? 1,
  };
  const id = nextId();

  return `
          <GlueCompressor Id="${id}">
            <LomId Value="0" />
            <LomIdView Value="0" />
            <IsExpanded Value="true" />
            ${buildDeviceOn()}
            <ParametersListWrapper LomId="0" />
            <Threshold>
              ${buildAutoParam(c.threshold, -60, 0)}
            </Threshold>
            <Ratio>
              <LomId Value="0" />
              <Manual Value="${c.ratio}" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </Ratio>
            <Attack>
              <LomId Value="0" />
              <Manual Value="${c.attack}" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </Attack>
            <Release>
              ${buildAutoParam(c.release, 0, 1.6)}
            </Release>
            <MakeupGain>
              ${buildAutoParam(c.makeup, -10, 10)}
            </MakeupGain>
            <DryWet>
              ${buildAutoParam(c.dryWet, 0, 1)}
            </DryWet>
            <PeakClipIn Value="false" />
          </GlueCompressor>`;
}

// ─── Compressor 2 ────────────────────────────────────────────────────────────
// Ableton's multi-mode Compressor.

interface CompressorConfig {
  threshold: number;   // dB
  ratio:     number;   // 1–∞ (linear)
  attack:    number;   // ms (0.01–500)
  release:   number;   // ms (1–10000) or "auto" stored as 0
  knee:      number;   // dB soft-knee width (0=hard)
  makeup:    number;   // dB
  dryWet:    number;   // 0–1
  model:     number;   // 0=Peak, 1=RMS
}

function buildCompressor(cfg: Partial<CompressorConfig> = {}): string {
  const c: CompressorConfig = {
    threshold: cfg.threshold ?? -18,
    ratio:     cfg.ratio     ?? 3,
    attack:    cfg.attack    ?? 10,
    release:   cfg.release   ?? 100,
    knee:      cfg.knee      ?? 6,
    makeup:    cfg.makeup    ?? 0,
    dryWet:    cfg.dryWet    ?? 1,
    model:     cfg.model     ?? 0,
  };
  const id = nextId();

  return `
          <Compressor2 Id="${id}">
            <LomId Value="0" />
            <LomIdView Value="0" />
            <IsExpanded Value="true" />
            ${buildDeviceOn()}
            <ParametersListWrapper LomId="0" />
            <Threshold>
              ${buildAutoParam(c.threshold, -36, 0)}
            </Threshold>
            <Ratio>
              ${buildAutoParam(c.ratio, 1, 10)}
            </Ratio>
            <Knee>
              ${buildAutoParam(c.knee, 0, 24)}
            </Knee>
            <Attack>
              ${buildAutoParam(c.attack, 0, 500)}
            </Attack>
            <Release>
              ${buildAutoParam(c.release, 1, 10000)}
            </Release>
            <AutoReleaseControlIsOn>
              <LomId Value="0" />
              <Manual Value="false" />
              <AutomationTarget Id="${nextId()}" />
            </AutoReleaseControlIsOn>
            <MakeupGain>
              ${buildAutoParam(c.makeup, -10, 10)}
            </MakeupGain>
            <DryWetKnob>
              ${buildAutoParam(c.dryWet, 0, 1)}
            </DryWetKnob>
            <Model Value="${c.model}" />
          </Compressor2>`;
}

// ─── Limiter ─────────────────────────────────────────────────────────────────
// Ableton's true-peak Limiter (brick-wall).

function buildLimiter(ceiling = -0.3, lookahead = 1.0): string {
  const id = nextId();
  return `
          <Limiter Id="${id}">
            <LomId Value="0" />
            <LomIdView Value="0" />
            <IsExpanded Value="true" />
            ${buildDeviceOn()}
            <ParametersListWrapper LomId="0" />
            <Ceiling>
              ${buildAutoParam(ceiling, -36, 0)}
            </Ceiling>
            <GainInputLevel>
              ${buildAutoParam(0, -36, 36)}
            </GainInputLevel>
            <Lookahead Value="${lookahead}" />
            <Mode Value="1" />
            <LinkChannels Value="true" />
          </Limiter>`;
}

// ─── Saturator ───────────────────────────────────────────────────────────────
// Ableton's Saturator. WaveformType: 0=SoftSine, 1=Analog, 2=HardClip, 3=Sine, 4=Fold

function buildSaturator(drive = 0.0, waveformType = 1, wetDry = 1.0): string {
  const id = nextId();
  return `
          <Saturator Id="${id}">
            <LomId Value="0" />
            <LomIdView Value="0" />
            <IsExpanded Value="true" />
            ${buildDeviceOn()}
            <ParametersListWrapper LomId="0" />
            <Drive>
              ${buildAutoParam(drive, 0, 40)}
            </Drive>
            <Type Value="${waveformType}" />
            <WetDryMix>
              ${buildAutoParam(wetDry, 0, 1)}
            </WetDryMix>
            <DcOffsetOut Value="0" />
            <Effect>
              <Bass>
                <LomId Value="0" />
                <Manual Value="0" />
                <AutomationTarget Id="${nextId()}" />
              </Bass>
              <BassModeFreq>
                <LomId Value="0" />
                <Manual Value="90" />
                <AutomationTarget Id="${nextId()}" />
              </BassModeFreq>
              <Color>
                <LomId Value="0" />
                <Manual Value="0" />
                <AutomationTarget Id="${nextId()}" />
              </Color>
              <Freq>
                <LomId Value="0" />
                <Manual Value="0" />
                <AutomationTarget Id="${nextId()}" />
              </Freq>
            </Effect>
            <ColorAmount>
              ${buildAutoParam(0, 0, 100)}
            </ColorAmount>
          </Saturator>`;
}

// ─── Reverb ───────────────────────────────────────────────────────────────────
// Ableton's Reverb.

interface ReverbConfig {
  roomSize:    number;  // 0–1 (maps to Ableton's Room Size knob)
  decaySec:    number;  // 0.1–60s
  diffusion:   number;  // 0–1
  preDelaySec: number;  // 0–0.5s
  wetLevel:    number;  // 0–1
  dryLevel:    number;  // 0–1
  hpFreq:      number;  // Hz  (preverb EQ high-pass)
  lpFreq:      number;  // Hz  (preverb EQ low-pass)
}

function buildReverb(cfg: Partial<ReverbConfig> = {}): string {
  const c: ReverbConfig = {
    roomSize:    cfg.roomSize    ?? 0.75,
    decaySec:    cfg.decaySec    ?? 2.4,
    diffusion:   cfg.diffusion   ?? 0.9,
    preDelaySec: cfg.preDelaySec ?? 0.015,
    wetLevel:    cfg.wetLevel    ?? 1.0,
    dryLevel:    cfg.dryLevel    ?? 0.0,
    hpFreq:      cfg.hpFreq      ?? 120,
    lpFreq:      cfg.lpFreq      ?? 8000,
  };
  const id = nextId();

  return `
          <Reverb Id="${id}">
            <LomId Value="0" />
            <LomIdView Value="0" />
            <IsExpanded Value="true" />
            ${buildDeviceOn()}
            <ParametersListWrapper LomId="0" />
            <RoomSize>
              ${buildAutoParam(c.roomSize, 0, 1)}
            </RoomSize>
            <DecayTime>
              ${buildAutoParam(c.decaySec, 0.1, 60)}
            </DecayTime>
            <PreDelayTime>
              ${buildAutoParam(c.preDelaySec, 0, 0.5)}
            </PreDelayTime>
            <Diffusion>
              ${buildAutoParam(c.diffusion, 0, 1)}
            </Diffusion>
            <WetLevel>
              ${buildAutoParam(c.wetLevel, 0, 1)}
            </WetLevel>
            <DryLevel>
              ${buildAutoParam(c.dryLevel, 0, 1)}
            </DryLevel>
            <PreverbFilter>
              <HPFreq>
                ${buildAutoParam(c.hpFreq, 10, 22000)}
              </HPFreq>
              <LPFreq>
                ${buildAutoParam(c.lpFreq, 10, 22000)}
              </LPFreq>
            </PreverbFilter>
            <Freeze Value="0" />
          </Reverb>`;
}

// ─── Delay ───────────────────────────────────────────────────────────────────
// Ableton's native Delay (not Echo). Beat-synced delays L/R independently.
// beatLeft/beatRight are Ableton beat division indices:
//   0=1/32, 1=1/16, 2=3/32, 3=1/8, 4=3/16, 5=1/4, 6=3/8, 7=1/2, 8=3/4, 9=1
// filterOn=true activates 2-pole bandpass on the delay output.

interface DelayConfig {
  beatLeft:   number;  // beat division index
  beatRight:  number;  // beat division index
  feedback:   number;  // 0–1
  filterOn:   boolean;
  hpFreq:     number;  // Hz
  lpFreq:     number;  // Hz
  wet:        number;  // 0–1
}

function buildDelay(cfg: Partial<DelayConfig> = {}): string {
  const c: DelayConfig = {
    beatLeft:  cfg.beatLeft  ?? 3,   // 1/8
    beatRight: cfg.beatRight ?? 5,   // 1/4
    feedback:  cfg.feedback  ?? 0.30,
    filterOn:  cfg.filterOn  ?? true,
    hpFreq:    cfg.hpFreq    ?? 200,
    lpFreq:    cfg.lpFreq    ?? 8000,
    wet:       cfg.wet       ?? 0.8,
  };
  const id = nextId();

  return `
          <Delay Id="${id}">
            <LomId Value="0" />
            <LomIdView Value="0" />
            <IsExpanded Value="true" />
            ${buildDeviceOn()}
            <ParametersListWrapper LomId="0" />
            <DelayLeft>
              <SyncedRate>
                <LomId Value="0" />
                <Manual Value="${c.beatLeft}" />
                <AutomationTarget Id="${nextId()}" />
              </SyncedRate>
              <SyncMode Value="1" />
            </DelayLeft>
            <DelayRight>
              <SyncedRate>
                <LomId Value="0" />
                <Manual Value="${c.beatRight}" />
                <AutomationTarget Id="${nextId()}" />
              </SyncedRate>
              <SyncMode Value="1" />
            </DelayRight>
            <FeedbackL>
              ${buildAutoParam(c.feedback, 0, 1)}
            </FeedbackL>
            <FeedbackR>
              ${buildAutoParam(c.feedback, 0, 1)}
            </FeedbackR>
            <LinkFeedback Value="true" />
            <WetAmount>
              ${buildAutoParam(c.wet, 0, 1)}
            </WetAmount>
            <DryAmount>
              ${buildAutoParam(1 - c.wet, 0, 1)}
            </DryAmount>
            <StereoLink Value="false" />
            <Filter Value="${c.filterOn ? 1 : 0}">
              <Highpass>
                ${buildAutoParam(c.hpFreq, 10, 22000)}
              </Highpass>
              <Lowpass>
                ${buildAutoParam(c.lpFreq, 10, 22000)}
              </Lowpass>
            </Filter>
          </Delay>`;
}

// ─── Chorus-Ensemble ─────────────────────────────────────────────────────────
// Ableton's Chorus-Ensemble (Live 11+). Used for pad stereo widening.
// Mode: 0=Chorus I, 1=Chorus II, 2=Flanger, 3=Ensemble

function buildChorusEnsemble(amount = 0.4, mode = 3, dryWet = 0.5): string {
  const id = nextId();
  return `
          <ChorusEnsemble Id="${id}">
            <LomId Value="0" />
            <LomIdView Value="0" />
            <IsExpanded Value="true" />
            ${buildDeviceOn()}
            <ParametersListWrapper LomId="0" />
            <Amount>
              ${buildAutoParam(amount, 0, 1)}
            </Amount>
            <Mode Value="${mode}" />
            <DryWetMix>
              ${buildAutoParam(dryWet, 0, 1)}
            </DryWetMix>
          </ChorusEnsemble>`;
}

// ─── Utility ─────────────────────────────────────────────────────────────────
// Ableton's Utility. Used for gain staging and bass mono below a cutoff.

function buildUtility(gainDb = 0.0, stereoWidth = 1.0, monoBelow = 0): string {
  const id = nextId();
  return `
          <StereoGain Id="${id}">
            <LomId Value="0" />
            <LomIdView Value="0" />
            <IsExpanded Value="true" />
            ${buildDeviceOn()}
            <ParametersListWrapper LomId="0" />
            <Gain>
              ${buildAutoParam(gainDb, -35, 35)}
            </Gain>
            <StereoWidth>
              ${buildAutoParam(stereoWidth, 0, 1)}
            </StereoWidth>
            <SumToMono Value="false" />
            <MonoBelow>
              ${buildAutoParam(monoBelow, 0, 22000)}
            </MonoBelow>
            <MidSideMode Value="false" />
            <DC Value="false" />
          </StereoGain>`;
}

// ─── Drum Rack ────────────────────────────────────────────────────────────────
// One DrumBranch per pad. Each branch has:
//   - Simpler in one-shot mode with velocity-layered MultiSampleParts
//   - Per-pad EQ Eight + Compressor device chain

interface DrumPadConfig {
  name:       string;  // "Kick", "Snare", etc.
  midiNote:   number;  // 36=C1, 38=D1, 40=E1, 42=F#1, 44=G#1, 46=A#1
  stemType:   string;  // matches folder in Samples/Drums/
  color:      number;  // Ableton colour ID
  eqBands:    EqBand[];
  compConfig: Partial<CompressorConfig>;
  // Velocity layers for multi-zone Simpler
  velocityLayers: Array<{
    file:    string;   // relative path inside ZIP root
    velMin:  number;
    velMax:  number;
    velRoot: number;
  }>;
}

function buildDrumSimpler(pad: DrumPadConfig): string {
  const simplerId = nextId();

  const buildVelPart = (layer: DrumPadConfig["velocityLayers"][number], idx: number) => `
                    <MultiSamplePart Id="${idx}" HasImportedSlicePoints="false" NeedsAnalysisData="false">
                      <LomId Value="0" />
                      <Name Value="${xmlAttr(layer.file.split("/").pop() ?? "")}" />
                      <Selection Value="${idx === 1 ? "true" : "false"}" />
                      <IsActive Value="true" />
                      <Solo Value="false" />
                      <KeyRange>
                        <Min Value="${pad.midiNote}" />
                        <Max Value="${pad.midiNote}" />
                        <CrossfadeMin Value="${pad.midiNote}" />
                        <CrossfadeMax Value="${pad.midiNote}" />
                      </KeyRange>
                      <VelocityRange>
                        <Min Value="${layer.velMin}" />
                        <Max Value="${layer.velMax}" />
                        <CrossfadeMin Value="${layer.velMin}" />
                        <CrossfadeMax Value="${layer.velMax}" />
                      </VelocityRange>
                      <SelectorRange>
                        <Min Value="0" />
                        <Max Value="127" />
                        <CrossfadeMin Value="0" />
                        <CrossfadeMax Value="127" />
                      </SelectorRange>
                      <RootKey Value="${pad.midiNote}" />
                      <Detune Value="0" />
                      <TuneScale Value="100" />
                      <Panorama Value="0" />
                      <Volume Value="1" />
                      <Lfo />
                      <Filter />
                      <SampleRef>${buildFileRef(layer.file)}
                      </SampleRef>
                      <SlicePoints />
                      <ManageWarps Value="false" />
                      <WarpOn Value="false" />
                      <AutoWarpTolerance Value="4" />
                      <WarpMarkers />
                      <WarpMode Value="0" />
                    </MultiSamplePart>`;

  return `
                <Simpler Id="${simplerId}">
                  <LomId Value="0" />
                  <LomIdView Value="0" />
                  <IsExpanded Value="true" />
                  ${buildDeviceOn()}
                  <ParametersListWrapper LomId="0" />
                  <Player>
                    <MultiSampleMap>
                      <SampleParts>
                        ${pad.velocityLayers.map(buildVelPart).join("")}
                      </SampleParts>
                    </MultiSampleMap>
                    <LoopOn Value="false" />
                    <SampleStart Value="0" />
                    <SampleEnd Value="1" />
                    <SustainMode Value="0" />
                    <InterpolationQuality Value="2" />
                  </Player>
                </Simpler>`;
}

function buildDrumBranch(pad: DrumPadConfig, branchIdx: number): string {
  const branchId  = nextId();
  const simplerId = nextId();
  const eqXml     = buildEqEight(pad.eqBands);
  const compXml   = buildCompressor(pad.compConfig);

  return `
              <DrumBranch Id="${branchIdx}">
                <LomId Value="0" />
                <Name Value="${xmlAttr(pad.name)}" />
                <IsActive Value="true" />
                <Solo Value="false" />
                <Mute Value="false" />
                <ReceivingNote Value="${pad.midiNote}" />
                <SendingNote Value="${pad.midiNote}" />
                <ChokeGroup Value="0" />
                <NoteOffset Value="0" />
                <VelocityStart Value="1" />
                <VelocityEnd Value="127" />
                <ZoneSettings>
                  <ReceivingNoteRangeMin Value="${pad.midiNote}" />
                  <ReceivingNoteRangeMax Value="${pad.midiNote}" />
                  <Input Value="${pad.midiNote}" />
                  <Output Value="${pad.midiNote}" />
                </ZoneSettings>
                <DeviceChain>
                  <Devices>
                    ${buildDrumSimpler(pad)}
                    ${eqXml}
                    ${compXml}
                  </Devices>
                  <MixerDevice Id="${nextId()}">
                    <LomId Value="0" />
                    <LomIdView Value="0" />
                    <IsExpanded Value="true" />
                    ${buildDeviceOn()}
                    <ParametersListWrapper LomId="0" />
                    <Volume>
                      ${buildAutoParam(0.85, 0, 2)}
                    </Volume>
                    <Panorama>
                      ${buildAutoParam(0, -1, 1)}
                    </Panorama>
                  </MixerDevice>
                </DeviceChain>
              </DrumBranch>`;
}

function buildDrumRack(pads: DrumPadConfig[]): string {
  const rackId = nextId();
  const branches = pads.map((p, i) => buildDrumBranch(p, i)).join("");

  return `
          <DrumGroupDevice Id="${rackId}">
            <LomId Value="0" />
            <LomIdView Value="0" />
            <IsExpanded Value="true" />
            ${buildDeviceOn()}
            <ParametersListWrapper LomId="0" />
            <DrumBranches>
              ${branches}
            </DrumBranches>
            <ReturnCount Value="0" />
            <ShowRPads Value="false" />
            <ShowCPads Value="false" />
            <MidiNotesHaveChannels Value="false" />
            <PlaybackMode Value="0" />
            <ViewData Value="{&quot;ActiveChain&quot;:0}" />
          </DrumGroupDevice>`;
}

// ─── MixerDevice with Sends ───────────────────────────────────────────────────
// Ableton tracks have a MixerDevice that handles volume, pan, and send amounts.
// sendAmounts is an array of [returnTrackId, amount 0-1] pairs.

interface MixerCfg {
  volume:       number;   // 0–2 (1.0 = 0dB)
  pan:          number;   // -1 to 1
  sendAmounts:  number[]; // one per return track, 0–1
}

function buildMixerDevice(cfg: Partial<MixerCfg> = {}): string {
  const volume      = cfg.volume ?? 1.0;
  const pan         = cfg.pan    ?? 0;
  const sendAmounts = cfg.sendAmounts ?? [];
  const id = nextId();

  const sendsXml = sendAmounts.map((amt, i) => `
              <TrackSendHolder Id="${i}">
                <Send>
                  <LomId Value="0" />
                  <Manual Value="${amt.toFixed(4)}" />
                  <MidiControllerRange>
                    <Min Value="0" />
                    <Max Value="1" />
                  </MidiControllerRange>
                  <AutomationTarget Id="${nextId()}" />
                  <ModulationTarget Id="${nextId()}" />
                </Send>
                <Active Value="true" />
              </TrackSendHolder>`).join("");

  return `
        <MixerDevice Id="${id}">
          <LomId Value="0" />
          <LomIdView Value="0" />
          <IsExpanded Value="true" />
          ${buildDeviceOn()}
          <ParametersListWrapper LomId="0" />
          <Volume>
            ${buildAutoParam(volume, 0, 2)}
          </Volume>
          <Panorama>
            ${buildAutoParam(pan, -1, 1)}
          </Panorama>
          <SpeakerOn>
            <LomId Value="0" />
            <Manual Value="true" />
            <AutomationTarget Id="${nextId()}" />
          </SpeakerOn>
          <Sends>
            ${sendsXml}
          </Sends>
        </MixerDevice>`;
}

// ─── Audio Track (with FX chain and sends) ────────────────────────────────────

function buildAudioTrackFull(
  stem:        SamplepPackStem,
  endBeat:     number,
  isMix:       boolean,
  devicesXml:  string,
  mixerCfg:    Partial<MixerCfg> = {},
): string {
  const trackId = nextId();
  const clipId  = nextId();
  const color   = TRACK_COLORS[stem.stem_type] ?? TRACK_COLORS.mix;
  const label   = isMix
    ? "Master Mix"
    : stem.stem_type.charAt(0).toUpperCase() + stem.stem_type.slice(1);

  return `
    <AudioTrack Id="${trackId}">
      <LomId Value="0" />
      <LomIdView Value="0" />
      <IsContentSelectedInDocument Value="false" />
      <PreferredContentViewMode Value="0" />
      <TrackDelay><Value Value="0" /><IsValueSampleBased Value="false" /></TrackDelay>
      <Name>
        <EffectiveName Value="${xmlAttr(label)}" />
        <UserName Value="" /><Annotation Value="" /><MemorizedFirstClipName Value="" />
      </Name>
      <Color Value="${color}" />
      <AutomationEnvelopes><Envelopes /></AutomationEnvelopes>
      <TrackGroupId Value="-1" />
      <TrackUnfolded Value="false" />
      <DevicesListWrapper LomId="0" />
      <ClipSlotsListWrapper LomId="0" />
      <ViewData Value="{}" />
      <TakeLanes>
        <TakeLane Id="0">
          <LomId Value="0" />
          <Name Value="${xmlAttr(label)}" />
          <Annotation Value="" />
          <IsContentSelectedInDocument Value="false" />
          <ClipSlotList>
            <ClipSlot Id="0">
              <Value>${buildAudioClip(clipId, stem, endBeat)}</Value>
              <HasStopButton Value="true" />
              <NeedRefreeze Value="false" />
            </ClipSlot>
          </ClipSlotList>
        </TakeLane>
      </TakeLanes>
      <DeviceChain>
        <AutomationLanes><AutomationLanes /></AutomationLanes>
        <ClipEnvelopeChooserViewState>
          <SelectedDevice Value="0" /><SelectedEnvelope Value="0" /><PreferModulationVisible Value="false" />
        </ClipEnvelopeChooserViewState>
        <AudioInputRouting>
          <Target Value="AudioIn/None" /><UpperDisplayString Value="No Input" /><LowerDisplayString Value="" />
        </AudioInputRouting>
        <AudioOutputRouting>
          <Target Value="AudioOut/Master" /><UpperDisplayString Value="Master" /><LowerDisplayString Value="" />
        </AudioOutputRouting>
        <Devices>${devicesXml}</Devices>
        ${buildMixerDevice(mixerCfg)}
      </DeviceChain>
    </AudioTrack>`;
}

// ─── Midi Track (with FX chain and sends) ─────────────────────────────────────

function buildMidiTrackFull(
  stem:       SamplepPackStem,
  endBeat:    number,
  rootPitch:  number,
  zones:      SimplerZone[] | undefined,
  devicesXml: string,       // appended AFTER the Simpler
  mixerCfg:   Partial<MixerCfg> = {},
  keyRoot:    number = 0,   // MIDI note for Scale tool (0 = C)
  includeScale = true,      // Add Scale MIDI effect
): string {
  const trackId = nextId();
  const clipId  = nextId();
  const color   = TRACK_COLORS[stem.stem_type] ?? 40;
  const label   = stem.stem_type.charAt(0).toUpperCase() + stem.stem_type.slice(1);

  const simplerFallbackPath = `Samples/Originals/${stem.stem_type}.wav`;
  const simplerXml = zones && zones.length > 0
    ? buildSimpler(zones[0].samplePath, rootPitch, zones)
    : buildSimpler(simplerFallbackPath, rootPitch);

  // Build the main Simpler + FX chain, wrap in Instrument Rack
  const chainXml = `${simplerXml}${devicesXml}`;
  const instrumentRackXml = buildInstrumentRack(chainXml, DEFAULT_MACROS, label);

  // Scale MIDI effect (if enabled, placed before the Rack)
  const scaleXml = includeScale ? buildScaleMidiEffect(keyRoot, 0, true) : "";

  return `
    <MidiTrack Id="${trackId}">
      <LomId Value="0" />
      <LomIdView Value="0" />
      <IsContentSelectedInDocument Value="false" />
      <PreferredContentViewMode Value="0" />
      <TrackDelay><Value Value="0" /><IsValueSampleBased Value="false" /></TrackDelay>
      <Name>
        <EffectiveName Value="${xmlAttr(label)}" />
        <UserName Value="" /><Annotation Value="" /><MemorizedFirstClipName Value="" />
      </Name>
      <Color Value="${color}" />
      <AutomationEnvelopes><Envelopes /></AutomationEnvelopes>
      <TrackGroupId Value="-1" />
      <TrackUnfolded Value="false" />
      <DevicesListWrapper LomId="0" />
      <ClipSlotsListWrapper LomId="0" />
      <ViewData Value="{}" />
      <TakeLanes>
        <TakeLane Id="0">
          <LomId Value="0" />
          <Name Value="${xmlAttr(label)}" />
          <Annotation Value="" />
          <IsContentSelectedInDocument Value="false" />
          <ClipSlotList>
            <ClipSlot Id="0">
              <Value>${buildMidiClip(clipId, label, endBeat, rootPitch)}</Value>
              <HasStopButton Value="true" />
              <NeedRefreeze Value="false" />
            </ClipSlot>
          </ClipSlotList>
        </TakeLane>
      </TakeLanes>
      <DeviceChain>
        <AutomationLanes><AutomationLanes /></AutomationLanes>
        <ClipEnvelopeChooserViewState>
          <SelectedDevice Value="0" /><SelectedEnvelope Value="0" /><PreferModulationVisible Value="false" />
        </ClipEnvelopeChooserViewState>
        <MidiInputRouting>
          <Target Value="MidiIn/External.All/-1" />
          <UpperDisplayString Value="Ext: All Ins" /><LowerDisplayString Value="" />
        </MidiInputRouting>
        <MidiOutputRouting>
          <Target Value="MidiOut/None" /><UpperDisplayString Value="No Output" /><LowerDisplayString Value="" />
        </MidiOutputRouting>
        <Devices>
          ${scaleXml}
          ${instrumentRackXml}
        </Devices>
        ${buildMixerDevice(mixerCfg)}
      </DeviceChain>
    </MidiTrack>`;
}

// ─── Drum Group Track ─────────────────────────────────────────────────────────
// A single GroupTrack containing the DrumRack + post-rack FX chain.

function buildDrumGroupTrack(
  pads:     DrumPadConfig[],
  endBeat:  number,
): string {
  const trackId  = nextId();
  const color    = 18; // deep orange

  const drumRackXml = buildDrumRack(pads);
  // Post-drum-rack chain: Drum Bus analogue (EQ + Glue + Limiter)
  const postFxXml =
    buildEqEight([
      { freq: 40,   gain: -2,  q: 0.71, mode: 2,  on: true  },  // HP 40Hz
      { freq: 200,  gain: 1.5, q: 0.9,  mode: 4,  on: true  },  // Low shelf +1.5
      { freq: 3500, gain: 1.2, q: 1.4,  mode: 5,  on: true  },  // Bell 3.5k presence
      { freq: 12000,gain: -1,  q: 0.7,  mode: 7,  on: true  },  // High shelf rolloff
    ]) +
    buildGlueCompressor({ threshold: -8, ratio: 1, attack: 1, release: 0, makeup: 2, dryWet: 0.8 }) +
    buildLimiter(-0.5, 1.0);

  return `
    <GroupTrack Id="${trackId}">
      <LomId Value="0" />
      <LomIdView Value="0" />
      <IsContentSelectedInDocument Value="false" />
      <PreferredContentViewMode Value="0" />
      <TrackDelay><Value Value="0" /><IsValueSampleBased Value="false" /></TrackDelay>
      <Name>
        <EffectiveName Value="Drums" />
        <UserName Value="" /><Annotation Value="" /><MemorizedFirstClipName Value="" />
      </Name>
      <Color Value="${color}" />
      <AutomationEnvelopes><Envelopes /></AutomationEnvelopes>
      <TrackGroupId Value="-1" />
      <TrackUnfolded Value="true" />
      <DevicesListWrapper LomId="0" />
      <ClipSlotsListWrapper LomId="0" />
      <ViewData Value="{}" />
      <TakeLanes>
        <TakeLane Id="0">
          <LomId Value="0" /><Name Value="Drums" /><Annotation Value="" />
          <IsContentSelectedInDocument Value="false" />
          <ClipSlotList>
            <ClipSlot Id="0"><HasStopButton Value="true" /><NeedRefreeze Value="false" /></ClipSlot>
          </ClipSlotList>
        </TakeLane>
      </TakeLanes>
      <DeviceChain>
        <AutomationLanes><AutomationLanes /></AutomationLanes>
        <ClipEnvelopeChooserViewState>
          <SelectedDevice Value="0" /><SelectedEnvelope Value="0" /><PreferModulationVisible Value="false" />
        </ClipEnvelopeChooserViewState>
        <AudioInputRouting>
          <Target Value="AudioIn/None" /><UpperDisplayString Value="No Input" /><LowerDisplayString Value="" />
        </AudioInputRouting>
        <AudioOutputRouting>
          <Target Value="AudioOut/Master" /><UpperDisplayString Value="Master" /><LowerDisplayString Value="" />
        </AudioOutputRouting>
        <Devices>
          ${drumRackXml}
          ${postFxXml}
        </Devices>
        ${buildMixerDevice({ volume: 0.9, sendAmounts: [0.0, 0.0] })}
      </DeviceChain>
    </GroupTrack>`;
}

// ─── Return Track ────────────────────────────────────────────────────────────

function buildReturnTrack(returnIdx: number, name: string, color: number, devicesXml: string): string {
  const trackId = nextId();

  return `
    <ReturnTrack Id="${trackId}">
      <LomId Value="0" />
      <LomIdView Value="0" />
      <IsContentSelectedInDocument Value="false" />
      <PreferredContentViewMode Value="0" />
      <TrackDelay><Value Value="0" /><IsValueSampleBased Value="false" /></TrackDelay>
      <Name>
        <EffectiveName Value="${xmlAttr(name)}" />
        <UserName Value="" /><Annotation Value="" /><MemorizedFirstClipName Value="" />
      </Name>
      <Color Value="${color}" />
      <AutomationEnvelopes><Envelopes /></AutomationEnvelopes>
      <TrackGroupId Value="-1" />
      <TrackUnfolded Value="false" />
      <DevicesListWrapper LomId="0" />
      <ClipSlotsListWrapper LomId="0" />
      <ViewData Value="{}" />
      <TakeLanes>
        <TakeLane Id="0">
          <LomId Value="0" /><Name Value="${xmlAttr(name)}" /><Annotation Value="" />
          <IsContentSelectedInDocument Value="false" />
          <ClipSlotList />
        </TakeLane>
      </TakeLanes>
      <DeviceChain>
        <AutomationLanes><AutomationLanes /></AutomationLanes>
        <ClipEnvelopeChooserViewState>
          <SelectedDevice Value="0" /><SelectedEnvelope Value="0" /><PreferModulationVisible Value="false" />
        </ClipEnvelopeChooserViewState>
        <AudioInputRouting>
          <Target Value="AudioIn/Return/${returnIdx}" />
          <UpperDisplayString Value="Return ${returnIdx + 1}" /><LowerDisplayString Value="" />
        </AudioInputRouting>
        <AudioOutputRouting>
          <Target Value="AudioOut/Master" /><UpperDisplayString Value="Master" /><LowerDisplayString Value="" />
        </AudioOutputRouting>
        <Devices>${devicesXml}</Devices>
        ${buildMixerDevice({ volume: 0.9, sendAmounts: [] })}
      </DeviceChain>
    </ReturnTrack>`;
}

// ─── Master Track (full) ──────────────────────────────────────────────────────

function buildMasterTrackFull(bpm: number, projectName: string): string {
  const masterFxXml =
    buildEqEight([
      { freq: 60,   gain: 1.5, q: 0.5,  mode: 4, on: true },  // Low shelf boost
      { freq: 200,  gain: -1,  q: 0.9,  mode: 5, on: true },  // Cut mud
      { freq: 8000, gain: 0.8, q: 0.5,  mode: 7, on: true },  // Air shelf
    ]) +
    buildGlueCompressor({ threshold: -6, ratio: 0, attack: 2, release: 0, makeup: 1, dryWet: 0.7 }) +
    buildLimiter(-0.3, 1.0);

  return `
    <MasterTrack>
      <LomId Value="0" />
      <LomIdView Value="0" />
      <IsContentSelectedInDocument Value="false" />
      <PreferredContentViewMode Value="0" />
      <TrackDelay><Value Value="0" /><IsValueSampleBased Value="false" /></TrackDelay>
      <Name>
        <EffectiveName Value="Master" />
        <UserName Value="" />
        <Annotation Value="${xmlAttr(`DARKSCO ${projectName} — generated by ableton-ai-control-bridge`)}" />
        <MemorizedFirstClipName Value="" />
      </Name>
      <Color Value="${TRACK_COLORS.mix}" />
      <AutomationEnvelopes><Envelopes /></AutomationEnvelopes>
      <TrackGroupId Value="-1" />
      <TrackUnfolded Value="false" />
      <DevicesListWrapper LomId="0" />
      <ClipSlotsListWrapper LomId="0" />
      <ViewData Value="{}" />
      <DeviceChain>
        <AutomationLanes><AutomationLanes /></AutomationLanes>
        <ClipEnvelopeChooserViewState>
          <SelectedDevice Value="0" /><SelectedEnvelope Value="0" /><PreferModulationVisible Value="false" />
        </ClipEnvelopeChooserViewState>
        <AudioInputRouting>
          <Target Value="AudioIn/None" /><UpperDisplayString Value="No Input" /><LowerDisplayString Value="" />
        </AudioInputRouting>
        <AudioOutputRouting>
          <Target Value="AudioOut/Master" /><UpperDisplayString Value="Master" /><LowerDisplayString Value="" />
        </AudioOutputRouting>
        <Devices>${masterFxXml}</Devices>
        <MixerDevice Id="${nextId()}">
          <LomId Value="0" />
          <LomIdView Value="0" />
          <IsExpanded Value="true" />
          ${buildDeviceOn()}
          <ParametersListWrapper LomId="0" />
          <Volume>
            ${buildAutoParam(1.0, 0, 2)}
          </Volume>
          <Panorama>
            ${buildAutoParam(0, -1, 1)}
          </Panorama>
          <Tempo>
            <LomId Value="0" />
            <Manual Value="${bpm}" />
            <AutomationTarget Id="${nextId()}" />
            <ModulationTarget Id="${nextId()}" />
          </Tempo>
        </MixerDevice>
      </DeviceChain>
    </MasterTrack>`;
}

// ─── Automation Envelope Builder ───────────────────────────────────────────────
// Builds a parameter envelope following arrangement sections.
// envelope: array of [sectionName, startValue, endValue] for smooth automation.

interface AutomationEnvelope {
  section: string;
  startVal: number;
  endVal: number;
}

function buildParameterAutomation(
  paramName: string,
  envelopes: AutomationEnvelope[],
  bars: number,
): string {
  if (envelopes.length === 0) return "";

  const beatPerBar = 4;
  const beatPerSec = (bpm: number) => bpm / 60;

  // Assume sections are sequential; calculate beat offsets
  const events: Array<{ beat: number; val: number }> = [];
  let currentBeat = 0;

  for (const env of envelopes) {
    events.push({ beat: currentBeat, val: env.startVal });
    // Advance section duration (estimated at 4 bars per section for now)
    currentBeat += 4 * beatPerBar;
    events.push({ beat: currentBeat, val: env.endVal });
  }

  const automationXml = events.map((e, i) => `
        <AutomationEvent Id="${i}" Time="${e.beat}">
          <FloatEvent Value="${e.val}" />
        </AutomationEvent>`).join("");

  return `<Lom Id="0" />
      ${automationXml}`;
}

// ─── Instrument Rack with 8 Macros ────────────────────────────────────────────
// Wraps a Simpler+FX chain with 8 easy-to-reach macro controls:
//   Macro 1: Filter Freq (100–20kHz)
//   Macro 2: Filter Resonance (0–1)
//   Macro 3: Saturation Drive (0–40)
//   Macro 4: Reverb Send (0–1)
//   Macro 5: Delay Send (0–1)
//   Macro 6: Volume (0–2)
//   Macro 7: Panorama (−1 to 1)
//   Macro 8: Dry/Wet Effect Mix (0–1)

interface MacroConfig {
  name: string;
  min: number;
  max: number;
  default: number;
}

const DEFAULT_MACROS: MacroConfig[] = [
  { name: "Filter Freq",     min: 100,  max: 20000, default: 8000 },
  { name: "Filter Res",      min: 0,    max: 1,     default: 0.5 },
  { name: "Saturation",      min: 0,    max: 40,    default: 0 },
  { name: "Reverb Send",     min: 0,    max: 1,     default: 0.35 },
  { name: "Delay Send",      min: 0,    max: 1,     default: 0.15 },
  { name: "Volume",          min: 0,    max: 2,     default: 1.0 },
  { name: "Panorama",        min: -1,   max: 1,     default: 0 },
  { name: "Effect Wet/Dry",  min: 0,    max: 1,     default: 0.5 },
];

function buildInstrumentRack(
  chainXml: string,           // Pre-built Simpler + FX chain XML
  macros: MacroConfig[] = DEFAULT_MACROS,
  name = "Instrument",
): string {
  const rackId = nextId();
  const chainId = nextId();

  const macroXml = macros.map((m, i) => `
            <Macro Id="${i}">
              <LomId Value="0" />
              <Name Value="${xmlAttr(m.name)}" />
              <Annotation Value="" />
              <MacroAssignments>
                <Assignments />
              </MacroAssignments>
              <Min Value="${m.min}" />
              <Max Value="${m.max}" />
              <Value>
                <LomId Value="0" />
                <Manual Value="${m.default}" />
                <MidiControllerRange>
                  <Min Value="${m.min}" />
                  <Max Value="${m.max}" />
                </MidiControllerRange>
                <AutomationTarget Id="${nextId()}" />
              </Value>
              <Visualization>
                <Automatable Value="false" />
              </Visualization>
              <ArrangementViewOrder Value="-1" />
            </Macro>`).join("");

  return `
        <InstrumentGroupDevice Id="${rackId}">
          <LomId Value="0" />
          <LomIdView Value="0" />
          <IsExpanded Value="true" />
          ${buildDeviceOn()}
          <ParametersListWrapper LomId="0" />
          <Macros>
            ${macroXml}
          </Macros>
          <Chains>
            <AudioBranch Id="0">
              <LomId Value="0" />
              <Name Value="${xmlAttr(name)}" />
              <IsActive Value="true" />
              <Solo Value="false" />
              <Mute Value="false" />
              <DeviceChain>
                <Devices>
                  ${chainXml}
                </Devices>
                <MixerDevice Id="${nextId()}">
                  <LomId Value="0" />
                  <LomIdView Value="0" />
                  <IsExpanded Value="true" />
                  ${buildDeviceOn()}
                  <ParametersListWrapper LomId="0" />
                  <Volume>
                    ${buildAutoParam(1.0, 0, 2)}
                  </Volume>
                  <Panorama>
                    ${buildAutoParam(0, -1, 1)}
                  </Panorama>
                </MixerDevice>
              </DeviceChain>
            </AudioBranch>
          </Chains>
        </InstrumentGroupDevice>`;
}

// ─── Scale MIDI Effect (locks melodic tracks to key) ─────────────────────────────
// Constrains MIDI notes to a scale. Mode: 0=Major, 1=Minor, 2=Dorian, 3=Phrygian, etc.

function buildScaleMidiEffect(rootNote = 0, scaleMode = 0, isActive = true): string {
  const scaleId = nextId();
  const SCALE_NAMES = [
    "Major", "Minor", "Dorian", "Phrygian", "Lydian", "Mixolydian",
    "Locrian", "Pentatonic Major", "Pentatonic Minor",
  ];
  const scaleName = SCALE_NAMES[scaleMode] ?? "Major";

  return `
          <Scale Id="${scaleId}">
            <LomId Value="0" />
            <LomIdView Value="0" />
            <IsExpanded Value="false" />
            <On>
              <LomId Value="0" />
              <Manual Value="${isActive}" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </On>
            <ParametersListWrapper LomId="0" />
            <BaseNote>
              <LomId Value="0" />
              <Manual Value="${rootNote}" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </BaseNote>
            <ScaleType>
              <LomId Value="0" />
              <Manual Value="${scaleMode}" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </ScaleType>
            <Transposition>
              <LomId Value="0" />
              <Manual Value="0" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </Transposition>
            <Fold Value="true" />
            <Name Value="${xmlAttr(`Scale: ${scaleName}`)}" />
            <Annotation Value="" />
          </Scale>`;
}

// ─── Arpeggiator MIDI Effect ───────────────────────────────────────────────────
// Arpeggiate held notes. Mode: 0=Up, 1=Down, 2=Up+Down, 3=Random

function buildArpeggiatorMidiEffect(
  mode = 0,     // 0=Up
  rate = 3,     // beat division index (3 = 1/8)
  octaves = 1,
  isActive = true,
): string {
  const arpId = nextId();
  const MODE_NAMES = ["Up", "Down", "Up+Down", "Random"];

  return `
          <Arpeggiator Id="${arpId}">
            <LomId Value="0" />
            <LomIdView Value="0" />
            <IsExpanded Value="false" />
            <On>
              <LomId Value="0" />
              <Manual Value="${isActive}" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </On>
            <ParametersListWrapper LomId="0" />
            <Mode>
              <LomId Value="0" />
              <Manual Value="${mode}" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </Mode>
            <TargetNote>
              <LomId Value="0" />
              <Manual Value="60" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </TargetNote>
            <FixedNoteLength>
              <LomId Value="0" />
              <Manual Value="0.125" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </FixedNoteLength>
            <Synced Value="true" />
            <Rate>
              <LomId Value="0" />
              <Manual Value="${rate}" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </Rate>
            <GripAmount>
              <LomId Value="0" />
              <Manual Value="0" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </GripAmount>
            <Offset>
              <LomId Value="0" />
              <Manual Value="0" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </Offset>
            <Steps>
              <LomId Value="0" />
              <Manual Value="4" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </Steps>
            <Octaves>
              <LomId Value="0" />
              <Manual Value="${octaves}" />
              <AutomationTarget Id="${nextId()}" />
              <ModulationTarget Id="${nextId()}" />
            </Octaves>
            <RetriggerMode Value="0" />
            <Name Value="${xmlAttr(`Arpeggiator: ${MODE_NAMES[mode] ?? "Up"}`)}" />
            <Annotation Value="" />
          </Arpeggiator>`;
}

// ─── Wavetable Synth Track ─────────────────────────────────────────────────────
// Alternative performance layer running in parallel with Simpler.
// Uses native Wavetable with basic setup (init osc, default filter).

function buildWavetableSynthChain(): string {
  const wavetableId = nextId();

  return `
          <Wavetable Id="${wavetableId}">
            <LomId Value="0" />
            <LomIdView Value="0" />
            <IsExpanded Value="true" />
            ${buildDeviceOn()}
            <ParametersListWrapper LomId="0" />
            <Oscillator>
              <WavetableRef>
                <Value Value="Wavetables/Init Osc" />
              </WavetableRef>
              <TableIndex>
                ${buildAutoParam(0, 0, 1)}
              </TableIndex>
              <Transpose>
                ${buildAutoParam(0, -48, 48)}
              </Transpose>
              <Detune>
                ${buildAutoParam(0, -100, 100)}
              </Detune>
              <Phase>
                ${buildAutoParam(0, 0, 360)}
              </Phase>
              <UniSpread>
                ${buildAutoParam(0, 0, 1)}
              </UniSpread>
              <UniVoices>
                <LomId Value="0" />
                <Manual Value="1" />
                <AutomationTarget Id="${nextId()}" />
              </UniVoices>
              <Pan>
                ${buildAutoParam(0, -1, 1)}
              </Pan>
              <VolEnv>
                <Envelope>
                  <AmplitudeEnvelope>
                    <Lom Id="0" />
                    <Time0 Value="0.005" /><Level0 Value="1" /><Time1 Value="0.1" /><Level1 Value="0.8" />
                    <Time2 Value="1" /><Level2 Value="0.5" /><Time3 Value="0.5" /><Level3 Value="0" />
                  </AmplitudeEnvelope>
                </Envelope>
              </VolEnv>
            </Oscillator>
            <Filter>
              <FilterType Value="1" />
              <Frequency>
                ${buildAutoParam(0.5, 0, 1)}
              </Frequency>
              <Resonance>
                ${buildAutoParam(0.4, 0, 1)}
              </Resonance>
              <Morph>
                ${buildAutoParam(0, 0, 1)}
              </Morph>
            </Filter>
          </Wavetable>`;
}

function buildWavetableMidiTrack(
  name: string,
  rootNote: number,
  endBeat: number,
  color: number,
  midiEffectsXml: string = "",
  mixerCfg: Partial<MixerCfg> = {},
): string {
  const trackId = nextId();
  const clipId  = nextId();

  const wavetableXml = buildWavetableSynthChain();
  const eqXml = buildEqEight([
    { freq: 80,  gain: 0,  q: 0.71, mode: 2, on: true },
  ]);
  const compXml = buildCompressor({ threshold: -18, ratio: 2, attack: 10, release: 100, knee: 6, makeup: 0 });

  return `
    <MidiTrack Id="${trackId}">
      <LomId Value="0" />
      <LomIdView Value="0" />
      <IsContentSelectedInDocument Value="false" />
      <PreferredContentViewMode Value="0" />
      <TrackDelay><Value Value="0" /><IsValueSampleBased Value="false" /></TrackDelay>
      <Name>
        <EffectiveName Value="${xmlAttr(name + " (WT)")}" />
        <UserName Value="" /><Annotation Value="Wavetable synth alternative layer" /><MemorizedFirstClipName Value="" />
      </Name>
      <Color Value="${color}" />
      <AutomationEnvelopes><Envelopes /></AutomationEnvelopes>
      <TrackGroupId Value="-1" />
      <TrackUnfolded Value="false" />
      <DevicesListWrapper LomId="0" />
      <ClipSlotsListWrapper LomId="0" />
      <ViewData Value="{}" />
      <TakeLanes>
        <TakeLane Id="0">
          <LomId Value="0" /><Name Value="${xmlAttr(name + " (WT)")}" /><Annotation Value="" />
          <IsContentSelectedInDocument Value="false" />
          <ClipSlotList>
            <ClipSlot Id="0">
              <Value>${buildMidiClip(clipId, name + " (WT)", endBeat, rootNote)}</Value>
              <HasStopButton Value="true" /><NeedRefreeze Value="false" />
            </ClipSlot>
          </ClipSlotList>
        </TakeLane>
      </TakeLanes>
      <DeviceChain>
        <AutomationLanes><AutomationLanes /></AutomationLanes>
        <ClipEnvelopeChooserViewState>
          <SelectedDevice Value="0" /><SelectedEnvelope Value="0" /><PreferModulationVisible Value="false" />
        </ClipEnvelopeChooserViewState>
        <MidiInputRouting>
          <Target Value="MidiIn/External.All/-1" /><UpperDisplayString Value="Ext: All Ins" /><LowerDisplayString Value="" />
        </MidiInputRouting>
        <MidiOutputRouting>
          <Target Value="MidiOut/None" /><UpperDisplayString Value="No Output" /><LowerDisplayString Value="" />
        </MidiOutputRouting>
        <Devices>
          ${midiEffectsXml}
          ${wavetableXml}
          ${eqXml}
          ${compXml}
        </Devices>
        ${buildMixerDevice(mixerCfg)}
      </DeviceChain>
    </MidiTrack>`;
}

// ─── Group Track ──────────────────────────────────────────────────────────────
// Container for organizing related tracks (e.g., all melodic stems, all returns).

function buildGroupTrack(
  name: string,
  color: number,
  trackIds: number[] = [],  // Child track IDs (for reference)
): string {
  const groupId = nextId();

  return `
    <GroupTrack Id="${groupId}">
      <LomId Value="0" />
      <LomIdView Value="0" />
      <IsContentSelectedInDocument Value="false" />
      <PreferredContentViewMode Value="0" />
      <TrackDelay><Value Value="0" /><IsValueSampleBased Value="false" /></TrackDelay>
      <Name>
        <EffectiveName Value="${xmlAttr(name)}" />
        <UserName Value="" /><Annotation Value="" /><MemorizedFirstClipName Value="" />
      </Name>
      <Color Value="${color}" />
      <AutomationEnvelopes><Envelopes /></AutomationEnvelopes>
      <TrackGroupId Value="-1" />
      <TrackUnfolded Value="true" />
      <DevicesListWrapper LomId="0" />
      <ClipSlotsListWrapper LomId="0" />
      <ViewData Value="{}" />
      <TakeLanes>
        <TakeLane Id="0">
          <LomId Value="0" /><Name Value="${xmlAttr(name)}" /><Annotation Value="" />
          <IsContentSelectedInDocument Value="false" />
          <ClipSlotList />
        </TakeLane>
      </TakeLanes>
      <DeviceChain>
        <AutomationLanes><AutomationLanes /></AutomationLanes>
        <ClipEnvelopeChooserViewState>
          <SelectedDevice Value="0" /><SelectedEnvelope Value="0" /><PreferModulationVisible Value="false" />
        </ClipEnvelopeChooserViewState>
        <AudioInputRouting>
          <Target Value="AudioIn/None" /><UpperDisplayString Value="No Input" /><LowerDisplayString Value="" />
        </AudioInputRouting>
        <AudioOutputRouting>
          <Target Value="AudioOut/Master" /><UpperDisplayString Value="Master" /><LowerDisplayString Value="" />
        </AudioOutputRouting>
        <Devices />
        ${buildMixerDevice({ volume: 1.0, sendAmounts: [] })}
      </DeviceChain>
    </GroupTrack>`;
}

// ─── Drum pad definitions ──────────────────────────────────────────────────────

function makeDrumPads(root: string): DrumPadConfig[] {
  // root = ZIP root prefix, e.g. "DARKSCO_Night_120bpm/"
  const drumPath = (stem: string, layer: string) =>
    `${root}Samples/Drums/${stem}/${stem}_${layer}.wav`;

  return [
    {
      name: "Kick", midiNote: 36, stemType: "kick", color: 18,
      eqBands: [
        { freq: 40,  gain: 3,   q: 0.5,  mode: 5, on: true },  // Sub boost
        { freq: 500, gain: -2,  q: 1.4,  mode: 5, on: true },  // Remove boxiness
        { freq: 4000,gain: 2.5, q: 1.0,  mode: 5, on: true },  // Click attack
        { freq: 80,  gain: 0,   q: 0.71, mode: 2, on: true },  // HP 80Hz very gentle
      ],
      compConfig: { threshold: -12, ratio: 3, attack: 3, release: 60, knee: 3, makeup: 2 },
      velocityLayers: [
        { file: drumPath("kick","soft"),   velMin: 1,   velMax: 60,  velRoot: 40 },
        { file: drumPath("kick","medium"), velMin: 61,  velMax: 100, velRoot: 90 },
        { file: drumPath("kick","hard"),   velMin: 101, velMax: 127, velRoot: 120 },
      ],
    },
    {
      name: "Snare", midiNote: 38, stemType: "snare", color: 15,
      eqBands: [
        { freq: 120,  gain: -3,  q: 0.71, mode: 2, on: true },  // HP
        { freq: 200,  gain: 2,   q: 1.0,  mode: 5, on: true },  // Body
        { freq: 900,  gain: -1.5,q: 1.2,  mode: 5, on: true },  // Remove nasal
        { freq: 5000, gain: 3,   q: 1.4,  mode: 5, on: true },  // Crack
        { freq: 10000,gain: 1.5, q: 0.7,  mode: 7, on: true },  // Air
      ],
      compConfig: { threshold: -14, ratio: 4, attack: 5, release: 80, knee: 4, makeup: 3 },
      velocityLayers: [
        { file: drumPath("snare","soft"),   velMin: 1,   velMax: 55,  velRoot: 40 },
        { file: drumPath("snare","medium"), velMin: 56,  velMax: 100, velRoot: 80 },
        { file: drumPath("snare","hard"),   velMin: 101, velMax: 127, velRoot: 120 },
      ],
    },
    {
      name: "Hihat", midiNote: 42, stemType: "hihat", color: 57,
      eqBands: [
        { freq: 600,  gain: 0,   q: 0.71, mode: 2, on: true },  // HP 600Hz
        { freq: 3000, gain: -1,  q: 1.0,  mode: 5, on: true },  // Tame midrange
        { freq: 10000,gain: 1,   q: 0.8,  mode: 7, on: true },  // Preserve air
      ],
      compConfig: { threshold: -20, ratio: 2, attack: 2, release: 30, knee: 6, makeup: 0 },
      velocityLayers: [
        { file: drumPath("hihat","soft"),   velMin: 1,   velMax: 60,  velRoot: 40 },
        { file: drumPath("hihat","medium"), velMin: 61,  velMax: 100, velRoot: 90 },
        { file: drumPath("hihat","hard"),   velMin: 101, velMax: 127, velRoot: 120 },
      ],
    },
    {
      name: "Open Hat", midiNote: 46, stemType: "openHihat", color: 40,
      eqBands: [
        { freq: 800,  gain: 0,   q: 0.71, mode: 2, on: true },  // HP 800Hz
        { freq: 8000, gain: 1.5, q: 0.7,  mode: 7, on: true },  // Shimmer
      ],
      compConfig: { threshold: -18, ratio: 2, attack: 5, release: 200, knee: 6, makeup: 0 },
      velocityLayers: [
        { file: drumPath("openHihat","soft"),   velMin: 1,   velMax: 60,  velRoot: 40 },
        { file: drumPath("openHihat","medium"), velMin: 61,  velMax: 100, velRoot: 90 },
        { file: drumPath("openHihat","hard"),   velMin: 101, velMax: 127, velRoot: 120 },
      ],
    },
    {
      name: "Clap", midiNote: 40, stemType: "clap", color: 26,
      eqBands: [
        { freq: 200,  gain: 0,   q: 0.71, mode: 2, on: true },  // HP 200Hz
        { freq: 1000, gain: 1.5, q: 1.0,  mode: 5, on: true },  // Slap body
        { freq: 7000, gain: 2.5, q: 1.2,  mode: 5, on: true },  // Crack
      ],
      compConfig: { threshold: -16, ratio: 3, attack: 4, release: 70, knee: 4, makeup: 2 },
      velocityLayers: [
        { file: drumPath("clap","soft"),   velMin: 1,   velMax: 60,  velRoot: 40 },
        { file: drumPath("clap","medium"), velMin: 61,  velMax: 100, velRoot: 90 },
        { file: drumPath("clap","hard"),   velMin: 101, velMax: 127, velRoot: 120 },
      ],
    },
    {
      name: "Perc", midiNote: 44, stemType: "perc", color: 33,
      eqBands: [
        { freq: 300,  gain: 0,   q: 0.71, mode: 2, on: true },  // HP 300Hz
        { freq: 2500, gain: 2,   q: 1.4,  mode: 5, on: true },  // Metallic body
        { freq: 8000, gain: 1,   q: 0.8,  mode: 7, on: true },  // Top end
      ],
      compConfig: { threshold: -18, ratio: 2, attack: 3, release: 60, knee: 6, makeup: 1 },
      velocityLayers: [
        { file: drumPath("perc","soft"),   velMin: 1,   velMax: 60,  velRoot: 40 },
        { file: drumPath("perc","medium"), velMin: 61,  velMax: 100, velRoot: 90 },
        { file: drumPath("perc","hard"),   velMin: 101, velMax: 127, velRoot: 120 },
      ],
    },
  ];
}

// ─── Main ALS XML builder ─────────────────────────────────────────────────────

interface BuildAlsInput {
  projectName: string;
  bpm:         number;
  bars:        number;
  stems:       SamplepPackStem[];
  hasMix:      boolean;
  mixStem?:    SamplepPackStem;
  sections?:   ArrangementSection[];
  stemNotes?:  Record<string, number[]>;
  /** ZIP root prefix needed for drum pad sample paths */
  zipRoot:     string;
}

// MIDI root notes per melodic stem type
const STEM_ROOT_NOTES: Record<string, number> = {
  bass: 41,  // F2
  pad:  53,  // F3
  stab: 65,  // F4
  arp:  65,  // F4
};

const DRUM_STEMS = new Set(["kick", "snare", "hihat", "openHihat", "clap", "perc", "noise"]);

async function buildAlsXml(input: BuildAlsInput): Promise<Buffer> {
  trackIdCounter = 100; // start IDs at 100 to avoid collisions

  const endBeat = barsToBeatTime(input.bars);
  const trackXml: string[] = [];

  // ── Drum Group Track ──────────────────────────────────────────────────────
  // All drum stems collapse into a single DrumRack group with per-pad EQ + Compressor chains.
  const drumPads = makeDrumPads(input.zipRoot);
  trackXml.push(buildDrumGroupTrack(drumPads, endBeat));

  // ── Melodic GroupTrack (container) ─────────────────────────────────────────
  trackXml.push(buildGroupTrack("Melodic Stems", 57, []));  // teal color

  // ── Melodic MidiTracks with per-stem FX chains ────────────────────────────
  const melodicStems = input.stems.filter(s => !DRUM_STEMS.has(s.stem_type));

  // Send levels [returnA-Reverb, returnB-Delay] per stem
  const SEND_LEVELS: Record<string, [number, number]> = {
    bass: [0.00, 0.00],  // bass always dry — no reverb/delay
    pad:  [0.35, 0.15],  // pad: lots of reverb, touch of delay
    stab: [0.15, 0.20],  // stab: light reverb, rhythmic delay
    arp:  [0.10, 0.30],  // arp: slight reverb, prominent delay
  };

  // MIDI key note for Scale tool per stem
  const STEM_KEY_ROOTS: Record<string, number> = {
    bass: 0,  // C
    pad:  0,  // C
    stab: 0,  // C
    arp:  0,  // C
  };

  for (const stem of melodicStems) {
    const root  = STEM_ROOT_NOTES[stem.stem_type] ?? 60;
    const notes = input.stemNotes?.[stem.stem_type];
    const zones = notes && notes.length > 0
      ? buildZonesForMelodicStem(stem.stem_type, notes)
      : undefined;

    const [sendReverb, sendDelay] = SEND_LEVELS[stem.stem_type] ?? [0, 0];
    const keyRoot = STEM_KEY_ROOTS[stem.stem_type] ?? 0;

    // Per-stem FX chains (post-Simpler)
    let fxXml = "";
    switch (stem.stem_type) {
      case "bass":
        fxXml =
          // Soft saturation for harmonic warmth
          buildSaturator(4.0, 1, 0.7) +
          // EQ: HP below 30Hz, sub shelf boost, cut low-mid mud, gentle top-end roll
          buildEqEight([
            { freq: 30,   gain: 0,   q: 0.71, mode: 2, on: true  },  // HP – remove DC
            { freq: 60,   gain: 2.5, q: 0.6,  mode: 4, on: true  },  // Sub shelf
            { freq: 300,  gain: -2,  q: 1.2,  mode: 5, on: true  },  // Cut mud
            { freq: 1200, gain: 1.5, q: 1.4,  mode: 5, on: true  },  // Upper harmonics
            { freq: 8000, gain: -2,  q: 0.7,  mode: 1, on: true  },  // LP 8kHz roll
          ]) +
          buildGlueCompressor({ threshold: -14, ratio: 2, attack: 3, release: 0, makeup: 1 }) +
          // Utility: mono below 120Hz (keeps sub tight in club systems)
          buildUtility(0, 1.0, 120);
        break;

      case "pad":
        fxXml =
          buildEqEight([
            { freq: 80,   gain: 0,    q: 0.71, mode: 2, on: true  },  // HP 80Hz
            { freq: 500,  gain: -1,   q: 1.0,  mode: 5, on: true  },  // Clean low-mid
            { freq: 3000, gain: 1.5,  q: 0.8,  mode: 5, on: true  },  // Presence
            { freq: 12000,gain: 2,    q: 0.6,  mode: 7, on: true  },  // High shelf air
          ]) +
          buildCompressor({ threshold: -16, ratio: 2, attack: 20, release: 300, knee: 8, makeup: 1 }) +
          buildChorusEnsemble(0.35, 3, 0.45) +   // Ensemble mode, subtle width
          buildUtility(-1.5, 1.0);               // Slight gain trim for headroom
        break;

      case "stab":
        fxXml =
          buildEqEight([
            { freq: 120,  gain: 0,   q: 0.71, mode: 2, on: true  },  // HP 120Hz
            { freq: 800,  gain: 2,   q: 1.6,  mode: 5, on: true  },  // Mid bite
            { freq: 4000, gain: 1.5, q: 1.2,  mode: 5, on: true  },  // Top-end brightness
            { freq: 16000,gain: -1.5,q: 0.7,  mode: 7, on: true  },  // Tame harshness
          ]) +
          buildSaturator(6.0, 1, 0.6) +  // Analog saturation for grit
          buildCompressor({ threshold: -10, ratio: 4, attack: 2, release: 50, knee: 3, makeup: 2 }) +
          buildUtility(0, 0.9);          // Slight narrow — keeps it punchy in mix
        break;

      case "arp":
        fxXml =
          buildEqEight([
            { freq: 100,  gain: 0,   q: 0.71, mode: 2, on: true  },  // HP 100Hz
            { freq: 600,  gain: -1.5,q: 1.0,  mode: 5, on: true  },  // Clean low-mid
            { freq: 2500, gain: 2,   q: 1.2,  mode: 5, on: true  },  // Sparkle
            { freq: 10000,gain: 1.5, q: 0.8,  mode: 7, on: true  },  // Air
          ]) +
          buildCompressor({ threshold: -12, ratio: 3, attack: 5, release: 80, knee: 4, makeup: 1 }) +
          buildUtility(0, 1.0);
        break;

      default:
        fxXml = buildEqEight([
          { freq: 80,  gain: 0, q: 0.71, mode: 2, on: true },
          { freq: 200, gain: 0, q: 0.71, mode: 5, on: false },
        ]);
    }

    // Add Simpler+Rack track with Scale MIDI effect
    trackXml.push(buildMidiTrackFull(
      stem, endBeat, root, zones, fxXml,
      { volume: 1.0, sendAmounts: [sendReverb, sendDelay] },
      keyRoot,  // MIDI key for Scale tool
      true,     // include Scale MIDI effect
    ));

    // Add Wavetable alt-layer synth for same stem (optional performance layer)
    if (stem.stem_type !== "arp") {  // Arp gets Arpeggiator instead
      trackXml.push(buildWavetableMidiTrack(
        stem.stem_type.charAt(0).toUpperCase() + stem.stem_type.slice(1),
        root, endBeat, TRACK_COLORS[stem.stem_type] ?? 40,
        buildScaleMidiEffect(keyRoot, 0, true),  // Scale effect on Wavetable too
        { volume: 0.7, sendAmounts: [sendReverb * 0.8, sendDelay * 0.8] },
      ));
    } else {
      // Arp gets Arpeggiator MIDI effect instead of Scale
      trackXml.push(buildWavetableMidiTrack(
        "Arp",
        root, endBeat, TRACK_COLORS["arp"] ?? 40,
        buildArpeggiatorMidiEffect(0, 3, 1, true),  // Up mode, 1/8 beat, 1 octave
        { volume: 0.7, sendAmounts: [0.10 * 0.8, 0.30 * 0.8] },
      ));
    }
  }

  // ── Master Mix AudioTrack ─────────────────────────────────────────────────
  if (input.hasMix && input.mixStem) {
    const mixFx =
      buildEqEight([
        { freq: 30,   gain: 0,  q: 0.71, mode: 2, on: true },  // HP
        { freq: 8000, gain: 1,  q: 0.5,  mode: 7, on: true },  // Air shelf
      ]) +
      buildGlueCompressor({ threshold: -10, ratio: 0, attack: 2, release: 0, makeup: 0.5, dryWet: 0.5 }) +
      buildLimiter(-0.5, 1.0);

    trackXml.push(buildAudioTrackFull(input.mixStem, endBeat, true, mixFx, {
      volume: 0.85,
      sendAmounts: [0, 0],
    }));
  }

  // ── Return Tracks GroupTrack (container) ───────────────────────────────────
  trackXml.push(buildGroupTrack("FX Returns", 64, []));  // white color

  // ── Return Track A — Reverb ───────────────────────────────────────────────
  const returnA = buildReturnTrack(0, "A — Reverb", 49,   // teal
    buildEqEight([
      { freq: 120,  gain: 0,  q: 0.71, mode: 2, on: true },  // HP pre-reverb
      { freq: 8000, gain: -1, q: 0.7,  mode: 1, on: true },  // LP pre-reverb
    ]) +
    buildReverb({
      roomSize:    0.75,
      decaySec:    2.4,
      diffusion:   0.90,
      preDelaySec: 0.015,
      wetLevel:    1.0,
      dryLevel:    0.0,
      hpFreq:      120,
      lpFreq:      8000,
    })
  );

  // ── Return Track B — Delay ────────────────────────────────────────────────
  const returnB = buildReturnTrack(1, "B — Delay", 57,  // steel blue
    buildEqEight([
      { freq: 200,  gain: 0,  q: 0.71, mode: 2, on: true },  // HP pre-delay
      { freq: 8000, gain: 0,  q: 0.71, mode: 1, on: true },  // LP pre-delay
    ]) +
    buildDelay({
      beatLeft:  3,   // 1/8
      beatRight: 6,   // 3/8 (dotted quarter)
      feedback:  0.30,
      filterOn:  true,
      hpFreq:    200,
      lpFreq:    8000,
      wet:       0.85,
    })
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="11" MinorVersion="11.3.21.0" SchemaChangeCount="3" Creator="DARKSCO AI Bridge — ableton-ai-control-bridge" Revision="">
  <LiveSet>
    <NextPointeeId Value="${trackIdCounter + 500}" />
    <OverwriteProtectionNumber Value="2819" />
    <LomId Value="0" />
    <Tracks>
      ${trackXml.join("\n")}
    </Tracks>
    <ReturnTracks>
      ${returnA}
      ${returnB}
    </ReturnTracks>
    <Transport>
      <PhaseNudgeTempo Value="10" />
      <LoopOn Value="false" />
      <LoopStart Value="0" />
      <LoopLength Value="${endBeat}" />
      <LoopIsSongStart Value="true" />
      <CurrentTime Value="0" />
      <PunchIn Value="false" />
      <PunchOut Value="false" />
      <DrawMode Value="false" />
      <MetronomeTickDuration Value="0" />
      <DefaultInputMonitoringState Value="0" />
      <TapTempoCount Value="0" />
    </Transport>
    <SongMasterValues>
      <ScrollerTimePreserver />
      <AutoScrollIsEnabled Value="true" />
      <BackgroundColor Value="0" />
      <GlobalQuantisation Value="4" />
      <AutoQuantisation Value="0" />
      <Grid>
        <FixedNumerator Value="1" />
        <FixedDenominator Value="16" />
        <GridIntervalPixel Value="20" />
        <Ntoles Value="2" />
        <SnapToGrid Value="true" />
        <Fixed Value="false" />
      </Grid>
      <ScaleInformation>
        <RootNote Value="0" />
        <Name Value="Major" />
      </ScaleInformation>
      <InKey Value="false" />
      <SmpteFormat Value="0" />
      <TimeSelection>
        <AnchorTime Value="0" />
        <OtherTime Value="1" />
      </TimeSelection>
      <Signature>
        <Numerator Value="4" />
        <Denominator Value="4" />
      </Signature>
      <TimeSignatures>
        <AutomationEvent Id="0" Time="0">
          <AutomationEvent />
          <TimeSignature>
            <Numerator Value="4" />
            <Denominator Value="4" />
          </TimeSignature>
        </AutomationEvent>
      </TimeSignatures>
      <Tempo>
        <LomId Value="0" />
        <Manual Value="${input.bpm}" />
        <MidiControllerRange>
          <Min Value="60" />
          <Max Value="200" />
        </MidiControllerRange>
        <AutomationTarget Id="${nextId()}" />
        <ModulationTarget Id="${nextId()}" />
      </Tempo>
      <TimeSignature>
        <TimeSignatures>
          <AutomationEvent Id="0" Time="0">
            <TimeSignature>
              <Numerator Value="4" />
              <Denominator Value="4" />
            </TimeSignature>
          </AutomationEvent>
        </TimeSignatures>
      </TimeSignature>
    </SongMasterValues>
    <GlobalGrooveAmount Value="0" />
    <DateOfLastChange Value="${Math.floor(Date.now() / 1000)}" />
    <ContentLanes>
      <ContentLanes />
    </ContentLanes>
    ${buildScenesList(input.sections ?? [], input.bpm)}
    ${buildMasterTrackFull(input.bpm, input.projectName)}
  </LiveSet>
</Ableton>`;

  const xmlBuf = Buffer.from(xml, "utf8");
  return gzipBuffer(xmlBuf);
}

// ─── Public: build full pack ──────────────────────────────────────────────────

export interface AbletonPackInput {
  variant:  string;
  bpm:      number;
  bars:     number;
  key:      string;
  pipeline: FullPipelineResponse;
  /** Arrangement sections for Ableton Scene generation. Falls back to pipeline.structure.sections. */
  sections?: ArrangementSection[];
}

export interface AbletonPackResult {
  zipBuffer: Buffer;
  projectName: string;
  filename: string;
  sizeBytes: number;
  contents: string[];
}

export async function buildAbletonPack(input: AbletonPackInput): Promise<AbletonPackResult> {
  const { variant, bpm, bars, key, pipeline } = input;
  const projectName = `DARKSCO_${variant.charAt(0).toUpperCase() + variant.slice(1)}_${bpm}bpm`;
  const root = `${projectName}/`;

  const entries: ZipEntry[] = [];

  // ── Helper: fetch binary from signed URL or decode from b64 ─────────────────
  async function resolveBuffer(b64: string, url: string): Promise<Buffer> {
    if (b64) return Buffer.from(b64, "base64");
    if (url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch from Storage: ${url} (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    }
    throw new Error("No b64 data or storage URL available for file");
  }

  // ── 1. WAV stems ────────────────────────────────────────────────────────────
  const stemForMix: SamplepPackStem = {
    name:        "master_mix",
    stem_type:   "mix",
    wav_b64:     pipeline.final_wav.wav_b64,
    wav_url:     pipeline.final_wav.wav_url  ?? "",
    wav_path:    pipeline.final_wav.wav_path ?? "",
    sampleRate:  48000,
    bitDepth:    24,
    durationSec: pipeline.final_wav.durationSec,
    sizeBytes:   pipeline.final_wav.sizeBytes,
  };

  for (const stem of pipeline.samplepack.stems) {
    const data = await resolveBuffer(stem.wav_b64, stem.wav_url);
    entries.push({ path: `${root}Samples/Originals/${stem.stem_type}.wav`, data });
  }
  entries.push({
    path: `${root}Samples/Originals/master_mix.wav`,
    data: await resolveBuffer(pipeline.final_wav.wav_b64, pipeline.final_wav.wav_url ?? ""),
  });

  // ── 2. MIDI files ───────────────────────────────────────────────────────────
  for (const midi of pipeline.midis) {
    const data = await resolveBuffer(midi.midi_b64, midi.midi_url);
    entries.push({ path: `${root}MIDI Clips/${midi.filename}`, data });
  }

  // ── 2b. Per-note one-shot samples (Instruments folder for Simpler zones) ─────
  // Each melodic stem gets N samples named {stem}_{note}_med.wav under
  // Samples/Instruments/{stem}/.  Drum stems get 3 velocity layers under
  // Samples/Drums/{stem}/.
  // These are what the multi-zone Simpler zones point to in the .als file.
  let totalOneShotBytes = 0;
  const oneShotLog: string[] = [];

  for (const group of (pipeline.samplepack.sample_groups ?? [])) {
    for (const hit of group.samples) {
      const wavBuf = Buffer.from(hit.wav_b64, "base64");
      let filePath: string;

      if (group.category === "drum") {
        // e.g. Samples/Drums/kick/kick_hard.wav
        filePath = `${root}Samples/Drums/${group.stem}/${hit.name}.wav`;
      } else {
        // e.g. Samples/Instruments/bass/bass_C2_med.wav
        const notePart = hit.note_name.replace("#", "s"); // C# → Cs (filesystem safe)
        filePath = `${root}Samples/Instruments/${group.stem}/${group.stem}_${notePart}_med.wav`;
      }

      entries.push({ path: filePath, data: wavBuf });
      totalOneShotBytes += wavBuf.length;
    }
    oneShotLog.push(
      `  ${group.stem}: ${group.samples.length} samples (${group.category === "drum" ? "3 velocity layers" : group.samples.length + " notes"})`
    );
  }

  // ── 3. Max for Live device ──────────────────────────────────────────────────
  const noteNames = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const noteName = (n: number) => `${noteNames[n % 12]}${Math.floor(n / 12) - 1}`;

  const m4lDevice = buildAmxdDevice({
    projectName,
    variant,
    bpm,
    key,
    bars,
    stems: pipeline.midis.map((m) => ({
      name: m.stem,
      channel: m.channel,
      noteMin: m.channel === 10 ? 36 : 36,
      noteMax: m.channel === 10 ? 51 : 84,
      noteCount: m.notes_count,
      description: m.description,
    })),
  });
  entries.push({ path: `${root}Max for Live Devices/DARKSCO_Sampler.amxd`, data: m4lDevice });

  // ── 4. ALS file ─────────────────────────────────────────────────────────────
  // Sections: prefer explicit input, fall back to pipeline structure
  const arrangementSections = (input.sections ?? pipeline.structure?.sections ?? []) as ArrangementSection[];

  // Build per-stem MIDI note lists from sample_groups (for multi-zone Simpler)
  const stemNotes: Record<string, number[]> = {};
  for (const group of (pipeline.samplepack.sample_groups ?? [])) {
    if (group.category === "melodic") {
      const uniqueNotes = [...new Set(group.samples.map((s) => s.midi_note))].sort((a, b) => a - b);
      stemNotes[group.stem] = uniqueNotes;
    }
  }

  const alsBuffer = await buildAlsXml({
    projectName,
    bpm,
    bars,
    stems:    pipeline.samplepack.stems,
    hasMix:   true,
    mixStem:  stemForMix,
    sections: arrangementSections,
    stemNotes,
    zipRoot:  root,
  });
  entries.push({ path: `${root}${projectName}.als`, data: alsBuffer });

  // ── 5. README ───────────────────────────────────────────────────────────────
  const readme = [
    `DARKSCO Live Pack — ${projectName}`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `CONTENTS`,
    `--------`,
    `${projectName}.als`,
    `  Ableton Live 11/12 project file. Drag onto Ableton Live to open directly.`,
    `  READY FOR LIVE PLAY — all tracks have native instrument + FX chains pre-loaded.`,
    ``,
    `  TRACK LAYOUT`,
    `  ─────────────────────────────────────────────────────────────────────────────`,
    `  [GroupTrack]  Drums  — DrumRack (6 pads) → Drum Bus EQ → Glue Compressor → Limiter`,
    `    [DrumBranch] Kick   C1  — Simpler (3 vel layers) → EQ Eight → Compressor`,
    `    [DrumBranch] Snare  D1  — Simpler (3 vel layers) → EQ Eight → Compressor`,
    `    [DrumBranch] Hihat  F#1 — Simpler (3 vel layers) → EQ Eight → Compressor`,
    `    [DrumBranch] OpenHat A#1 — Simpler (3 vel layers) → EQ Eight → Compressor`,
    `    [DrumBranch] Clap   E1  — Simpler (3 vel layers) → EQ Eight → Compressor`,
    `    [DrumBranch] Perc   G#1 — Simpler (3 vel layers) → EQ Eight → Compressor`,
    `  [MidiTrack]   Bass   — Simpler (12 zones) → Saturator → EQ Eight → Glue Comp → Utility (mono <120Hz)`,
    `  [MidiTrack]   Pad    — Simpler (10 zones) → EQ Eight → Compressor → Chorus-Ensemble → Utility`,
    `  [MidiTrack]   Stab   — Simpler (10 zones) → EQ Eight → Saturator → Compressor → Utility`,
    `  [MidiTrack]   Arp    — Simpler (10 zones) → EQ Eight → Compressor → Utility`,
    `  [AudioTrack]  Master Mix — WAV clip → EQ Eight → Glue Compressor → Limiter`,
    `  [ReturnTrack] A — Reverb — EQ Eight (HP+LP) → Reverb (2.4s decay, Size 75)`,
    `  [ReturnTrack] B — Delay  — EQ Eight (HP+LP) → Delay (1/8L + 3/8R, 30% FB)`,
    `  [MasterTrack] Master — EQ Eight → Glue Compressor → Limiter (-0.3dBTP)`,
    ``,
    `  SEND AMOUNTS (pre-baked)`,
    `  Bass:  Reverb 0%,  Delay 0%  (bass stays dry)`,
    `  Pad:   Reverb 35%, Delay 15%`,
    `  Stab:  Reverb 15%, Delay 20%`,
    `  Arp:   Reverb 10%, Delay 30%`,
    ``,
    `  ${arrangementSections.length} Scenes: ${arrangementSections.map(s => s.name).join(", ")}`,
    ``,
    `Samples/Originals/           — ${pipeline.samplepack.stems.length + 1} full-length WAV stems (48kHz / 24-bit)`,
    ...pipeline.samplepack.stems.map((s) => `  ${s.stem_type}.wav  (${s.durationSec.toFixed(2)}s)`),
    `  master_mix.wav  (${pipeline.final_wav.durationSec.toFixed(2)}s — stereo master)`,
    ``,
    `Samples/Instruments/         — Multi-zone Simpler one-shot samples (melodic stems)`,
    `  Loaded automatically by Simpler in each MidiTrack.`,
    `  Play across the full MIDI keyboard range.`,
    ...oneShotLog.filter((_, i) => {
      const g = pipeline.samplepack.sample_groups?.[i];
      return g?.category === "melodic";
    }),
    ``,
    `Samples/Drums/               — Velocity-layered drum one-shot samples`,
    `  3 layers per drum: soft (vel 50), medium (vel 90), hard (vel 120).`,
    ...oneShotLog.filter((_, i) => {
      const g = pipeline.samplepack.sample_groups?.[i];
      return g?.category === "drum";
    }),
    ``,
    `MIDI Clips/                  — ${pipeline.midis.length} MIDI files (Format 0 / 480 PPQ)`,
    ...pipeline.midis.map((m) => `  ${m.filename}  (${m.notes_count} notes, Ch ${m.channel})`),
    ``,
    `Max for Live Devices/        — DARKSCO_Sampler.amxd`,
    `  Open in Ableton Live with Max for Live installed.`,
    `  Shows stem/channel/note mapping. MIDI router device.`,
    ``,
    `ARRANGEMENT SECTIONS`,
    `--------------------`,
    ...arrangementSections.map((s) =>
      `  ${s.name.padEnd(12)} ${s.duration_bars} bars  [${s.dynamics.padEnd(8)}]  ${s.elements.join(", ")}`
    ),
    ``,
    `PRODUCTION INFO`,
    `---------------`,
    `Variant:    ${variant}`,
    `BPM:        ${bpm}`,
    `Key:        ${key}`,
    `Bars:       ${bars}`,
    `LUFS:       ${pipeline.final_wav.lufs} LUFS integrated`,
    `True Peak:  ${pipeline.final_wav.truePeak} dBTP`,
    `One-shots:  ${Math.round(totalOneShotBytes / 1024)} KB across all sample zones`,
    ``,
    `SIMPLER ZONES`,
    `-------------`,
    `Bass:  12 zones  C2–G5 (minor/major 3rd spacing) — 3 detuned saws + sub sine`,
    `Pad:   10 zones  C3–A4 (root zones) — 6-voice supersaw + LFO filter + reverb`,
    `Stab:  10 zones  C3–A4 — square+saw + saturated HP/LP band + tight ADSR`,
    `Arp:   10 zones  C3–A4 — saw+triangle + delay echo + resonant LP`,
    ``,
    `Generated by DARKSCO AI Bridge — ableton-ai-control-bridge`,
    `https://github.com/traviscomber/ableton-ai-control-bridge`,
  ].join("\n");

  entries.push({ path: `${root}README.txt`, data: Buffer.from(readme, "utf8") });

  // ── Build ZIP ────────────────────────────────────────────────────────────────
  const zipBuffer = buildZip(entries);

  const contents = entries.map((e) => e.path.replace(root, ""));

  return {
    zipBuffer,
    projectName,
    filename: `${projectName}.zip`,
    sizeBytes: zipBuffer.length,
    contents,
  };
}
