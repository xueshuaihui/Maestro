#!/usr/bin/env node
/**
 * Layout harness for the role flow graph (I1.10a WP-5; AC-17 fixture path).
 *
 * Reads a graph payload JSON (the frozen WP-4 projection shape: `nodes` and
 * `edges`; e.g. the output of desktop/harness/graph-dump.mjs), feeds it to
 * the pure `desktop/ui/graph/layout.js` module and writes the layout JSON
 * `{ nodes, edges }` to the output path or stdout. The layout module itself
 * stays pure; every file IO lives here.
 *
 * Usage:
 *   node desktop/harness/layout-dump.mjs --payload <graph.json> [--out <layout.json>]
 *
 * Exit codes: 0 ok, 1 load failure, 2 bad arguments.
 * Zero npm dependencies; Node built-ins only.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { computeLayout } from '../ui/graph/layout.js';

const USAGE = 'usage: layout-dump.mjs --payload <graph.json> [--out <layout.json>]';

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
let graph;
try {
  graph = JSON.parse(text);
} catch (err) {
  fail(`cannot parse payload as JSON: ${opts.payload} (${err.message})`);
}
if (graph === null || typeof graph !== 'object' || Array.isArray(graph)) {
  fail(`payload is not a graph object: ${opts.payload}`);
}

const layout = computeLayout(graph);
const output = `${JSON.stringify({ rev: graph.rev ?? null, ...layout }, null, 2)}\n`;

if (opts.out !== null) {
  const target = path.resolve(opts.out);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output, 'utf8');
  process.stdout.write(`layout written: ${target}\n`);
} else {
  process.stdout.write(output);
}
