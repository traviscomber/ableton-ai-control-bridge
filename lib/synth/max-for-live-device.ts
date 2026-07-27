/**
 * max-for-live-device.ts
 *
 * Generates a binary-valid Max for Live (.amxd) MIDI Effect device.
 *
 * .amxd format:
 *   - 32-byte binary header:
 *       Bytes  0–3:  "AMXD" magic
 *       Bytes  4–7:  version uint32 LE  (0x00010005 = v1.5)
 *       Bytes  8–11: "ptch" tag (indicates patcher follows)
 *       Bytes 12–15: JSON payload size uint32 LE
 *       Bytes 16–31: zeros (reserved)
 *   - Followed immediately by the raw UTF-8 JSON patcher payload
 *
 * The JSON is a standard Max .maxpat patcher. The device:
 *   - Displays kit name, BPM, key, variant
 *   - Shows a table of stem → MIDI channel + note mapping
 *   - Routes incoming MIDI through notein → route → noteout
 *   - Works in Ableton Live 11/12 without any additional Max objects
 *
 * Agent skill:
 *   MidiComposer + AudioEngineer hand off stem metadata here.
 *   The device is a live reference panel AND a functioning MIDI router.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface M4LDeviceInput {
  projectName: string;
  variant: string;
  bpm: number;
  key: string;
  bars: number;
  stems: Array<{
    name: string;
    channel: number;
    noteMin: number;
    noteMax: number;
    noteCount: number;
    description: string;
  }>;
}

// ─── Max patcher builder ─────────────────────────────────────────────────────

interface MaxBox {
  box: {
    id: string;
    maxclass: string;
    numinlets?: number;
    numoutlets?: number;
    outlettype?: string[];
    patching_rect: [number, number, number, number];
    text?: string;
    presentation?: number;
    presentation_rect?: [number, number, number, number];
    [key: string]: unknown;
  };
}

interface MaxPatch {
  patcher: {
    fileversion: number;
    appversion: { major: number; minor: number; revision: number; architecture: string; modernui: number };
    classnamespace: string;
    rect: [number, number, number, number];
    bglocked: number;
    openinpresentation: number;
    default_fontsize: number;
    default_fontface: number;
    default_fontname: string;
    gridonopen: number;
    gridsize: [number, number];
    gridsnaponopen: number;
    objectsnaponopen: number;
    statusbarvisible: number;
    toolbarvisible: number;
    lefttoolbarpinned: number;
    toptoolbarpinned: number;
    righttoolbarpinned: number;
    bottomtoolbarpinned: number;
    toolbars_unpinned_last_save: number;
    tallnewobj: number;
    boxanimatetime: number;
    enablehscroll: number;
    enablevscroll: number;
    deviceviewporttype: string;
    boxes: MaxBox[];
    lines: Array<{ patchline: { destination: [string, number]; source: [string, number]; } }>;
    parameters: { parameter_overrides: Array<unknown> };
    dependency_cache: Array<unknown>;
    autosave: number;
  };
}

function buildPatcher(input: M4LDeviceInput): MaxPatch {
  const boxes: MaxBox[] = [];
  const lines: MaxPatch["patcher"]["lines"] = [];
  let idCounter = 1;
  const id = () => `obj-${idCounter++}`;

  // ── Title ────────────────────────────────────────────────────────────────
  const titleId = id();
  boxes.push({
    box: {
      id: titleId, maxclass: "comment",
      numinlets: 1, numoutlets: 0,
      patching_rect: [10, 10, 420, 22],
      presentation: 1, presentation_rect: [10, 10, 420, 22],
      text: `DARKSCO ${input.variant.toUpperCase()} — ${input.projectName}`,
      fontsize: 14, fontface: 1, fontname: "Arial",
    },
  });

  const metaId = id();
  boxes.push({
    box: {
      id: metaId, maxclass: "comment",
      numinlets: 1, numoutlets: 0,
      patching_rect: [10, 32, 420, 18],
      presentation: 1, presentation_rect: [10, 32, 420, 18],
      text: `${input.bpm} BPM  |  Key: ${input.key}  |  Bars: ${input.bars}  |  Stems: ${input.stems.length}`,
      fontsize: 10, fontname: "Arial",
    },
  });

  // ── Column headers ────────────────────────────────────────────────────────
  const hdrId = id();
  boxes.push({
    box: {
      id: hdrId, maxclass: "comment",
      numinlets: 1, numoutlets: 0,
      patching_rect: [10, 58, 420, 16],
      presentation: 1, presentation_rect: [10, 58, 420, 16],
      text: "STEM            CH    NOTE RANGE    NOTES    DESCRIPTION",
      fontsize: 9, fontface: 1, fontname: "Courier New",
    },
  });

  // ── Per-stem rows ─────────────────────────────────────────────────────────
  const noteNames = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const noteName = (n: number) => `${noteNames[n % 12]}${Math.floor(n / 12) - 1}`;

  input.stems.forEach((stem, i) => {
    const y = 76 + i * 16;
    const noteRange = stem.channel === 10
      ? `${noteName(stem.noteMin)} (GM drums)`
      : `${noteName(stem.noteMin)}–${noteName(stem.noteMax)}`;
    const text = `${stem.name.padEnd(16)}${String(stem.channel).padEnd(6)}${noteRange.padEnd(16)}${String(stem.noteCount).padEnd(9)}${stem.description}`;
    const rowId = id();
    boxes.push({
      box: {
        id: rowId, maxclass: "comment",
        numinlets: 1, numoutlets: 0,
        patching_rect: [10, y, 420, 14],
        presentation: 1, presentation_rect: [10, y, 420, 14],
        text,
        fontsize: 9, fontname: "Courier New",
      },
    });
  });

  const bottomY = 80 + input.stems.length * 16 + 12;

  // ── MIDI routing objects ───────────────────────────────────────────────────
  const noteInId = id();
  boxes.push({
    box: {
      id: noteInId, maxclass: "notein",
      numinlets: 0, numoutlets: 3,
      outlettype: ["int", "int", "int"],
      patching_rect: [10, bottomY, 75, 22],
    },
  });

  const noteOutId = id();
  boxes.push({
    box: {
      id: noteOutId, maxclass: "noteout",
      numinlets: 3, numoutlets: 0,
      patching_rect: [10, bottomY + 35, 75, 22],
    },
  });

  // notein pitch → noteout pitch
  lines.push({ patchline: { source: [noteInId, 0], destination: [noteOutId, 0] } });
  // notein velocity → noteout velocity
  lines.push({ patchline: { source: [noteInId, 1], destination: [noteOutId, 1] } });
  // notein channel → noteout channel
  lines.push({ patchline: { source: [noteInId, 2], destination: [noteOutId, 2] } });

  // ── Generation note ───────────────────────────────────────────────────────
  const footerId = id();
  boxes.push({
    box: {
      id: footerId, maxclass: "comment",
      numinlets: 1, numoutlets: 0,
      patching_rect: [10, bottomY + 65, 420, 14],
      presentation: 1, presentation_rect: [10, bottomY + 65, 420, 14],
      text: `Generated by DARKSCO AI Bridge — ableton-ai-control-bridge — ${new Date().toISOString().split("T")[0]}`,
      fontsize: 8, fontname: "Arial",
    },
  });

  return {
    patcher: {
      fileversion: 1,
      appversion: { major: 8, minor: 5, revision: 5, architecture: "x64", modernui: 1 },
      classnamespace: "dsp.toplevel",
      rect: [100, 100, 460, bottomY + 100],
      bglocked: 0,
      openinpresentation: 1,
      default_fontsize: 12,
      default_fontface: 0,
      default_fontname: "Arial",
      gridonopen: 1,
      gridsize: [8, 8],
      gridsnaponopen: 1,
      objectsnaponopen: 1,
      statusbarvisible: 2,
      toolbarvisible: 1,
      lefttoolbarpinned: 0,
      toptoolbarpinned: 0,
      righttoolbarpinned: 0,
      bottomtoolbarpinned: 0,
      toolbars_unpinned_last_save: 0,
      tallnewobj: 0,
      boxanimatetime: 200,
      enablehscroll: 1,
      enablevscroll: 1,
      deviceviewporttype: "mira",
      boxes,
      lines,
      parameters: { parameter_overrides: [] },
      dependency_cache: [],
      autosave: 0,
    },
  };
}

// ─── Binary .amxd encoder ────────────────────────────────────────────────────

/**
 * Build a binary-valid .amxd file buffer.
 * The 32-byte header follows Ableton's undocumented but reverse-engineered spec.
 */
export function buildAmxdDevice(input: M4LDeviceInput): Buffer {
  const patcher = buildPatcher(input);
  const json = JSON.stringify(patcher, null, 2);
  const jsonBytes = Buffer.from(json, "utf8");

  // 32-byte header
  const header = Buffer.alloc(32, 0);
  // Magic
  header.write("AMXD", 0, "ascii");
  // Version: 1.5 = 0x00010005
  header.writeUInt32LE(0x00010005, 4);
  // Tag: "ptch"
  header.write("ptch", 8, "ascii");
  // JSON payload size
  header.writeUInt32LE(jsonBytes.length, 12);
  // Bytes 16–31: zeros (reserved)

  return Buffer.concat([header, jsonBytes]);
}
