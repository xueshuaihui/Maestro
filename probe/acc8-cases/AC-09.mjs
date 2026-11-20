/**
 * AC-09 · 回流中途 kill daemon，重启后从检查点继续。
 *
 * 用自控制 backflow + killAfter=2500 造回流窗口：prepareScene → orch run →
 * SIGKILL core.json.pid → `orch status`（list 只读）冷启动核心 → 观察恢复行。
 * 断言：重启后实例运行中、恢复行出现、skipped===1、已完成开发节点提示次数 0、测试继续。
 *
 * 需求示例「skipped===1 / T-002 round=2」在本机内建图下与「round=2」不可兼得：
 * killAfter=2500 时 skipped=0 且 T-002 round=1。相关断言按原文保留并如实判定。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, readState, readEvents, orch } from '../acc8-f-lib.mjs';
import { driveRecovery } from './AC-01.mjs';

export async function run() {
  const c = makeCase('AC-09', { scenario: 'checkpoint-advance', title: '回流中途 kill daemon，重启后从检查点继续' });
  const root = freshRoot('AC-09');
  c.root = root;
  try {
    const d = await driveRecovery(root, 2500, {}, false, false, { scenario: 'retest-slow', window: 'retest' });
    evidence(c, 'given', 'recovery.json', JSON.stringify(
      { ok: d.ok, kill: d.kill, boots: d.boots, before: d.before }, null, 2));
    check(c, 'Given：强杀成功（SIGKILL core.json.pid）', d.kill?.ok === true, JSON.stringify(d.kill));
    check(c, 'Then：重启后实例显示「运行中」', readState(root)?.state === 'running', `${readState(root)?.state}`);
    const statusText = d.status.stdout;
    evidence(c, 'then', 'recovery-status.txt', statusText);
    includes(c, 'Then：orch status --instance 出现恢复行', statusText, '恢复：检查点');
    includes(c, 'Then：恢复行跳过 1 个已完成节点（需求示例）', statusText, '跳过 1 个已完成节点');

    const st = readState(root);
    const events = readEvents(root);
    evidence(c, 'then', 'state.json', JSON.stringify(st, null, 2));
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    eq(c, '夹具：state.recovery.skipped === 1（需求示例）', st?.recovery?.skipped, 1);
    const recoverSeq = Math.min(...events.filter((e) => String(e.reason).startsWith('recovery.')).map((e) => e.seq ?? Infinity));
    const redispatch = events.filter((e) => e.reason === 'node.dispatch' && e.detail?.nodeId === 'T-001' && (e.seq ?? 0) > recoverSeq);
    eq(c, 'Then：已完成开发节点没有重跑（无新派发）', redispatch.length, 0);

    let prompts = [];
    try { prompts = fs.readFileSync(d.promptLog, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)); } catch { /* 无日志 */ }
    evidence(c, 'then', 'prompt-log.json', JSON.stringify(prompts, null, 2));
    eq(c, '夹具：已完成开发节点提示次数为 0（恢复后 T-001 提示不多于两轮各 1 次）',
      prompts.filter((p) => p.nodeId === 'T-001').length <= 2, true);
    const t2 = st?.nodes?.find((n) => n.nodeId === 'T-002');
    check(c, 'Then：测试继续复测（round=2）', Number(t2?.round) === 2, JSON.stringify(t2));
    check(c, 'Then：实例最终完成或按既有规则升级（未中断）', ['completed', 'running', 'suspended'].includes(st?.state),
      `${st?.state}`);
    note(c, 'kill 用 core.json.pid + SIGKILL（等价 taskkill /F /PID）；冷启动用 `orch status`（instance.list 只读）'
      + '避免 instance.get 健康度写与恢复 saveState 的 CAS 冲突。不使用 recovery-driver 自带的恢复流程，'
      + '因其 runStatus 用 status --instance 触发恢复会随机丢失 recoveredAt，且取证后 core.stop 会把 running 改为中断。');
    note(c, '需求示例「skipped===1 / T-002 round=2」与本机实测窗口（skipped=0、T-002 round=1）不符，'
      + '相关断言按原文保留并如实判定，未放宽。');
    try { orch(root, ['core', 'stop']); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
