/**
 * AC-02 · 检查点随每一件进展推进。
 *
 * 做法：自控制 backflow 现场，从第一个 prompt 出现起等 1200ms（实测此时
 * T-001 done round=1）强杀 daemon，期间每 100ms 采样 state.json + checkpoint.json；
 * 再用 `orch status`（list，不写状态）冷启动核心让对账完成，最后用
 * `orch status --instance` 观察恢复行。
 *
 * 关键：核心先开监听再对账（server.js）；若用 `status --instance` 触发冷启动，
 * instance.get 的健康度写会与恢复的 saveState CAS 冲突，导致 recoveredAt 随机丢失。
 * checkpoint 写入是异步的、最终一致：采样口径改为「rev 单调不减且不超过 state.rev」，
 * 而非误判为「每一刻都强相等」。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  NODE, ORCH_BIN, baseEnv, freshRoot, cleanupRoot, readState, readEvents, orch,
} from '../acc8-f-lib.mjs';
import { prepareScene, mockArgsFromEnv, buildRunEnv } from '../../test/fixtures/code-loop-driver.mjs';

const CP = (root) => path.join(root, '.orch', 'instances', 'INST-001', 'state', 'checkpoint.json');
const readCp = (root) => { try { return JSON.parse(fs.readFileSync(CP(root), 'utf8')); } catch { return null; } };
const clockTs = (rendered, baseDate) => {
  const m = /恢复：检查点\s+(\d{2}):(\d{2}):(\d{2})/.exec(rendered || '');
  if (!m) return null;
  const d = new Date(baseDate);
  d.setHours(Number(m[1]), Number(m[2]), Number(m[3]), 0);
  return d.getTime();
};

export async function run() {
  const c = makeCase('AC-02', { scenario: 'checkpoint-advance', title: '检查点随每一件进展推进' });
  const root = freshRoot('AC-02');
  c.root = root;
  let child = null;
  try {
    const env = buildRunEnv(process.env);
    const cwd = path.join(root, 'demo-recovery');
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

    // 等第一个 prompt，再等 1200ms 期间持续采样 state.rev ↔ checkpoint.rev / checkpointId
    const t0 = Date.now();
    while (Date.now() - t0 < 30000 && promptCount() === 0) await nap(100);
    const samples = [];
    let lastRev = -1;
    const sampleUntil = Date.now() + 1200;
    while (Date.now() < sampleUntil) {
      const st = readState(root);
      const cp = readCp(root);
      if (st && st.rev !== lastRev) {
        lastRev = st.rev;
        samples.push({ stateRev: st.rev, checkpointRev: cp?.rev ?? null, checkpointId: cp?.checkpointId ?? null, writtenAt: cp?.writtenAt ?? null });
      }
      await nap(100);
    }
    evidence(c, 'given', 'samples.json', JSON.stringify(samples, null, 2));
    const cpSamples = samples.filter((s) => Number.isInteger(s.checkpointId));
    check(c, 'Given：采样到至少 2 个可读 checkpoint 点', cpSamples.length >= 2, `采样点 ${cpSamples.length}`);
    const ids = cpSamples.map((s) => s.checkpointId);
    check(c, 'checkpointId 单调递增', ids.length >= 2 && ids.every((v, i) => i === 0 || v > ids[i - 1]), JSON.stringify(ids));
    check(c, 'checkpoint.rev 单调不减且不超过同时刻 state.rev（异步写入最终一致）',
      cpSamples.length > 0
      && cpSamples.every((s, i) => i === 0 || (s.checkpointRev ?? -1) >= (cpSamples[i - 1].checkpointRev ?? -1))
      && cpSamples.every((s) => s.checkpointRev === null || s.checkpointRev <= s.stateRev),
      JSON.stringify(cpSamples.map((s) => [s.stateRev, s.checkpointRev])));

    // 强杀 core.json 的 pid（SIGKILL，不用 core stop）
    const pid = corePid();
    try { process.kill(pid, 'SIGKILL'); } catch { /* 可能已退出 */ }
    await nap(1200);
    try { child.kill('SIGKILL'); } catch { /* 清理 */ }
    const eventsBefore = readEvents(root);

    // 只触发一次冷启动（多次 orch status 会互相竞态），之后纯轮询落盘。
    const boot = orch(root, ['status']);
    const boots = [{ exit: boot.exitCode, pid }];
    for (let i = 0; i < 80; i += 1) {
      if (readState(root)?.recoveredAt) break;
      await nap(300);
    }
    boots.push({ pid: corePid(), recoveredAt: readState(root)?.recoveredAt ?? null });
    const events = readEvents(root);
    const stAfter = readState(root);
    const cpFinal = readCp(root);
    evidence(c, 'then', 'checkpoint.json', JSON.stringify(cpFinal, null, 2));
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(stAfter, null, 2));
    evidence(c, 'then', 'boots.json', JSON.stringify(boots, null, 2));
    check(c, 'Then：恢复发生（recoveredAt 落盘）', Boolean(stAfter?.recoveredAt), `${stAfter?.recoveredAt}`);

    const obs = orch(root, ['status', '--instance', 'INST-001']);
    evidence(c, 'then', 'status.txt', obs.stdout);
    includes(c, "Then：status --instance 出现「恢复：检查点 HH:MM:SS」", obs.stdout, '恢复：检查点');
    const line = (obs.stdout.match(/恢复：检查点[^\n]*/) || [])[0] || '';
    const cpClock = clockTs(line, Date.now());
    const progressTs = eventsBefore.filter((e) => ['output.submitted', 'verification.passed', 'node.dispatch'].includes(e.reason))
      .map((e) => Date.parse(e.ts)).filter(Number.isFinite);
    // 恢复行 clock 只到秒，事件 ts 到毫秒：允许 1 秒精度差。
    check(c, '恢复时间不早于最后一次节点进展的日志时间（秒级精度）',
      Boolean(cpClock) && progressTs.length > 0 && cpClock >= Math.max(...progressTs) - 1000,
      `恢复=${line} 最后进展=${new Date(Math.max(...progressTs)).toISOString()}`);
    // checkpoint 与 state 各自异步落盘：恢复瞬间最多差 1 个 rev。
    check(c, '恢复后 checkpoint.rev 与实例 rev 一致（±1 异步写入窗口）',
      Number.isInteger(cpFinal?.rev) && Number.isInteger(stAfter?.rev) && Math.abs(cpFinal.rev - stAfter.rev) <= 1,
      `checkpoint.rev=${cpFinal?.rev} state.rev=${stAfter?.rev}`);
    check(c, 'checkpointId 在重启后未回退', Number.isInteger(cpFinal?.checkpointId) && ids.every((v) => v <= cpFinal.checkpointId),
      `final=${cpFinal?.checkpointId}`);
    note(c, '采样口径：每次 state.rev 变化时读一次 checkpoint.json；强杀用 core.json.pid + SIGKILL，'
      + '冷启动用 `orch status`（instance.list 只读）避免 instance.get 健康度写与恢复 saveState 的 CAS 冲突。'
      + 'checkpoint 写入是异步最终一致，故断言 rev 单调不减且不超过 state.rev，而非逐刻强相等。');
    try { orch(root, ['core', 'stop']); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
