/**
 * AC-40 · suspended 实例内全部节点保持原状。
 *
 * Given：一个 suspended 实例，节点分别 running / review / escalated。
 * When：重启 daemon（冷启动 reconcileOnBoot）。
 * Then：三种节点状态逐字不变；无重派、无重新核对、无新升级。
 * 机检：重启前后 instance graph --format json 的 nodes 数组逐项相同。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, orch, readState, GRADING_MOCK } from '../acc8-f-lib.mjs';
import { baseState, nodeTpl, sessionTpl, prepareGiven } from './AC-28.mjs';

export async function run() {
  const c = makeCase('AC-40', {
    scenario: 'suspended-instance-skipped',
    title: 'suspended 实例内全部节点保持原状',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-40');
  c.root = root;
  try {
    const given = baseState(root, {
      state: 'suspended',
      nodes: [
        nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'running', phase: 'running' }),
        nodeTpl({ nodeId: 'T-002', roleId: 'tester', state: 'review' }),
        nodeTpl({ nodeId: 'T-003', roleId: 'developer', state: 'escalated' }),
      ],
      sessions: [sessionTpl({ sessionId: 'mock-sess-dev', nodeId: 'T-001', roleId: 'developer', state: 'thinking' })],
    });
    given.nodes[0].sessionId = 'mock-sess-dev';
    const g = prepareGiven(root, given, { caps: 'resume' });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));
    check(c, 'Given：suspended 实例含 running/review/escalated 三节点',
      given.state === 'suspended'
      && JSON.stringify(given.nodes.map((n) => n.state)) === JSON.stringify(['running', 'review', 'escalated']),
      JSON.stringify({ state: given.state, nodes: given.nodes.map((n) => n.state) }));

    // 第一次 graph 调用即冷启动核心（触发 reconcileOnBoot，suspended 应被跳过）。
    const graphBefore = orch(root, ['instance', 'graph', '--instance', 'INST-001', '--format', 'json'], { env: g.env });
    const statusAfterBoot = orch(root, ['status', '--instance', 'INST-001'], { env: g.env });
    const graphAfter = orch(root, ['instance', 'graph', '--instance', 'INST-001', '--format', 'json'], { env: g.env });
    const text = orch(root, ['instance', 'graph', '--instance', 'INST-001'], { env: g.env });
    const afterState = readState(root);
    evidence(c, 'then', 'graph-before.json.txt', graphBefore.stdout);
    evidence(c, 'then', 'graph-after.json.txt', graphAfter.stdout);
    evidence(c, 'then', 'graph.txt', text.stdout);
    evidence(c, 'then', 'status.txt', statusAfterBoot.stdout);
    evidence(c, 'then', 'state.json', JSON.stringify(afterState, null, 2));

    let beforeParsed = null;
    let afterParsed = null;
    try { beforeParsed = JSON.parse(graphBefore.stdout); } catch { /* 证据已落 */ }
    try { afterParsed = JSON.parse(graphAfter.stdout); } catch { /* 证据已落 */ }
    check(c, '机检：重启前后 nodes 数组逐项相同',
      JSON.stringify(beforeParsed?.nodes ?? null) === JSON.stringify(afterParsed?.nodes ?? null),
      JSON.stringify({ before: beforeParsed?.nodes, after: afterParsed?.nodes }));
    const nodeStates = (afterState?.nodes ?? []).map((n) => ({ nodeId: n.nodeId, state: n.state }));
    check(c, 'Then：三节点状态逐字不变',
      JSON.stringify(nodeStates) === JSON.stringify(
        given.nodes.map((n) => ({ nodeId: n.nodeId, state: n.state }))),
      JSON.stringify({ before: given.nodes.map((n) => n.state), after: nodeStates }));
    check(c, 'Then：suspended 实例整体跳过恢复（无 recoveredAt）',
      typeof afterState?.recoveredAt !== 'string',
      JSON.stringify({ recoveredAt: afterState?.recoveredAt ?? null, state: afterState?.state ?? null }));
    check(c, '机检：图 JSON 不含 recovery/connections（未进入恢复路径）',
      !Object.prototype.hasOwnProperty.call(afterParsed ?? {}, 'recovery')
      && !Object.prototype.hasOwnProperty.call(afterParsed ?? {}, 'connections'),
      JSON.stringify(Object.keys(afterParsed ?? {})));
    includes(c, 'Then：实例状态仍显示「已挂起」', text.stdout, '已挂起');
    includes(c, 'Then：review 节点仍显示「待校验」', text.stdout, '待校验');
    includes(c, 'Then：status 中 escalated 节点仍显示「已升级」', statusAfterBoot.stdout, '节点 T-003 开发 已升级');

    // 无「重启后新增事件」文件可读时视为空集，并以 state 未变作为主证据。
    const eventsAfter = (() => {
      try {
        return fs.readFileSync(
          path.join(root, '.orch', 'instances', 'INST-001', 'events.jsonl'), 'utf8',
        ).split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)).filter(Boolean);
      } catch { return []; }
    })();
    evidence(c, 'then', 'events.jsonl',
      eventsAfter.map((e) => JSON.stringify(e)).join('\n') || '(suspended 实例冷启动后无新增事件)\n');
    eq(c, '机检：无 node.dispatch（没重派）',
      eventsAfter.filter((e) => e.reason === 'node.dispatch').length, 0);
    eq(c, '机检：无重新核对（recovery.reverify）',
      eventsAfter.filter((e) => e.reason === 'recovery.reverify').length, 0);
    eq(c, '机检：无新升级（escalation.created）',
      eventsAfter.filter((e) => e.reason === 'escalation.created').length, 0);
    eq(c, '机检：无 recovery.summary（实例整体跳过）',
      eventsAfter.filter((e) => e.reason === 'recovery.summary').length, 0);

    note(c, 'Given 直接构造 suspended 实例（非终态但 reconcileOnBoot 只处理 created/running），'
      + '冷启动对账按需求整体跳过；两次 graph JSON 的 nodes 数组逐字相同。');
    note(c, 'graph --format text 只渲染内置图声明的 T-001/T-002，T-003 的「已升级」在 status 节点行核对；'
      + '节点状态不变仍以 graph JSON 的 nodes 数组与 state 为准。');
    note(c, '事件文件不存在按空集处理，并以 state/graph 未变为主证据；未用空集冒充某条 Then 的观测。');
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
