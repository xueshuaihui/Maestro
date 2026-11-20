/**
 * AC-17 · 恢复失败时用户看到原因。
 *
 * 现场：retest-slow 第 4 步 30s 延迟窗口（T-002 第 2 轮 running 且已绑定会话）SIGKILL，
 * 写 `.mock/recovery` 标记后冷启动；mock agent 的 `--spawn-fail-on-recover`
 * 只在恢复标记存在时让新进程 exit 9，于是 initializeAdapterOnly 抛错 →
 * 核心 markInterrupted + recovery.failed 事件。
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
  const c = makeCase('AC-17', {
    scenario: 'recover-host-unreachable',
    title: '恢复失败时用户看到原因',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-17');
  c.root = root;
  let child = null;
  try {
    const env = buildRunEnv(process.env, { MAESTRO_MOCK_SPAWN_FAIL_ON_RECOVER: '1' });
    const cwd = path.join(root, 'demo-recovery');
    const prepared = prepareScene({ root, scenario: 'retest-slow', reset: false, mockArgs: mockArgsFromEnv(env) });
    fs.mkdirSync(cwd, { recursive: true });
    child = spawn(NODE, [ORCH_BIN, 'run', '--cwd', cwd,
      '--task', '修复 calc.js 的除零边界，并补一条回归测试。\n改动写在 calc.js\n产物：calc.js',
      '--template', 'code-loop', '--host', 'mock'], {
      cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    let runOut = '';
    child.stdout?.on('data', (b) => { runOut += String(b); });
    child.stderr?.on('data', (b) => { runOut += String(b); });

    // 等「running 节点 + 已绑定会话」窗口
    let before = null;
    const until = Date.now() + 30000;
    while (Date.now() < until && !before) {
      const st = readState(root);
      // retest-slow 第 4 步 delayMs=30s：T-002 第 2 轮 running 且会话已绑定，
      // 保证强杀时核心看到的是「有会话可恢复」的运行中节点。
      const running = (st?.nodes ?? []).find((n) => n.state === 'running' && n.sessionId
        && Number(n.round) >= 2
        && (st?.sessions ?? []).some((s) => s.sessionId === n.sessionId));
      if (running) before = st;
      await nap(50);
    }
    evidence(c, 'given', 'run.txt', runOut.slice(-3000));
    evidence(c, 'given', 'state-before.json', JSON.stringify(before, null, 2));
    check(c, 'Given：恢复前存在 running 且已绑定会话的节点', Boolean(before),
      JSON.stringify(before?.nodes?.map((n) => ({ id: n.nodeId, state: n.state, sid: n.sessionId }))));
    check(c, 'Given：实例有检查点', fs.existsSync(path.join(root, '.orch', 'instances', 'INST-001', 'state', 'checkpoint.json')),
      'checkpoint.json');

    const pid = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8')).pid; }
      catch { return null; }
    })();
    let kill = { ok: false, pid };
    try { process.kill(pid, 'SIGKILL'); kill = { ok: true, pid }; } catch (e) { kill = { ok: false, reason: String(e.code ?? e) }; }
    await nap(1200);
    try { child.kill('SIGKILL'); } catch { /* 清理孤儿 */ }
    fs.mkdirSync(path.join(prepared.mockDir), { recursive: true });
    fs.writeFileSync(path.join(prepared.mockDir, 'recovery'), '1', 'utf8');

    const boot = orch(root, ['status', '--instance', 'INST-001'], { env });
    for (let i = 0; i < 120 && readState(root)?.state !== 'interrupted'; i += 1) await nap(200);
    const status = orch(root, ['status', '--instance', 'INST-001'], { env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env });
    const stAfter = readState(root);
    const events = readEvents(root);

    evidence(c, 'then', 'boot.txt', `exit=${boot.exitCode}\n${boot.stdout.slice(-1500)}`);
    evidence(c, 'then', 'status.txt', status.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(stAfter, null, 2));

    includes(c, 'Then：实例显示「已中断」', status.stdout, '已中断');
    excludes(c, 'Then：不显示「运行中」', status.stdout, '运行中');
    includes(c, '夹具：instance log 出现「恢复失败：」', log.stdout, '恢复失败：');
    includes(c, '夹具：instance log 出现「实例已中断（可执行 orch instance log 查看详情）」',
      log.stdout, '实例已中断（可执行 orch instance log 查看详情）');
    eq(c, '机检：状态 interrupted', stAfter?.state, 'interrupted');
    check(c, '夹具：recovery.failed 事件存在',
      events.some((e) => e.reason === 'recovery.failed'),
      JSON.stringify(events.filter((e) => String(e.reason).startsWith('recovery.'))));
    check(c, '夹具：宿主不可达原因可见（日志恢复失败行非空）',
      /恢复失败：[^\n；]+；实例已中断/.test(log.stdout),
      (log.stdout.match(/恢复失败：[^\n]*/) || [])[0] ?? '');
    note(c, '夹具 MAESTRO_MOCK_SPAWN_FAIL_ON_RECOVER=1 只在 `.mock/recovery` 标记存在时让新 mock 进程 exit 9；'
      + '该标记在 SIGKILL 之后写入，避免影响首次正常 run。');
    try { orch(root, ['core', 'stop'], { env }); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
