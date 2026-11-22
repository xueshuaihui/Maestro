/**
 * Maestro brand mark — single source of truth for the logo geometry.
 *
 * The mark reads as the product itself: several parallel session tracks
 * (the short white bars, each a different length) converging into one
 * conducting node (the dot on the right). Colour follows the UI accent
 * already used in `desktop/shell-ui` (gradient #2f6fd0 -> #6d9cf0).
 *
 * Everything derived (window PNG, Windows ICO, tray RGBA, favicon) is
 * generated from the same 32-unit design grid defined here so the shapes
 * never drift apart. Pure Node, zero npm dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/** Design grid: all raster mark regions are rect [x0,x1) x [y0,y1) on 32 units. */
const GRID = 32;
/** Rounded-square padding on the grid (transparent outside). */
const PAD = 4;

/** Background gradient stops (RGB), matching the CSS accent gradient. */
const COLOR_A = [47, 111, 208]; // #2f6fd0
const COLOR_B = [109, 156, 240]; // #6d9cf0
/** Mark colour: near-white. */
const COLOR_MARK = [244, 247, 252];

/** Three session tracks + one conducting node, in 32-grid units. */
const MARK_RECTS = Object.freeze([
  { x0: 7, y0: 8, x1: 15, y1: 12 }, // track 1 (top, medium)
  { x0: 7, y0: 14, x1: 19, y1: 18 }, // track 2 (middle, longest, aims at node)
  { x0: 7, y0: 20, x1: 13, y1: 24 }, // track 3 (bottom, shortest)
  { x0: 21, y0: 12, x1: 28, y1: 20 }, // conducting node (octagon, y-centre 16)
]);

/** Grid cells clipped away from the node so it reads round rather than square. */
const MARK_HOLES = Object.freeze([
  [21, 12], [27, 12], [21, 19], [27, 19],
]);

/** True when the 32-grid cell (gx,gy) belongs to the mark. */
export function isMarkCell(gx, gy) {
  for (const [hx, hy] of MARK_HOLES) {
    if (gx === hx && gy === hy) return false;
  }
  for (const r of MARK_RECTS) {
    if (gx >= r.x0 && gx < r.x1 && gy >= r.y0 && gy < r.y1) return true;
  }
  return false;
}

/**
 * Sample the brand pixel for image of `size`, at pixel (x,y).
 * Returns `[r,g,b,a]`. Pixel coordinates are projected onto the 32-unit
 * design grid so every size (16 tray, 32 window icon, ...) stays crisp.
 */
export function brandPixel(x, y, size) {
  const gx = Math.floor((x * GRID) / size);
  const gy = Math.floor((y * GRID) / size);
  const inside = gx >= PAD && gx < GRID - PAD && gy >= PAD && gy < GRID - PAD;
  if (!inside) return [0, 0, 0, 0];
  const t = size > 1 ? (x + y) / (2 * (size - 1)) : 0;
  const rgb = isMarkCell(gx, gy)
    ? COLOR_MARK
    : [
        Math.round(COLOR_A[0] + (COLOR_B[0] - COLOR_A[0]) * t),
        Math.round(COLOR_A[1] + (COLOR_B[1] - COLOR_A[1]) * t),
        Math.round(COLOR_A[2] + (COLOR_B[2] - COLOR_A[2]) * t),
      ];
  return [rgb[0], rgb[1], rgb[2], 255];
}

/** Raw RGBA buffer for a `size` x `size` brand tile (tray icon source). */
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
// Vector master (favicon / docs / web) — derived from the same MARK_RECTS
// ---------------------------------------------------------------------------

const HEX = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const hex = (c) => HEX(c);

/**
 * Standalone brand tile as SVG text (viewBox 0 0 32 32, transparent outside
 * the rounded square). Raster sizes are hand-tuned rects so the vector stays
 * smooth while the bitmap stays crisp.
 */
export function brandSvg() {
  const tracks = [
    { x: 7, y: 8, w: 8, h: 4, r: 1.5 },
    { x: 7, y: 14, w: 12, h: 4, r: 1.5 },
    { x: 7, y: 20, w: 6, h: 4, r: 1.5 },
    { x: 21, y: 12, w: 7, h: 8, r: 3 },
  ];
  const bars = tracks
    .map((t) => `    <rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="${t.r}" fill="${hex(COLOR_MARK)}"/>`)
    .join('\n');
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Maestro">',
    '  <defs>',
    '    <linearGradient id="maestro-brand-bg" x1="0" y1="0" x2="1" y2="1">',
    `      <stop offset="0" stop-color="${hex(COLOR_A)}"/>`,
    `      <stop offset="1" stop-color="${hex(COLOR_B)}"/>`,
    '    </linearGradient>',
    '  </defs>',
    `  <rect x="${PAD}" y="${PAD}" width="${GRID - PAD * 2}" height="${GRID - PAD * 2}" rx="6" fill="url(#maestro-brand-bg)"/>`,
    '  <g>',
    bars,
    '  </g>',
    '</svg>',
    '',
  ].join('\n');
}

/**
 * The mark without the tile background, for inline use. `ink` is the foreground
 * colour: brand blue on light surfaces, near-white on dark surfaces.
 */
export function brandSvgMono(ink = COLOR_A) {
  const one = hex(ink);
  const tracks = [
    { x: 7, y: 8, w: 8, h: 4, r: 1.5 },
    { x: 7, y: 14, w: 12, h: 4, r: 1.5 },
    { x: 7, y: 20, w: 6, h: 4, r: 1.5 },
    { x: 21, y: 12, w: 7, h: 8, r: 3 },
  ];
  const bars = tracks
    .map((t) => `  <rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="${t.r}" fill="${one}"/>`)
    .join('\n');
  return ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Maestro">', bars, '</svg>', ''].join('\n');
}

/** Write the vector masters into the served UI asset folder. */
export function writeBrandSvg(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'mark.svg'), brandSvg(), 'utf8');
  fs.writeFileSync(path.join(outDir, 'mark-mono.svg'), brandSvgMono(), 'utf8');
  fs.writeFileSync(path.join(outDir, 'mark-mono-invert.svg'), brandSvgMono(COLOR_MARK), 'utf8');
}

// ---------------------------------------------------------------------------
// PNG / ICO containers (same hand-rolled encoders the build script used before)
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
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function iconPngBuffer(size = 32) {
  const rgba = brandRgba(size);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filter none
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

/**
 * Windows resource icon: PNG-in-ICO container (supported since Vista).
 * Layout: ICONDIR(6) + ICONDIRENTRY(16) + PNG payload.
 */
export function writeIconIco(outPath) {
  const size = 32;
  const png = iconPngBuffer(size);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(1, 4); // image count
  const entry = Buffer.alloc(16);
  entry[0] = size; // width (0 means 256)
  entry[1] = size; // height
  entry[2] = 0; // palette size
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // payload size
  entry.writeUInt32LE(header.length + entry.length, 12); // payload offset
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.concat([header, entry, png]));
}
