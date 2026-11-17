#!/usr/bin/env node
/**
 * Evidence view-model harness (I1.11 WP-8; A-8 / AC-32..34 / AC-42).
 *
 * Reads a payload `{ instanceId, items, labels }` (a buildEvidence projection),
 * feeds it to the pure `desktop/ui/evidence/evidence.js` module and writes the
 * per-item A-8 lines plus the composed text and the 64 KB gate result as JSON.
 * No log body or session text is read here. Label table from `payload.labels`
 * or `--labels <file>` (GET /ui/labels body).
 *
 * Usage:
 *   node desktop/harness/evidence-dump.mjs --payload <evidence.json> [--labels <labels.json>] [--out <out.json>]
 *
 * Exit codes: 0 ok, 1 load/render failure, 2 bad arguments. Node built-ins only.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { renderEvidence } from '../ui/evidence/evidence.js';

const USAGE = 'usage: evidence-dump.mjs --payload <evidence.json> [--labels <labels.json>] [--out <out.json>]';

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

const result = renderEvidence(payload, labels);
const output = `${JSON.stringify(result, null, 2)}\n`;

if (opts.out !== null) {
  const target = path.resolve(opts.out);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output, 'utf8');
  process.stdout.write(`evidence written: ${target}\n`);
} else {
  process.stdout.write(output);
}
