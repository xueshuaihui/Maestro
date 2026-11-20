/**
 * AC-21 · new 方言：两种都不支持时新建并只重发当前轮。
 *
 * MAESTRO_MOCK_CAPS=none → initialize 只广告 {close,list}，无 resume / loadSession。
 * 恢复降级为 session/new（新建），随后只重发当前轮一次 prompt；已完成节点不提示。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import { driveDialect } from './AC-19.mjs';

export async function run() {
  const c = makeCase('AC-21', {
    scenario: 'dialect-new',
    title: 'new 方言：两种都不支持时新建并只重发当前轮',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-21');
  c.root = root;
  try {
    const d = await driveDialect(root, { MAESTRO_MOCK_CAPS: 'none' },
      { handState: true, waitAfterMs: 3500 });
    evidence(c, 'given', 'driver.json', JSON.stringify({
      ok: d.ok, kill: d.kill, boots: d.boots, before: d.before, runningNodeId: d.runningNodeId, doneNodeId: d.doneNodeId,
    }, null, 2));
    check(c, 'Given：无 resume/load 方言的恢复窗口构造成功', d.ok === true,
      JSON.stringify({ kill: d.kill, runningNodeId: d.runningNodeId }));

    evidence(c, 'then', 'status.txt', d.status.stdout);
    evidence(c, 'then', 'instance-log.txt', d.log.stdout);
    evidence(c, 'then', 'events.jsonl', d.events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(d.afterState, null, 2));
    evidence(c, 'then', 'prompt-log.json', JSON.stringify(d.prompts, null, 2));

    const dialectEvents = d.events.filter((e) => e.reason === 'recovery.dialect');
    const main = dialectEvents.filter((e) => e.fallback !== true);
    evidence(c, 'then', 'dialect-events.json', JSON.stringify(dialectEvents, null, 2));

    includes(c, 'Then：instance log 出现 session/new（新建）', d.log.stdout, 'session/new（新建）');
    excludes(c, 'Then：没有 session/resume 尝试', d.log.stdout, 'session/resume');
    excludes(c, 'Then：没有 session/load 尝试', d.log.stdout, 'session/load');
    eq(c, '夹具：session/new 调用 1 次', main.filter((e) => e.detail?.dialect === 'new').length, 1);
    eq(c, '夹具：resume 调用 0 次', main.filter((e) => e.detail?.dialect === 'resume').length, 0);
    eq(c, '夹具：load 调用 0 次', main.filter((e) => e.detail?.dialect === 'load').length, 0);

    const currentPromptsBefore = d.beforePrompts.filter((p) => p.nodeId === d.runningNodeId).length;
    const currentPromptsAfter = d.prompts.filter((p) => p.nodeId === d.runningNodeId).length;
    eq(c, '夹具：当前轮提示 1 次', currentPromptsAfter - currentPromptsBefore, 1);
    const donePromptsBefore = d.beforePrompts.filter((p) => p.nodeId === d.doneNodeId).length;
    const donePromptsAfter = d.prompts.filter((p) => p.nodeId === d.doneNodeId).length;
    eq(c, '夹具：已完成节点提示 0 次', donePromptsAfter - donePromptsBefore, 0);
    check(c, 'Then：角色因会话不可恢复降级为可用',
      d.events.some((e) => e.reason === 'recovery.role' && e.detail?.to === 'available'
        && e.detail?.reason === 'session_unrecoverable'),
      JSON.stringify(d.events.filter((e) => e.reason === 'recovery.role')));
    note(c, '需求示例会话号 sess-005 属真实 DSH；mock 会话号形态为 mock-sess-<pid>-<seq>，'
      + '按方言语义断言 session/new（新建）行。');
    note(c, '当前轮/已完成节点归属取 MAESTRO_MOCK_PROMPT_LOG 中按提示词推断的 nodeId，'
      + '而非 mock 场景步的 nodeId。');
    try { orch(root, ['core', 'stop'], { env: d.env }); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
