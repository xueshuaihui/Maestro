#!/usr/bin/env node
// 验收证据落盘：把某实例的 state.json 快照与 events.jsonl 原样复制到 evidence 目录。
// 用法：
//   node probe/accept-collect.mjs --root <项目根> --instance INST-001 --ac AC-01 [--out <dir>]
// 产出：<out>/AC-01.state.json、<out>/AC-01.events.jsonl、<out>/AC-01.meta.json
// 绝不改写数据：state 原样（格式化后仍等值）；events 逐字节复制。

import fs from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = { root: null, instance: null, ac: null, out: 'docs/iterations/iteration-1/evidence' };
for (let i = 0; i < argv.length; i += 1) {
  const k = argv[i];
  if (k === '--root') { opt.root = argv[i + 1]; i += 1; }
  else if (k === '--instance') { opt.instance = argv[i + 1]; i += 1; }
  else if (k === '--ac') { opt.ac = argv[i + 1]; i += 1; }
  else if (k === '--out') { opt.out = argv[i + 1]; i += 1; }
}

if (!opt.root || !opt.instance || !opt.ac) {
  console.error('用法：--root <项目根> --instance <实例号> --ac AC-xx [--out <dir>]');
  process.exit(2);
}

const dir = path.join(opt.root, '.orch', 'instances', opt.instance);
const outDir = path.resolve(process.cwd(), opt.out);
await fs.mkdir(outDir, { recursive: true });

const stateSrc = path.join(dir, 'state.json');
const eventsSrc = path.join(dir, 'events.jsonl');

let stateText = null;
try {
  stateText = await fs.readFile(stateSrc, 'utf8');
} catch (err) {
  stateText = null;
}

let parsed = null;
let parseError = null;
try {
  parsed = stateText === null ? null : JSON.parse(stateText);
} catch (err) {
  parseError = String(err?.message ?? err);
}

if (stateText !== null) {
  await fs.writeFile(path.join(outDir, `${opt.ac}.state.json`), stateText, 'utf8');
}

let eventLines = [];
let eventsRaw = '';
try {
  eventsRaw = await fs.readFile(eventsSrc, 'utf8');
  eventLines = eventsRaw.split('\n').filter((l) => l.trim() !== '');
  await fs.writeFile(path.join(outDir, `${opt.ac}.events.jsonl`), eventsRaw, 'utf8');
} catch {
  await fs.writeFile(path.join(outDir, `${opt.ac}.events.jsonl`), '', 'utf8');
}

const meta = {
  ac: opt.ac,
  root: opt.root,
  instanceId: opt.instance,
  collectedAt: new Date().toISOString(),
  stateFileExists: stateText !== null,
  stateParseError: parseError,
  state: parsed
    ? {
        instance: parsed.state,
        node: parsed.node?.state ?? null,
        session: parsed.session?.state ?? null,
        handoff: parsed.handoff?.state ?? null,
        handoffRejectReason: parsed.handoff?.rejectReason ?? null,
        handoffTimestamps: parsed.handoff
          ? {
              createdAt: parsed.handoff.createdAt ?? null,
              deliveredAt: parsed.handoff.deliveredAt ?? null,
              acceptedAt: parsed.handoff.acceptedAt ?? null,
              consumedAt: parsed.handoff.consumedAt ?? null,
              rejectedAt: parsed.handoff.rejectedAt ?? null,
            }
          : null,
        artifactRefs: parsed.artifactRefs ?? [],
        nodeFailure: parsed.node?.failure ?? null,
        hostRaw: parsed.hostRaw ?? null,
      }
    : null,
  eventCount: eventLines.length,
  events: eventLines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { __badLine: line };
    }
  }),
};

await fs.writeFile(path.join(outDir, `${opt.ac}.meta.json`), JSON.stringify(meta, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ ok: true, ac: opt.ac, state: meta.state, eventCount: meta.eventCount }, null, 2));
