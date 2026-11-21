/**
 * AC-67 · 角色恢复后既无可用会话也无可调度节点 → 按既有优先序显示（冷却中）。
 *
 * Given：developer 的会话不可恢复（caps=none），它服务的节点 T-001 已 done（终态，
 *        doneCount > 0），再放一个非本角色的 pending 节点作对照；
 *        MAESTRO_TEST_RECOVERY_HOLD=after_assign。
 * When：重启并执行 role show developer。
 * Then：显示「冷却中 · 活跃会话 0/1 · 服务节点 —」（busy > cooldown > available，
 *        doneCount > 0 → cooldown）；不显示「服务中」，也不新建会话；
 *       机检 roleToSessions 保留该角色历史 idle 会话记录但不计入活跃会话、session/new 次数不变；
 *       取证「Given 落盘后、执行恢复动作之前」与恢复后各取一次 role show，两帧逐字相同。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  freshRoot, cleanupRoot, readState, readEvents, orch, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import { baseState, nodeTpl, sessionTpl, prepareGiven, boot } from './AC-28.mjs';

const nap = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run() {
  const c = makeCase('AC-67', {
    scenario: 'role-available-without-session-or-node',
    title: '角色恢复后既无可用会话也无可调度节点 → 按既有优先序显示（冷却中）',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-67');
  c.root = root;
  try {
    const given = baseState(root, {
      nodes: [
        nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'done',
          extra: { verdict: { value: 'pass', defects: [] } } }),
        nodeTpl({ nodeId: 'T-002', roleId: 'tester', state: 'pending', phase: 'blocked' }),
      ],
      sessions: [sessionTpl({ sessionId: 'mock-sess-dev', nodeId: 'T-001', roleId: 'developer', state: 'idle' })],
    });
    const g = prepareGiven(root, given, {
      caps: 'none', extraEnv: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
    });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));
    check(c, 'Given：developer 会话不可恢复且其节点已终态',
      given.nodes[0].state === 'done' && given.sessions[0].state === 'idle',
      JSON.stringify({ node: given.nodes[0].state, session: given.sessions[0].state }));

    // hold=after_assign 挂在 continueRecovery 派发之前：recoveredAt 已落盘、角色派生已写入，
    // 但「执行恢复动作」（重新派发）尚未发生。此点取「Given 落盘后、恢复动作之前」帧。
    const b = await boot(root, g.env, 'INST-001', { waitPaused: true });
    const roleShowBefore = orch(root, ['role', 'show', 'developer', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'then', 'role-show-before.txt', roleShowBefore.stdout);

    // 释放 hold 让恢复动作完成；本现场无可派发节点，完成后角色派生不应被改写。
    fs.writeFileSync(path.join(root, '.mock', 'release'), new Date().toISOString(), 'utf8');
    await nap(800);

    const state = readState(root);
    const events = readEvents(root);
    const roleShow = orch(root, ['role', 'show', 'developer', '--instance', 'INST-001'], { env: g.env });
    const roleJson = orch(root, ['role', 'show', 'developer', '--instance', 'INST-001', '--format', 'json'], { env: g.env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'then', 'boots.json', JSON.stringify(b.boots, null, 2));
    evidence(c, 'then', 'state.json', JSON.stringify(state, null, 2));
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'role-show.txt', roleShow.stdout);
    evidence(c, 'then', 'role-show-after.txt', roleShow.stdout);
    evidence(c, 'then', 'role-show.json.txt', roleJson.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);

    let parsed = null;
    try { parsed = JSON.parse(roleJson.stdout); } catch { /* 证据已落盘 */ }
    const roleToSessions = parsed?.instance?.roleToSessions ?? null;
    evidence(c, 'then', 'role-to-sessions.json', JSON.stringify(roleToSessions, null, 2));
    const devLine = roleShow.stdout.split(/\r?\n/).find((l) => l.includes('实例 INST-001')) ?? '';
    const beforeLine = roleShowBefore.stdout.split(/\r?\n/).find((l) => l.includes('实例 INST-001')) ?? '';
    evidence(c, 'then', 'role-instance-line.txt', `${devLine}\n`);
    evidence(c, 'then', 'role-frames-diff.txt',
      `# beforeLine=${beforeLine}\n# afterLine=${devLine}\n`
      + `# byteEqual=${roleShowBefore.stdout === roleShow.stdout}\n`
      + `# before=${JSON.stringify(roleShowBefore.stdout)}\n# after=${JSON.stringify(roleShow.stdout)}\n`);

    check(c, '夹具：recoveredAt 落盘（恢复发生）', Boolean(state?.recoveredAt),
      JSON.stringify({ recoveredAt: state?.recoveredAt ?? null }));
    // v4：按既有六态派生优先序 busy > cooldown > available（doneCount > 0 → cooldown）。
    includes(c, 'Then：role show 显示「冷却中 · 活跃会话 0/1 · 服务节点 —」',
      devLine, '冷却中 · 活跃会话 0/1 · 服务节点 —');
    excludes(c, 'Then：不显示「服务中」', devLine, '服务中');
    check(c, '夹具：恢复前后两帧 orch role show 逐字相同（恢复不改写既有派生结果）',
      roleShowBefore.stdout === roleShow.stdout,
      JSON.stringify({ before: roleShowBefore.stdout, after: roleShow.stdout }));
    check(c, '机检：roleToSessions 保留 developer 历史 idle 会话记录但不计入活跃会话',
      Array.isArray(roleToSessions?.developer)
        && roleToSessions.developer.includes(given.sessions[0].sessionId)
        && devLine.includes('活跃会话 0/1'),
      JSON.stringify({ roleToSessions, devLine }));
    eq(c, '夹具：没有新建会话（会话数不变）', (state?.sessions ?? []).length, given.sessions.length);
    eq(c, '机检：无 session/new 事件', events.filter((e) => e.reason === 'session.new').length, 0);
    eq(c, '夹具：developer 节点仍为 done（无重新派发）',
      (state?.nodes ?? []).find((n) => n.nodeId === 'T-001')?.state ?? null, 'done');
    eq(c, '机检：无 node.dispatch', events.filter((e) => e.reason === 'node.dispatch').length, 0);

    note(c, 'Given 用受控 state.json（developer 会话 idle + 节点 done，caps=none）构造'
      + '「会话不可恢复且服务节点已终态（doneCount > 0）」窗口，恢复仍由产品核心连真 mock ACP 适配器执行。');
    note(c, 'v4 改法（裁-21e / 裁-21g / 裁-21h）：标题与 Then 改为「按既有优先序显示（冷却中）」，'
      + '依据角色六态派生 busy > cooldown > available（doneCount > 0 → cooldown，I1.5 契约），不再要求显示「可用」。');
    note(c, 'v4 新增取证：Given 落盘后、执行恢复动作之前（hold 点，recoveredAt 已落盘但派发未发生）'
      + '与恢复完成之后各取一次 orch role show，两帧文本整段比对、字面差异 0 处；'
      + 'MAESTRO_TEST_RECOVERY_HOLD=after_assign 的暂停点在 orchestrator.js 约 :5956（写入后、派发前）。');
    note(c, '机检由「roleToSessions 无 developer 键」改为「保留该角色历史 idle 会话记录但不计入活跃会话（0/1）」；'
      + '实测 role-to-sessions.json 保留 mock-sess-dev，session/new 次数不变、无 node.dispatch。');
    try { orch(root, ['core', 'stop'], { env: g.env }); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
