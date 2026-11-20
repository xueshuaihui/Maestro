/**
 * AC-64 · 重建失败 / 宿主不可达 → 角色不可用，恢复后回到可用（BR-50）。
 *
 * 三现场核对状态词序列：
 *  A) crash-rebuild + NEW_FAIL=1（会话升级/宿主不可达侧）→ role show developer 显示「不可用」；
 *  B) 方言全失败但宿主可达（裁-13a/16c 会话级降级）→ 显示「可用」；
 *  C) 重新派发后节点在服务 → 显示「服务中」。
 *
 * 裁-13a/16c：initializeAdapterOnly 成功但方言失败只走会话级降级，角色仍 available；
 * 只有宿主真不可达（或会话 escalated/quarantined）才 unavailable。两种现场分别断言，
 * 不把降级现场伪造成「不可用」。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  REPO, NODE, baseEnv, freshRoot, cleanupRoot, runCmd, readState, readEvents, orch, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import { baseState, nodeTpl, sessionTpl, prepareGiven, boot } from './AC-28.mjs';

const DRIVER = path.join(REPO, 'test', 'fixtures', 'recovery-driver.mjs');

export async function run() {
  const c = makeCase('AC-64', {
    scenario: 'role-unavailable-available-serving',
    title: '重建失败 / 宿主不可达 → 角色不可用，恢复后回到可用',
    grading: GRADING_MOCK,
  });
  const rootA = freshRoot('AC-64-unavailable');
  const rootB = freshRoot('AC-64-available');
  const rootC = freshRoot('AC-64-serving');
  c.root = rootA;
  try {
    // ---------- A) 重建失败：session escalated → 不可用 ----------
    const envA = baseEnv();
    const promptLogA = path.join(rootA, 'prompt-log.ndjson');
    envA.MAESTRO_MOCK_PROMPT_LOG = promptLogA;
    const rA = runCmd([NODE, DRIVER, '--root', rootA, '--scenario', 'crash-rebuild'], {
      cwd: REPO, env: baseEnv({ MAESTRO_MOCK_NEW_FAIL: '1', MAESTRO_MOCK_PROMPT_LOG: promptLogA }),
      timeout: 180_000,
    });
    let sumA = null;
    try { sumA = JSON.parse(rA.stdout.trim().split(/\r?\n/).pop()); } catch { /* 证据仍落盘 */ }
    const stateA = readState(rootA);
    const eventsA = readEvents(rootA);
    const roleA = orch(rootA, ['role', 'show', 'developer', '--instance', 'INST-001'], { env: envA });
    evidence(c, 'given', 'a-driver-summary.json', JSON.stringify({
      ok: sumA?.ok, exitCodes: sumA?.exitCodes, afterRecovery: sumA?.afterRecovery,
    }, null, 2));
    evidence(c, 'then', 'a-state.json', JSON.stringify(stateA, null, 2));
    evidence(c, 'then', 'a-events.jsonl', eventsA.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'a-role-show.txt', roleA.stdout);
    check(c, '夹具 A：crash + new-fail 场景跑通', sumA?.ok === true,
      JSON.stringify({ ok: sumA?.ok, exitCodes: sumA?.exitCodes }));
    check(c, '夹具 A：session.rebuild_failed 落盘（会话不可恢复）',
      eventsA.some((e) => e.reason === 'session.rebuild_failed'),
      JSON.stringify(eventsA.filter((e) => e.reason === 'session.rebuild_failed')));
    includes(c, 'Then A：role show developer 显示「不可用」', roleA.stdout, '不可用');

    // ---------- B) 方言失败但宿主可达 → 可用（会话级降级） ----------
    const givenB = baseState(rootB, {
      nodes: [nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'running', phase: 'assigned' })],
      sessions: [sessionTpl({ sessionId: 'mock-sess-dev', nodeId: 'T-001', roleId: 'developer', state: 'idle' })],
    });
    givenB.nodes[0].sessionId = 'mock-sess-dev';
    const gB = prepareGiven(rootB, givenB, {
      caps: 'none', extraEnv: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
    });
    const bB = await boot(rootB, gB.env, 'INST-001', { waitPaused: true });
    const roleB = orch(rootB, ['role', 'show', 'developer', '--instance', 'INST-001'], { env: gB.env });
    evidence(c, 'given', 'b-state.json', JSON.stringify(givenB, null, 2));
    evidence(c, 'then', 'b-role-show.txt', roleB.stdout);
    evidence(c, 'then', 'b-state-after.json', JSON.stringify(bB.afterState, null, 2));
    check(c, '夹具 B：recoveredAt 落盘，降级现场构造成功', Boolean(bB.afterState?.recoveredAt),
      JSON.stringify({ recoveredAt: bB.afterState?.recoveredAt ?? null }));
    includes(c, 'Then B：role show developer 显示「可用」', roleB.stdout, '可用');
    includes(c, 'Then B：显示「活跃会话 0/1 · 服务节点 —」', roleB.stdout, '活跃会话 0/1');
    includes(c, 'Then B：服务节点为 —', roleB.stdout, '服务节点 —');
    check(c, '夹具 B：不是宿主不可达中断（无 recovery.failed）',
      !bB.events.some((e) => e.reason === 'recovery.failed'),
      JSON.stringify(bB.events.filter((e) => e.reason === 'recovery.failed')));

    // ---------- C) 重新派发后节点在服务 → 服务中 ----------
    const givenC = baseState(rootC, {
      nodes: [nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'running', phase: 'running' })],
      sessions: [sessionTpl({ sessionId: 'mock-sess-dev', nodeId: 'T-001', roleId: 'developer', state: 'thinking' })],
    });
    givenC.nodes[0].sessionId = 'mock-sess-dev';
    const gC = prepareGiven(rootC, givenC, { caps: 'resume' });
    // role show 是只读命令（AC-38），直接读预置 state，不触发核心推进。
    const roleC = orch(rootC, ['role', 'show', 'developer', '--instance', 'INST-001'], { env: gC.env });
    evidence(c, 'given', 'c-state.json', JSON.stringify(givenC, null, 2));
    evidence(c, 'then', 'c-role-show.txt', roleC.stdout);
    includes(c, 'Then C：role show developer 显示「服务中」', roleC.stdout, '服务中');

    const words = [
      roleA.stdout.includes('不可用') ? '不可用' : '?',
      roleB.stdout.includes('可用') ? '可用' : '?',
      roleC.stdout.includes('服务中') ? '服务中' : '?',
    ];
    evidence(c, 'then', 'role-status-sequence.json', JSON.stringify(words, null, 2));
    check(c, '夹具：角色状态词序列 不可用 → 可用 → 服务中',
      JSON.stringify(words) === JSON.stringify(['不可用', '可用', '服务中']), JSON.stringify(words));

    note(c, 'A 现场用真 driver crash-rebuild + NEW_FAIL=1 产生 session.rebuild_failed/escalated 会话，'
      + 'B 现场用受控 assigned + caps=none 触发会话级降级，C 现场用受控 running + thinking 会话核对服务中。');
    note(c, '裁-13a/16c：initializeAdapterOnly 成功但方言全失败只降级到 available（B），'
      + '只有会话 escalated / 宿主不可达才 unavailable（A）；本用例不为凑序列把 B 现场写成不可用。');
    try { fs.writeFileSync(path.join(rootB, '.mock', 'release'), '1'); } catch { /* 放行 */ }
    try { orch(rootB, ['core', 'stop'], { env: gB.env }); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(rootA);
    cleanupRoot(rootB);
    cleanupRoot(rootC);
  }
  return finish(c);
}
