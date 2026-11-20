/**
 * AC-30 · available / cooldown / inactive 不受恢复影响。
 *
 * Given 一个 code-loop 实例里同时构造三态角色：
 * - developer：绑定 pending 节点、无会话 → available（可用）
 * - tester：绑定 done 节点、无会话 → cooldown（冷却中）
 * - coordinator：图声明但未绑定节点 → inactive（未参与）
 * 重启 daemon 后三行状态词逐字不变，无降级行、无新增活跃会话。
 */
import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import {
  baseState, nodeTpl, prepareGiven, boot, releaseAndStop,
} from './AC-28.mjs';

/** 与 role-instances.js::buildRoleInstances 同口径的 roleToSessions 投影（只读核对）。 */
function roleToSessionsOf(state) {
  const map = {};
  for (const s of state?.sessions ?? []) {
    const node = (state?.nodes ?? []).find((n) => n.nodeId === s.nodeId);
    if (!node?.roleId) continue;
    (map[node.roleId] ??= []).push(s.sessionId);
  }
  return map;
}

export async function run() {
  const c = makeCase('AC-30', {
    scenario: 'three-role-states-unchanged',
    title: 'available / cooldown / inactive 不受恢复影响',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-30');
  c.root = root;
  try {
    const given = baseState(root, {
      nodes: [
        nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'pending' }),
        nodeTpl({ nodeId: 'T-002', roleId: 'tester', state: 'done', extra: { verdict: { value: 'pass', defects: [] } } }),
      ],
    });
    const g = prepareGiven(root, given, { caps: 'resume' });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));
    const beforeMap = roleToSessionsOf(given);
    evidence(c, 'given', 'role-to-sessions.json', JSON.stringify(beforeMap, null, 2));
    check(c, 'Given：三角色同场（pending 开发 / done 测试 / 未绑定协调者）',
      given.nodes.length === 2 && given.nodes[0].roleId === 'developer'
      && given.nodes[1].roleId === 'tester' && given.sessions.length === 0, '受控现场');

    const b = await boot(root, g.env);
    evidence(c, 'then', 'boots.json', JSON.stringify(b.boots, null, 2));
    check(c, '夹具：recoveredAt 落盘，重启对账确实发生', Boolean(b.afterState?.recoveredAt),
      JSON.stringify({ recoveredAt: b.afterState?.recoveredAt ?? null }));

    const roleList = orch(root, ['role', 'list', '--instance', 'INST-001'], { env: g.env });
    const status = orch(root, ['status', '--instance', 'INST-001'], { env: g.env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'then', 'role-list.txt', roleList.stdout);
    evidence(c, 'then', 'status.txt', status.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    evidence(c, 'then', 'state.json', JSON.stringify(b.afterState, null, 2));
    evidence(c, 'then', 'events.jsonl',
      b.events.map((e) => JSON.stringify(e)).join('\n') || '(恢复期无事件：三角色节点 pending/done 且均无会话)\n');

    const lines = roleList.stdout.split(/\r?\n/).filter((l) => l.includes('实例 INST-001：'));
    evidence(c, 'then', 'role-instance-lines.txt', lines.join('\n'));
    const lineFor = (word) => lines.find((l) => l.includes(word)) ?? '';
    const availableLine = lineFor('可用');
    const cooldownLine = lineFor('冷却中');
    const inactiveLine = lineFor('未参与');

    includes(c, 'Then：developer 三态词「可用」逐字不变', availableLine, '可用 · 活跃会话');
    includes(c, 'Then：tester 三态词「冷却中」逐字不变', cooldownLine, '冷却中 · 活跃会话');
    includes(c, 'Then：coordinator 三态词「未参与」逐字不变', inactiveLine, '未参与');
    eq(c, '机检：恰好 3 行实例角色状态', lines.length, 3);
    excludes(c, 'Then：没有降级行（服务中 → 可用）', log.stdout, '服务中 → 可用');
    excludes(c, 'Then：没有「服务中」角色', roleList.stdout, '服务中 · 活跃会话');
    eq(c, '机检：无新增活跃会话（state.sessions 仍为 0）', (b.afterState?.sessions ?? []).length, 0);
    const afterMap = roleToSessionsOf(b.afterState);
    evidence(c, 'then', 'role-to-sessions-after.json', JSON.stringify(afterMap, null, 2));
    check(c, '机检：role_to_sessions 映射不变（前后均为空）',
      JSON.stringify(afterMap) === JSON.stringify(beforeMap),
      JSON.stringify({ before: beforeMap, after: afterMap }));
    eq(c, '机检：无 recovery.role 降级事件', b.events.filter((e) => e.reason === 'recovery.role').length, 0);

    note(c, 'Given 用受控 state.json 构造同实例三态角色；developer 用 pending（绑定但无服务/无 done）→ available，'
      + 'tester 用 done → cooldown，coordinator 由 code-loop 图声明但不绑定节点 → inactive。');
    note(c, '机检「role_to_sessions 映射不变」以与 buildRoleInstances 同口径的只读投影核对：'
      + 'before/after 均为 {}，且 state.sessions 长度仍为 0。');
    releaseAndStop(root, g.env);
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
