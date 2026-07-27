/**
 * Standard MIDI File encoder — Format 0 (single track)
 * Pure TypeScript, zero external dependencies.
 * Produces a valid .mid file as a Node.js Buffer.
 *
 * Spec: https://www.midi.org/specifications-old/item/standard-midi-files-smf
 */

export const TICKS_PER_BEAT = 480; // Standard PPQ resolution

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MidiNote {
  /** MIDI channel 0-15 (channel 9 = GM drums) */
  channel: number;
  /** MIDI pitch 0-127 */
  pitch: number;
  /** Velocity 1-127 */
  velocity: number;
  /** Absolute start position in ticks */
  startTick: number;
  /** Note duration in ticks */
  durationTicks: number;
}

export interface MidiEncodeOptions {
  bpm: number;
  trackName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function writeUInt32BE(val: number): number[] {
  return [
    (val >>> 24) & 0xff,
    (val >>> 16) & 0xff,
    (val >>> 8) & 0xff,
    val & 0xff,
  ];
}

function writeUInt16BE(val: number): number[] {
  return [(val >>> 8) & 0xff, val & 0xff];
}

/** MIDI variable-length quantity encoding */
function writeVarLen(val: number): number[] {
  if (val < 0) val = 0;
  const bytes: number[] = [];
  bytes.unshift(val & 0x7f);
  val >>>= 7;
  while (val > 0) {
    bytes.unshift((val & 0x7f) | 0x80);
    val >>>= 7;
  }
  return bytes;
}

/** Convert beat positions (float) to integer ticks */
export function beatsToTicks(beats: number): number {
  return Math.round(beats * TICKS_PER_BEAT);
}

/** Convert 16th-note grid position (0-15) to absolute ticks within a bar */
export function sixteenthToTicks(pos: number): number {
  return Math.round((pos / 16) * 4 * TICKS_PER_BEAT); // 4 beats per bar
}

// ─── Encoder ─────────────────────────────────────────────────────────────────

/**
 * Encode a list of MIDI notes into a Format 0 MIDI file buffer.
 * Returns a Buffer ready to write to disk or base64-encode.
 */
export function encodeMidiFile(notes: MidiNote[], opts: MidiEncodeOptions): Buffer {
  const { bpm, trackName } = opts;
  const microsecondsPerBeat = Math.round(60_000_000 / bpm);

  // ── Build event list ────────────────────────────────────────────────
  type TickEvent = { tick: number; data: number[] };
  const events: TickEvent[] = [];

  // Tempo event at tick 0
  events.push({
    tick: 0,
    data: [
      0xff, 0x51, 0x03,
      (microsecondsPerBeat >>> 16) & 0xff,
      (microsecondsPerBeat >>> 8) & 0xff,
      microsecondsPerBeat & 0xff,
    ],
  });

  // Optional track name meta event
  if (trackName) {
    const nameBytes = Array.from(trackName, (c) => c.charCodeAt(0) & 0x7f);
    events.push({
      tick: 0,
      data: [0xff, 0x03, ...writeVarLen(nameBytes.length), ...nameBytes],
    });
  }

  // Note on + note off pairs
  for (const note of notes) {
    const ch = note.channel & 0x0f;
    const pitch = Math.max(0, Math.min(127, note.pitch));
    const vel = Math.max(1, Math.min(127, note.velocity));
    const offTick = note.startTick + Math.max(1, note.durationTicks);

    events.push({ tick: note.startTick, data: [0x90 | ch, pitch, vel] });
    events.push({ tick: offTick, data: [0x80 | ch, pitch, 0] });
  }

  // End of track
  const endTick =
    notes.length > 0
      ? Math.max(...notes.map((n) => n.startTick + n.durationTicks)) + TICKS_PER_BEAT
      : TICKS_PER_BEAT * 4;
  events.push({ tick: endTick, data: [0xff, 0x2f, 0x00] });

  // ── Sort by tick, then note-off before note-on at same tick ─────────
  events.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    // Note off (0x8x) before note on (0x9x) at same tick
    const aOff = (a.data[0] & 0xf0) === 0x80 ? 0 : 1;
    const bOff = (b.data[0] & 0xf0) === 0x80 ? 0 : 1;
    return aOff - bOff;
  });

  // ── Convert to delta-time track bytes ───────────────────────────────
  const trackBytes: number[] = [];
  let prevTick = 0;
  for (const ev of events) {
    const delta = Math.max(0, ev.tick - prevTick);
    prevTick = ev.tick;
    trackBytes.push(...writeVarLen(delta), ...ev.data);
  }

  // ── Assemble file ───────────────────────────────────────────────────
  const header: number[] = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    ...writeUInt32BE(6),      // header chunk length = 6
    ...writeUInt16BE(0),      // format 0 (single track)
    ...writeUInt16BE(1),      // 1 track
    ...writeUInt16BE(TICKS_PER_BEAT),
  ];

  const mtrk: number[] = [
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    ...writeUInt32BE(trackBytes.length),
    ...trackBytes,
  ];

  return Buffer.from([...header, ...mtrk]);
}
