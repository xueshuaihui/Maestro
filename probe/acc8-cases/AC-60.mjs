/**
 * AC-60 · 「待执行」节点恢复后保持原位置，依赖不变（BR-53）。
 *
 * Given：T-001 pending+phase=ready（可调度）、T-002 pending+phase=blocked（依赖未满足）。
 * When：冷启动恢复。Then：两者仍显示待执行；阻塞节点不可调度，可调度节点被派发；
 *       图的边/依赖不变；只有可调度节点 node.dispatch 增加。
 *
 * 机检「重启前后 nodes[].phase 逐项相同」与「可调度节点被派发」互相牵制：
 * 保留逐字断言并如实判定，冲突记 note 交主控裁决。
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  NODE, ORCH_BIN, freshRoot, cleanupRoot, readState, readEvents, orch, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import { baseState, nodeTpl, prepareGiven } from './AC-28.mjs';

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
      extraEnv: { MAESTRO_MOCK_SLOW: '1', MAESTRO_TEST_SLOW_MS: '60000' },
    });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));
    check(c, 'Given：同时有 ready 与 blocked 两个待执行节点',
      given.nodes[0].phase === 'ready' && given.nodes[1].phase === 'blocked'
      && given.nodes.every((n) => n.state === 'pending'),
      JSON.stringify(given.nodes.map((n) => ({ id: n.nodeId, state: n.state, phase: n.phase }))));

    // 第一次 graph 调用即冷启动核心，恢复与调度已经开始；before 取 Given 的逐字现场。
    const graphFirst = orch(root, ['instance', 'graph', '--instance', 'INST-001', '--format', 'json'], { env: g.env });
    const textFirst = orch(root, ['instance', 'graph', '--instance', 'INST-001'], { env: g.env });
    // reconcileOnBoot 只做恢复对账，不直接派发 pending 节点；用 orch run 续跑驱动调度。
    // mock 慢开关让 T-001 停在 running，抓住「T-001 已派发 / T-002 仍 blocked」的窗口。
    const child = spawn(NODE, [ORCH_BIN, 'run', '--cwd', path.join(root, 'demo-recovery'),
      '--task', given.task, '--template', 'code-loop', '--host', 'mock'], {
      cwd: root, env: g.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    let driveOut = '';
    child.stdout?.on('data', (b) => { driveOut += String(b); });
    child.stderr?.on('data', (b) => { driveOut += String(b); });
    const driveUntil = Date.now() + 25000;
    while (Date.now() < driveUntil) {
      const ev = readEvents(root);
      const st = readState(root);
      if (ev.some((e) => e.reason === 'node.dispatch' && e.detail?.nodeId === 'T-001')
        || (st?.nodes ?? []).find((n) => n.nodeId === 'T-001')?.phase === 'running') break;
      await nap(100);
    }
    try { child.kill('SIGKILL'); } catch { /* 清理续跑驱动 */ }
    await nap(500);
    evidence(c, 'then', 'run-resume-output.txt', driveOut || '(无输出)\n');
    const graphSecond = orch(root, ['instance', 'graph', '--instance', 'INST-001', '--format', 'json'], { env: g.env });
    const textSecond = orch(root, ['instance', 'graph', '--instance', 'INST-001'], { env: g.env });
    const state = readState(root);
    const events = readEvents(root);
    evidence(c, 'then', 'graph-first.json.txt', graphFirst.stdout);
    evidence(c, 'then', 'graph-second.json.txt', graphSecond.stdout);
    evidence(c, 'then', 'graph-first.txt', textFirst.stdout);
    evidence(c, 'then', 'graph-second.txt', textSecond.stdout);
    evidence(c, 'then', 'state.json', JSON.stringify(state, null, 2));
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    const first = parseGraph(graphFirst.stdout);
    const second = parseGraph(graphSecond.stdout);
    const edgesStable = JSON.stringify(first?.edges ?? null) === JSON.stringify(second?.edges ?? null);
    const phasesStable = JSON.stringify((first?.nodes ?? []).map((n) => ({ nodeId: n.nodeId, phase: n.phase })))
      === JSON.stringify((second?.nodes ?? []).map((n) => ({ nodeId: n.nodeId, phase: n.phase })));
    evidence(c, 'then', 'graph-diff.json', JSON.stringify({ first, second, edgesStable, phasesStable }, null, 2));

    check(c, '夹具：recoveredAt 落盘（重启对账发生）', Boolean(state?.recoveredAt),
      JSON.stringify({ recoveredAt: state?.recoveredAt ?? null }));
    check(c, '机检：重启前后 edges 逐项相同（依赖图不变）', edgesStable,
      JSON.stringify({ first: first?.edges, second: second?.edges }));
    check(c, '机检：重启前后 nodes[].phase 逐项相同', phasesStable,
      JSON.stringify({
        first: (first?.nodes ?? []).map((n) => ({ nodeId: n.nodeId, phase: n.phase })),
        second: (second?.nodes ?? []).map((n) => ({ nodeId: n.nodeId, phase: n.phase })),
      }));
    const blockedNode = (second?.nodes ?? []).find((n) => n.nodeId === 'T-002');
    check(c, 'Then：依赖未满足节点仍保持 blocked 且显示待执行',
      (blockedNode?.phase ?? null) === 'blocked' && textSecond.stdout.includes('待执行'),
      JSON.stringify(blockedNode ?? null));
    const dispatchT001 = events.filter((e) => e.reason === 'node.dispatch'
      && (e.detail?.nodeId === 'T-001' || e.objectId === 'T-001'));
    const dispatchT002 = events.filter((e) => e.reason === 'node.dispatch'
      && (e.detail?.nodeId === 'T-002' || e.objectId === 'T-002'));
    evidence(c, 'then', 'dispatch.json', JSON.stringify({ T001: dispatchT001, T002: dispatchT002 }, null, 2));
    check(c, 'Then：可调度节点被派发，阻塞节点仍不可调度',
      dispatchT001.length >= 1 && dispatchT002.length === 0,
      JSON.stringify({ T001: dispatchT001.length, T002: dispatchT002.length }));
    eq(c, '机检：只有可调度节点 node.dispatch 次数增加（+1）', dispatchT001.length, 1);
    includes(c, 'Then：graph 文本仍有待执行节点', textSecond.stdout, '待执行');

    note(c, '机检冲突：需求同时要求「可调度节点被派发」与「重启前后 nodes[].phase 逐项相同」；'
      + '派发必然把 T-001 的 phase 从 ready 推进为 running，两者不可兼得。已逐字保留 phase 断言并如实判不通过。');
    note(c, 'CLI 首次调用即冷启动核心并触发恢复，无法先取一份未恢复的 graph JSON；'
      + '「重启前」节点位置以 Given 的受控 state.json 为准，边/依赖用两次 graph JSON 的 edges 比对。');
    note(c, 'reconcileOnBoot 只做恢复对账、不派发 pending 节点，故用 orch run 续跑 + mock 慢开关'
      + '抓「可调度已派发 / 阻塞仍 blocked」窗口；实测续跑被产品按运行中实例拒绝（见 run-resume-output），'
      + '两条派发断言如实判不通过，交主控裁决是否要求恢复后自动调度 pending 节点。');
    try { orch(root, ['core', 'stop'], { env: g.env }); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
