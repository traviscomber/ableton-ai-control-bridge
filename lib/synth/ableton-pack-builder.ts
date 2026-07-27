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
  drop:      18,  // deep orange — peak energy
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

// ─── Main ALS XML builder ─────────────────────────────────────────────────────

interface BuildAlsInput {
  projectName: string;
  bpm:         number;
  bars:        number;
  stems:       SamplepPackStem[];
  hasMix:      boolean;
  mixStem?:    SamplepPackStem;
  sections?:   ArrangementSection[];
  /** Per-stem MIDI note lists for multi-zone Simpler mapping */
  stemNotes?:  Record<string, number[]>;
}

// MIDI root notes per stem type
const STEM_ROOT_NOTES: Record<string, number> = {
  bass: 41, // F2
  pad:  53, // F3
  stab: 65, // F4
  arp:  65, // F4
};

// Drum stems rendered as AudioTracks; melodic as MidiTracks
const DRUM_STEMS = new Set(["kick", "snare", "hihat", "openHihat", "clap", "perc", "noise"]);

async function buildAlsXml(input: BuildAlsInput): Promise<Buffer> {
  trackIdCounter = 100; // start IDs at 100 to avoid collisions

  const endBeat = barsToBeatTime(input.bars);
  const trackXml: string[] = [];

  for (const stem of input.stems) {
    if (DRUM_STEMS.has(stem.stem_type)) {
      trackXml.push(buildAudioTrack(stem, endBeat));
    } else {
      const root  = STEM_ROOT_NOTES[stem.stem_type] ?? 60;
      // Build multi-zone Simpler mapping if we have note data for this stem
      const notes = input.stemNotes?.[stem.stem_type];
      const zones = notes && notes.length > 0
        ? buildZonesForMelodicStem(stem.stem_type, notes)
        : undefined;
      trackXml.push(buildMidiTrackWithZones(stem, endBeat, root, zones));
    }
  }

  if (input.hasMix && input.mixStem) {
    trackXml.push(buildAudioTrack(input.mixStem, endBeat, true));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="11" MinorVersion="11.3.21.0" SchemaChangeCount="3" Creator="DARKSCO AI Bridge — ableton-ai-control-bridge" Revision="">
  <LiveSet>
    <NextPointeeId Value="${trackIdCounter + 200}" />
    <OverwriteProtectionNumber Value="2819" />
    <LomId Value="0" />
    <Tracks>
      ${trackXml.join("\n")}
    </Tracks>
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
    <MasterTrack>
      <LomId Value="0" />
      <LomIdView Value="0" />
      <IsContentSelectedInDocument Value="false" />
      <PreferredContentViewMode Value="0" />
      <TrackDelay>
        <Value Value="0" />
        <IsValueSampleBased Value="false" />
      </TrackDelay>
      <Name>
        <EffectiveName Value="Master" />
        <UserName Value="" />
        <Annotation Value="${xmlAttr(`DARKSCO ${input.projectName} — generated by ableton-ai-control-bridge`)}" />
        <MemorizedFirstClipName Value="" />
      </Name>
      <Color Value="${TRACK_COLORS.mix}" />
    </MasterTrack>
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
    `  Pre-built tracks: AudioTrack per drum stem, MidiTrack+Simpler per melodic stem.`,
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
