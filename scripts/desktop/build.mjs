#!/usr/bin/env node
/**
 * Maestro desktop build (pure Node, zero npm dependencies).
 *
 * Steps:
 *   1. Generate the compile-time placeholder UI (embedded by tauri-build).
 *   2. `cargo build --release` in desktop/src-tauri.
 *   3. Hand-assemble the .app bundle:
 *        Maestro.app/Contents/MacOS/maestro            (cargo binary)
 *        Maestro.app/Contents/Resources/runtime/node   (local node binary)
 *        Maestro.app/Contents/Resources/bin/ + src/    (repo runtime sources)
 *        Maestro.app/Contents/Resources/desktop/ui/    (when present)
 *   4. Ad-hoc codesign (`codesign --sign -`).
 *
 * Output: desktop/src-tauri/target/release/bundle/macos/Maestro.app
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

// 版本号唯一来源（需求 v4 裁决 U-13 / AC-41）：本文件不得再写版本字面量。
import { readVersion, REPO as VERSION_REPO } from './version.mjs';

const REPO = VERSION_REPO;
const VERSION = readVersion();
const SRC_TAURI = path.join(REPO, 'desktop', 'src-tauri');
const TARGET = path.join(SRC_TAURI, 'target');
const APP = path.join(TARGET, 'release', 'bundle', 'macos', 'Maestro.app');

function log(message) {
  process.stdout.write(`[desktop-build] ${message}\n`);
}

function die(message, result) {
  const detail = result ? `${result.stdout ?? ''}\n${result.stderr ?? ''}` : '';
  process.stderr.write(`[desktop-build] FAIL: ${message}\n${detail}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  log(`${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'pipe', encoding: 'utf8', ...options });
  if (result.status !== 0) die(`${command} exited ${result.status}`, result);
  return result;
}

// 1. Compile-time placeholder UI (English-only; the real UI ships via /ui/).
const placeholderDir = path.join(TARGET, 'ui-placeholder');
fs.mkdirSync(placeholderDir, { recursive: true });
fs.writeFileSync(
  path.join(placeholderDir, 'index.html'),
  [
    '<!doctype html>',
    '<html><head><meta charset="utf-8"><title>Maestro</title>',
    '<style>body{font:14px -apple-system,sans-serif;color:#28303b;padding:24px}</style></head>',
    '<body><p>Maestro desktop shell is running. The instance UI is served',
    'by the daemon channel at <code>/ui/</code>.</p></body></html>',
    '',
  ].join('\n'),
  'utf8',
);

// 1b. Compile-time window icon (PNG generated in-process, zero dependencies).
writeIconPng(path.join(TARGET, 'icon.png'));

// 1c. Windows resource icon. `tauri-build` requires `icons/icon.ico` for the
// Windows target (missing file fails the build outright); it is generated here
// so no binary is committed and no dependency is added.
writeIconIco(path.join(SRC_TAURI, 'icons', 'icon.ico'));

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

function iconPngBuffer(size = 32) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inside = x >= 3 && x < 29 && y >= 3 && y < 29;
      const mark = x + y >= 24 && x + y <= 36 && x >= 8 && x < 24 && y >= 8 && y < 24;
      const color = mark ? [232, 232, 238] : [40, 44, 52];
      const idx = (y * size + x) * 4;
      rgba[idx] = color[0];
      rgba[idx + 1] = color[1];
      rgba[idx + 2] = color[2];
      rgba[idx + 3] = inside ? 255 : 0;
    }
  }
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

function writeIconPng(outPath) {
  fs.writeFileSync(outPath, iconPngBuffer(32));
}

/**
 * Windows resource icon: PNG-in-ICO container (supported since Vista).
 * Layout: ICONDIR(6) + ICONDIRENTRY(16) + PNG payload.
 */
function writeIconIco(outPath) {
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

// 2. cargo build --release
run('cargo', ['build', '--release'], { cwd: SRC_TAURI });

// Windows produces `maestro.exe`; macOS/Linux produce `maestro`.
const binName = process.platform === 'win32' ? 'maestro.exe' : 'maestro';
const binPath = path.join(TARGET, 'release', binName);
if (!fs.existsSync(binPath)) die(`cargo binary missing: ${binPath}`);

if (process.platform !== 'darwin') {
  // Windows / Linux: no `.app`, no macOS-only codesign. The installable package
  // is produced by `package-win.mjs` (Windows) using the binary cargo just built.
  log(`binary ready: ${binPath}`);
} else {
  // 3. Assemble the bundle from scratch.
  fs.rmSync(APP, { recursive: true, force: true });
  const contents = path.join(APP, 'Contents');
  const macosDir = path.join(contents, 'MacOS');
  const resDir = path.join(contents, 'Resources');
  fs.mkdirSync(macosDir, { recursive: true });
  fs.mkdirSync(resDir, { recursive: true });

  fs.copyFileSync(binPath, path.join(macosDir, 'maestro'));
  fs.chmodSync(path.join(macosDir, 'maestro'), 0o755);

  fs.writeFileSync(
    path.join(contents, 'Info.plist'),
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0"><dict>',
      '  <key>CFBundleName</key><string>Maestro</string>',
      '  <key>CFBundleDisplayName</key><string>Maestro</string>',
      '  <key>CFBundleIdentifier</key><string>com.maestro.desktop</string>',
      '  <key>CFBundleExecutable</key><string>maestro</string>',
      '  <key>CFBundlePackageType</key><string>APPL</string>',
      `  <key>CFBundleShortVersionString</key><string>${VERSION}</string>`,
      `  <key>CFBundleVersion</key><string>${VERSION}</string>`,
      '  <key>LSMinimumSystemVersion</key><string>10.13</string>',
      '  <key>NSHighResolutionCapable</key><true/>',
      '</dict></plist>',
      '',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(path.join(contents, 'PkgInfo'), 'APPL????\n', 'utf8');

  // Bundled interpreter: copy the local node binary (build machine needs node;
  // user machines do not). Absolute in-package path is used at spawn time.
  const runtimeDir = path.join(resDir, 'runtime');
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.copyFileSync(process.execPath, path.join(runtimeDir, 'node'));
  fs.chmodSync(path.join(runtimeDir, 'node'), 0o755);

  // Runtime sources: bin/ + src/ (+ desktop/ui when the UI batch has landed).
  copyDir(path.join(REPO, 'bin'), path.join(resDir, 'bin'));
  copyDir(path.join(REPO, 'src'), path.join(resDir, 'src'));
  const uiSrc = path.join(REPO, 'desktop', 'ui');
  if (fs.existsSync(uiSrc)) copyDir(uiSrc, path.join(resDir, 'desktop', 'ui'));

  function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const from = path.join(src, entry.name);
      const to = path.join(dest, entry.name);
      if (entry.isDirectory()) copyDir(from, to);
      else fs.copyFileSync(from, to);
    }
  }

  // 4. Ad-hoc signature (notarization is not required for this iteration).
  run('codesign', ['--force', '--deep', '--sign', '-', APP]);

  log(`bundle ready: ${APP}`);
}
