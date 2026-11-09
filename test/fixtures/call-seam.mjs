#!/usr/bin/env node
// 仅 test 的编排接缝客户端（需求 v15 M-14 / 拆分 §1.8 / §2.13 / §2.20）。
//
// 连接一个**已经在跑**的核心（ensure:false，绝不顺手拉起），经 IPC 调：
//   test.dispatch            params {instanceId, nodeId}                          -> dispatchToNode
//   test.escalate            params {instanceId, nodeId, reasonCode?, artifactRefs?} -> escalateOnce
//   test.handoff             params {instanceId, nodeId, mutate, edgeKind?, round?}  -> seamHandoff
//   test.delivery            params {instanceId, action}                         -> holdDelivery
//   test.delivery.whenHeld   params {}                                           -> whenDeliveryHeld
// 返回对象原样 JSON.stringify 成**单行**打到 stdout（AC-26/27/32/37/38/43/44 依赖）。
//
// 核心侧契约（WP-4 / WP-6）：
//   成功 -> {ok:true, ...}；escalateOnce 命中既有 pending -> {ok:true, escalationId, reused:true}
//   失败 -> {ok:false, code, detail}；code ∈ NODE_BUSY | WAKE_REJECTED | ESCALATION_WRITE_FAILED
//          WAKE_REJECTED 时 detail.code ∈ NO_PENDING_BACKFLOW | ROUNDS_EXCEEDED | TARGET_NOT_ELIGIBLE
//
// 核心没在跑 -> {"ok":false,"code":"CORE_NOT_RUNNING"}，退出码 2。
// 接缝本身返回失败 -> 退出码 1；成功 -> 0。
// --dry-run 只构造并打印 payload，不连核心（WP-7 夹具自测用，不起核心）。

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
  ['test.handoff', 'test.handoff'],
  ['handoff', 'test.handoff'],
  ['test.delivery', 'test.delivery'],
  ['delivery', 'test.delivery'],
  ['test.delivery.whenHeld', 'test.delivery.whenHeld'],
]);

// server.js / orchestrator.js 冻结的 mutate 字面量（applyHandoffMutation 的 8 个 case）。
const MUTATES = [
  'missing-to', 'missing-field', 'no-evidence', 'remove-evidence',
  'escape-ref', 'hash-mismatch', 'backflow-empty-defects', 'empty-requirements',
];

const ACTIONS = ['hold', 'release', 'cancel'];

const USAGE = [
  '用法：node test/fixtures/call-seam.mjs --root <项目根绝对路径> --instance <实例号> --call <接缝名> [参数]',
  '',
  '  --call 取值（与 server.js 注册的 RPC 方法逐字对齐）：',
  '    dispatchToNode | test.dispatch | dispatch        -> test.dispatch',
  '    escalateOnce   | test.escalate | escalate        -> test.escalate',
  '    test.handoff   | handoff                         -> test.handoff',
  '    test.delivery  | delivery                        -> test.delivery',
  '    test.delivery.whenHeld                           -> test.delivery.whenHeld',
  '',
  '  参数（CLI flag -> RPC payload key，逐字对齐 server.js）：',
  '    --instance <id>        -> instanceId   （各接缝必填）',
  '    --node <nodeId>        -> nodeId       （test.dispatch / test.escalate / test.handoff）',
  '    --reason-code <code>   -> reasonCode   （test.escalate 可选）',
  '    --artifact-ref <ref>   -> artifactRefs （test.escalate 可选，可重复）',
  '    --mutate <值>          -> mutate       （test.handoff 必填）',
  '    --edge-kind <kind>     -> edgeKind     （test.handoff 可选）',
  '    --round <n>            -> round        （test.handoff 可选）',
  '    --action hold|release  -> action       （test.delivery 必填）',
  '',
  `  --mutate 允许值：${MUTATES.join(' / ')}`,
  '  --dry-run               只打印将构造的 {ok, dryRun, method, params}，不连核心',
  '  --help                  打印本用法并 exit 0',
  '',
  '  核心没在跑 -> {"ok":false,"code":"CORE_NOT_RUNNING"}，退出码 2；接缝失败 -> 1；成功 -> 0。',
].join('\n');

function parse(argv) {
  const opts = {
    root: null,
    instance: null,
    call: null,
    node: null,
    reasonCode: null,
    artifactRefs: [],
    mutate: null,
    edgeKind: null,
    round: null,
    action: null,
    help: false,
    dryRun: false,
  };
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
      case '--reason-code': opts.reasonCode = take() ?? null; break;
      case '--artifact-ref': {
        const value = take();
        if (value !== undefined && value !== null && value.length > 0) opts.artifactRefs.push(value);
        break;
      }
      case '--mutate': opts.mutate = take() ?? null; break;
      case '--edge-kind': opts.edgeKind = take() ?? null; break;
      case '--round': opts.round = take() ?? null; break;
      case '--action': opts.action = take() ?? null; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--help': opts.help = true; break;
      default: throw new Error(`未知参数：${key}`);
    }
  }
  return opts;
}

function buildParams(method, opts) {
  // server.js 的 whenDeliveryHeld 是 async () =>，不接收任何 params。
  if (method === 'test.delivery.whenHeld') return {};
  const params = { instanceId: opts.instance };
  if (opts.node) params.nodeId = opts.node;
  switch (method) {
    case 'test.handoff':
      if (opts.mutate) params.mutate = opts.mutate;
      if (opts.edgeKind) params.edgeKind = opts.edgeKind;
      if (opts.round !== null && opts.round !== undefined) params.round = Number(opts.round);
      break;
    case 'test.delivery':
      if (opts.action) params.action = opts.action;
      break;
    case 'test.escalate':
      if (opts.reasonCode) params.reasonCode = opts.reasonCode;
      if (opts.artifactRefs.length > 0) params.artifactRefs = opts.artifactRefs;
      break;
    default:
      break; // test.dispatch / test.delivery.whenHeld
  }
  return params;
}

function validate(opts, method) {
  if (opts.mutate !== null && !MUTATES.includes(opts.mutate)) {
    return `未知 --mutate：${opts.mutate}（允许：${MUTATES.join(' / ')}）`;
  }
  if (opts.action !== null && !ACTIONS.includes(opts.action)) {
    return `未知 --action：${opts.action}（允许：${ACTIONS.join(' / ')}）`;
  }
  if (method === 'test.handoff' && !opts.mutate) return 'test.handoff 需要 --mutate';
  if (method === 'test.delivery' && !opts.action) return 'test.delivery 需要 --action hold|release';
  return null;
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
  if (!opts.call) {
    process.stderr.write(`缺少 --call\n${USAGE}\n`);
    return 2;
  }

  const method = CALLS.get(opts.call);
  if (!method) {
    process.stderr.write(`未知接缝：${opts.call}\n${USAGE}\n`);
    return 2;
  }
  const invalid = validate(opts, method);
  if (invalid) {
    process.stderr.write(`${invalid}\n${USAGE}\n`);
    return 2;
  }

  const params = buildParams(method, opts);
  if (opts.dryRun) {
    emit({ ok: true, dryRun: true, method, params });
    return 0;
  }

  if (!opts.root || !opts.instance) {
    process.stderr.write(`缺少 --root / --instance\n${USAGE}\n`);
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
