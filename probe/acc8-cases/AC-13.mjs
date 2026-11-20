/**
 * AC-13 · 失败节点重启后不自动重跑。
 *
 * 受控现场：手写「T-001 done + T-002 failed(verdict=fail, note=等待复测)」的 running
 * 实例，无会话需要恢复；`orch status --instance` 冷启动让核心对账。按需求断言失败
 * 节点状态不变、无新 node.dispatch、status 仍给出既有下一步。
 *
 * 需求 Given 写 `failed_reason: verdict_fail`；本机 verdict_fail 节点把原因记在
 * `verdict.value='fail'` + `note='等待复测'`，字段差异记 note()，不改产品代码。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  freshRoot, cleanupRoot, readState, readEvents, orch, statePath, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import { prepareScene, mockArgsFromEnv, buildRunEnv } from '../../test/fixtures/code-loop-driver.mjs';

const promptFiles = (root) => {
  try { return fs.readdirSync(path.join(root, '.mock', 'prompts')).filter((n) => /^\d+\.json$/.test(n)); }
  catch { return []; }
};

export async function run() {
  const c = makeCase('AC-13', {
    scenario: 'failed-node-no-rerun',
    title: '失败节点重启后不自动重跑',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-13');
  c.root = root;
  try {
    const env = buildRunEnv(process.env);
    prepareScene({ root, scenario: 'backflow', reset: false, mockArgs: mockArgsFromEnv(env) });
    const stateFile = statePath(root, 'INST-001');
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    const stamp = new Date().toISOString();
    const hand = {
      schemaVersion: 2,
      instanceId: 'INST-001',
      coreGeneration: 'gen-before-restart',
      createdAt: stamp,
      updatedAt: stamp,
      state: 'running',
      stateSince: stamp,
      template: 'code-loop',
      cwd: path.join(root, 'demo-recovery'),
      task: '修复 calc.js 的除零边界，并补一条回归测试。\n改动写在 calc.js\n产物：calc.js',
      halted: false,
      rev: 1,
      counters: { eventSeq: 0, runCount: 1, dispatchCount: 1 },
      hostRaw: { stopReason: null, lastError: null, agentInfo: null },
      nodes: [
        { nodeId: 'T-001', roleId: 'developer', round: 1, state: 'done', stateSince: stamp,
          startedAt: stamp, roundStartedAt: stamp, endedAt: stamp, failure: null, note: null,
          verdict: { value: 'pass', defects: [] }, sessionId: null, artifactRefs: [] },
        { nodeId: 'T-002', roleId: 'tester', round: 1, state: 'failed', stateSince: stamp,
          startedAt: stamp, roundStartedAt: stamp, endedAt: stamp, failure: null, note: '等待复测',
          verdict: { value: 'fail', defects: [{ summary: 'div 除零未抛错' }] },
          sessionId: null, artifactRefs: [] },
      ],
      sessions: [],
      handoffs: [],
      escalations: [],
      health: { level: 'normal', reasons: [], computedAt: stamp, nodeTimeoutMs: 30000 },
      paused: false,
    };
    fs.writeFileSync(stateFile, `${JSON.stringify(hand, null, 2)}\n`, 'utf8');
    const promptsBefore = promptFiles(root);
    evidence(c, 'given', 'state.json', JSON.stringify(hand, null, 2));
    evidence(c, 'given', 'events-before.jsonl', '(受控起点：暂无事件)\n');
    evidence(c, 'given', 'prompt-files-before.txt', promptsBefore.join('\n') || '(无)\n');

    // 冷启动触发对账（相当于重启 daemon）
    const boot = orch(root, ['status', '--instance', 'INST-001'], { env });
    for (let i = 0; i < 80; i += 1) {
      if (readState(root)?.recoveredAt) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    await new Promise((r) => setTimeout(r, 600));
    const afterState = readState(root);
    const status = orch(root, ['status', '--instance', 'INST-001'], { env });
    const graph = orch(root, ['instance', 'graph', '--instance', 'INST-001', '--format', 'text'], { env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env });
    const events = readEvents(root);
    const promptsAfter = promptFiles(root);

    evidence(c, 'then', 'boot.txt', `exit=${boot.exitCode}\n${boot.stdout.slice(-1200)}`);
    evidence(c, 'then', 'status.txt', status.stdout);
    evidence(c, 'then', 'graph.txt', graph.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(afterState, null, 2));
    evidence(c, 'then', 'prompt-files-after.txt', promptsAfter.join('\n') || '(无)\n');

    const before = hand.nodes.find((n) => n.nodeId === 'T-002');
    const after = afterState?.nodes?.find((n) => n.nodeId === 'T-002');
    check(c, 'Given：恢复发生（recoveredAt 落盘）', Boolean(afterState?.recoveredAt), `${afterState?.recoveredAt}`);
    check(c, 'Given：测试节点判定失败（verdict=fail）', before?.verdict?.value === 'fail',
      JSON.stringify(before?.verdict ?? null));
    check(c, 'Given：失败节点处于等待复测', before?.note === '等待复测', `${before?.note}`);
    eq(c, '机检：重启前节点 state === failed', before?.state, 'failed');
    eq(c, '机检：重启后节点 state 仍 === failed', after?.state, 'failed');
    includes(c, 'Then：status --instance 节点仍显示「失败」', status.stdout, '失败');
    includes(c, 'Then：status 仍给出既有下一步「等待复测」', status.stdout, '等待复测');
    includes(c, 'Then：graph 文本节点仍显示「失败」', graph.stdout, '失败');

    const dispatch = events.filter((e) => e.reason === 'node.dispatch');
    eq(c, '机检：恢复后没有新的 node.dispatch', dispatch.length, 0);
    const dispatchLines = log.stdout.split(/\r?\n/).filter((line) => /派发/.test(line) && /T-002/.test(line));
    eq(c, '机检：instance log 没有 T-002 的新派发行', dispatchLines.length, 0);
    eq(c, 'Then：会话 prompt 次数不增（mock prompts 仍为 0）', promptsAfter.length - promptsBefore.length, 0);
    check(c, 'Then：实例仍可推进（running）', afterState?.state === 'running', `${afterState?.state}`);
    excludes(c, '机检：失败节点未被误标为「已完成」', graph.stdout, 'T-002 · 已完成');
    note(c, '需求 Given 写 failed_reason: verdict_fail；实测 verdict_fail 节点把原因记在 '
      + 'verdict.value=fail + note=等待复测，failed_reason 字段为空。按语义核对失败+等待复测，未伪造字段。');
    note(c, '受控 running 起点避免真实 backflow 快速把 failed 推进到 review（批二首轮实测窗口漂移），'
      + '恢复动作仍由产品核心对账执行。');
    try { orch(root, ['core', 'stop'], { env }); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
