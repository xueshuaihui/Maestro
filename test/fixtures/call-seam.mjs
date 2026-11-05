#!/usr/bin/env node
// 仅 test 的编排接缝客户端（需求 v15 M-14 / 拆分 §1.8 / §2.13）。
//
// 连接一个**已经在跑**的核心（ensure:false，绝不顺手拉起），经 IPC 调：
//   test.dispatch  params {instanceId, nodeId}   → dispatchToNode
//   test.escalate  params {instanceId, nodeId}   → escalateOnce
// 返回对象原样 JSON.stringify 成**单行**打到 stdout（AC-26/27/32/37/38/43/44 依赖）。
//
// 核心侧契约（WP-4）：
//   成功 → {ok:true, ...}；escalateOnce 命中既有 pending → {ok:true, escalationId, reused:true}
//   失败 → {ok:false, code, detail}；code ∈ NODE_BUSY | WAKE_REJECTED | ESCALATION_WRITE_FAILED
//          WAKE_REJECTED 时 detail.code ∈ NO_PENDING_BACKFLOW | ROUNDS_EXCEEDED | TARGET_NOT_ELIGIBLE
//
// 核心没在跑 → {"ok":false,"code":"CORE_NOT_RUNNING"}，退出码 2。
// 接缝本身返回失败 → 退出码 1；成功 → 0。

import path from 'node:path';
import fs from 'node:fs';

import { createClient } from '../../src/daemon/client.js';

const CALLS = new Map([
  ['dispatchToNode', 'test.dispatch'],
  ['test.dispatch', 'test.dispatch'],
  ['dispatch', 'test.dispatch'],
  ['escalateOnce', 'test.escalate'],
  ['test.escalate', 'test.escalate'],
  ['escalate', 'test.escalate'],
]);

const USAGE = [
  '用法：node test/fixtures/call-seam.mjs --root <项目根绝对路径> --instance <实例号>',
  '        --call dispatchToNode|escalateOnce [--node <nodeId>]',
].join('\n');

function parse(argv) {
  const opts = { root: null, instance: null, call: null, node: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const key = eq >= 0 ? arg.slice(0, eq) : arg;
    const inline = eq >= 0 ? arg.slice(eq + 1) : undefined;
    const take = () => {
      if (inline !== undefined) return inline;
      i += 1;
      return argv[i];
    };
    switch (key) {
      case '--root': opts.root = take() ?? null; break;
      case '--instance': opts.instance = take() ?? null; break;
      case '--call': opts.call = take() ?? null; break;
      case '--node': opts.node = take() ?? null; break;
      case '--help': opts.help = true; break;
      default: throw new Error(`未知参数：${key}`);
    }
  }
  return opts;
}

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

async function main(argv) {
  let opts;
  try {
    opts = parse(argv);
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${USAGE}\n`);
    return 2;
  }
  if (opts.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (!opts.root || !opts.instance || !opts.call) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }

  const method = CALLS.get(opts.call);
  if (!method) {
    process.stderr.write(`未知接缝：${opts.call}\n${USAGE}\n`);
    return 2;
  }

  const root = path.resolve(opts.root);
  if (!fs.existsSync(root)) {
    emit({ ok: false, code: 'CORE_NOT_RUNNING', detail: { root } });
    return 2;
  }

  const client = createClient({ root });
  try {
    const connected = await client.connect({ ensure: false, hotRetryMs: 1500 });
    if (!connected?.ok) {
      emit({ ok: false, code: 'CORE_NOT_RUNNING' });
      return 2;
    }

    const params = { instanceId: opts.instance };
    if (opts.node) params.nodeId = opts.node;
    const res = await client.request(method, params, { timeoutMs: 30_000 });

    if (res?.ok === true) {
      const result = res.result;
      emit(result && typeof result === 'object' && !Array.isArray(result)
        ? { ok: true, ...result }
        : { ok: true, result: result ?? null });
      return 0;
    }

    emit({
      ok: false,
      code: res?.code ?? 'UNKNOWN_ERROR',
      ...(res?.params === undefined ? {} : { detail: res.params }),
    });
    return 1;
  } finally {
    await client.close();
  }
}

const code = await main(process.argv.slice(2));
process.exit(code);
