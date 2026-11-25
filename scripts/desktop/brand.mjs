/**
 * Maestro brand mark — single source of truth for the logo geometry.
 *
 * The Cue mark places three parallel session tracks beside a diagonal
 * conductor's baton. The dark tile keeps the mark legible in both light and
 * dark surfaces; cyan is reserved for the baton.
 *
 * Everything derived (window PNG, Windows ICO, tray RGBA, favicon) is
 * generated from the same 64-unit design grid defined here. Pure Node, zero
 * npm dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const GRID = 64;
const TILE = Object.freeze({ x: 4, y: 4, size: 56, radius: 16 });
const TILE_GRADIENT = Object.freeze({ x0: 8, y0: 6, x1: 56, y1: 58 });
const TRACK_WIDTH = 5.5;
const TRACKS = Object.freeze([
  { x0: 15, y0: 18, x1: 44, y1: 18 },
  { x0: 15, y0: 32, x1: 38, y1: 32 },
  { x0: 15, y0: 46, x1: 32, y1: 46 },
]);
const BATON = Object.freeze({ x0: 34, y0: 49, x1: 49, y1: 18, width: 6 });

const COLOR_TILE_A = [17, 26, 44];
const COLOR_TILE_B = [24, 34, 56];
const COLOR_TRACK = [244, 247, 252];
const COLOR_BATON_A = [6, 182, 212];
const COLOR_BATON_B = [53, 208, 232];

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const mix = (a, b, t) => a + (b - a) * t;
const mixColor = (a, b, t) => a.map((value, index) => mix(value, b[index], t));

function projection(x, y, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return clamp01(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy));
}

function roundedTileDistance(x, y) {
  const radius = TILE.radius;
  const qx = Math.abs(x - GRID / 2) - (TILE.size / 2 - radius);
  const qy = Math.abs(y - GRID / 2) - (TILE.size / 2 - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function segmentDistance(x, y, segment) {
  const dx = segment.x1 - segment.x0;
  const dy = segment.y1 - segment.y0;
  const t = clamp01(((x - segment.x0) * dx + (y - segment.y0) * dy) / (dx * dx + dy * dy));
  return {
    distance: Math.hypot(x - (segment.x0 + dx * t), y - (segment.y0 + dy * t)),
    t,
  };
}

const coverage = (distance, antialias) => clamp01(0.5 - distance / antialias);

/** Sample the brand pixel for an image of `size`, returning straight RGBA. */
export function brandPixel(x, y, size) {
  const samples = 4;
  const scale = GRID / size;
  const antialias = scale / samples;
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;

  for (let sy = 0; sy < samples; sy += 1) {
    for (let sx = 0; sx < samples; sx += 1) {
      const gx = (x + (sx + 0.5) / samples) * scale;
      const gy = (y + (sy + 0.5) / samples) * scale;
      const tileCoverage = coverage(roundedTileDistance(gx, gy), antialias);
      if (tileCoverage <= 0) continue;

      const tileT = projection(gx, gy, TILE_GRADIENT.x0, TILE_GRADIENT.y0, TILE_GRADIENT.x1, TILE_GRADIENT.y1);
      let color = mixColor(COLOR_TILE_A, COLOR_TILE_B, tileT);

      let trackCoverage = 0;
      for (const track of TRACKS) {
        trackCoverage = Math.max(trackCoverage, coverage(segmentDistance(gx, gy, track).distance - TRACK_WIDTH / 2, antialias));
      }
      color = mixColor(color, COLOR_TRACK, trackCoverage);

      const baton = segmentDistance(gx, gy, BATON);
      const batonCoverage = coverage(baton.distance - BATON.width / 2, antialias);
      color = mixColor(color, mixColor(COLOR_BATON_A, COLOR_BATON_B, baton.t), batonCoverage);

      red += color[0] * tileCoverage;
      green += color[1] * tileCoverage;
      blue += color[2] * tileCoverage;
      alpha += tileCoverage;
    }
  }

  if (alpha <= 0) return [0, 0, 0, 0];
  const sampleCount = samples * samples;
  return [
    Math.round(red / alpha),
    Math.round(green / alpha),
    Math.round(blue / alpha),
    Math.round((alpha / sampleCount) * 255),
  ];
}

/** Raw RGBA buffer for a `size` x `size` brand tile. */
export function brandRgba(size) {
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = brandPixel(x, y, size);
      const i = (y * size + x) * 4;
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = a;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Vector master (favicon / docs / web)
// ---------------------------------------------------------------------------

const HEX = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const hex = HEX;

export function brandSvg() {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Maestro">',
    '  <defs>',
    `    <linearGradient id="maestro-brand-bg" x1="${TILE_GRADIENT.x0}" y1="${TILE_GRADIENT.y0}" x2="${TILE_GRADIENT.x1}" y2="${TILE_GRADIENT.y1}" gradientUnits="userSpaceOnUse">`,
    `      <stop offset="0" stop-color="${hex(COLOR_TILE_A)}"/>`,
    `      <stop offset="1" stop-color="${hex(COLOR_TILE_B)}"/>`,
    '    </linearGradient>',
    `    <linearGradient id="maestro-brand-baton" x1="${BATON.x0}" y1="${BATON.y0}" x2="${BATON.x1}" y2="${BATON.y1}" gradientUnits="userSpaceOnUse">`,
    `      <stop offset="0" stop-color="${hex(COLOR_BATON_A)}"/>`,
    `      <stop offset="1" stop-color="${hex(COLOR_BATON_B)}"/>`,
    '    </linearGradient>',
    '  </defs>',
    `  <rect x="${TILE.x}" y="${TILE.y}" width="${TILE.size}" height="${TILE.size}" rx="${TILE.radius}" fill="url(#maestro-brand-bg)"/>`,
    '  <g fill="none" stroke="' + hex(COLOR_TRACK) + '" stroke-width="' + TRACK_WIDTH + '" stroke-linecap="round">',
    ...TRACKS.map((track) => `    <path d="M${track.x0} ${track.y0}H${track.x1}"/>`),
    '  </g>',
    `  <path d="M${BATON.x0} ${BATON.y0}L${BATON.x1} ${BATON.y1}" fill="none" stroke="url(#maestro-brand-baton)" stroke-width="${BATON.width}" stroke-linecap="round"/>`,
    '</svg>',
    '',
  ].join('\n');
}

/** The mark without its tile, for monochrome placements. */
export function brandSvgMono(ink = COLOR_TILE_A) {
  const one = hex(ink);
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Maestro">',
    `  <g fill="none" stroke="${one}" stroke-width="${TRACK_WIDTH}" stroke-linecap="round">`,
    ...TRACKS.map((track) => `    <path d="M${track.x0} ${track.y0}H${track.x1}"/>`),
    '  </g>',
    `  <path d="M${BATON.x0} ${BATON.y0}L${BATON.x1} ${BATON.y1}" fill="none" stroke="${one}" stroke-width="${BATON.width}" stroke-linecap="round"/>`,
    '</svg>',
    '',
  ].join('\n');
}

/** Write the vector masters into the served UI asset folder. */
export function writeBrandSvg(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'mark.svg'), brandSvg(), 'utf8');
  fs.writeFileSync(path.join(outDir, 'mark-mono.svg'), brandSvgMono(), 'utf8');
  fs.writeFileSync(path.join(outDir, 'mark-mono-invert.svg'), brandSvgMono(COLOR_TRACK), 'utf8');
}

// ---------------------------------------------------------------------------
// PNG / ICO / ICNS containers
// ---------------------------------------------------------------------------

function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

export function iconPngBuffer(size = 32) {
  const rgba = brandRgba(size);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function writeIconPng(outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, iconPngBuffer(32));
}

/** Windows resource icon with the standard 16/32/48/256 pixel sizes. */
export function iconIcoBuffer() {
  const sizes = [16, 32, 48, 256];
  const images = sizes.map((size) => iconPngBuffer(size));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((png, index) => {
    const entry = 6 + index * 16;
    const size = sizes[index];
    header[entry] = size === 256 ? 0 : size;
    header[entry + 1] = size === 256 ? 0 : size;
    header[entry + 2] = 0;
    header[entry + 3] = 0;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images]);
}

export function writeIconIco(outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, iconIcoBuffer());
}

/** macOS app icon container using PNG-backed ICNS entries. */
export function iconIcnsBuffer() {
  const entries = [
    ['icp4', 16],
    ['icp5', 32],
    ['icp6', 64],
    ['ic07', 128],
    ['ic08', 256],
    ['ic09', 512],
    ['ic10', 1024],
    ['ic11', 32],
    ['ic12', 64],
  ];
  const chunks = entries.map(([type, size]) => {
    const png = iconPngBuffer(size);
    const header = Buffer.alloc(8);
    header.write(type, 0, 4, 'ascii');
    header.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([header, png]);
  });
  const header = Buffer.alloc(8);
  header.write('icns', 0, 4, 'ascii');
  header.writeUInt32BE(8 + chunks.reduce((total, chunk) => total + chunk.length, 0), 4);
  return Buffer.concat([header, ...chunks]);
}

export function writeIconIcns(outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, iconIcnsBuffer());
}
