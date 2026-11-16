#!/usr/bin/env node
/**
 * Asset library view-model harness (I1.11 WP-8; A-5 / AC-19..24 / AC-46).
 *
 * Reads a payload `{ kind, items, counts, dirUnreadable, detail, labels }`,
 * feeds it to the pure `desktop/ui/assets/assets.js` module and writes the
 * tab / count / row / detail text as JSON. Label table from `payload.labels`
 * or `--labels <file>` (GET /ui/labels body). Only desktop/ui is imported.
 *
 * Usage:
 *   node desktop/harness/assets-dump.mjs --payload <assets.json> [--labels <labels.json>] [--out <out.json>]
 *
 * Exit codes: 0 ok, 1 load/render failure, 2 bad arguments. Node built-ins only.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  ASSET_KINDS,
  tabText,
  countText,
  rowText,
  dirUnreadableText,
  detailLines,
} from '../ui/assets/assets.js';

const USAGE = 'usage: assets-dump.mjs --payload <assets.json> [--labels <labels.json>] [--out <out.json>]';

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { payload: null, labels: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) fail(`${USAGE}\nunexpected argument: ${arg}`, 2);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) fail(`${USAGE}\n--${key} needs a value`, 2);
    i += 1;
    if (key === 'payload') opts.payload = value;
    else if (key === 'labels') opts.labels = value;
    else if (key === 'out') opts.out = value;
    else fail(`${USAGE}\nunknown flag: --${key}`, 2);
  }
  if (opts.payload === null) fail(`${USAGE}\n--payload is required`, 2);
  return opts;
}

function readJson(file, what) {
  let text;
  try {
    text = fs.readFileSync(path.resolve(file), 'utf8');
  } catch (err) {
    fail(`cannot read ${what}: ${file} (${err.code ?? err.message})`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    fail(`cannot parse ${what} as JSON: ${file} (${err.message})`);
  }
}

function tableOf(parsed) {
  if (parsed !== null && typeof parsed === 'object' && parsed.keys !== null && typeof parsed.keys === 'object') {
    return parsed.keys;
  }
  return parsed;
}

const opts = parseArgs(process.argv.slice(2));
const payload = readJson(opts.payload, 'payload');
if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
  fail(`payload is not an object: ${opts.payload}`);
}
const labels = payload.labels !== undefined
  ? tableOf(payload.labels)
  : (opts.labels !== null ? tableOf(readJson(opts.labels, 'labels')) : null);
if (labels === null || typeof labels !== 'object' || Array.isArray(labels)) {
  fail('no label table: put labels in the payload or pass --labels (GET /ui/labels body)');
}

const kind = ASSET_KINDS.includes(payload.kind) ? payload.kind : ASSET_KINDS[0];
const items = Array.isArray(payload.items) ? payload.items : [];
const detail = payload.detail && payload.detail.found !== false ? payload.detail : null;
const output = `${JSON.stringify({
  kind,
  tabs: ASSET_KINDS.map((k) => ({ kind: k, text: tabText(k, labels) })),
  countText: payload.dirUnreadable === true ? null : countText(kind, payload.counts ?? {}, labels),
  dirUnreadableText: payload.dirUnreadable === true ? dirUnreadableText(kind, labels) : null,
  rows: items.map((item) => rowText(kind, item, labels)),
  detail: detail === null ? [] : detailLines(kind, detail, labels),
}, null, 2)}\n`;

if (opts.out !== null) {
  const target = path.resolve(opts.out);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output, 'utf8');
  process.stdout.write(`assets written: ${target}\n`);
} else {
  process.stdout.write(output);
}
