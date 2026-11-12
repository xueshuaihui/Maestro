#!/usr/bin/env node
/**
 * Acceptance harness: render the instance list rows from a collected payload
 * (I1.10a WP-3; AC-03 / AC-04 machine check). Imports only the
 * `desktop/ui/list` pure modules — sorting, rows, empty and unreadable states
 * all go through the same code the interface uses, so the harness output is
 * the verbatim A-1 / A-2 baseline comparison source.
 *
 * Usage:
 *   node desktop/harness/render-list.mjs --payload <instances.json>
 *
 * The payload is the collect.mjs output: `{items, labels}`. Rows print to
 * stdout one per line; the empty state prints its single line.
 *
 * Exit codes: 0 ok, 1 read/render failure, 2 bad arguments.
 * Zero npm dependencies; Node built-ins only.
 */

import fs from 'node:fs';
import process from 'node:process';

import {
  renderListEmpty,
  renderListRow,
  renderListUnreadable,
  sortInstances,
} from '../ui/list/list.js';

const USAGE_ERROR = 'usage: render-list.mjs --payload <instances.json>';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(message === USAGE_ERROR ? 2 : 1);
}

function parseArgs(argv) {
  const opts = { payload: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) fail(`${USAGE_ERROR}\nunexpected argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) fail(`${USAGE_ERROR}\n--${key} needs a value`);
    i += 1;
    if (key === 'payload') opts.payload = value;
    else fail(`${USAGE_ERROR}\nunknown flag: --${key}`);
  }
  if (opts.payload === null) fail(`${USAGE_ERROR}\n--payload is required`);
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

let payload;
try {
  payload = JSON.parse(fs.readFileSync(opts.payload, 'utf8'));
} catch (err) {
  fail(`cannot read payload: ${opts.payload} (${err?.message ?? err})`);
}
if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
  fail(`payload is not an object: ${opts.payload}`);
}

const items = Array.isArray(payload.items) ? payload.items : [];
const labels = payload.labels ?? {};

const sorted = sortInstances(items);
const lines = sorted.length === 0
  ? [renderListEmpty(labels)]
  : sorted.map((instance) =>
      instance?.readable === false
        ? renderListUnreadable(instance?.instanceId, labels)
        : renderListRow(instance, labels),
    );

process.stdout.write(`${lines.join('\n')}\n`);
