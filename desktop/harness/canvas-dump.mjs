#!/usr/bin/env node
/**
 * Canvas view-model harness (I1.11 WP-8; A-7 / AC-29 / AC-31 / AC-45).
 *
 * Reads a payload `{ title, readable, valid, nodes, edges, problems?, labels }`
 * (a buildCanvas projection), feeds it to the pure `desktop/ui/canvas/canvas.js`
 * module and writes the title / badge / degradation / rows as JSON. Layout is
 * produced by the single `graph/layout.js` `computeLayout` on `graphEdges`,
 * exactly as the app wiring does — no second layout. Label table from
 * `payload.labels` or `--labels <file>` (GET /ui/labels body).
 *
 * Usage:
 *   node desktop/harness/canvas-dump.mjs --payload <canvas.json> [--labels <labels.json>] [--out <out.json>]
 *
 * Exit codes: 0 ok, 1 load/render failure, 2 bad arguments. Node built-ins only.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  titleText,
  validationBadge,
  degradeText,
  nodeRow,
  edgeRow,
  graphEdges,
} from '../ui/canvas/canvas.js';
import { computeLayout } from '../ui/graph/layout.js';

const USAGE = 'usage: canvas-dump.mjs --payload <canvas.json> [--labels <labels.json>] [--out <out.json>]';

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

const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
const edges = Array.isArray(payload.edges) ? payload.edges : [];
const degrade = degradeText(payload, labels);
const nodeRows = nodes.map((node) => nodeRow(node, labels));
const edgeRows = edges.map((edge) => edgeRow(edge, labels));
const layout = computeLayout({ nodes, edges: graphEdges(payload) });
const placed = [];
for (const pos of layout.nodes) {
  const row = nodeRows.find((entry) => entry.id === pos.id);
  if (row) placed.push({ ...row, x: pos.x, y: pos.y, layer: pos.layer });
}
const output = `${JSON.stringify({
  title: titleText(payload, labels),
  badge: validationBadge(payload, labels),
  degrade,
  nodes: placed,
  edges: edgeRows,
}, null, 2)}\n`;

if (opts.out !== null) {
  const target = path.resolve(opts.out);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output, 'utf8');
  process.stdout.write(`canvas written: ${target}\n`);
} else {
  process.stdout.write(output);
}
