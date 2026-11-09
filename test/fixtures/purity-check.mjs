#!/usr/bin/env node
/**
 * AC-28 architecture guard: the orchestration engine must not embed any
 * built-in template / role literal, not even inside comments.
 *
 * Usage:
 *   node test/fixtures/purity-check.mjs --dirs src/core,src/daemon \
 *     --forbid code-loop,developer,tester,coordinator [--json]
 *   node test/fixtures/purity-check.mjs --files src/cli/roles.js --forbid ... [--json]
 *
 * `--files` scans exactly the listed files and ignores `--dirs` (and the default
 * directories): a single file is the only way to guard `src/cli/roles.js` without
 * also scanning `labels.js`, which legitimately holds the six role names.
 *
 * Whitelist per requirement AC-28: src/templates/**, test/**, docs/**.
 * Anything outside --dirs is simply not scanned.
 * Exit 0 = clean, 1 = at least one hit, 2 = bad arguments.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const DEFAULT_DIRS = ['src/core', 'src/daemon'];
const DEFAULT_FORBID = ['code-loop', 'developer', 'tester', 'coordinator'];
const TEXT_EXT = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts',
  '.json', '.jsonl', '.md', '.txt', '.yml', '.yaml', ''
]);

function parseArgs(argv) {
  const opts = { dirs: null, files: null, forbid: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      opts.json = true;
      continue;
    }
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) return { error: `--${key} 缺少取值` };
    i += 1;
    if (key === 'dirs') opts.dirs = value.split(',').map((s) => s.trim()).filter(Boolean);
    else if (key === 'files') opts.files = value.split(',').map((s) => s.trim()).filter(Boolean);
    else if (key === 'forbid') opts.forbid = value.split(',').map((s) => s.trim()).filter(Boolean);
    else return { error: `未知参数 --${key}` };
  }
  return opts;
}

function collectFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...collectFiles(full));
    } else if (entry.isFile() && TEXT_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

const opts = parseArgs(process.argv.slice(2));
if (opts.error) {
  console.log(`参数错误：${opts.error}`);
  process.exit(2);
}

// `--files` wins over `--dirs` entirely: the list is the scope, not an addition.
const explicitFiles = opts.files ?? null;
const dirs = explicitFiles === null ? (opts.dirs ?? DEFAULT_DIRS) : [];
const forbidden = opts.forbid ?? DEFAULT_FORBID;
const hits = [];
let scannedFiles = 0;

const targets = [];
if (explicitFiles !== null) {
  for (const f of explicitFiles) {
    const abs = path.isAbsolute(f) ? f : path.join(REPO, f);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      // Same treatment as a missing directory: a typo must not read as "clean".
      console.log(`文件不存在：${f}`);
      process.exit(2);
    }
    targets.push({ dir: null, file: abs });
  }
} else {
  for (const d of dirs) {
    const abs = path.isAbsolute(d) ? d : path.join(REPO, d);
    if (!fs.existsSync(abs)) {
      console.log(`目录不存在：${d}`);
      process.exit(2);
    }
    for (const file of collectFiles(abs)) targets.push({ dir: d, file });
  }
}

for (const target of targets) {
  scannedFiles += 1;
  const lines = fs.readFileSync(target.file, 'utf8').split(/\r?\n/);
  for (const word of forbidden) {
    for (let ln = 0; ln < lines.length; ln += 1) {
      if (lines[ln].includes(word)) {
        hits.push({
          dir: target.dir,
          file: path.relative(REPO, target.file).replaceAll('\\', '/'),
          line: ln + 1,
          word,
          snippet: lines[ln].trim().slice(0, 160)
        });
      }
    }
  }
}

const result = { ok: hits.length === 0, dirs, files: explicitFiles, forbidden, scannedFiles, hits };
if (opts.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  for (const h of hits) console.log(`${h.file}:${h.line} 命中 ${h.word} — ${h.snippet}`);
  const scope = explicitFiles === null ? dirs.join(', ') : explicitFiles.join(', ');
  console.log(
    hits.length === 0
      ? `OK: 扫描 ${scannedFiles} 个文件，${scope} 内 ${forbidden.join(', ')} 零命中`
      : `FAIL: ${hits.length} 处命中`
  );
}
process.exit(hits.length === 0 ? 0 : 1);
