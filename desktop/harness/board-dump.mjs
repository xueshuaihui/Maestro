#!/usr/bin/env node
/**
 * Board harness for the node board projection (I1.10a WP-5; AC-24 / AC-35).
 *
 * Reads a payload JSON `{ state, graph, labels? }`, feeds it to the pure
 * `desktop/ui/board/board.js` module and writes the projected board JSON to
 * the output path or stdout. When the payload carries no `labels`, the
 * frozen desktop label keys (`DESKTOP_LABEL_KEYS`) are used, so column names
 * and fold/unknown texts always come from the single CJK source. The board
 * module itself stays pure; every file IO lives here.
 *
 * Usage:
 *   node desktop/harness/board-dump.mjs --payload <board.json> [--out <board-out.json>]
 *
 * Exit codes: 0 ok, 1 load failure, 2 bad arguments.
 * Zero npm dependencies; Node built-ins only.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { projectBoard } from '../ui/board/board.js';
import { DESKTOP_LABEL_KEYS } from '../../src/daemon/http/labels.js';

const USAGE = 'usage: board-dump.mjs --payload <board.json> [--out <board-out.json>]';

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { payload: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) fail(`${USAGE}\nunexpected argument: ${arg}`, 2);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) fail(`${USAGE}\n--${key} needs a value`, 2);
    i += 1;
    if (key === 'payload') opts.payload = value;
    else if (key === 'out') opts.out = value;
    else fail(`${USAGE}\nunknown flag: --${key}`, 2);
  }
  if (opts.payload === null) fail(`${USAGE}\n--payload is required`, 2);
  return opts;
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

const board = projectBoard({
  state: payload.state ?? null,
  graph: payload.graph ?? null,
  labels: payload.labels ?? DESKTOP_LABEL_KEYS,
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
