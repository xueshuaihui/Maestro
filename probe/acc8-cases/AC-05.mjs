/**
 * AC-05 · 检查点缺失但实例记录完整时按实例记录恢复。
 *
 * 自控制 backflow 现场：从第一个 prompt 起等 1200ms（实测此时 T-001 done round=1）
 * 强杀 daemon，手动删除 .orch/instances/INST-001/state/checkpoint.json，
 * 再用 `orch status`（list）冷启动核心。
 * 断言：实例仍运行中、instance log 出现「按实例记录恢复（可能重跑当前轮）」、
 * 已完成节点不再收到 prompt。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  NODE, ORCH_BIN, freshRoot, cleanupRoot, readState, readEvents, orch,
} from '../acc8-f-lib.mjs';
import { prepareScene, mockArgsFromEnv, buildRunEnv } from '../../test/fixtures/code-loop-driver.mjs';

const CP = (root) => path.join(root, '.orch', 'instances', 'INST-001', 'state', 'checkpoint.json');

function promptLogEntries(file) {
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  } catch { return []; }
}

export async function run() {
  const c = makeCase('AC-05', { scenario: 'checkpoint-missing', title: '检查点缺失但实例记录完整时按实例记录恢复' });
  const root = freshRoot('AC-05');
  c.root = root;
  let child = null;
  try {
    const env = buildRunEnv(process.env);
    const cwd = path.join(root, 'demo-recovery');
    const promptLog = path.join(root, 'prompt-log.ndjson');
    env.MAESTRO_MOCK_PROMPT_LOG = promptLog;
    const prepared = prepareScene({ root, scenario: 'backflow', reset: false, mockArgs: mockArgsFromEnv(env) });
    fs.mkdirSync(cwd, { recursive: true });
    const task = '修复 calc.js 的除零边界，并补一条回归测试。\n改动写在 calc.js\n产物：calc.js';
    child = spawn(NODE, [ORCH_BIN, 'run', '--cwd', cwd, '--task', task, '--template', 'code-loop', '--host', 'mock'], {
      cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    child.stdout?.on('data', () => {}); child.stderr?.on('data', () => {});
    const nap = (ms) => new Promise((r) => setTimeout(r, ms));
    const promptCount = () => {
      try { return fs.readdirSync(path.join(prepared.mockDir, 'prompts')).filter((x) => /^\d+\.json$/.test(x)).length; }
      catch { return 0; }
    };
    const corePid = () => {
      try { return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8')).pid; }
      catch { return null; }
    };

    const t0 = Date.now();
    while (Date.now() - t0 < 30000 && promptCount() === 0) await nap(100);
    await nap(1200);
    const stBefore = readState(root);
    const promptsBefore = promptLogEntries(promptLog);
    const donePromptsBefore = promptsBefore.filter((p) => p.nodeId === 'T-001').length;
    evidence(c, 'given', 'prompt-log-before.json', JSON.stringify(promptsBefore, null, 2));
    evidence(c, 'given', 'state-before.json', JSON.stringify(stBefore, null, 2));
    check(c, 'Given：checkpoint.json 删除前存在', fs.existsSync(CP(root)), CP(root));

    // 强杀 + 删除 checkpoint
    const pid = corePid();
    try { process.kill(pid, 'SIGKILL'); } catch { /* 已退出 */ }
    await nap(1200);
    try { child.kill('SIGKILL'); } catch { /* 清理 */ }
    fs.rmSync(CP(root), { force: true });
    check(c, 'Given：checkpoint.json 已手动删除', !fs.existsSync(CP(root)), CP(root));
    const eventsBefore = readEvents(root);

    // 只触发一次冷启动（多次 orch status 会互相竞态），之后纯轮询落盘。
    const boot = orch(root, ['status']);
    const boots = [{ exit: boot.exitCode, pid }];
    for (let i = 0; i < 80; i += 1) {
      if (readState(root)?.recoveredAt) break;
      await nap(300);
    }
    boots.push({ pid: corePid(), recoveredAt: readState(root)?.recoveredAt ?? null });

    const log = orch(root, ['instance', 'log', '--instance', 'INST-001']);
    const status = orch(root, ['status', '--instance', 'INST-001']);
    const events = readEvents(root);
    const stAfter = readState(root);
    const promptsAfter = promptLogEntries(promptLog);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    evidence(c, 'then', 'status.txt', status.stdout);
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(stAfter, null, 2));
    evidence(c, 'then', 'boots.json', JSON.stringify(boots, null, 2));
    evidence(c, 'then', 'prompt-log-after.json', JSON.stringify(promptsAfter, null, 2));
    check(c, 'Then：恢复发生（recoveredAt 落盘）', Boolean(stAfter?.recoveredAt), `${stAfter?.recoveredAt}`);

    includes(c, "Then：instance log 出现「按实例记录恢复（可能重跑当前轮）」", log.stdout, '按实例记录恢复（可能重跑当前轮）');
    check(c, '对账事件含 recovery.record', events.some((e) => e.reason === 'recovery.record'),
      JSON.stringify(events.filter((e) => String(e.reason).startsWith('recovery.')).map((e) => e.reason)));
    eq(c, '实例仍「运行中」', stAfter?.state, 'running');
    includes(c, 'status --instance 显示「运行中」', status.stdout, '运行中');
    const donePromptsAfter = promptsAfter.filter((p) => p.nodeId === 'T-001').length;
    eq(c, '夹具：已完成节点 session/prompt 次数仍为 0（恢复后无新增）', donePromptsAfter - donePromptsBefore, 0);
    const dispatchAfter = events.filter((e) => e.reason === 'node.dispatch'
      && (e.ts ?? '') >= (eventsBefore.at(-1)?.ts ?? '')).length;
    check(c, '当前轮允许 1 次重发（恢复后派发 ≤ 1）', dispatchAfter <= 1, `${dispatchAfter} 次`);
    check(c, '模板是内建三图之一', ['code-loop', 'task-loop', 'single'].includes(stAfter?.template), `${stAfter?.template}`);
    note(c, '强杀用 core.json.pid + SIGKILL；冷启动用 `orch status`（instance.list 只读）避免 instance.get '
      + '健康度写与恢复 saveState 的 CAS 冲突。已完成节点 prompt 计数用 MAESTRO_MOCK_PROMPT_LOG 前后差。');
    try { orch(root, ['core', 'stop']); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
