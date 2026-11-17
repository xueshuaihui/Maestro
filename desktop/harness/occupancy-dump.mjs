#!/usr/bin/env node
/**
 * Occupancy view-model harness (I1.11 WP-8; A-6 / AC-26..28 / AC-47).
 *
 * Reads a payload `{ rows, skipped, disconnected, labels }` (a buildOccupancy
 * projection), feeds it to the pure `desktop/ui/occupancy/occupancy.js` module
 * and writes the rendered rows / skipped / disconnect lines as JSON. Label
 * table from `payload.labels` or `--labels <file>` (GET /ui/labels body).
 *
 * Usage:
 *   node desktop/harness/occupancy-dump.mjs --payload <occupancy.json> [--labels <labels.json>] [--out <out.json>]
 *
 * Exit codes: 0 ok, 1 load/render failure, 2 bad arguments. Node built-ins only.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  renderOccupancyRow,
  emptyText,
  skippedText,
  disconnectedText,
} from '../ui/occupancy/occupancy.js';

const USAGE = 'usage: occupancy-dump.mjs --payload <occupancy.json> [--labels <labels.json>] [--out <out.json>]';

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

const rows = Array.isArray(payload.rows) ? payload.rows : [];
const rendered = rows.map((row) => renderOccupancyRow(row, labels));
const output = `${JSON.stringify({
  rows: rendered,
  emptyText: rendered.length === 0 ? emptyText(labels) : null,
  skippedText: skippedText(payload.skipped, labels),
  disconnectedText: payload.disconnected === true ? disconnectedText(labels) : null,
}, null, 2)}\n`;

if (opts.out !== null) {
  const target = path.resolve(opts.out);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output, 'utf8');
  process.stdout.write(`occupancy written: ${target}\n`);
} else {
  process.stdout.write(output);
}
