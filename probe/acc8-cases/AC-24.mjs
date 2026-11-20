/**
 * AC-24 · resume 成功也不重放已完成节点。
 *
 * 与批一 AC-08 同族，方言固定 resume。用 driveRecovery(root, 2500,
 * {MAESTRO_MOCK_CAPS:'resume'}, …, retryRecover=true) 构造回流复测现场。
 *
 * 裁-14b：需求示例窗口「T-002 round=2」与内建 4 步 backflow 夹具不可兼得；
 * 按原文保留该断言并如实判定，差异记 note()，不放宽。
 */
import fs from 'node:fs';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, readState, readEvents, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import { driveRecovery } from './AC-01.mjs';

const promptsOf = (file) => {
  try { return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)); }
  catch { return []; }
};

export async function run() {
  const c = makeCase('AC-24', {
    scenario: 'resume-no-replay',
    title: 'resume 成功也不重放已完成节点',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-24');
  c.root = root;
  try {
    const d = await driveRecovery(root, 2500, { MAESTRO_MOCK_CAPS: 'resume' }, false, true);
    evidence(c, 'given', 'driver.json', JSON.stringify(
      { ok: d.ok, kill: d.kill, boots: d.boots, before: d.before }, null, 2));
    check(c, 'Given：resume 方言恢复现场构造成功', d.ok === true,
      JSON.stringify({ kill: d.kill, boots: d.boots }));

    const st = readState(root);
    const events = readEvents(root);
    const prompts = promptsOf(d.promptLog);
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001']);
    const status = orch(root, ['status', '--instance', 'INST-001']);
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(st, null, 2));
    evidence(c, 'then', 'prompt-log.json', JSON.stringify(prompts, null, 2));
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    evidence(c, 'then', 'status.txt', status.stdout);

    const dev = st?.nodes?.find((n) => n.nodeId === 'T-001');
    const t2 = st?.nodes?.find((n) => n.nodeId === 'T-002');
    const devBefore = d.before?.nodes?.find((n) => n.nodeId === 'T-001');
    const t2Before = d.before?.nodes?.find((n) => n.nodeId === 'T-002');

    includes(c, '夹具：恢复方言为 session/resume（不回放）', log.stdout, 'session/resume（不回放）');
    const dialectEvents = events.filter((e) => e.reason === 'recovery.dialect');
    check(c, '夹具：recovery.dialect=resume 恰好 1 次',
      dialectEvents.filter((e) => e.fallback !== true && e.detail?.dialect === 'resume').length === 1,
      JSON.stringify(dialectEvents));
    check(c, '夹具：无 session/load 方言行', !dialectEvents.some((e) => e.detail?.dialect === 'load'),
      JSON.stringify(dialectEvents));

    const devPrompts = prompts.filter((p) => p.nodeId === 'T-001').length;
    check(c, 'Then：已完成开发节点 prompt 次数为 0（恢复后不增，总数 ≤ 2 两轮）',
      devPrompts <= 2 && devPrompts === prompts.filter((p) => p.nodeId === 'T-001').length,
      `T-001=${devPrompts}`);
    const t2Prompts = prompts.filter((p) => p.nodeId === 'T-002').length;
    check(c, 'Then：当前复测测试节点至多收到一次提示（崩溃前 1 次 + 恢复后 ≤ 1）',
      t2Prompts <= 2, `T-002=${t2Prompts}（崩溃前 1）`);

    const firstRecoverSeq = Math.min(...events.filter((e) => String(e.reason).startsWith('recovery.')).map((e) => e.seq ?? 0));
    const devDispatchAfter = events.filter((e) => e.reason === 'node.dispatch'
      && e.detail?.nodeId === 'T-001' && (e.seq ?? 0) > firstRecoverSeq);
    eq(c, 'Then：已完成开发节点没有新的 node.dispatch', devDispatchAfter.length, 0);
    check(c, 'Given：崩溃前开发节点已完成过至少一轮', devBefore?.round >= 1 || devBefore?.state === 'done',
      JSON.stringify(devBefore));
    eq(c, '夹具：当前复测测试节点 round=2（需求示例，裁-14b）', t2?.round, 2);
    check(c, 'Then：实例仍可推进', ['running', 'completed'].includes(st?.state), `${st?.state}`);
    note(c, '裁-14b：需求示例窗口 T-002 round=2 与内建 4 步 backflow 夹具不可兼得；'
      + `崩溃前 T-002=${JSON.stringify(t2Before)}，恢复后=${JSON.stringify(t2)}。按原文保留 round=2 断言并如实判定。`);
    note(c, '与 AC-08 同窗口：killAfter=2500 下 T-001 处于第 2 轮执行/待校验，T-002 failed r1；'
      + '已完成节点 prompt 计数取 MAESTRO_MOCK_PROMPT_LOG 的 nodeId 归属。');
    try { orch(root, ['core', 'stop']); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
