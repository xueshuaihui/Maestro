#!/usr/bin/env node
/**
 * Acceptance harness: collect the desktop instance list over the live channel
 * (I1.10a WP-3; AC-03 fixture step). Reads the D-1 credentials file
 * `<project>/.orch/desktop.json`, fetches `GET /instances` and `GET /ui/labels`
 * from the loopback channel, and writes one combined JSON payload
 * `{items, labels}` (the render-list harness input). It only consumes the
 * read-only interface; no instance is ever started from here.
 *
 * Usage:
 *   node desktop/harness/collect.mjs --project <root> [--out <payload.json>]
 *
 * Exit codes: 0 ok, 1 fetch/read failure, 2 bad arguments.
 * Zero npm dependencies; Node built-ins only (Node 22 global fetch).
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const USAGE_ERROR =
  'usage: collect.mjs --project <root> [--out <payload.json>]';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(message === USAGE_ERROR ? 2 : 1);
}

function parseArgs(argv) {
  const opts = { project: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) fail(`${USAGE_ERROR}\nunexpected argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) fail(`${USAGE_ERROR}\n--${key} needs a value`);
    i += 1;
    if (key === 'project') opts.project = value;
    else if (key === 'out') opts.out = value;
    else fail(`${USAGE_ERROR}\nunknown flag: --${key}`);
  }
  if (opts.project === null) fail(`${USAGE_ERROR}\n--project is required`);
  return opts;
}

async function fetchJson(url, headers, what) {
  let res;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    fail(`cannot reach the desktop channel for ${what}: ${url} (${err?.message ?? err})`);
  }
  if (!res.ok) {
    fail(`${what} answered HTTP ${res.status}`);
  }
  try {
    return await res.json();
  } catch (err) {
    fail(`${what} returned a non-JSON body (${err?.message ?? err})`);
  }
}

const opts = parseArgs(process.argv.slice(2));
const root = path.resolve(opts.project);

let meta;
try {
  meta = JSON.parse(fs.readFileSync(path.join(root, '.orch', 'desktop.json'), 'utf8'));
} catch (err) {
  fail(`cannot read desktop.json under ${root} (${err?.message ?? err})`);
}
if (!Number.isInteger(meta?.port) || typeof meta?.token !== 'string') {
  fail(`desktop.json under ${root} has no {port, token} credentials`);
}

const headers = { Authorization: `Bearer ${meta.token}` };
const base = `http://127.0.0.1:${meta.port}`;

const list = await fetchJson(`${base}/instances`, headers, 'GET /instances');
const labelsPayload = await fetchJson(`${base}/ui/labels`, headers, 'GET /ui/labels');

const payload = {
  items: Array.isArray(list?.items) ? list.items : [],
  labels: labelsPayload?.keys ?? {},
};

const text = `${JSON.stringify(payload, null, 2)}\n`;
if (opts.out !== null) {
  fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
  fs.writeFileSync(opts.out, text, 'utf8');
  process.stdout.write(`instance list payload written: ${opts.out}\n`);
} else {
  process.stdout.write(text);
}
