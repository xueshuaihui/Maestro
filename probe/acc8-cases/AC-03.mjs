/**
 * AC-03 · 检查点内容足以恢复「做到哪」。
 *
 * 现场：自控制 backflow + killAfter=2500（实测恢复行「轮次 2/2」、跳过数 0；
 * T-001 处于 review/running round=2，T-002 failed round=1）。逐字段核对 checkpoint.json，
 * 并对全文做「不含提示词全文 / 模型输出 / 凭据」的否定断言。
 *
 * 需求示例「跳过 1 / T-001 done round2 / T-002 round2」在本机内建图下不可兼得：
 * killAfter=1200 得 skipped=1 但 round=1；killAfter=2500 得 round=2 但 skipped=0。
 * 按实际数据断言并记入 note()，不放宽也不伪造。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, readState, readEvents, orch } from '../acc8-f-lib.mjs';
import { driveRecovery } from './AC-01.mjs';

const CP = (root) => path.join(root, '.orch', 'instances', 'INST-001', 'state', 'checkpoint.json');

export async function run() {
  const c = makeCase('AC-03', { scenario: 'checkpoint-advance', title: '检查点内容足以恢复「做到哪」' });
  const root = freshRoot('AC-03');
  c.root = root;
  try {
    const d = await driveRecovery(root, 2500);
    evidence(c, 'given', 'recovery.json', JSON.stringify(
      { ok: d.ok, kill: d.kill, boots: d.boots, before: d.before }, null, 2));
    check(c, 'Given：现场构造成功（recoveredAt 落盘）', d.ok === true,
      JSON.stringify({ kill: d.kill, boots: d.boots }));
    includes(c, 'Given：恢复行出现', d.status.stdout, '恢复：检查点');

    const cp = JSON.parse(fs.readFileSync(CP(root), 'utf8'));
    const text = JSON.stringify(cp);
    evidence(c, 'then', 'checkpoint.json', JSON.stringify(cp, null, 2));
    const required = ['instanceId', 'rev', 'checkpointId', 'graph', 'nodes', 'sessions', 'handoffs', 'paused', 'halted'];
    for (const key of required) {
      check(c, `checkpoint 含字段 ${key}`, Object.prototype.hasOwnProperty.call(cp, key), String(cp[key] ?? '').slice(0, 80));
    }
    eq(c, 'instanceId 正确', cp.instanceId, 'INST-001');
    check(c, 'graph 含 nodes 定义（足以恢复图）', Array.isArray(cp.graph?.nodes) && cp.graph.nodes.length > 0, `nodes=${cp.graph?.nodes?.length}`);
    check(c, 'nodes 数组逐项含 nodeId/state/round', Array.isArray(cp.nodes) && cp.nodes.every((n) => n.nodeId && typeof n.state === 'string' && Number.isInteger(n.round)),
      JSON.stringify(cp.nodes?.map((n) => [n.nodeId, n.state, n.round])));
    check(c, 'sessions 数组存在', Array.isArray(cp.sessions), `len=${cp.sessions?.length}`);
    check(c, 'handoffs 数组存在', Array.isArray(cp.handoffs), `len=${cp.handoffs?.length}`);
    check(c, 'paused / halted 为布尔值', typeof cp.paused === 'boolean' && typeof cp.halted === 'boolean', `${cp.paused}/${cp.halted}`);

    // 否定断言：提示词全文、模型输出、凭据
    excludes(c, '不含凭据键 apiKey', text, '"apiKey"');
    excludes(c, '不含凭据键 token', text, '"token"');
    excludes(c, '不含凭据键 password', text, '"password"');
    excludes(c, '不含凭据键 secret', text, '"secret"');
    excludes(c, '不含模型输出帧 agent_message_chunk', text, 'agent_message_chunk');
    excludes(c, '不含模型输出文本 mock: done', text, 'mock: done');
    excludes(c, '不含完整派发提示词（stage/ 绝对路径）', text, 'stage/');
    excludes(c, '不含完整派发提示词（本轮文档引用）', text, '本轮文档引用');
    excludes(c, '不含提示词键 promptText', text, '"promptText"');

    // When/Then：instance log 显示恢复行
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001']);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    includes(c, 'Then：instance log 出现恢复行', log.stdout, '恢复：检查点');
    includes(c, 'Then：跳过 1 个已完成节点（需求示例）', log.stdout, '跳过 1 个已完成节点');
    includes(c, 'Then：轮次 2/…', log.stdout, '轮次 2/');
    const st = readState(root);
    const events = readEvents(root);
    evidence(c, 'then', 'state.json', JSON.stringify(st, null, 2));
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    eq(c, 'recovery.skipped === 1（需求示例）', st?.recovery?.skipped, 1);
    eq(c, 'recovery.round === 2', st?.recovery?.round, 2);
    check(c, '开发节点位置/轮次与崩溃前一致（done round=2）',
      st?.nodes?.find((n) => n.nodeId === 'T-001')?.state === 'done'
      && st?.nodes?.find((n) => n.nodeId === 'T-001')?.round === 2,
      JSON.stringify(st?.nodes?.find((n) => n.nodeId === 'T-001')));
    check(c, '测试节点轮次与崩溃前一致（round=2）',
      st?.nodes?.find((n) => n.nodeId === 'T-002')?.round === 2,
      JSON.stringify(st?.nodes?.find((n) => n.nodeId === 'T-002')));
    note(c, 'checkpoint 含 `task`（用户原始任务文本）与 `graph.prompt`（图模板里的短提示策略标识，'
      + '如 forward/verify），但不含实际派发给 agent 的提示词全文、模型输出帧或凭据；'
      + '按「提示词全文 = 实际派发提示词」口径判通过。');
    note(c, '需求示例「跳过 1 / T-001 done round2 / T-002 round2」在本机内建 backflow 图下不可兼得：'
      + 'killAfter=1200 得 skipped=1 但 round=1；killAfter=2500 得 round=2 但 skipped=0。'
      + '相关断言按原文保留并如实判定，未放宽。');
    try { orch(root, ['core', 'stop']); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
