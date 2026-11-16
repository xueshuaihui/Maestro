#!/usr/bin/env node
/**
 * AC-25 / AC-33 / D-14-C1 real-surface verifier (I1.10b WP-5, contract D13).
 *
 * STRICTLY READ-ONLY. It never writes a file, never deletes anything, never
 * launches the host application, and never touches user ~/.dsh configuration
 * beyond read-only directory listing / reading a session record. No expected
 * identifier is hardcoded: the sessionId under test is passed on the CLI.
 *
 * Usage:
 *   node probe/acc10b-jump-verify.mjs <sessionId> --check process
 *   node probe/acc10b-jump-verify.mjs <sessionId> --check session-dir
 *
 * --check process     Read-only count of live "DeepSeek Harness" processes,
 *                     to prove a click raised exactly one host process
 *                     (0 before, >=1 / ==1 after). Reports the current count;
 *                     it does not itself start any process.
 * --check session-dir D-14 table C1 fact only: is the ACP session id the same
 *                     as the ~/.dsh/sessions/<ws>/<dir> directory name? The
 *                     session's own recorded id (session.v4.jsonl.zstd -> id)
 *                     is read as an independent source, then compared with the
 *                     directory name. Consistent / inconsistent are both legal
 *                     conclusions and neither changes any AC strength (Decision I).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PROCESS_NAME = 'DeepSeek Harness';
const SESSION_FILE = 'session.v4.jsonl.zstd';

function usage(msg) {
  if (msg) process.stderr.write(`error: ${msg}\n`);
  process.stderr.write(
    'usage: node probe/acc10b-jump-verify.mjs <sessionId> --check <process|session-dir>\n',
  );
  return 2;
}

/** Read-only process-table query. Returns the number of matching processes. */
async function countHostProcesses() {
  const platform = process.platform;
  if (platform === 'win32') {
    const { stdout } = await execFileAsync(
      'tasklist.exe',
      ['/FI', `IMAGENAME eq ${PROCESS_NAME}.exe`, '/NH'],
      { encoding: 'utf8', windowsHide: true },
    );
    const lines = String(stdout).split(/\r?\n/);
    return lines.filter((line) => /deepseek\s+harness/i.test(line)).length;
  }
  const { stdout } = await execFileAsync('ps', ['-eo', 'comm='], { encoding: 'utf8' });
  return String(stdout).split(/\r?\n/).filter((line) => /deepseek.?harness/i.test(line)).length;
}

/**
 * Read the id recorded inside one session file (independent of its directory
 * name). Read-only: zstd decompression in memory + a single file read.
 */
function internalSessionId(file) {
  try {
    const raw = zlib.zstdDecompressSync(fs.readFileSync(file));
    const firstLine = raw.toString('utf8').split(/\r?\n/, 1)[0] ?? '';
    const m = firstLine.match(/"id"\s*:\s*"([^"]+)"/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Read-only listing of ~/.dsh/sessions/<ws>/<dir> with C1 comparison rows. */
function sessionDirRows(sessionId) {
  const root = path.join(os.homedir(), '.dsh', 'sessions');
  const rows = [];
  let rootExists = true;
  let workspaces = [];
  try {
    if (!fs.statSync(root).isDirectory()) rootExists = false;
    workspaces = rootExists ? fs.readdirSync(root) : [];
  } catch {
    rootExists = false;
  }
  for (const ws of workspaces) {
    const wsPath = path.join(root, ws);
    let dirs;
    try {
      if (!fs.statSync(wsPath).isDirectory()) continue;
      dirs = fs.readdirSync(wsPath);
    } catch {
      continue;
    }
    for (const dir of dirs) {
      const record = path.join(wsPath, dir, SESSION_FILE);
      let exists = false;
      try { exists = fs.statSync(record).isFile(); } catch { exists = false; }
      if (!exists) continue;
      const internalId = internalSessionId(record);
      rows.push({
        workspace: ws,
        dirName: dir,
        internalId,
        dirEqualsInternalId: internalId === null ? null : dir === internalId,
        matchesGivenSessionId: dir === sessionId,
      });
    }
  }
  return { root, rootExists, rows };
}

function print(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

/** Contract export (D13). */
export async function main(argv = []) {
  const args = argv.slice();
  const checkAt = args.indexOf('--check');
  const sessionId = checkAt > 0 ? args[0] : (args[0] && !args[0].startsWith('--') ? args[0] : null);
  const mode = checkAt !== -1 ? args[checkAt + 1] : null;

  if (!sessionId) return usage('missing <sessionId>');
  if (mode !== 'process' && mode !== 'session-dir') return usage('--check must be process or session-dir');

  if (mode === 'process') {
    try {
      const processCount = await countHostProcesses();
      print({
        check: 'process',
        sessionId,
        processName: PROCESS_NAME,
        processCount,
        evoked: processCount >= 1,
        exactlyOne: processCount === 1,
        readOnly: true,
        note: 'Current live host-process count; the identifier is the caller-supplied value, never hardcoded.',
      });
      return 0;
    } catch (err) {
      print({
        check: 'process', sessionId, error: String(err?.message ?? err),
        note: 'Process table could not be read read-only; no fixture substitution performed.',
      });
      return 1;
    }
  }

  // session-dir -- D-14 table C1, read-only real-surface observation.
  const { root, rootExists, rows } = sessionDirRows(sessionId);
  const compared = rows.filter((r) => r.dirEqualsInternalId !== null);
  const allMatch = compared.length > 0 && compared.every((r) => r.dirEqualsInternalId);
  const anyMismatch = compared.some((r) => !r.dirEqualsInternalId);
  const verdict = compared.length === 0 ? 'no-data' : (anyMismatch ? '不一致' : '一致');
  print({
    check: 'session-dir',
    sessionId,
    dshSessionsRoot: root,
    rootExists,
    sessions: rows,
    summary: {
      total: rows.length,
      compared: compared.length,
      dirEqualsInternalIdCount: compared.filter((r) => r.dirEqualsInternalId).length,
      dirEqualsInternalIdAll: allMatch,
      givenSessionIdMatched: rows.some((r) => r.matchesGivenSessionId),
      c1: verdict,
    },
    note: 'D-14 C1 read-only fact. Consistent or inconsistent are both legal; neither changes AC-25 strength (Decision I).',
  });
  return 0;
}

// CLI entry (only when executed directly, not when imported for contract test).
if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  process.exitCode = await main(process.argv.slice(2));
}
