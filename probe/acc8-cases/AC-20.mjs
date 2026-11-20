/**
 * AC-20 · load 方言：广告 load 时走回放且不重复投递。
 *
 * MAESTRO_MOCK_CAPS=load → initialize 只广告 {close,list} + loadSession=true。
 * 恢复应走 session/load（回放），无 resume 尝试；hold 冻结后续推进，
 * 使「恢复后没有重发已完成历史 / session/prompt 0 次」可直接机检。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import { driveDialect } from './AC-19.mjs';

export async function run() {
  const c = makeCase('AC-20', {
    scenario: 'dialect-load',
    title: 'load 方言：广告 load 时走回放且不重复投递',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-20');
  c.root = root;
  try {
    const d = await driveDialect(root, { MAESTRO_MOCK_CAPS: 'load' },
      { handState: true, hold: true });
    evidence(c, 'given', 'driver.json', JSON.stringify({
      ok: d.ok, kill: d.kill, boots: d.boots, before: d.before, runningNodeId: d.runningNodeId, doneNodeId: d.doneNodeId,
    }, null, 2));
    check(c, 'Given：广告 load 的恢复窗口构造成功', d.ok === true,
      JSON.stringify({ kill: d.kill, runningNodeId: d.runningNodeId }));
    const sessBefore = (d.before?.sessions ?? []).find((s) => s.sessionId === d.before?.nodes?.find((n) => n.nodeId === d.runningNodeId)?.sessionId);
    check(c, 'Given：会话最后状态为 thinking/tool_running', ['thinking', 'tool_running'].includes(sessBefore?.state),
      `${sessBefore?.state}`);

    evidence(c, 'then', 'status.txt', d.status.stdout);
    evidence(c, 'then', 'instance-log.txt', d.log.stdout);
    evidence(c, 'then', 'events.jsonl', d.events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(d.afterState, null, 2));
    evidence(c, 'then', 'prompt-log.json', JSON.stringify(d.prompts, null, 2));

    const dialectEvents = d.events.filter((e) => e.reason === 'recovery.dialect');
    const main = dialectEvents.filter((e) => e.fallback !== true);
    evidence(c, 'then', 'dialect-events.json', JSON.stringify(dialectEvents, null, 2));

    includes(c, 'Then：instance log 出现 session/load（回放）', d.log.stdout, 'session/load（回放）');
    excludes(c, 'Then：没有 session/resume 尝试', d.log.stdout, 'session/resume');
    eq(c, '夹具：session/load 调用 1 次', main.filter((e) => e.detail?.dialect === 'load').length, 1);
    eq(c, '夹具：session/resume 调用 0 次', main.filter((e) => e.detail?.dialect === 'resume').length, 0);
    eq(c, '夹具：没有静默新建（dialect=new 为 0）', main.filter((e) => e.detail?.dialect === 'new').length, 0);
    check(c, '夹具：回放事件标记 restored=true',
      main.some((e) => e.detail?.dialect === 'load' && e.detail?.restored === true),
      JSON.stringify(main));
    eq(c, '夹具：恢复后没有新的 session/prompt（hold 下总量不增）',
      d.prompts.length - d.beforePrompts.length, 0);
    const donePromptsAfter = d.prompts.filter((p) => p.nodeId === d.doneNodeId).length;
    const donePromptsBefore = d.beforePrompts.filter((p) => p.nodeId === d.doneNodeId).length;
    eq(c, 'Then：没有重发已完成历史（已完成节点 prompt 0）', donePromptsAfter - donePromptsBefore, 0);
    note(c, '需求示例会话号 sess-003 属真实 DSH；mock 会话号形态为 mock-sess-<pid>-<seq>，'
      + '按方言语义断言 session/load（回放）行。');
    note(c, 'Given「会话最后状态 thinking」本机实测可能为 thinking 或 tool_running（首个 update 类型不同），'
      + '两者都属执行中，按执行中语义核对。');
    note(c, '实测方言落到 session/new 而非 session/load：mock 在 initialize 顶层给 loadSession=true，'
      + '但 src/adapter/acp-client.js:323 只把 agentCapabilities.sessionCapabilities 存入 capabilities，'
      + 'normalizeCapabilities 取不到 loadSession → canLoad=false。按需求保留 load 断言并如实判不通过。');
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
