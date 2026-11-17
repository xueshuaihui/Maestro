#!/usr/bin/env node
/**
 * Text/structure projection harness for the pure drill modules (I1.10b WP-3,
 * contract A1 / D11). Same CLI shape as the other dump scripts in this folder.
 *
 * Usage:
 *   node desktop/harness/drill-dump.mjs --payload <fixture.json> --role <roleId>
 *        [--node <id>] [--edge <id>] [--escalations <instanceId>] [--out <file>]
 *
 * The payload carries the frozen projection segments (`breadcrumb`, `roleBar`,
 * `dag`, `cards`, and optionally `detail`, `connection`, `escalations`) plus a
 * flat `labels` table. All wording is produced by the imported pure modules.
 * This file owns the only filesystem work; the modules themselves stay pure.
 *
 * Exit codes: 0 ok, 1 load/build failure, 2 bad arguments.
 * Zero npm dependencies; Node built-ins only.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { createDrillView } from '../ui/drill/index.js';

const USAGE = 'usage: drill-dump.mjs --payload <fixture.json> --role <roleId> [--node <id>] [--edge <id>] [--escalations <instanceId>] [--out <file>]';

function parseArgs(argv) {
  const opts = { payload: null, role: null, node: null, edge: null, escalations: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${key} needs a value`);
    i += 1;
    if (key === 'payload') opts.payload = value;
    else if (key === 'role') opts.role = value;
    else if (key === 'node') opts.node = value;
    else if (key === 'edge') opts.edge = value;
    else if (key === 'escalations') opts.escalations = value;
    else if (key === 'out') opts.out = value;
    else throw new Error(`unknown flag: --${key}`);
  }
  if (opts.payload === null) throw new Error('--payload is required');
  if (opts.role === null) throw new Error('--role is required');
  return opts;
}

function readJson(file) {
  const text = fs.readFileSync(path.resolve(file), 'utf8');
  return JSON.parse(text);
}

function emit(payload, outputPath) {
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  if (outputPath !== null) {
    const target = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text, 'utf8');
    process.stdout.write(`drill payload written: ${target}\n`);
  } else {
    process.stdout.write(text);
  }
}

export async function main(argv = []) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`${USAGE}\n${err.message}\n`);
    return 2;
  }

  let payload;
  try {
    payload = readJson(opts.payload);
  } catch (err) {
    process.stderr.write(`cannot read payload: ${opts.payload} (${err.code ?? err.message})\n`);
    return 1;
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    process.stderr.write(`payload is not an object: ${opts.payload}\n`);
    return 1;
  }

  const data = { ...payload };
  if (typeof data.breadcrumb === 'object' && data.breadcrumb !== null) {
    data.breadcrumb = { ...data.breadcrumb };
    if (data.breadcrumb.roleId === undefined) data.breadcrumb.roleId = opts.role;
  }
  if (typeof data.roleBar === 'object' && data.roleBar !== null) {
    data.roleBar = { ...data.roleBar };
    if (data.roleBar.roleId === undefined) data.roleBar.roleId = opts.role;
  }

  let view;
  try {
    view = createDrillView({
      labels: data.labels ?? {},
      data,
      interactions: {
        now: data.now,
        clock: () => 0,
        nodeId: opts.node,
      },
    });
  } catch (err) {
    process.stderr.write(`cannot project payload: ${err.message}\n`);
    return 1;
  }

  emit({
    breadcrumb: view.breadcrumb,
    roleBar: view.roleBar,
    dag: view.dag,
    cards: view.cards,
    detail: opts.node === null ? null : view.detail,
    connection: opts.edge === null ? null : view.connection,
    escalations: opts.escalations === null ? null : view.escalations,
  }, opts.out);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}

export default main;
