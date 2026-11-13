#!/usr/bin/env node
/**
 * Board harness for the node board projection (I1.10a WP-5; AC-24 / AC-35).
 *
 * Reads a payload JSON `{ state, graph, labels? }`, feeds it to the pure
 * `desktop/ui/board/board.js` module and writes the projected board JSON to
 * the output path or stdout. The label table comes from `payload.labels` or,
 * when absent, from `--labels <file>` (the `GET /ui/labels` response body:
 * its `keys` object is used). This harness imports `desktop/ui` modules only
 * (D-9), so it never reaches into the daemon; with neither source present it
 * exits with an error instead of falling back to an empty table (B-12).
 * The board module itself stays pure; every file IO lives here.
 *
 * Usage:
 *   node desktop/harness/board-dump.mjs --payload <board.json> [--labels <labels.json>] [--out <board-out.json>]
 *
 * Exit codes: 0 ok, 1 load failure, 2 bad arguments.
 * Zero npm dependencies; Node built-ins only.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { projectBoard } from '../ui/board/board.js';

const USAGE = 'usage: board-dump.mjs --payload <board.json> [--labels <labels.json>] [--out <board-out.json>]';

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

/**
 * Read a `GET /ui/labels` response body and return its `keys` object.
 *
 * @param {string} file
 * @returns {object}
 */
function readLabelsFile(file) {
  let text;
  try {
    text = fs.readFileSync(path.resolve(file), 'utf8');
  } catch (err) {
    fail(`cannot read labels: ${file} (${err.code ?? err.message})`);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    fail(`cannot parse labels as JSON: ${file} (${err.message})`);
  }
  const keys = parsed !== null && typeof parsed === 'object' ? parsed.keys : null;
  if (keys === null || typeof keys !== 'object' || Array.isArray(keys)) {
    fail(`labels file must be a GET /ui/labels body with a "keys" object: ${file}`);
  }
  return keys;
}

const opts = parseArgs(process.argv.slice(2));

let text;
try {
  text = fs.readFileSync(path.resolve(opts.payload), 'utf8');
} catch (err) {
  fail(`cannot read payload: ${opts.payload} (${err.code ?? err.message})`);
}
let payload;
try {
  payload = JSON.parse(text);
} catch (err) {
  fail(`cannot parse payload as JSON: ${opts.payload} (${err.message})`);
}
if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
  fail(`payload is not an object: ${opts.payload}`);
}

const labels = payload.labels ?? (opts.labels !== null ? readLabelsFile(opts.labels) : null);
if (labels === null || typeof labels !== 'object' || Array.isArray(labels)) {
  fail('no label table: put labels in the payload or pass --labels <file> (GET /ui/labels body)');
}

const board = projectBoard({
  state: payload.state ?? null,
  graph: payload.graph ?? null,
  labels,
});
const output = `${JSON.stringify(board, null, 2)}\n`;

if (opts.out !== null) {
  const target = path.resolve(opts.out);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output, 'utf8');
  process.stdout.write(`board written: ${target}\n`);
} else {
  process.stdout.write(output);
}
