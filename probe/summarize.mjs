#!/usr/bin/env node
// Rebuilds probe/runs/frames.jsonl from the per-run logs and prints a summary
// of the runs the report cites. Usage: node probe/summarize.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = path.join(ROOT, 'probe', 'runs');
const ORDER = ['write-01', 'write-02', 'write-03', 'busy-01', 'cancel-01', 'cancel-02', 'acl-repro-01'];

const all = [];
for (const id of ORDER) {
  const f = path.join(RUNS, id, 'frames.jsonl');
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) if (line.trim()) all.push(JSON.parse(line));
}
fs.writeFileSync(path.join(RUNS, 'frames.jsonl'), all.map((r) => JSON.stringify(r)).join('\n') + '\n');

const summary = ORDER.map((id) => {
  const r = JSON.parse(fs.readFileSync(path.join(RUNS, id, 'result.json'), 'utf8'));
  return {
    runId: id,
    mode: r.mode,
    cwd: r.cwd,
    ok: r.ok,
    framing: r.framing,
    stopReason: r.stopReason,
    timingsMs: r.timingsMs,
    firstPromptFrame: r.firstPromptFrame,
    updates: r.updates,
    toolCalls: (r.toolCalls ?? []).map((t) => `${t.title}:${t.statuses.join('>')}`),
    assertions: r.assertions,
    file: r.file && { path: r.file.path, bytes: r.file.bytes, sha256: r.file.sha256, content: r.file.content },
    busy: r.busy,
    cancel: r.cancel,
    permissionsRequested: r.permissionsRequested,
  };
});
fs.writeFileSync(path.join(RUNS, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
