import { deflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';

/** Test fixtures built in memory so no binary files live in the repo. */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/**
 * Encodes a real 8-bit RGBA PNG. Browsers reject hand-trimmed base64 blobs, so
 * fixtures are generated rather than pasted.
 */
export function makePng(width = 8, height = 8): Buffer {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      raw[offset++] = (x * 255) / Math.max(1, width - 1); // R ramp
      raw[offset++] = (y * 255) / Math.max(1, height - 1); // G ramp
      raw[offset++] = 128; // B constant
      raw[offset++] = 255; // A opaque
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function pngFile(name = 'sample.png', width = 8, height = 8) {
  return { name, mimeType: 'image/png', buffer: makePng(width, height) };
}

/** Builds a real PDF with the requested number of A5 pages. */
export async function makePdf(pageCount = 3): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([420, 595]);
  return Buffer.from(await doc.save());
}

export async function pdfFile(name = 'sample.pdf', pageCount = 3) {
  return { name, mimeType: 'application/pdf', buffer: await makePdf(pageCount) };
}
