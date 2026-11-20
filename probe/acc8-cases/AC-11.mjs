/**
 * AC-11 · 挂起实例重启后仍挂起。
 *
 * 用 rounds-exceeded 造 suspended 实例（T-001 done / T-002 escalated），
 * 执行 `orch core stop` + `orch status --instance` 重启 daemon。
 * 断言：仍显示「已挂起」、节点状态逐项不变、无恢复行、无新派发/核对事件。
 *
 * 需求 Given 写「节点 running / review 各一个」；实测轮次超限挂起时节点为
 * done + escalated（没有 running/review）。按真实可达现场验收并记入 note()。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  REPO, NODE, ORCH_BIN, baseEnv, freshRoot, cleanupRoot, readState, readEvents, orch, runCmd,
} from '../acc8-f-lib.mjs';

const DRIVER = path.join(REPO, 'test', 'fixtures', 'code-loop-driver.mjs');

export async function run() {
  const c = makeCase('AC-11', { scenario: 'rounds-exceeded', title: '挂起实例重启后仍挂起' });
  const root = freshRoot('AC-11');
  c.root = root;
  try {
    const cwd = path.join(root, 'demo-code-pass');
    fs.mkdirSync(cwd, { recursive: true });
    runCmd([NODE, DRIVER, '--root', root, '--scenario', 'rounds-exceeded', '--cwd', cwd, '--prepare-only'], { cwd: REPO, env: baseEnv() });
    const run = runCmd([NODE, ORCH_BIN, 'run', '--cwd', cwd,
      '--task', '给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js',
      '--template', 'code-loop', '--host', 'mock'], { cwd: root, env: baseEnv(), timeout: 120_000 });
    const before = readState(root);
    const evBefore = readEvents(root);
    evidence(c, 'given', 'run.txt', `exit=${run.exitCode}\n${run.stdout.slice(-1200)}`);
    evidence(c, 'given', 'state-before.json', JSON.stringify(before, null, 2));
    evidence(c, 'given', 'events-before.jsonl', evBefore.map((e) => JSON.stringify(e)).join('\n'));
    eq(c, 'Given：实例已 suspended', before?.state, 'suspended');
    check(c, 'Given：退码为挂起口径 4', run.exitCode === 4, `${run.exitCode}`);

    // 重启 daemon：core stop（suspended 属于 CORE_IMMUTABLE，不被改写）+ status 冷启动
    orch(root, ['core', 'stop']);
    const status = orch(root, ['status', '--instance', 'INST-001']);
    const graphJ = orch(root, ['instance', 'graph', '--instance', 'INST-001', '--format', 'json']);
    const after = readState(root);
    const evAfter = readEvents(root);
    evidence(c, 'then', 'status.txt', status.stdout);
    evidence(c, 'then', 'graph.json', graphJ.stdout);
    evidence(c, 'then', 'state-after.json', JSON.stringify(after, null, 2));
    evidence(c, 'then', 'events-after.jsonl', evAfter.map((e) => JSON.stringify(e)).join('\n'));

    includes(c, 'Then：仍显示「已挂起」', status.stdout, '已挂起');
    eq(c, '机检：重启前后 state 相同', after?.state, before?.state);
    check(c, '机检：节点状态逐项相同',
      JSON.stringify(after?.nodes?.map((n) => [n.nodeId, n.state, n.round]))
      === JSON.stringify(before?.nodes?.map((n) => [n.nodeId, n.state, n.round])),
      `before=${JSON.stringify(before?.nodes?.map((n) => [n.nodeId, n.state, n.round]))} after=${JSON.stringify(after?.nodes?.map((n) => [n.nodeId, n.state, n.round]))}`);
    excludes(c, 'Then：没有恢复行', status.stdout, '恢复：检查点');
    const added = evAfter.slice(evBefore.length);
    eq(c, '机检：instance log 没有新增 node.dispatch', added.filter((e) => e.reason === 'node.dispatch').length, 0);
    eq(c, '机检：instance log 没有新增 verification.*', added.filter((e) => String(e.reason).startsWith('verification.')).length, 0);
    eq(c, '机检：事件总数不变', evAfter.length, evBefore.length);
    note(c, '需求 Given 写「节点 running / review 各一个」；内建 code-loop 的轮次超限挂起发生在升级裁决点，'
      + '实测节点为 T-001 done + T-002 escalated，无法构造 running/review 各一个的 suspended 现场。');
    try { orch(root, ['core', 'stop']); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
