/**
 * zip-builder.ts
 *
 * Pure-TypeScript minimal ZIP encoder. Zero external dependencies.
 * Implements the PKZIP format (PKWARE Application Note §V):
 *   Local file headers   PK\x03\x04
 *   Central directory    PK\x01\x02
 *   End-of-central-dir  PK\x05\x06
 *
 * Files are stored UNCOMPRESSED (method = 0) — fast, and Ableton
 * Live handles its own internal compression / gzip on .als files.
 * CRC-32 is computed per file using the standard IEEE polynomial.
 */

// ─── CRC-32 table ─────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── Writer helper ─────────────────────────────────────────────────────────────

class BufWriter {
  private chunks: Uint8Array[] = [];
  private _offset = 0;

  get offset() { return this._offset; }

  write(data: Uint8Array | Buffer) {
    const u8 = data instanceof Buffer ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : data;
    this.chunks.push(u8);
    this._offset += u8.length;
  }

  writeU8(v: number) {
    const b = new Uint8Array(1);
    b[0] = v & 0xff;
    this.write(b);
  }

  writeU16LE(v: number) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, v, true);
    this.write(b);
  }

  writeU32LE(v: number) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v >>> 0, true);
    this.write(b);
  }

  writeStr(s: string) {
    const b = Buffer.from(s, "utf8");
    this.write(b);
  }

  finalize(): Buffer {
    const total = this.chunks.reduce((s, c) => s + c.length, 0);
    const out = Buffer.alloc(total);
    let pos = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, pos);
      pos += chunk.length;
    }
    return out;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ZipEntry {
  /** Path inside the ZIP, e.g. "Samples/Originals/kick.wav" */
  path: string;
  data: Buffer | Uint8Array;
}

/**
 * Build a ZIP archive from an array of entries.
 * Returns a Buffer containing the complete ZIP binary.
 */
export function buildZip(entries: ZipEntry[]): Buffer {
  const w = new BufWriter();

  // DOS epoch: 1980-01-01 00:00:00
  const DOS_TIME = 0x0000;
  const DOS_DATE = 0x0021; // 1980-01-01

  // Track central directory info per entry
  const centralDirs: Array<{
    nameBytes: Buffer;
    localHeaderOffset: number;
    compressedSize: number;
    crc: number;
  }> = [];

  // ── Local file entries ──────────────────────────────────────────────────────
  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.path, "utf8");
    const data =
      entry.data instanceof Buffer
        ? entry.data
        : Buffer.from(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength);

    const u8data = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const checksum = crc32(u8data);
    const localHeaderOffset = w.offset;

    // Local file header
    w.writeU32LE(0x04034b50);       // signature
    w.writeU16LE(20);               // version needed: 2.0
    w.writeU16LE(0x0800);           // general purpose bit flag: UTF-8 name
    w.writeU16LE(0);                // compression method: stored
    w.writeU16LE(DOS_TIME);
    w.writeU16LE(DOS_DATE);
    w.writeU32LE(checksum);
    w.writeU32LE(data.length);      // compressed size == uncompressed
    w.writeU32LE(data.length);
    w.writeU16LE(nameBytes.length);
    w.writeU16LE(0);                // extra field length
    w.write(nameBytes);
    w.write(data);

    centralDirs.push({
      nameBytes,
      localHeaderOffset,
      compressedSize: data.length,
      crc: checksum,
    });
  }

  // ── Central directory ───────────────────────────────────────────────────────
  const cdOffset = w.offset;

  for (const cd of centralDirs) {
    const data =
      entries[centralDirs.indexOf(cd)].data instanceof Buffer
        ? (entries[centralDirs.indexOf(cd)].data as Buffer)
        : Buffer.from(
            entries[centralDirs.indexOf(cd)].data.buffer,
            (entries[centralDirs.indexOf(cd)].data as Uint8Array).byteOffset,
            entries[centralDirs.indexOf(cd)].data.byteLength
          );

    w.writeU32LE(0x02014b50);       // signature
    w.writeU16LE(20);               // version made by: 2.0 / DOS
    w.writeU16LE(20);               // version needed: 2.0
    w.writeU16LE(0x0800);           // general purpose bit flag: UTF-8
    w.writeU16LE(0);                // compression method: stored
    w.writeU16LE(DOS_TIME);
    w.writeU16LE(DOS_DATE);
    w.writeU32LE(cd.crc);
    w.writeU32LE(cd.compressedSize);
    w.writeU32LE(data.length);
    w.writeU16LE(cd.nameBytes.length);
    w.writeU16LE(0);                // extra field length
    w.writeU16LE(0);                // file comment length
    w.writeU16LE(0);                // disk number start
    w.writeU16LE(0);                // internal attributes
    w.writeU32LE(0);                // external attributes
    w.writeU32LE(cd.localHeaderOffset);
    w.write(cd.nameBytes);
  }

  const cdSize = w.offset - cdOffset;

  // ── End-of-central-directory record ────────────────────────────────────────
  w.writeU32LE(0x06054b50);         // signature
  w.writeU16LE(0);                  // disk number
  w.writeU16LE(0);                  // disk with start of CD
  w.writeU16LE(centralDirs.length); // entries on this disk
  w.writeU16LE(centralDirs.length); // total entries
  w.writeU32LE(cdSize);
  w.writeU32LE(cdOffset);
  w.writeU16LE(0);                  // comment length

  return w.finalize();
}
