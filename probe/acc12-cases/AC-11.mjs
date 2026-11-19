/**
 * AC-11 · 预算与配额：并行度上限排队（mock / 夹具面）。
 * 5 就绪上限 2 → 执行 ≤2、等待 ≥3、完成一个补位一个、无 failed。
 */
import path from 'node:path';

import { ACC12_PATHS, freshRoot, writeJson, readText, cleanupRoot } from '../acc12-f-lib.mjs';
import {
  makeCase, eq, check, verify, evidence, note, finish,
} from '../acc12-f-common.mjs';

import { decideParallelism } from '../../src/core/budget.js';
import { parallelismGate } from '../../src/core/orchestrator.js';

const CONFIG = {
  maxConcurrent: 2,
  instanceBudget: { roles: [{ id: 'role-a', max_concurrent_sessions: 2 }] },
};

function byState(state, wanted) {
  return state.nodes.filter((node) => node.state === wanted);
}

function dispatch(state, config) {
  const decision = decideParallelism({
    readyNodes: byState(state, 'ready'),
    runningNodes: byState(state, 'running'),
    maxConcurrent: config.maxConcurrent,
    instanceBudget: config.instanceBudget,
  });
  for (const id of decision.allowed) {
    state.nodes.find((node) => node.id === id).state = 'running';
  }
  return {
    decision,
    running: byState(state, 'running').length,
    waiting: byState(state, 'ready').length,
    failed: byState(state, 'failed').length,
  };
}

export async function run() {
  const c = makeCase('AC-11', { scenario: 'parallel', title: '并行度上限排队' });
  c.root = freshRoot('parallel-ac11');
  const state = {
    instanceId: 'INST-001',
    nodes: ['T-001', 'T-002', 'T-003', 'T-004', 'T-005'].map((id) => ({ id, state: 'ready', round: 4 })),
  };

  try {
    const fixture = path.join(c.root, 'parallel.json');
    writeJson(fixture, state);
    evidence(c, 'fixture', 'parallel.json', readText(fixture));

    const initial = dispatch(state, CONFIG);
    evidence(c, 'verify', 'decision-initial.json', JSON.stringify(initial, null, 2));
    evidence(c, 'verify', 'state-after-initial.json', JSON.stringify(state, null, 2));

    verify(c, 'Then：任一时刻最多 2 个节点进入执行', initial.running, (n) => n <= 2, '<= 2');
    verify(c, 'Then：其余就绪节点至少 3 个保持等待', initial.waiting, (n) => n >= 3, '>= 3');
    eq(c, '机检：allowed 恰 2 个', initial.decision.allowed.length, 2);
    eq(c, '机检：queued 恰 3 个', initial.decision.queued.length, 3);
    eq(c, '机检：limit=2（实例与角色 max_concurrent_sessions 取小）', initial.decision.limit, 2);
    eq(c, '机检：reason=null', initial.decision.reason, null);
    eq(c, 'Then：没有节点因此失败（failed=0）', initial.failed, 0);

    const queuedGate = parallelismGate({
      budget: { decideParallelism },
      input: {
        readyNodes: ['T-003', 'T-004', 'T-005'], runningNodes: ['T-001', 'T-002'],
        maxConcurrent: 2, instanceBudget: CONFIG.instanceBudget,
      },
      nodeId: 'T-003', explicit: true,
    });
    evidence(c, 'verify', 'gate-waiting.json', JSON.stringify(queuedGate.verdict, null, 2));
    eq(c, '机检：超限节点保持 queued（PARALLEL_LIMIT）', queuedGate.verdict?.code, 'PARALLEL_LIMIT');
    eq(c, '机检：超限判定返回 3 个排队节点', queuedGate.verdict?.queued.length, 3);

    const completed = state.nodes.find((node) => node.state === 'running');
    completed.state = 'done';
    const backfill = dispatch(state, CONFIG);
    evidence(c, 'verify', 'decision-backfill.json', JSON.stringify(backfill, null, 2));
    evidence(c, 'verify', 'state-after-backfill.json', JSON.stringify(state, null, 2));
    eq(c, 'Then：完成一个后按序补位一个（allowed=1）', backfill.decision.allowed.length, 1);
    eq(c, '机检：等待数减一（queued=2）', backfill.decision.queued.length, 2);
    eq(c, 'Then：补位无 failed 节点', backfill.failed, 0);
    eq(c, 'Then：补位不产生失败节点', byState(state, 'failed').length, 0);

    const budgetSrc = readText(path.join(ACC12_PATHS.REPO, 'src', 'core', 'budget.js'));
    check(c, '架构检查：预算模块无 saveState/transit（纯判定）',
      !/\bsaveState\b/.test(budgetSrc) && !/transit\(/.test(budgetSrc), 'pure decision');
    check(c, '架构检查：沿用 max_concurrent_sessions 语义',
      /max_concurrent_sessions/.test(budgetSrc), 'reuses role ceiling');

    note(c, '以调用侧 dispatch 桩把纯判定应用到夹具 state（WP-7 接线采用同一冻结签名）');
    evidence(c, 'meta', 'result.json', JSON.stringify({
      config: CONFIG, initial, queuedGate: queuedGate.verdict, backfill,
      finalStates: state.nodes.map((n) => `${n.id}:${n.state}`), checks: c.checks,
    }, null, 2));
    evidence(c, 'summary', 'status.txt', [
      `running=${initial.running} waiting=${initial.waiting} limit=${initial.decision.limit}`,
      `backfill.allowed=${backfill.decision.allowed.length} failed=0`,
    ].join('\n'));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}
