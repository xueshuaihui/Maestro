#!/usr/bin/env node
/**
 * AC-28 architecture guard: the orchestration engine must not embed any
 * built-in template / role literal, not even inside comments.
 *
 * Usage:
 *   node test/fixtures/purity-check.mjs --dirs src/core,src/daemon \
 *     --forbid code-loop,developer,tester,coordinator [--json]
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
  const opts = { dirs: null, forbid: null, json: false };
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

const dirs = opts.dirs ?? DEFAULT_DIRS;
const forbidden = opts.forbid ?? DEFAULT_FORBID;
const hits = [];
let scannedFiles = 0;

for (const d of dirs) {
  const abs = path.isAbsolute(d) ? d : path.join(REPO, d);
  if (!fs.existsSync(abs)) {
    console.log(`目录不存在：${d}`);
    process.exit(2);
  }
  for (const file of collectFiles(abs)) {
    scannedFiles += 1;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const word of forbidden) {
      for (let ln = 0; ln < lines.length; ln += 1) {
        if (lines[ln].includes(word)) {
          hits.push({
            dir: d,
            file: path.relative(REPO, file).replaceAll('\\', '/'),
            line: ln + 1,
            word,
            snippet: lines[ln].trim().slice(0, 160)
          });
        }
      }
    }
  }
}

const result = { ok: hits.length === 0, dirs, forbidden, scannedFiles, hits };
if (opts.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  for (const h of hits) console.log(`${h.file}:${h.line} 命中 ${h.word} — ${h.snippet}`);
  console.log(
    hits.length === 0
      ? `OK: 扫描 ${scannedFiles} 个文件，${dirs.join(', ')} 内 ${forbidden.join(', ')} 零命中`
      : `FAIL: ${hits.length} 处命中`
  );
}
process.exit(hits.length === 0 ? 0 : 1);
