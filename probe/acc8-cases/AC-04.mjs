/**
 * AC-04 · 检查点写失败时用户看得到，运行不中断。
 *
 * 注入 MAESTRO_FAULT=checkpoint_write:fail，跑一次 pass 场景到自然结束。
 * 断言：提醒语句逐字出现在 instance log、每次运行（按 gen）最多 1 次、
 * state.json 仍有最新进展、退出码仍按原流程（完成 0）。
 *
 * 需求写「orch run 输出出现提醒」；实测提醒走 instance log 的 recovery 行通道，
 * orch run 的前台输出不渲染该类事件行。记入 note()，按机检口径（日志）判定。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  REPO, NODE, ORCH_BIN, baseEnv, freshRoot, cleanupRoot, readState, readEvents, orch, runCmd,
} from '../acc8-f-lib.mjs';

const TASK_DRIVER = path.join(REPO, 'test', 'fixtures', 'code-loop-driver.mjs');
const REMINDER = '检查点写入失败：checkpoint_write:fail；本次进展已保存，崩溃恢复可能回退到上一个检查点';

export async function run() {
  const c = makeCase('AC-04', { scenario: 'checkpoint-write-fail', title: '检查点写失败时用户看得到，运行不中断' });
  const root = freshRoot('AC-04');
  c.root = root;
  try {
    const cwd = path.join(root, 'demo-code-pass');
    fs.mkdirSync(cwd, { recursive: true });
    runCmd([NODE, TASK_DRIVER, '--root', root, '--scenario', 'pass', '--cwd', cwd, '--prepare-only'], { cwd: REPO, env: baseEnv() });
    const run = runCmd([NODE, ORCH_BIN, 'run', '--cwd', cwd,
      '--task', '给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js',
      '--template', 'code-loop', '--host', 'mock'],
    { cwd: root, env: baseEnv({ MAESTRO_FAULT: 'checkpoint_write:fail' }), timeout: 120_000 });
    evidence(c, 'given', 'run.txt', `${run.cmd}\nexit=${run.exitCode}\n${run.stdout}\n${run.stderr}`);
    evidence(c, 'given', 'fault-env.txt', 'MAESTRO_FAULT=checkpoint_write:fail\nNODE_ENV=test');

    const log = orch(root, ['instance', 'log', '--instance', 'INST-001']);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    includes(c, 'Then：提醒逐字出现在 instance log', log.stdout, REMINDER);
    check(c, '日志中该提醒至少出现 1 次', (log.stdout.match(/检查点写入失败/g) || []).length >= 1,
      `${(log.stdout.match(/检查点写入失败/g) || []).length} 次`);

    const events = readEvents(root);
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    const faults = events.filter((e) => e.reason === 'checkpoint.write_failed');
    check(c, '机检：checkpoint.write_failed 事件至少 1 次', faults.length >= 1, `${faults.length} 次`);
    const perGen = new Map();
    for (const e of faults) perGen.set(e.gen ?? '?', (perGen.get(e.gen ?? '?') ?? 0) + 1);
    check(c, '机检：每次运行（gen）该提醒最多 1 次', [...perGen.values()].every((n) => n <= 1),
      JSON.stringify([...perGen]));
    check(c, '提醒携带 reminderOnce 标记', faults.every((e) => e.detail?.reminderOnce === true),
      JSON.stringify(faults.map((e) => e.detail)));

    const st = readState(root);
    evidence(c, 'then', 'state.json', JSON.stringify(st, null, 2));
    check(c, 'state.json 仍有最新进展（两节点完成）',
      st?.nodes?.length === 2 && st.nodes.every((n) => n.state === 'done'),
      JSON.stringify(st?.nodes?.map((n) => [n.nodeId, n.state, n.round])));
    eq(c, '实例状态 completed', st?.state, 'completed');
    check(c, '退出码按原流程：完成为 0', run.exitCode === 0, `${run.exitCode}`);
    check(c, '不新增失败退出码（4 挂起 / 5 停止推进 均未出现）', ![4, 5].includes(run.exitCode), `${run.exitCode}`);
    note(c, '需求 Then 写「orch run 输出出现提醒」；实测该提醒走 instance log 的 recovery 行通道 '
      + '（main.js recoveryEventLines），orch run 前台输出不渲染事件行，run 输出 0 次、instance log 1 次。'
      + '按机检「日志中该提醒至少出现 1 次」判定。');
    try { orch(root, ['core', 'stop']); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
