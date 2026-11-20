/**
 * AC-16 · 显式 `orch core stop` 仍是已中断，不自动恢复。
 *
 * 现场：自控制 backflow 起 `orch run`，等实例进入 running 后显式 `orch core stop`
 * （interruptAll 把 running 改成 interrupted），再连做两次 `orch status --instance`
 * （第一次会冷启动核心并跑 reconcileOnBoot）。按需求断言两次 status 都「已中断」、
 * 无恢复摘要、无新派发。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  NODE, ORCH_BIN, freshRoot, cleanupRoot, readState, readEvents, orch, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import { prepareScene, mockArgsFromEnv, buildRunEnv } from '../../test/fixtures/code-loop-driver.mjs';

const nap = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run() {
  const c = makeCase('AC-16', {
    scenario: 'explicit-core-stop',
    title: '显式 core stop 仍是已中断，不自动恢复',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-16');
  c.root = root;
  let child = null;
  try {
    const env = buildRunEnv(process.env);
    const cwd = path.join(root, 'demo-recovery');
    const prepared = prepareScene({ root, scenario: 'backflow', reset: false, mockArgs: mockArgsFromEnv(env) });
    fs.mkdirSync(cwd, { recursive: true });
    child = spawn(NODE, [ORCH_BIN, 'run', '--cwd', cwd,
      '--task', '修复 calc.js 的除零边界，并补一条回归测试。\n改动写在 calc.js\n产物：calc.js',
      '--template', 'code-loop', '--host', 'mock'], {
      cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    let runOut = '';
    child.stdout?.on('data', (b) => { runOut += String(b); });
    child.stderr?.on('data', (b) => { runOut += String(b); });
    const promptCount = () => {
      try { return fs.readdirSync(path.join(prepared.mockDir, 'prompts')).filter((n) => /^\d+\.json$/.test(n)).length; }
      catch { return 0; }
    };
    for (let i = 0; i < 300 && promptCount() === 0; i += 1) await nap(100);
    await nap(1000);
    const stRunning = readState(root);
    const eventsBeforeStop = readEvents(root);
    evidence(c, 'given', 'run.txt', runOut.slice(-3000));
    evidence(c, 'given', 'state-running.json', JSON.stringify(stRunning, null, 2));
    evidence(c, 'given', 'events-before-stop.jsonl', eventsBeforeStop.map((e) => JSON.stringify(e)).join('\n'));
    eq(c, 'Given：core stop 前实例运行中', stRunning?.state, 'running');

    const stop = orch(root, ['core', 'stop']);
    for (let i = 0; i < 80 && readState(root)?.state !== 'interrupted'; i += 1) await nap(150);
    try { child.kill('SIGKILL'); } catch { /* 清理孤儿 */ }
    const stAfterStop = readState(root);
    const eventsAfterStop = readEvents(root);
    evidence(c, 'given', 'core-stop.txt', `exit=${stop.exitCode}\n${stop.stdout}`);
    evidence(c, 'given', 'state-after-stop.json', JSON.stringify(stAfterStop, null, 2));
    eq(c, '机检：core stop 后状态 interrupted', stAfterStop?.state, 'interrupted');

    // 两次 status：第一次冷启动核心（触发 reconcileOnBoot），第二次热查询
    const status1 = orch(root, ['status', '--instance', 'INST-001']);
    await nap(1200);
    const status2 = orch(root, ['status', '--instance', 'INST-001']);
    const stFinal = readState(root);
    const eventsFinal = readEvents(root);
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001']);

    evidence(c, 'then', 'status-1.txt', status1.stdout);
    evidence(c, 'then', 'status-2.txt', status2.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    evidence(c, 'then', 'events.jsonl', eventsFinal.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(stFinal, null, 2));

    includes(c, 'Then：第一次 status 显示「已中断」', status1.stdout, '已中断');
    includes(c, 'Then：再次 status 拉起核心后仍显示「已中断」', status2.stdout, '已中断');
    eq(c, '机检：最终状态仍 interrupted', stFinal?.state, 'interrupted');
    excludes(c, 'Then：没有恢复行（第一次 status）', status1.stdout, '恢复：检查点');
    excludes(c, 'Then：没有恢复行（第二次 status）', status2.stdout, '恢复：检查点');
    const newRecovery = eventsFinal.filter((e) => e.reason === 'recovery.summary'
      && !eventsAfterStop.some((b) => b.seq === e.seq));
    eq(c, 'Then：没有恢复摘要（recovery.summary 不新增）', newRecovery.length, 0);
    const newDispatch = eventsFinal.filter((e) => e.reason === 'node.dispatch'
      && !eventsAfterStop.some((b) => b.seq === e.seq));
    eq(c, '机检：没有自动继续（node.dispatch 不新增）', newDispatch.length, 0);
    excludes(c, '机检：instance log 没有恢复摘要', log.stdout, '恢复：检查点');
    excludes(c, 'Then：不显示「运行中」', status1.stdout, '运行中');
    note(c, '重启口径按需求用 `orch core stop`（显式中断，不是 SIGKILL）；'
      + '第一次 status 经 connect({ensure:true}) 拉起核心，reconcileOnBoot 对 interrupted 实例跳过。');
    try { orch(root, ['core', 'stop']); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
