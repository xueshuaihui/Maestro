/**
 * AC-67 · 角色恢复后既无可用会话也无可调度节点 → 保持「可用」（BR-24 / BR-50）。
 *
 * Given：developer 的会话不可恢复（caps=none），它服务的节点 T-001 已 done（终态），
 *        再放一个非本角色的 pending 节点作对照；MAESTRO_TEST_RECOVERY_HOLD=after_assign。
 * When：重启并执行 role show developer。
 * Then：显示「可用 · 活跃会话 0/1 · 服务节点 —」；不显示「服务中」，也不新建会话；
 *       机检 roleToSessions 无 developer 键、session/new 次数不变。
 */
import fs from 'node:fs';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  freshRoot, cleanupRoot, readState, readEvents, orch, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import { baseState, nodeTpl, sessionTpl, prepareGiven, boot } from './AC-28.mjs';

export async function run() {
  const c = makeCase('AC-67', {
    scenario: 'role-available-without-session-or-node',
    title: '角色恢复后既无可用会话也无可调度节点 → 保持可用',
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

    const b = await boot(root, g.env, 'INST-001');
    const state = readState(root);
    const events = readEvents(root);
    const roleShow = orch(root, ['role', 'show', 'developer', '--instance', 'INST-001'], { env: g.env });
    const roleJson = orch(root, ['role', 'show', 'developer', '--instance', 'INST-001', '--format', 'json'], { env: g.env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'then', 'boots.json', JSON.stringify(b.boots, null, 2));
    evidence(c, 'then', 'state.json', JSON.stringify(state, null, 2));
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'role-show.txt', roleShow.stdout);
    evidence(c, 'then', 'role-show.json.txt', roleJson.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);

    let parsed = null;
    try { parsed = JSON.parse(roleJson.stdout); } catch { /* 证据已落盘 */ }
    const roleToSessions = parsed?.instance?.roleToSessions ?? null;
    evidence(c, 'then', 'role-to-sessions.json', JSON.stringify(roleToSessions, null, 2));
    const devLine = roleShow.stdout.split(/\r?\n/).find((l) => l.includes('实例 INST-001')) ?? '';
    evidence(c, 'then', 'role-instance-line.txt', `${devLine}\n`);

    check(c, '夹具：recoveredAt 落盘（恢复发生）', Boolean(state?.recoveredAt),
      JSON.stringify({ recoveredAt: state?.recoveredAt ?? null }));
    includes(c, 'Then：role show 显示「可用 · 活跃会话 0/1 · 服务节点 —」',
      devLine, '可用 · 活跃会话 0/1 · 服务节点 —');
    excludes(c, 'Then：不显示「服务中」', devLine, '服务中');
    check(c, '机检：roleToSessions 无 developer 键',
      roleToSessions !== null && !Object.prototype.hasOwnProperty.call(roleToSessions, 'developer'),
      JSON.stringify(roleToSessions));
    eq(c, '夹具：没有新建会话（会话数不变）', (state?.sessions ?? []).length, given.sessions.length);
    eq(c, '机检：无 session/new 事件', events.filter((e) => e.reason === 'session.new').length, 0);
    eq(c, '夹具：developer 节点仍为 done（无重新派发）',
      (state?.nodes ?? []).find((n) => n.nodeId === 'T-001')?.state ?? null, 'done');
    eq(c, '机检：无 node.dispatch', events.filter((e) => e.reason === 'node.dispatch').length, 0);

    note(c, 'Given 用受控 state.json（developer 会话 idle + 节点 done，caps=none）构造'
      + '「会话不可恢复且无待派发节点」窗口，恢复仍由产品核心连真 mock ACP 适配器执行。');
    note(c, 'MAESTRO_TEST_RECOVERY_HOLD=after_assign 按需求夹具注入；'
      + '本现场无 assigned 节点可冻结，故不等待 .mock/paused 标记，判定只取恢复落盘后的可见结果。');
    try { orch(root, ['core', 'stop'], { env: g.env }); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
