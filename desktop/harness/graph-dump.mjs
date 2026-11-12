#!/usr/bin/env node
/**
 * Forensics harness for the graph projection (I1.10a WP-4, S-03 phased delivery).
 *
 * Batch 1 exports nodes/edges only: the `legend` and `hover` segments stay
 * `null` until legend.js (WP-5) and highlight.js (WP-6) land, at which point a
 * lazy dynamic import fills them in (never a static import, never a DAG edge).
 *
 * Usage:
 *   node desktop/harness/graph-dump.mjs --project <root> --instance <id> [--payload <out.json>]
 *       Build the projection from disk: state.json, workflow definition,
 *       role registry, landed traces and the event replay are read here (the
 *       projection itself stays pure). With --instance the --payload value is
 *       the OUTPUT payload path; without it, --payload is an INPUT payload.
 *   node desktop/harness/graph-dump.mjs --payload <in.json> [--out <out.json>]
 *       Re-export an existing graph payload, keeping its nodes/edges and
 *       filling the legend/hover segments with their current (null) values.
 *       The output goes to stdout when no output path is given.
 *
 * Exit codes: 0 ok, 1 load/build failure, 2 bad arguments.
 * Zero npm dependencies; Node built-ins only.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { buildGraph } from '../../src/daemon/graph.js';
import { parseYaml } from '../../src/registry/yaml-lite.js';
import { loadRegistry } from '../../src/registry/index.js';
import { readTraces } from '../../src/core/trace.js';
import { getGraph } from '../../src/templates/index.js';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(message === USAGE_ERROR ? 2 : 1);
}

const USAGE_ERROR = 'usage: graph-dump.mjs --project <root> --instance <id> [--payload <out.json>] | --payload <in.json> [--out <out.json>]';

function parseArgs(argv) {
  const opts = { project: null, instance: null, payload: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) fail(`${USAGE_ERROR}\nunexpected argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) fail(`${USAGE_ERROR}\n--${key} needs a value`);
    i += 1;
    if (key === 'project') opts.project = value;
    else if (key === 'instance') opts.instance = value;
    else if (key === 'payload') opts.payload = value;
    else if (key === 'out') opts.out = value;
    else fail(`${USAGE_ERROR}\nunknown flag: --${key}`);
  }
  if (opts.instance !== null && opts.project === null) {
    fail(`${USAGE_ERROR}\n--instance requires --project`);
  }
  if (opts.instance === null && opts.payload === null) {
    fail(`${USAGE_ERROR}\neither --instance (with --project) or --payload is required`);
  }
  return opts;
}

function readJson(file, what) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    fail(`cannot read ${what}: ${file} (${err.code ?? err.message})`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    fail(`cannot parse ${what} as JSON: ${file} (${err.message})`);
  }
}

function readEvents(root, instanceId) {
  const file = path.join(root, '.orch', 'instances', instanceId, 'events.jsonl');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return []; // an instance without an event log projects with rev 0
  }
  const events = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      const value = JSON.parse(trimmed);
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) events.push(value);
    } catch {
      // one broken line never breaks the whole replay
    }
  }
  return events;
}

/**
 * Definition resolution mirrors D-3 ①→②→③: workflowRef yaml first, then the
 * builtin template of the instance, else null (empty graph, readable=false).
 */
function loadWorkflowDef(root, state) {
  const ref = typeof state?.workflowRef === 'string' && state.workflowRef.length > 0
    ? state.workflowRef
    : null;
  if (ref !== null) {
    const file = path.join(root, '.orch', 'workflows', `${ref}.yaml`);
    try {
      const parsed = parseYaml(fs.readFileSync(file, 'utf8'));
      if (parsed.ok && parsed.value !== null && typeof parsed.value === 'object') {
        return parsed.value;
      }
    } catch {
      // fall through to the builtin template, then to the empty graph
    }
  }
  const template = typeof state?.template === 'string' ? state.template : null;
  if (template !== null) {
    const builtin = getGraph(template);
    if (builtin !== null && builtin !== undefined) return builtin;
  }
  return null;
}

function loadRoles(root) {
  try {
    const registry = loadRegistry({ root });
    return registry?.roleMap ?? null;
  } catch {
    return null; // D-3: an absent registry must not mark declared roles unavailable
  }
}

async function buildFromProject(opts) {
  const root = path.resolve(opts.project);
  const state = readJson(
    path.join(root, '.orch', 'instances', opts.instance, 'state.json'),
    'state.json',
  );
  const def = loadWorkflowDef(root, state);
  const roles = loadRoles(root);
  const traces = await readTraces(root, opts.instance);
  const events = readEvents(root, opts.instance);
  return buildGraph({ state, workflowDef: def, roles, traces, events });
}

function emit(payload, outputPath) {
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  if (outputPath !== null) {
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.writeFileSync(outputPath, text, 'utf8');
    process.stdout.write(`graph payload written: ${outputPath}\n`);
  } else {
    process.stdout.write(text);
  }
}

const opts = parseArgs(process.argv.slice(2));

if (opts.instance !== null) {
  const graph = await buildFromProject(opts);
  emit({ legend: null, hover: null, ...graph }, opts.payload ?? opts.out);
} else {
  const payload = readJson(opts.payload, 'payload');
  emit(
    {
      legend: null, // S-03: filled by a lazy import once legend.js (WP-5) lands
      hover: null, // S-03: filled by a lazy import once highlight.js (WP-6) lands
      ...(payload !== null && typeof payload === 'object' ? payload : {}),
    },
    opts.out,
  );
}
