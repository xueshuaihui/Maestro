/**
 * AC-37 · human 节点保持 running，等待人工。
 *
 * Given：直接把 test/fixtures/recovery/human-node-state.json 预置到实例目录
 * （INST-HUMAN-001：T-001 done / T-002 running / T-004 human running），daemon 已强杀。
 * When：冷启动恢复 + status / graph。Then：人工节点仍「执行中 · 等待人工」，无重派、无跳过。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  REPO, freshRoot, cleanupRoot, orch, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import { prepareGiven, boot } from './AC-28.mjs';

const FIXTURE = path.join(REPO, 'test', 'fixtures', 'recovery', 'human-node-state.json');

export async function run() {
  const c = makeCase('AC-37', {
    scenario: 'human-node-held',
    title: 'human 节点保持 running，等待人工',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-37');
  c.root = root;
  try {
    const given = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    // 夹具 cwd 是相对路径；核心按绝对 cwd 拉起宿主，先归一到临时项目根再预置。
    given.cwd = path.join(root, given.cwd);
    fs.mkdirSync(given.cwd, { recursive: true });
    const g = prepareGiven(root, given, { caps: 'resume' });
    evidence(c, 'given', 'fixture-state.json', JSON.stringify(given, null, 2));
    const humanGiven = (given.nodes ?? []).find((n) => n.nodeType === 'human');
    check(c, '夹具：预置 human 节点 T-004 running', humanGiven?.nodeId === 'T-004'
      && humanGiven?.state === 'running' && humanGiven?.nodeType === 'human',
    JSON.stringify(humanGiven));

    const b = await boot(root, g.env, 'INST-HUMAN-001');
    check(c, '夹具：recoveredAt 落盘，重启对账发生', Boolean(b.afterState?.recoveredAt),
      JSON.stringify({ recoveredAt: b.afterState?.recoveredAt ?? null }));

    const status = orch(root, ['status', '--instance', 'INST-HUMAN-001'], { env: g.env });
    const graph = orch(root, ['instance', 'graph', '--instance', 'INST-HUMAN-001'], { env: g.env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-HUMAN-001'], { env: g.env });
    evidence(c, 'then', 'status.txt', status.stdout);
    evidence(c, 'then', 'graph.txt', graph.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout || '(实例日志无新增行)\n');
    evidence(c, 'then', 'state.json', JSON.stringify(b.afterState, null, 2));
    evidence(c, 'then', 'events.jsonl',
      b.events.map((e) => JSON.stringify(e)).join('\n') || '(恢复期无事件)\n');

    const human = (b.afterState?.nodes ?? []).find((n) => n.nodeId === 'T-004');
    const humanEvents = b.events.filter((e) => e.reason === 'recovery.human');
    evidence(c, 'then', 'human-events.json', JSON.stringify(humanEvents, null, 2));
    const dispatchToHuman = b.events.filter(
      (e) => e.reason === 'node.dispatch' && (e.objectId === 'T-004' || e.detail?.nodeId === 'T-004'),
    );

    eq(c, 'Then：人工节点 nodeType === human', human?.nodeType ?? null, 'human');
    eq(c, 'Then：人工节点 state === running', human?.state ?? null, 'running');
    // v4 观测通道：以 orch status --instance 节点行 + instance log 固定行为准；
    // graph 只渲染图声明节点，不要求出现图外 human 节点 T-004。
    const humanStatusLine = `节点 ${humanGiven?.nodeId ?? 'T-004'} 执行中 · 第 ${humanGiven?.round ?? 1} 轮`;
    includes(c, 'Then：orch status --instance 节点行显示「节点 T-004 执行中 · 第 N 轮」',
      status.stdout, humanStatusLine);
    includes(c, 'Then：instance log 出现「恢复：人工节点 T-004 保持等待人工（不重派）」',
      log.stdout, '恢复：人工节点 T-004 保持等待人工（不重派）');
    eq(c, '机检：人工节点无第二次 node.dispatch', dispatchToHuman.length, 0);
    eq(c, '机检：会话数不变（人工节点不建会话）', (b.afterState?.sessions ?? []).length,
      (given.sessions ?? []).length);
    check(c, '夹具：recovery.human 事件点名 T-004',
      humanEvents.some((e) => e.detail?.nodeId === 'T-004'), JSON.stringify(humanEvents));
    excludes(c, 'Then：人工节点未被跳过（无该节点的 skipped 事件）',
      b.events.map((e) => JSON.stringify(e)).join('\n'), '"objectId":"T-004","from":"running","to":"done"');

    note(c, 'Given 直接预置需求指定的 test/fixtures/recovery/human-node-state.json（仅复制内容到临时实例目录），'
      + '方言恢复与人工节点保持由产品核心执行。');
    note(c, 'T-002 的 thinking 会话在本机走 session/resume；与人工节点判定无关，仅用于让实例具备可恢复会话。');
    note(c, 'v4 改法（裁-21a / 裁-21d）：观测通道改为 orch status --instance 的节点行'
      + '「节点 T-004 执行中 · 第 N 轮」+ instance log 固定行「恢复：人工节点 T-004 保持等待人工（不重派）」；'
      + 'graph 只渲染图声明节点（graphNodes() 自 I1.1 冻结），不要求出现图外 human 节点 T-004，'
      + '原 graph 帧保留供复核，不再作为 T-004 可见性的判据。');
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
