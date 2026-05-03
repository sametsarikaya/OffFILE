/**
 * Minimal QR Code generator - Byte mode, versions 1-10, all EC levels.
 * Implements ISO 18004:2015 without external dependencies.
 */

// ── GF(256) with primitive polynomial x^8+x^4+x^3+x^2+1 = 0x11D ─────────────
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  return a && b ? GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255] : 0;
}

// ── Reed-Solomon encoder ──────────────────────────────────────────────────────
function rsEncode(data: Uint8Array, nEC: number): Uint8Array {
  // Build generator polynomial: (x - α^0)(x - α^1)...(x - α^(nEC-1))
  let g: number[] = [1];
  for (let i = 0; i < nEC; i++) {
    const ai = GF_EXP[i];
    const ng  = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      if (!g[j]) continue;
      ng[j]     ^= g[j];
      ng[j + 1] ^= gfMul(g[j], ai);
    }
    g = ng;
  }
  // Polynomial long division
  const rem = new Array(nEC).fill(0);
  for (let i = 0; i < data.length; i++) {
    const f = data[i] ^ rem.shift()!;
    rem.push(0);
    for (let j = 0; j < nEC; j++) rem[j] ^= gfMul(f, g[j + 1]);
  }
  return new Uint8Array(rem);
}

// ── Format info BCH (poly x^10+x^8+x^5+x^4+x^2+x+1 = 0b10100110111) ────────
function formatInfoWord(data5: number): number {
  let rem = data5 << 10;
  const gen = 0b10100110111;
  for (let i = 14; i >= 10; i--) {
    if (rem & (1 << i)) rem ^= gen << (i - 10);
  }
  return ((data5 << 10) | rem) ^ 0b101010000010010;
}

// ── Version info BCH (poly x^12+x^11+x^10+x^9+x^8+x^5+x^2+1 = 0x1F25) ─────
function versionInfoWord(version: number): number {
  let rem = version << 12;
  const gen = 0x1f25;
  for (let i = 17; i >= 12; i--) {
    if (rem & (1 << i)) rem ^= gen << (i - 12);
  }
  return (version << 12) | rem;
}

// ── Tables ────────────────────────────────────────────────────────────────────
type ECLevel = 'L' | 'M' | 'Q' | 'H';
const EC_IDX: Record<ECLevel, number> = { L: 0, M: 1, Q: 2, H: 3 };
// EC level indicator bits: L=01, M=00, Q=11, H=10
const EC_BITS = [0b01, 0b00, 0b11, 0b10];

// Byte mode max capacity per [version][ecLevel]
const BYTE_CAP: number[][] = [
  [0,   0,   0,   0  ],
  [17,  14,  11,  7  ],
  [32,  26,  20,  14 ],
  [53,  42,  32,  24 ],
  [78,  62,  46,  34 ],
  [106, 84,  60,  44 ],
  [134, 106, 74,  58 ],
  [154, 122, 86,  64 ],
  [192, 152, 108, 84 ],
  [230, 180, 130, 98 ],
  [271, 213, 151, 119],
];

// Block structure: [ecPerBlock, b1Count, b1Data, b2Count, b2Data]
const BLOCKS: [number, number, number, number, number][][] = [
  [],
  [[7,1,19,0,0],[10,1,16,0,0],[13,1,13,0,0],[17,1,9,0,0]],
  [[10,1,34,0,0],[16,1,28,0,0],[22,1,22,0,0],[28,1,16,0,0]],
  [[15,1,55,0,0],[26,1,44,0,0],[18,2,17,0,0],[22,2,13,0,0]],
  [[20,1,80,0,0],[18,2,32,0,0],[26,2,24,0,0],[16,4,9,0,0]],
  [[26,1,108,0,0],[24,2,43,0,0],[18,2,15,2,16],[22,2,11,2,12]],
  [[18,2,68,0,0],[16,4,27,0,0],[24,4,19,0,0],[28,4,15,0,0]],
  [[20,2,78,0,0],[18,4,31,0,0],[18,2,14,4,15],[26,4,13,1,14]],
  [[24,2,97,0,0],[22,2,38,2,39],[22,4,18,2,19],[26,4,14,2,15]],
  [[30,2,116,0,0],[22,3,36,2,37],[20,4,16,4,17],[24,4,12,4,13]],
  [[18,2,68,2,69],[26,4,43,1,44],[24,6,19,2,20],[28,6,15,2,16]],
];

// Alignment pattern center positions per version (row or col values)
const ALIGN_POS: number[][] = [
  [],[], [6,18],[6,22],[6,26],[6,30],[6,34],
  [6,22,38],[6,24,42],[6,26,46],[6,28,50],
];

// Remainder bits appended after data codewords
const REMAINDER = [0,0,7,7,7,7,7,0,0,0,0];

// ── Bit buffer helpers ────────────────────────────────────────────────────────
function appendBits(bits: number[], val: number, len: number): void {
  for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
}

// ── Data encoding ─────────────────────────────────────────────────────────────
function buildData(bytes: Uint8Array, version: number, ecLevel: ECLevel): Uint8Array {
  const ec = EC_IDX[ecLevel];
  const [ecPB, b1c, b1d, b2c, b2d] = BLOCKS[version][ec];
  const totalData = b1c * b1d + b2c * b2d;

  const bits: number[] = [];
  // Mode indicator: byte mode = 0100
  appendBits(bits, 0b0100, 4);
  // Character count
  appendBits(bits, bytes.length, version < 10 ? 8 : 16);
  // Data bytes
  for (const b of bytes) appendBits(bits, b, 8);
  // Terminator (up to 4 zero bits)
  const cap = totalData * 8;
  for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
  // Pad to byte boundary
  while (bits.length % 8) bits.push(0);
  // Pad codewords
  for (let pad = 0; bits.length < cap; pad++) appendBits(bits, pad % 2 ? 0x11 : 0xec, 8);

  // Pack bits into bytes
  const codewords = new Uint8Array(totalData);
  for (let i = 0; i < totalData; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i * 8 + j] ?? 0);
    codewords[i] = byte;
  }

  // Split into blocks, add RS EC, interleave
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks:   Uint8Array[] = [];
  let pos = 0;
  for (let b = 0; b < b1c; b++) {
    const block = codewords.slice(pos, pos + b1d); pos += b1d;
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecPB));
  }
  for (let b = 0; b < b2c; b++) {
    const block = codewords.slice(pos, pos + b2d); pos += b2d;
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecPB));
  }

  // Interleave data codewords
  const maxData = Math.max(b1d, b2d);
  const out: number[] = [];
  for (let i = 0; i < maxData; i++) {
    for (const blk of dataBlocks) if (i < blk.length) out.push(blk[i]);
  }
  // Interleave EC codewords
  for (let i = 0; i < ecPB; i++) {
    for (const blk of ecBlocks) out.push(blk[i]);
  }
  // Append remainder bits
  for (let i = 0; i < REMAINDER[version]; i++) out.push(0);

  return new Uint8Array(out);
}

// ── Matrix helpers ─────────────────────────────────────────────────────────────
type Matrix = Int8Array[]; // -1=unset, 0=light, 1=dark
type BoolGrid = boolean[][];

function makeMatrix(size: number): { m: Matrix; fn: BoolGrid } {
  const m:  Matrix   = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
  const fn: BoolGrid = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  return { m, fn };
}

function set(m: Matrix, fn: BoolGrid, r: number, c: number, dark: boolean, func: boolean): void {
  m[r][c]  = dark ? 1 : 0;
  fn[r][c] = func;
}

// 7×7 finder pattern + 1-module white separator
function placeFinderPattern(m: Matrix, fn: BoolGrid, r: number, c: number): void {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const rr = r + dy, cc = c + dx;
      if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue;
      const inFinder = dy >= 0 && dy <= 6 && dx >= 0 && dx <= 6;
      const dark = inFinder && (
        dy === 0 || dy === 6 || dx === 0 || dx === 6 ||
        (dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4)
      );
      set(m, fn, rr, cc, dark, true);
    }
  }
}

function placeFinderPatterns(m: Matrix, fn: BoolGrid, size: number): void {
  placeFinderPattern(m, fn, 0, 0);
  placeFinderPattern(m, fn, 0, size - 7);
  placeFinderPattern(m, fn, size - 7, 0);
}

function placeTimingPatterns(m: Matrix, fn: BoolGrid, size: number): void {
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    set(m, fn, 6, i, dark, true);
    set(m, fn, i, 6, dark, true);
  }
}

// 5×5 alignment pattern centered at (r, c)
function placeAlignmentPattern(m: Matrix, fn: BoolGrid, r: number, c: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const dark = (Math.abs(dy) === 2 || Math.abs(dx) === 2) || (dy === 0 && dx === 0);
      set(m, fn, r + dy, c + dx, dark, true);
    }
  }
}

function placeAlignmentPatterns(m: Matrix, fn: BoolGrid, version: number): void {
  const pos = ALIGN_POS[version];
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      const r = pos[i], c = pos[j];
      // Skip positions that overlap with finder patterns
      if (fn[r][c]) continue;
      placeAlignmentPattern(m, fn, r, c);
    }
  }
}

function reserveFormatInfo(m: Matrix, fn: BoolGrid, size: number): void {
  // Horizontal band around top-left finder
  for (let i = 0; i <= 8; i++) {
    if (!fn[8][i]) set(m, fn, 8, i, false, true);
    if (!fn[i][8]) set(m, fn, i, 8, false, true);
  }
  // Vertical strip top-right
  for (let i = 0; i < 8; i++) set(m, fn, 8, size - 1 - i, false, true);
  // Horizontal strip bottom-left
  for (let i = 0; i < 8; i++) set(m, fn, size - 1 - i, 8, false, true);
  // Dark module
  set(m, fn, size - 8, 8, true, true);
}

function reserveVersionInfo(m: Matrix, fn: BoolGrid, size: number): void {
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      set(m, fn, i, size - 11 + j, false, true);
      set(m, fn, size - 11 + j, i, false, true);
    }
  }
}

function placeData(m: Matrix, fn: BoolGrid, data: Uint8Array): void {
  const size = m.length;
  let bitIdx = 0;
  let up = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip timing column
    const rows = up
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);
    for (const r of rows) {
      for (const dc of [0, -1]) {
        const c = right + dc;
        if (fn[r][c]) continue;
        const byteIdx = bitIdx >> 3;
        const bitPos  = 7 - (bitIdx & 7);
        m[r][c] = byteIdx < data.length ? (data[byteIdx] >> bitPos) & 1 : 0;
        bitIdx++;
      }
    }
    up = !up;
  }
}

// ── Masking ───────────────────────────────────────────────────────────────────
function maskFn(pattern: number, r: number, c: number): boolean {
  switch (pattern) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return (r * c) % 2 + (r * c) % 3 === 0;
    case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
    case 7: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
    default: return false;
  }
}

function applyMask(m: Matrix, fn: BoolGrid, pattern: number): Matrix {
  const size = m.length;
  return m.map((row, r) => {
    const newRow = new Int8Array(row);
    for (let c = 0; c < size; c++) {
      if (!fn[r][c] && maskFn(pattern, r, c)) newRow[c] ^= 1;
    }
    return newRow;
  });
}

function applyFormatInfo(m: Matrix, ecIdx: number, mask: number, size: number): void {
  const word = formatInfoWord((EC_BITS[ecIdx] << 3) | mask);
  // Format info bit sequence (MSB first): bits 14..0
  const bits: number[] = [];
  for (let i = 14; i >= 0; i--) bits.push((word >> i) & 1);

  // Copy 1: top-left
  const h = [0,1,2,3,4,5,7,8,   8,  8,  8,  8,  8,  8,  8]; // col positions
  const v = [8,8,8,8,8,8,8,8, size-7,size-6,size-5,size-4,size-3,size-2,size-1]; // matching rows

  for (let i = 0; i < 7; i++) { m[8][h[i]] = bits[i]; }  // horizontal row 8
  for (let i = 7; i < 15; i++) { m[v[i]][8] = bits[i]; } // vertical col 8

  // Copy 2 (top-right / bottom-left) uses the same bits mirrored
  // Top-right: row 8, cols size-1..size-7 (reversed)
  for (let i = 0; i < 8; i++) m[8][size - 1 - i] = bits[i];
  // Bottom-left: col 8, rows size-7..size-1
  for (let i = 8; i < 15; i++) m[size - 15 + i][8] = bits[i];
}

function applyVersionInfo(m: Matrix, version: number, size: number): void {
  const word = versionInfoWord(version);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      const bit = (word >> (i * 3 + j)) & 1;
      m[i][size - 11 + j] = bit;
      m[size - 11 + j][i] = bit;
    }
  }
}

// ── Penalty scoring ───────────────────────────────────────────────────────────
function calcPenalty(m: Matrix): number {
  const size = m.length;
  let penalty = 0;

  // Rule 1: runs of 5+ same colour in rows and columns
  for (let r = 0; r < size; r++) {
    for (let isCol = 0; isCol <= 1; isCol++) {
      let run = 1;
      for (let i = 1; i < size; i++) {
        const prev = isCol ? m[i-1][r] : m[r][i-1];
        const curr = isCol ? m[i][r]   : m[r][i];
        if (curr === prev) { run++; } else {
          if (run >= 5) penalty += run - 2;
          run = 1;
        }
      }
      if (run >= 5) penalty += run - 2;
    }
  }

  // Rule 2: 2×2 blocks of same colour
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c+1] && v === m[r+1][c] && v === m[r+1][c+1]) penalty += 3;
    }
  }

  // Rule 3: specific patterns (1011101 or reversed)
  const P3 = [1,0,1,1,1,0,1,0,0,0,0];
  const P3r = [0,0,0,0,1,0,1,1,1,0,1];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - 11; c++) {
      let matchH = true, matchHr = true, matchV = true, matchVr = true;
      for (let k = 0; k < 11; k++) {
        if (m[r][c+k] !== P3[k])  matchH  = false;
        if (m[r][c+k] !== P3r[k]) matchHr = false;
        if (m[c+k][r] !== P3[k])  matchV  = false;
        if (m[c+k][r] !== P3r[k]) matchVr = false;
      }
      if (matchH)  penalty += 40;
      if (matchHr) penalty += 40;
      if (matchV)  penalty += 40;
      if (matchVr) penalty += 40;
    }
  }

  // Rule 4: proportion of dark modules
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r][c] === 1) dark++;
  const pct = (dark / (size * size)) * 100;
  penalty += Math.abs(Math.floor(pct / 5) * 5 - 50) * 2;
  penalty += Math.abs(Math.ceil(pct / 5) * 5 - 50) * 2;

  return penalty;
}

// ── Public API ────────────────────────────────────────────────────────────────
export function generateQR(text: string, ecLevel: ECLevel): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  if (!bytes.length) throw new Error('QR code text cannot be empty.');

  const ec = EC_IDX[ecLevel];

  // Select minimum version
  let version = -1;
  for (let v = 1; v <= 10; v++) {
    if (bytes.length <= BYTE_CAP[v][ec]) { version = v; break; }
  }
  if (version < 0) {
    const maxCap = BYTE_CAP[10][ec];
    throw new Error(`Text too long for QR code (max ${maxCap} bytes at EC level ${ecLevel}).`);
  }

  const data = buildData(bytes, version, ecLevel);
  const size = 17 + 4 * version;

  const { m, fn } = makeMatrix(size);
  placeFinderPatterns(m, fn, size);
  placeTimingPatterns(m, fn, size);
  if (version >= 2) placeAlignmentPatterns(m, fn, version);
  reserveFormatInfo(m, fn, size);
  if (version >= 7) reserveVersionInfo(m, fn, size);
  placeData(m, fn, data);

  // Try all 8 masks, pick lowest penalty
  let bestMask = 0;
  let bestPenalty = Infinity;
  let bestM: Matrix | null = null;

  for (let mask = 0; mask < 8; mask++) {
    const masked = applyMask(m, fn, mask);
    applyFormatInfo(masked, ec, mask, size);
    if (version >= 7) applyVersionInfo(masked, version, size);
    const p = calcPenalty(masked);
    if (p < bestPenalty) { bestPenalty = p; bestMask = mask; bestM = masked; }
  }

  return bestM!.map(row => Array.from(row).map(v => v === 1));
}
