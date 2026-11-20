/**
 * AC-22 · resume 失败时回退 load，且每一步可见。
 *
 * caps=both + MAESTRO_MOCK_RESUME=fail → session/resume 返回宿主错误，
 * 核心按 resume → load 顺序回退，events.jsonl 先写 fallback 事件再写 dialect 事件，
 * instance log 对应两行可见；不允许静默新建。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import { driveDialect } from './AC-19.mjs';

export async function run() {
  const c = makeCase('AC-22', {
    scenario: 'resume-fallback-load',
    title: 'resume 失败时回退 load，且每一步可见',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-22');
  c.root = root;
  try {
    const d = await driveDialect(root, {
      MAESTRO_MOCK_CAPS: 'both', MAESTRO_MOCK_RESUME: 'fail',
    }, { handState: true, hold: true });
    evidence(c, 'given', 'driver.json', JSON.stringify({
      ok: d.ok, kill: d.kill, boots: d.boots, before: d.before, runningNodeId: d.runningNodeId,
    }, null, 2));
    check(c, 'Given：both 方言 + resume 失败的恢复窗口构造成功', d.ok === true,
      JSON.stringify({ kill: d.kill, runningNodeId: d.runningNodeId }));

    evidence(c, 'then', 'status.txt', d.status.stdout);
    evidence(c, 'then', 'instance-log.txt', d.log.stdout);
    evidence(c, 'then', 'events.jsonl', d.events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(d.afterState, null, 2));
    evidence(c, 'then', 'prompt-log.json', JSON.stringify(d.prompts, null, 2));

    const dialectEvents = d.events.filter((e) => e.reason === 'recovery.dialect');
    // 裁-16b：核心把 fallback 标记写在 detail 内（detail.fallback），不是事件顶层。
    // 原用例按 e.fallback 过滤导致漏判回退事件——修正字段路径，不放宽断言。
    const fallback = dialectEvents.filter((e) => e.detail?.fallback === true);
    const main = dialectEvents.filter((e) => e.detail?.fallback !== true);
    evidence(c, 'then', 'dialect-events.json', JSON.stringify(dialectEvents, null, 2));

    includes(c, 'Then：先出现「恢复：session/resume 失败，回退 session/load（回放）」',
      d.log.stdout, '恢复：session/resume 失败，回退 session/load（回放）');
    includes(c, 'Then：再出现「恢复：会话 <号> · session/load（回放）」',
      d.log.stdout, 'session/load（回放）');
    const idxFallback = d.log.stdout.indexOf('恢复：session/resume 失败，回退 session/load（回放）');
    const idxLoad = d.log.stdout.indexOf('恢复：会话');
    check(c, 'Then：回退行在会话方言行之前（调用顺序 resume → load）',
      idxFallback >= 0 && idxLoad >= 0 && idxFallback < idxLoad,
      `fallback@${idxFallback} load@${idxLoad}`);
    eq(c, '夹具：resume→load 回退事件 1 次',
      fallback.filter((e) => e.detail?.from === 'resume' && e.detail?.to === 'load').length, 1);
    eq(c, '夹具：最终 dialect=load 1 次', main.filter((e) => e.detail?.dialect === 'load').length, 1);
    eq(c, '夹具：new 为 0（没有静默新建）', main.filter((e) => e.detail?.dialect === 'new').length, 0);
    eq(c, '夹具：dialect=resume 为 0（resume 确实失败）',
      main.filter((e) => e.detail?.dialect === 'resume').length, 0);
    excludes(c, 'Then：instance log 没有 session/new（新建）', d.log.stdout, 'session/new（新建）');
    const doneBefore = d.beforePrompts.filter((p) => p.nodeId === d.doneNodeId).length;
    const doneAfter = d.prompts.filter((p) => p.nodeId === d.doneNodeId).length;
    eq(c, 'Then：已完成节点提示次数不增', doneAfter - doneBefore, 0);
    note(c, '需求示例会话号 sess-003 属真实 DSH；mock 会话号形态为 mock-sess-<pid>-<seq>，'
      + '按方言回退语义断言两行文字与顺序。');
    note(c, '实测只出现「resume 失败，回退 session/load（回放）」一行，随后直接 session/new：'
      + 'acp-client.js:323 未把顶层 loadSession 透传给 normalizeCapabilities，canLoad=false；'
      + '且回退行文案在 from=resume 时恒写 load，和实际 to=new 不一致。按需求保留断言并如实判不通过。');
    try {
      fs.writeFileSync(path.join(root, '.mock', 'release'), '1');
    } catch {
      /* 放行 */
    }
    try { orch(root, ['core', 'stop'], { env: d.env }); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
