/**
 * AC-29 · busy 且会话可恢复 → 保持 busy。
 *
 * Given：T-001 开发节点 running(phase=running，服务中) + thinking 会话；
 * caps=resume 广告恢复方言。重启恢复后会话原样 resume，角色仍显示 服务中 · 活跃会话 1/1，
 * 且不出现「服务中 → 可用」。
 */
import { makeCase, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import {
  baseState, nodeTpl, sessionTpl, prepareGiven, boot, releaseAndStop,
} from './AC-28.mjs';

export async function run() {
  const c = makeCase('AC-29', {
    scenario: 'role-resume-stays-busy',
    title: '角色 busy 且会话可恢复 → 保持 busy',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-29');
  c.root = root;
  try {
    const given = baseState(root, {
      nodes: [nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'running', phase: 'running' })],
      sessions: [sessionTpl({ sessionId: 'mock-sess-dev', nodeId: 'T-001', roleId: 'developer', state: 'thinking' })],
    });
    given.nodes[0].sessionId = 'mock-sess-dev';
    const g = prepareGiven(root, given, { caps: 'resume' });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));
    check(c, 'Given：开发节点 serving（running+phase=running）+ thinking 会话',
      given.nodes[0].state === 'running' && given.nodes[0].phase === 'running'
      && given.sessions[0].state === 'thinking', '受控现场');

    const b = await boot(root, g.env);
    evidence(c, 'then', 'boots.json', JSON.stringify(b.boots, null, 2));
    check(c, '夹具：recoveredAt 落盘，恢复窗口构造成功', Boolean(b.afterState?.recoveredAt),
      JSON.stringify({ recoveredAt: b.afterState?.recoveredAt ?? null }));

    const roleShow = orch(root, ['role', 'show', 'developer', '--instance', 'INST-001'], { env: g.env });
    const status = orch(root, ['status', '--instance', 'INST-001'], { env: g.env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'then', 'role-show.txt', roleShow.stdout);
    evidence(c, 'then', 'status.txt', status.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    evidence(c, 'then', 'state.json', JSON.stringify(b.afterState, null, 2));
    evidence(c, 'then', 'events.jsonl',
      b.events.map((e) => JSON.stringify(e)).join('\n') || '(恢复期无事件)\n');

    const node = (b.afterState?.nodes ?? []).find((n) => n.nodeId === 'T-001');
    const dialectEvents = b.events.filter((e) => e.reason === 'recovery.dialect' && e.detail?.fallback !== true);
    const roleEvents = b.events.filter((e) => e.reason === 'recovery.role');
    evidence(c, 'then', 'dialect-events.json', JSON.stringify(dialectEvents, null, 2));

    includes(c, 'Then：role show 仍显示「服务中 · 活跃会话 1/1」', roleShow.stdout, '服务中 · 活跃会话 1/1');
    excludes(c, 'Then：不出现「服务中 → 可用」', log.stdout, '服务中 → 可用');
    check(c, 'Then：节点保持 running+phase=running（未被降为 assigned）',
      node?.state === 'running' && node?.phase === 'running', JSON.stringify(node));
    check(c, '夹具：恢复方言为 resume（会话可恢复）',
      dialectEvents.some((e) => e.detail?.dialect === 'resume'), JSON.stringify(dialectEvents));
    check(c, '夹具：无 recovery.role 降级事件', roleEvents.length === 0, JSON.stringify(roleEvents));
    check(c, '夹具：会话标记 recovered=true 且 dialect=resume',
      (b.afterState?.sessions ?? []).some((s) => s.recovered === true && s.dialect === 'resume'),
      JSON.stringify(b.afterState?.sessions));

    note(c, 'Given 用受控 state.json（T-001 running+phase=running + thinking 会话）；'
      + 'caps=resume 让核心连真 mock ACP 适配器执行 session/resume。');
    note(c, '需求示例「服务中 · 活跃会话 1/1」逐字断言，不硬编码 mock 会话号。');
    releaseAndStop(root, g.env);
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
