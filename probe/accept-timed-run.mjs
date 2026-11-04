#!/usr/bin/env node
// 验收辅助：跑一次 orch 命令，并按到达顺序记录每一行 stdout 的相对时间（毫秒）。
// 只读执行，不改被测实现。用法：
//   node probe/accept-timed-run.mjs --root <项目根> -- run --cwd ./demo --task "..."
// 也支持直接跑 status / cancel / core：
//   node probe/accept-timed-run.mjs --root <root> -- status --instance INST-001
// 输出：单行 JSON（便于落盘/断言），字段 lines[{tMs,line}]、exitCode、totalMs。

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORCH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'orch.js');

function parse(argv) {
  const sep = argv.indexOf('--');
  const head = sep >= 0 ? argv.slice(0, sep) : argv;
  const tail = sep >= 0 ? argv.slice(sep + 1) : [];
  const out = { root: process.cwd(), rest: tail };
  for (let i = 0; i < head.length; i += 1) {
    if (head[i] === '--root') {
      out.root = head[i + 1];
      i += 1;
    }
  }
  return out;
}

const args = parse(process.argv.slice(2));
const t0 = process.hrtime.bigint();
const lines = [];

const child = spawn(process.execPath, [ORCH, ...args.rest], {
  cwd: args.root,
  env: process.env,
  windowsHide: true,
});

let buf = '';
child.stdout.on('data', (chunk) => {
  buf += chunk.toString('utf8');
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx);
    buf = buf.slice(idx + 1);
    lines.push({ tMs: Number((process.hrtime.bigint() - t0) / 1000000n), line });
  }
});
child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
});

child.on('close', (code) => {
  if (buf.length > 0) lines.push({ tMs: Number((process.hrtime.bigint() - t0) / 1000000n), line: buf });
  const totalMs = Number((process.hrtime.bigint() - t0) / 1000000n);
  process.stdout.write(JSON.stringify({ root: args.root, argv: args.rest, exitCode: code, totalMs, lines }, null, 2) + '\n');
});
