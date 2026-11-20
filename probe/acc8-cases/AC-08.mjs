/**
 * AC-08 · 已完成节点不重放。
 *
 * 现场：自控制 backflow + killAfter=2500（实测 T-001 review/running round=2，
 * T-002 failed round=1；恢复行「轮次 2/2」、跳过数 0）。断言恢复后：
 * - 已完成开发节点没有新的 node.dispatch；
 * - instance log 没有它的第二次派发记录；
 * - MAESTRO_MOCK_PROMPT_LOG 中 T-001 提示次数未增加；
 * - 测试节点继续推进（不是把上一轮 failed 当 done 重跑）。
 *
 * 需求夹具点名 retest-slow 的精确中间态 T-001 done r2 / T-002 running r2；
 * 本机实测该场景步数只有 4，恢复期新 mock 进程会耗尽 step 导致 host_unreachable，
 * 故改用同图的 backflow 并把差异记入 note()。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, readState, readEvents, orch } from '../acc8-f-lib.mjs';
import { driveRecovery } from './AC-01.mjs';

function promptsOf(file) {
  try { return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
}

export async function run() {
  const c = makeCase('AC-08', { scenario: 'checkpoint-advance', title: '已完成节点不重放' });
  const root = freshRoot('AC-08');
  c.root = root;
  try {
    const d = await driveRecovery(root, 2500, {}, false, false, { scenario: 'retest-slow', window: 'retest' });
    evidence(c, 'given', 'recovery.json', JSON.stringify(
      { ok: d.ok, kill: d.kill, boots: d.boots, before: d.before }, null, 2));
    check(c, 'Given：恢复现场构造成功（recoveredAt 落盘）', d.ok === true,
      JSON.stringify({ kill: d.kill, boots: d.boots }));
    const events = readEvents(root);
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));

    // 崩溃前 T-001 的派发次数
    const dispatchBefore = d.beforeEvents?.filter((e) => e.reason === 'node.dispatch' && e.detail?.nodeId === 'T-001') ?? [];
    const recoverSeq = events.filter((e) => String(e.reason).startsWith('recovery.')).map((e) => e.seq ?? 0);
    const firstRecoverSeq = recoverSeq.length ? Math.min(...recoverSeq) : Number.POSITIVE_INFINITY;
    const dispatchAfter = events.filter((e) => e.reason === 'node.dispatch' && e.detail?.nodeId === 'T-001' && (e.seq ?? 0) > firstRecoverSeq);
    check(c, 'Given：崩溃前 T-001 有派发记录', dispatchBefore.length >= 1, `${dispatchBefore.length} 次`);
    eq(c, 'Then：已完成开发节点没有新的 node.dispatch', dispatchAfter.length, 0);

    const log = orch(root, ['instance', 'log', '--instance', 'INST-001']);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    const dispatchLines = log.stdout.split(/\r?\n/).filter((l) => /派发/.test(l) && /T-001/.test(l));
    check(c, 'Then：instance log 没有 T-001 的第二次派发记录', dispatchLines.length <= dispatchBefore.length,
      `log 派发行=${JSON.stringify(dispatchLines)} 崩溃前次数=${dispatchBefore.length}`);

    const prompts = promptsOf(d.promptLog);
    evidence(c, 'then', 'prompt-log.json', JSON.stringify(prompts, null, 2));
    const t001Prompts = prompts.filter((p) => p.nodeId === 'T-001').length;
    check(c, '夹具：MAESTRO_MOCK_PROMPT_LOG 中 T-001 提示次数未因恢复增加', t001Prompts <= 2,
      `T-001=${t001Prompts}（两轮各 1 次）`);

    const st = readState(root);
    evidence(c, 'then', 'state.json', JSON.stringify(st, null, 2));
    const t2 = st?.nodes?.find((n) => n.nodeId === 'T-002');
    check(c, 'Then：测试节点继续到 round=2（未被当作已完成重跑）', Number(t2?.round) === 2 && t2?.state !== 'done',
      JSON.stringify(t2));
    const t2Before = d.before?.nodes?.find?.((n) => n.nodeId === 'T-002');
    check(c, 'Then：上一轮失败的测试节点没有被当成「已完成」重跑',
      // 需求 Then 的实质：崩溃时它「执行中/未 done」，恢复后轮次不回退
      // （被当 done 跳过会把 round 冻在原地，从头重跑会回到 round=1）。
      t2Before?.state === 'running'
      && Number(t2Before?.round) >= 2
      && Number(t2?.round) >= Number(t2Before?.round),
      `崩溃前=${JSON.stringify(t2Before)} 恢复后=${JSON.stringify(t2)}`);
    includes(c, '恢复行 skipped=1（需求示例）', log.stdout, '跳过 1 个已完成节点');
    check(c, '恢复后实例仍可推进（running 或 completed）', ['running', 'completed'].includes(st?.state), `${st?.state}`);
    note(c, '窗口已改为需求 Given 的原样现场：driver 用 retest-slow（第 4 步 delayMs=30s）'
      + '并在 T-001 done r2 + T-002 running r2 时强杀，不再用固定毫秒猜窗口。'
      + '此前固定 killAfter 只能得到 T-002 r1，C07 曾按那个错误现场绑死 round===1，已纠正为语义断言。');
    try { orch(root, ['core', 'stop']); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
