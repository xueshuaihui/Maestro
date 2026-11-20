/**
 * AC-12 · 升级节点重启后仍是已升级。
 *
 * 同样用 rounds-exceeded 造 suspended + escalated 现场（ESC-001 pending），
 * `orch core stop` + `orch status --instance` 重启后断言：仍显示「已升级」、
 * 无重派、无新升级请求、escalations pending 数与 node.dispatch 次数不变。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  REPO, NODE, ORCH_BIN, baseEnv, freshRoot, cleanupRoot, readState, readEvents, orch, runCmd,
} from '../acc8-f-lib.mjs';

const DRIVER = path.join(REPO, 'test', 'fixtures', 'code-loop-driver.mjs');

export async function run() {
  const c = makeCase('AC-12', { scenario: 'rounds-exceeded', title: '升级节点重启后仍是已升级' });
  const root = freshRoot('AC-12');
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
    evidence(c, 'given', 'run.txt', `exit=${run.exitCode}\n${run.stdout.slice(-1000)}`);
    evidence(c, 'given', 'state-before.json', JSON.stringify(before, null, 2));
    const esc = before?.escalations ?? [];
    eq(c, 'Given：实例 suspended', before?.state, 'suspended');
    check(c, 'Given：某节点 escalated', before?.nodes?.some((n) => n.state === 'escalated'), true);
    check(c, 'Given：升级 pending 至少 1 条', esc.filter((e) => e.state === 'pending').length >= 1,
      JSON.stringify(esc.map((e) => [e.escalationId, e.state])));
    const pendingBefore = esc.filter((e) => e.state === 'pending').length;
    const dispatchBefore = evBefore.filter((e) => e.reason === 'node.dispatch').length;

    orch(root, ['core', 'stop']);
    const status = orch(root, ['status', '--instance', 'INST-001']);
    const after = readState(root);
    const evAfter = readEvents(root);
    evidence(c, 'then', 'status.txt', status.stdout);
    evidence(c, 'then', 'state-after.json', JSON.stringify(after, null, 2));
    evidence(c, 'then', 'events-after.jsonl', evAfter.map((e) => JSON.stringify(e)).join('\n'));

    includes(c, 'Then：仍显示「已升级」', status.stdout, '已升级');
    check(c, 'Then：节点仍是 escalated', after?.nodes?.some((n) => n.state === 'escalated'), true);
    eq(c, '机检：escalations pending 数量不变', (after?.escalations ?? []).filter((e) => e.state === 'pending').length, pendingBefore);
    eq(c, '机检：node.dispatch 次数不变', evAfter.filter((e) => e.reason === 'node.dispatch').length, dispatchBefore);
    const added = evAfter.slice(evBefore.length);
    eq(c, '机检：没有新的升级请求（escalation.created）', added.filter((e) => e.reason === 'escalation.created').length, 0);
    eq(c, '机检：重启未产生新事件', added.length, 0);
    note(c, '重启口径为 `orch core stop` + `orch status --instance`：suspended 属 CORE_IMMUTABLE，'
      + 'core stop 不改其状态（已逐项比对 state/events）。');
    try { orch(root, ['core', 'stop']); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
