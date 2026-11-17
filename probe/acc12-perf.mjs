#!/usr/bin/env node
/**
 * I1.12 WP-6 / AC-21 real-surface performance probe (freeze point 6, D-11).
 *
 * STRICTLY READ-ONLY with respect to the host: it only stats/lists/reads the
 * local DSH session records and any supplied instance artifacts, decompresses
 * session records in memory, and prints a graded report. The report `level`
 * is an ASCII machine key (PERF_LEVEL_*); verbatim Chinese presentation is
 * owned by labels.js (WP-7) and is never hardcoded here. It never launches a
 * host process, never writes user-host configuration, and never substitutes a
 * mock result for a real-host measurement. The ONLY write in this file is the
 * optional `--out` report dump.
 *
 * Usage:
 *   node probe/acc12-perf.mjs --check
 *   node probe/acc12-perf.mjs --dsh-home <dir> --instances <dir> [--out <file>]
 *
 * Exit code 0 for BOTH a measured result and a blocked/uncollected result:
 * "blocked is not a failure; a false pass is" (ruling A item 3 / line 483).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import {
  PERF_LEVELS,
  PERF_TARGETS,
  collectHandoffLatency,
  buildPerfReport
} from '../src/core/perf-baseline.js';

const SESSION_FILE = 'session.v4.jsonl.zstd';
const DSH_VERSION = 'DSH 0.2.2-rc.1';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage(msg) {
  if (msg) process.stderr.write(`error: ${msg}\n`);
  process.stderr.write(
    'usage: node probe/acc12-perf.mjs [--check] [--dsh-home <dir>] [--instances <dir>] [--out <file>]\n'
  );
  return 2;
}

function parseArgs(argv) {
  const opts = { check: false, dshHome: null, instances: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') {
      opts.check = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }
    if (arg === '--dsh-home' || arg === '--instances' || arg === '--out') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value`);
      }
      opts[{ '--dsh-home': 'dshHome', '--instances': 'instances', '--out': 'out' }[arg]] = value;
      i += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return opts;
}

function isDirectory(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function readJsonLines(file) {
  const rows = [];
  try {
    const raw = fs.readFileSync(file, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed && typeof parsed === 'object') rows.push(parsed);
      } catch {
        // Unreadable line: skipped, never fatal (D-11 tolerance).
      }
    }
  } catch {
    // Missing/unreadable artifact: contributes to an uncollected result.
  }
  return rows;
}

function handoffLike(row) {
  const marker = String(row?.reason ?? row?.type ?? row?.update ?? '');
  return marker.includes('handoff') || row?.sessionUpdate === 'handoff';
}

function elapsedMs(row) {
  const start = Number(row?.deliveredAt ?? row?.createdAt);
  const end = Number(row?.arrivedAt ?? row?.firstEventAt ?? row?.timestamp);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null;
}

/** Read-only DSH session inventory; decompresses each record in memory. */
function observeDsh(dshHome, triedPaths) {
  const sessionsRoot = path.join(dshHome, 'sessions');
  triedPaths.push(sessionsRoot);
  const rootExists = isDirectory(sessionsRoot);
  const records = [];
  if (rootExists) {
    for (const workspace of fs.readdirSync(sessionsRoot)) {
      const workspaceDir = path.join(sessionsRoot, workspace);
      if (!isDirectory(workspaceDir)) continue;
      for (const dir of fs.readdirSync(workspaceDir)) {
        const record = path.join(workspaceDir, dir, SESSION_FILE);
        if (!isFile(record)) continue;
        triedPaths.push(record);
        try {
          const raw = zlib.zstdDecompressSync(fs.readFileSync(record)).toString('utf8');
          const rows = raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
          const handoffs = rows.filter(handoffLike);
          const meta = rows[0] ?? {};
          records.push({
            workspace,
            dir,
            id: meta.id ?? null,
            createdAt: meta.createdAt ?? null,
            handoffRecords: handoffs.length,
            timedHandoffs: handoffs.filter((row) => elapsedMs(row) !== null).length
          });
        } catch {
          records.push({ workspace, dir, id: null, unreadable: true });
        }
      }
    }
  }
  return { root: sessionsRoot, rootExists, records };
}

/** Read-only scan of instance artifacts for delivered -> first-event spans. */
function observeInstances(root, triedPaths) {
  const result = { root, rootExists: false, dirs: 0, samples: 0 };
  if (!root || !isDirectory(root)) return result;
  triedPaths.push(root);
  result.rootExists = true;
  const events = [];
  const spans = [];
  for (const dir of fs.readdirSync(root)) {
    const base = path.join(root, dir);
    if (!isDirectory(base)) continue;
    result.dirs += 1;
    const eventsFile = path.join(base, 'events.jsonl');
    const tracesFile = path.join(base, 'state', 'traces.jsonl');
    if (isFile(eventsFile)) {
      triedPaths.push(eventsFile);
      events.push(...readJsonLines(eventsFile));
    }
    if (isFile(tracesFile)) {
      triedPaths.push(tracesFile);
      spans.push(...readJsonLines(tracesFile));
    }
  }
  const collected = collectHandoffLatency({ events, spans });
  result.samples = collected.samples.length;
  result.samplesData = collected.samples;
  return result;
}

/**
 * Contract export. Read-only real-surface collection; returns the process exit
 * code. A blocked/uncollected result is a legal conclusion and returns 0.
 */
export async function main(argv = []) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    return usage(String(err?.message ?? err));
  }
  if (opts.help) {
    usage();
    return 0;
  }

  const dshHome = opts.dshHome || path.join(os.homedir(), '.dsh');
  const defaultInstances = path.join(REPO_ROOT, '.orch', 'instances');
  const instancesRoot = opts.instances || (isDirectory(defaultInstances) ? defaultInstances : null);
  const triedPaths = [];

  const dsh = observeDsh(dshHome, triedPaths);
  const instances = observeInstances(instancesRoot, triedPaths);

  const samples = instances.samplesData ?? [];
  const realInstances = new Set(samples.map((sample) => sample.instanceId).filter(Boolean)).size;
  const realSessions = new Set(samples.map((sample) => sample.sessionId).filter(Boolean)).size;
  const evidenceCollected = samples.length > 0
    && realInstances >= PERF_TARGETS.concurrentInstances
    && realSessions >= PERF_TARGETS.activeSessions;
  const evidenceLevel = evidenceCollected ? PERF_LEVELS.real : PERF_LEVELS.pending;

  const base = buildPerfReport({
    samples,
    evidenceLevel,
    target: PERF_TARGETS
  });

  const report = {
    ...base,
    check: 'perf-baseline',
    readOnly: true,
    host: DSH_VERSION,
    load: { ...PERF_TARGETS },
    observed: {
      dshRootExists: dsh.rootExists,
      dshSessionRecords: dsh.records.length,
      dshRecordsWithHandoff: dsh.records.filter((row) => row.handoffRecords > 0).length,
      dshTimedHandoffs: dsh.records.reduce((sum, row) => sum + (row.timedHandoffs ?? 0), 0),
      instanceRoot: instances.root,
      instanceRootExists: instances.rootExists,
      instanceDirs: instances.dirs,
      handoffSamples: samples.length,
      distinctInstances: realInstances,
      distinctSessions: realSessions
    },
    triedPaths,
    conclusion: evidenceCollected ? 'MEASURED_REAL_HOST' : 'BLOCKED_UNCOLLECTED',
    note: evidenceCollected
      ? 'Real-host handoff evidence collected read-only; no mock data used.'
      : 'Real-host handoff evidence not collected; blocked, not failed. Mock data never substituted.'
  };

  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  process.stdout.write(serialized);
  if (opts.out) {
    // The sole write in this probe: the caller-requested report dump.
    fs.writeFileSync(opts.out, serialized, 'utf8');
  }
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  process.exitCode = await main(process.argv.slice(2));
}
