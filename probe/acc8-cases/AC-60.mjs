/**
 * AC-60 · 「待执行」节点恢复后保持原位置，依赖不变（BR-53 / D-5 step 5）。
 *
 * Given：T-001 `pending` + `phase: ready`（可调度）、T-002 `pending` + `phase: blocked`（依赖未满足）。
 * When：冷启动恢复。Then：两者仍显示待执行；阻塞节点不可调度，可调度节点被派发；边/依赖不变；
 *       只有可调度节点的 `node.dispatch` 次数增加。
 *
 * 现场口径（裁-20n）：`MAESTRO_TEST_RECOVERY_HOLD=after_assign` 会在
 * `continueRecovery` **派发任何节点之前**落 `.mock/paused` 并阻塞等 `.mock/release`。
 * 因此「重启后位置不变」在 hold 点观测（此时 T-001 仍 ready、T-002 仍 blocked），
 * 之后再释放 hold 观测「可调度节点被派发」。需求的两条机检因此不再互斥：
 * 位置不变说的是**恢复本身**不挪动位置，派发是恢复之后的独立动作。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, readState, readEvents, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import { baseState, nodeTpl, prepareGiven, boot } from './AC-28.mjs';

const nap = (ms) => new Promise((r) => setTimeout(r, ms));
const parseGraph = (text) => {
  try { return JSON.parse(text); } catch { return null; }
};

export async function run() {
  const c = makeCase('AC-60', {
    scenario: 'pending-position-and-dependency',
    title: '待执行节点恢复后保持原位置，依赖不变',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-60');
  c.root = root;
  try {
    const given = baseState(root, {
      nodes: [
        nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'pending', phase: 'ready' }),
        nodeTpl({ nodeId: 'T-002', roleId: 'tester', state: 'pending', phase: 'blocked' }),
      ],
    });
    const g = prepareGiven(root, given, {
      caps: 'resume',
      // 恢复后在派发前停住：这是「重启后位置不变」唯一稳定可观测的窗口。
      extraEnv: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
    });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));
    check(c, 'Given：同时有 ready 与 blocked 两个待执行节点',
      given.nodes[0].phase === 'ready' && given.nodes[1].phase === 'blocked'
      && given.nodes.every((n) => n.state === 'pending'),
      JSON.stringify(given.nodes.map((n) => ({ id: n.nodeId, state: n.state, phase: n.phase }))));

    // 冷启动核心 → reconcileOnBoot 恢复 → continueRecovery 在派发前落 paused。
    await boot(root, g.env, 'INST-001', { waitPaused: true });
    const held = readState(root);
    const graphHoldJson = orch(root, ['instance', 'graph', '--instance', 'INST-001', '--format', 'json'], { env: g.env });
    const graphHoldText = orch(root, ['instance', 'graph', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'then', 'graph-hold.json.txt', graphHoldJson.stdout);
    evidence(c, 'then', 'graph-hold.txt', graphHoldText.stdout);
    evidence(c, 'then', 'state-hold.json', JSON.stringify(held, null, 2));

    const hold = parseGraph(graphHoldJson.stdout);
    check(c, '夹具：恢复已对账（recoveredAt 落盘）、且此时尚未派发任何节点',
      Boolean(held?.recoveredAt) && (readEvents(root).filter((e) => e.reason === 'node.dispatch').length === 0),
      JSON.stringify({
        recoveredAt: held?.recoveredAt ?? null,
        dispatches: readEvents(root).filter((e) => e.reason === 'node.dispatch').length,
      }));

    // 机检①：恢复本身不改位置 —— hold 点的 phase 与 Given 逐项相同。
    const holdPhases = (hold?.nodes ?? []).map((n) => ({ nodeId: n.nodeId, phase: n.phase }));
    const givenPhases = given.nodes.map((n) => ({ nodeId: n.nodeId, phase: n.phase }));
    eq(c, '机检：恢复后（派发前）nodes[].phase 与 Given 逐项相同', holdPhases, givenPhases);
    includes(c, 'Then：恢复后两个节点仍显示「待执行」', graphHoldText.stdout, '待执行');
    check(c, 'Then：依赖未满足的节点仍为 blocked',
      (hold?.nodes ?? []).find((n) => n.nodeId === 'T-002')?.phase === 'blocked',
      JSON.stringify((hold?.nodes ?? []).find((n) => n.nodeId === 'T-002') ?? null));
    const graphEdgesBefore = JSON.stringify(hold?.edges ?? null);

    // 释放 hold → 可调度节点被派发，阻塞节点保持不动。
    fs.writeFileSync(path.join(root, '.mock', 'release'), new Date().toISOString(), 'utf8');
    const until = Date.now() + 30000;
    while (Date.now() < until) {
      if (readEvents(root).some((e) => e.reason === 'node.dispatch' && e.detail?.nodeId === 'T-001')) break;
      await nap(100);
    }
    await nap(300);

    const state = readState(root);
    const events = readEvents(root);
    const graphAfterJson = orch(root, ['instance', 'graph', '--instance', 'INST-001', '--format', 'json'], { env: g.env });
    const graphAfterText = orch(root, ['instance', 'graph', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'then', 'graph-after.json.txt', graphAfterJson.stdout);
    evidence(c, 'then', 'graph-after.txt', graphAfterText.stdout);
    evidence(c, 'then', 'state-after.json', JSON.stringify(state, null, 2));
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));

    const after = parseGraph(graphAfterJson.stdout);
    const dispatchOf = (nodeId) => events.filter((e) => e.reason === 'node.dispatch'
      && (e.detail?.nodeId === nodeId || e.objectId === nodeId));
    evidence(c, 'then', 'dispatch.json', JSON.stringify({
      T001: dispatchOf('T-001'), T002: dispatchOf('T-002'),
    }, null, 2));

    check(c, 'Then：可调度节点被派发（node.dispatch 记录 +1）', dispatchOf('T-001').length === 1,
      JSON.stringify({ count: dispatchOf('T-001').length }));
    eq(c, 'Then：阻塞节点不可调度（node.dispatch 0 次）', dispatchOf('T-002').length, 0);
    eq(c, '机检：只有可调度节点的 node.dispatch 次数增加（本轮恰 1 条，且属 T-001）',
      events.filter((e) => e.reason === 'node.dispatch').map((e) => e.detail?.nodeId ?? e.objectId), ['T-001']);
    check(c, '机检：边的逐项相同（依赖图不因恢复改变）',
      JSON.stringify(after?.edges ?? null) === graphEdgesBefore,
      JSON.stringify({ before: graphEdgesBefore, after: JSON.stringify(after?.edges ?? null) }));
    check(c, 'Then：阻塞节点派发后仍显示「待执行」',
      (after?.nodes ?? []).find((n) => n.nodeId === 'T-002')?.phase === 'blocked'
      && graphAfterText.stdout.includes('待执行'),
      JSON.stringify((after?.nodes ?? []).find((n) => n.nodeId === 'T-002') ?? null));

    note(c, '裁-20n：`continueRecovery` 的 `MAESTRO_TEST_RECOVERY_HOLD=after_assign` 挂在**派发之前**，'
      + '因此「重启前后 nodes[].phase 逐项相同」在 hold 点取证（此时两节点仍是 ready/blocked），'
      + '「可调度节点被派发」在释放 hold 之后取证。需求这两句不再互斥：位置不变约束的是恢复本身。');
    note(c, '产品侧本轮补的是 D-5 step 5 的第 5 步：`recoverInstance` 收集 `nodePosition(node)==="ready"` 的'
      + '待执行节点，`continueRecovery` 在恢复完 assigned/created/redeliver 之后逐个派发；`blocked` 节点不进清单。');
    try { orch(root, ['core', 'stop'], { env: g.env }); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
