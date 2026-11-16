#!/usr/bin/env node
/**
 * Queue view-model harness (I1.11 WP-8; A-3 / A-4 / AC-08 / AC-43).
 *
 * Reads a payload `{ items, prefs?, labels }` (a buildQueue projection plus
 * optional prefs), feeds it to the pure `desktop/ui/queue/queue.js` module and
 * writes the rendered rows / actions / prefs / notices as JSON. The label table
 * comes from `payload.labels` or `--labels <file>` (a GET /ui/labels body).
 * Imports only desktop/ui modules; all file IO lives here.
 *
 * Usage:
 *   node desktop/harness/queue-dump.mjs --payload <queue.json> [--labels <labels.json>] [--out <out.json>]
 *
 * Exit codes: 0 ok, 1 load/render failure, 2 bad arguments. Node built-ins only.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  renderQueueRow,
  actionsFor,
  emptyText,
  disconnectedText,
  prefsRows,
} from '../ui/queue/queue.js';

const USAGE = 'usage: queue-dump.mjs --payload <queue.json> [--labels <labels.json>] [--out <out.json>]';

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

const items = Array.isArray(payload.items) ? payload.items : [];
const rows = items.map((item) => {
  const row = renderQueueRow(item, labels);
  return { ...row, actions: actionsFor(row, labels) };
});
const output = `${JSON.stringify({
  rows,
  emptyText: rows.length === 0 ? emptyText(labels) : null,
  disconnectedText: payload.disconnected === true ? disconnectedText(labels) : null,
  prefs: prefsRows(payload.prefs ?? null, labels),
}, null, 2)}\n`;

if (opts.out !== null) {
  const target = path.resolve(opts.out);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output, 'utf8');
  process.stdout.write(`queue written: ${target}\n`);
} else {
  process.stdout.write(output);
}
