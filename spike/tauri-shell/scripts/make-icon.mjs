/**
 * 生成 512x512 的图标源文件（Tauri 打包需要 icon.ico，由 `tauri icon` 从该 PNG 派生）。
 * 纯 Node 实现，避免为 spike 引入图像依赖。
 *
 *   node scripts/make-icon.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../src-tauri/icons/source.png');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const W = 512;
const H = 512;
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6; // RGBA
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y += 1) {
  const off = y * (W * 4 + 1);
  raw[off] = 0;
  for (let x = 0; x < W; x += 1) {
    // 深蓝底 + 中央浅色方框，作为可辨识的占位图标
    const cx = Math.abs(x - W / 2);
    const cy = Math.abs(y - H / 2);
    const inner = cx < 150 && cy < 150;
    const p = off + 1 + x * 4;
    raw[p] = inner ? 0xf5 : 0x1f;
    raw[p + 1] = inner ? 0xf7 : 0x3a;
    raw[p + 2] = inner ? 0xfa : 0x8f;
    raw[p + 3] = 0xff;
  }
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync(OUT, png);
process.stdout.write(`icon written: ${OUT} (${png.length} bytes)\n`);
