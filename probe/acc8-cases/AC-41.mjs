/**
 * AC-41 · subworkflow 节点在恢复中保持不透明（BR-54 / 裁-10e）。
 *
 * Given：受控 running 实例，T-001 为 subworkflow 节点（running），T-002 已完成。
 * When：冷启动核心触发 reconcileOnBoot。
 * Then：subworkflow 节点状态逐字不变、节点数不变、不展开内部节点、不向内部派发。
 * 机检：重启前后 nodes 数组逐项相同；没有内部节点 id 的新事件。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, orch, readState, readEvents, GRADING_MOCK } from '../acc8-f-lib.mjs';
import { baseState, nodeTpl, prepareGiven, boot, releaseAndStop } from './AC-28.mjs';

const INTERNAL_IDS = ['SW-001', 'SW-002', 'SW-003'];

export async function run() {
  const c = makeCase('AC-41', {
    scenario: 'subworkflow-opaque-on-recovery',
    title: 'subworkflow 节点在恢复中保持不透明',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-41');
  c.root = root;
  try {
    const given = baseState(root, {
      nodes: [
        nodeTpl({ nodeId: 'T-001', roleId: null, state: 'running', phase: 'running',
          nodeType: 'subworkflow', title: '子工作流', extra: { sessionId: null } }),
        nodeTpl({ nodeId: 'T-002', roleId: 'developer', state: 'done' }),
      ],
    });
    const g = prepareGiven(root, given, { caps: 'resume' });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));
    check(c, 'Given：subworkflow 节点 running + 一个已完成节点，内部节点未落盘',
      given.nodes.length === 2
      && given.nodes[0].nodeType === 'subworkflow'
      && given.nodes[0].state === 'running'
      && !INTERNAL_IDS.some((id) => given.nodes.some((n) => n.nodeId === id)),
      JSON.stringify(given.nodes.map((n) => ({ id: n.nodeId, type: n.nodeType, state: n.state }))));

    // 第一次 graph 调用即冷启动；boot() 内部用 status 触发同一对账窗口并等 recoveredAt。
    const graphBefore = orch(root, ['instance', 'graph', '--instance', 'INST-001', '--format', 'json'], { env: g.env });
    const b = await boot(root, g.env, 'INST-001');
    const graphAfter = orch(root, ['instance', 'graph', '--instance', 'INST-001', '--format', 'json'], { env: g.env });
    const graphText = orch(root, ['instance', 'graph', '--instance', 'INST-001'], { env: g.env });
    const events = readEvents(root);
    const after = readState(root);
    evidence(c, 'then', 'boots.json', JSON.stringify(b.boots, null, 2));
    evidence(c, 'then', 'graph-before.json.txt', graphBefore.stdout);
    evidence(c, 'then', 'graph-after.json.txt', graphAfter.stdout);
    evidence(c, 'then', 'graph.txt', graphText.stdout);
    evidence(c, 'then', 'state.json', JSON.stringify(after, null, 2));
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n') || '(恢复期无事件)\n');

    check(c, '夹具：recoveredAt 落盘，恢复路径确实执行', Boolean(after?.recoveredAt),
      JSON.stringify({ recoveredAt: after?.recoveredAt ?? null, boots: b.boots }));

    let beforeParsed = null;
    let afterParsed = null;
    try { beforeParsed = JSON.parse(graphBefore.stdout); } catch { /* 证据已落 */ }
    try { afterParsed = JSON.parse(graphAfter.stdout); } catch { /* 证据已落 */ }
    eq(c, '机检：重启前后 node 数不变（2 → 2）', afterParsed?.nodes?.length, 2);
    check(c, '机检：重启前后 nodes 数组逐项相同',
      JSON.stringify(beforeParsed?.nodes ?? null) === JSON.stringify(afterParsed?.nodes ?? null),
      JSON.stringify({ before: beforeParsed?.nodes, after: afterParsed?.nodes }));

    const sub = (after?.nodes ?? []).find((n) => n.nodeId === 'T-001');
    check(c, 'Then：subworkflow 节点逐字保持 Given 原状态（running/phase=running/无会话）',
      JSON.stringify(sub) === JSON.stringify(given.nodes[0]),
      JSON.stringify({ given: given.nodes[0], after: sub }));
    eq(c, 'Then：state.nodes 数不变（2）', after?.nodes?.length, 2);
    eq(c, '机检：没有内部节点 id 的新事件',
      events.filter((e) => INTERNAL_IDS.includes(e.objectId)
        || INTERNAL_IDS.includes(e.detail?.nodeId)).length, 0);
    eq(c, '机检：subworkflow 节点没有 node.dispatch（不向内部派发）',
      events.filter((e) => e.reason === 'node.dispatch' && e.objectId === 'T-001').length, 0);
    eq(c, '机检：没有任何 node.dispatch（已完成节点也不重派）',
      events.filter((e) => e.reason === 'node.dispatch').length, 0);
    includes(c, 'Then：instance graph 仍只显示 T-001 一个 subworkflow 节点', graphText.stdout, 'T-001');
    for (const id of INTERNAL_IDS) {
      const hit = graphText.stdout.includes(id);
      check(c, `Then：graph 不展开内部节点 ${id}`, !hit, hit ? '出现内部节点' : '未出现');
    }

    note(c, 'BR-54 / 裁-10e：核心 reconcileOnBoot 对 nodeType=subworkflow 直接 continue，'
      + '不建会话、不展开、不派发；本用例用受控 state.json 固定 Given，恢复仍由产品核心执行。');
    note(c, '内部节点 id（SW-001~SW-003）为用例侧的哨兵：若恢复展开子工作流，'
      + '这些 id 会出现在 graph/events 中；实测两者均无。');
    releaseAndStop(root, g.env);
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
