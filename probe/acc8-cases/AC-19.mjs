/**
 * AC-19 · resume 方言：广告 resume 时走不回放。
 *
 * 同时提供同族用例复用的 `driveDialect()`：自控制 retest-slow 第 4 步 30s 延迟窗口
 * （T-002 第 2 轮 running 且已绑定会话）SIGKILL，冷启动触发恢复。
 * 方言选择只由 mock 的 `MAESTRO_MOCK_CAPS` 决定，events.jsonl 里的
 * `recovery.dialect` 行就是产品实际调用的方言记录。
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
const promptsOf = (file) => {
  try { return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)); }
  catch { return []; }
};

/**
 * @param {string} root freshRoot 目录
 * @param {object} envExtra MAESTRO_MOCK_* 方言/故障开关
 * @param {{hold?: boolean, marker?: boolean, waitAfterMs?: number}} opts
 *   hold=true → 恢复后继续推进前冻结；marker=true → 写 .mock/recovery（spawn fail 用）
 */
export async function driveDialect(root, envExtra = {}, opts = {}) {
  const hold = opts.hold === true;
  const extra = { ...envExtra, ...(hold ? { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' } : {}) };
  const env = buildRunEnv(process.env, extra);
  const promptLog = path.join(root, 'prompt-log.ndjson');
  env.MAESTRO_MOCK_PROMPT_LOG = promptLog;
  const scenario = opts.scenario ?? 'backflow';
  const prepared = prepareScene({ root, scenario, reset: false, mockArgs: mockArgsFromEnv(env) });
  const cwd = path.join(root, 'demo-recovery');
  fs.mkdirSync(cwd, { recursive: true });

  // 受控起点：手写「T-001 已完成 + T-002 第 2 轮 running 且会话 thinking」实例记录。
  // 只把核心对账放到同一个可复跑现场；方言选择 / 恢复动作仍由产品核心 + 真 mock 适配器执行。
  let handState = null;
  if (opts.handState === true) {
    const stateFile = path.join(root, '.orch', 'instances', 'INST-001', 'state.json');
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    const stamp = new Date().toISOString();
    handState = {
      schemaVersion: 2,
      instanceId: 'INST-001',
      coreGeneration: 'gen-before-recovery',
      createdAt: stamp,
      updatedAt: stamp,
      state: 'running',
      stateSince: stamp,
      template: 'code-loop',
      cwd,
      task: '修复 calc.js 的除零边界，并补一条回归测试。\n改动写在 calc.js\n产物：calc.js',
      halted: false,
      rev: 1,
      counters: { eventSeq: 0, runCount: 1, dispatchCount: 1 },
      hostRaw: { stopReason: null, lastError: null, agentInfo: null },
      nodes: [
        { nodeId: 'T-001', roleId: 'developer', round: 1, state: 'done', stateSince: stamp,
          startedAt: stamp, roundStartedAt: stamp, endedAt: stamp, failure: null, note: null,
          verdict: { value: 'pass', defects: [] }, sessionId: 'mock-sess-dev-done', artifactRefs: [] },
        { nodeId: 'T-002', roleId: 'tester', round: 2, state: 'running', phase: 'assigned', stateSince: stamp,
          startedAt: stamp, roundStartedAt: stamp, endedAt: null, failure: null, note: null,
          verdict: null, sessionId: 'mock-sess-retest', artifactRefs: [] },
      ],
      sessions: [
        { sessionId: 'mock-sess-retest', nodeId: 'T-002', round: 2, hostId: 'mock', state: 'thinking',
          stateSince: stamp, createdAt: stamp, lastEventAt: stamp, toolName: null, turnId: 'turn-1',
          artifactRef: null, pendingPermission: null, quarantined: false },
      ],
      handoffs: [],
      escalations: [],
      health: { level: 'normal', reasons: [], computedAt: stamp, nodeTimeoutMs: 30000 },
      paused: false,
    };
    fs.writeFileSync(stateFile, `${JSON.stringify(handState, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(prepared.mockDir, 'cursor.json'), '{"next":1}\n', 'utf8');
  }

  let child = null;
  let runOut = '';
  if (!handState) {
    child = spawn(NODE, [ORCH_BIN, 'run', '--cwd', cwd,
      '--task', '修复 calc.js 的除零边界，并补一条回归测试。\n改动写在 calc.js\n产物：calc.js',
      '--template', 'code-loop', '--host', 'mock'], {
      cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    child.stdout?.on('data', (b) => { runOut += String(b); });
    child.stderr?.on('data', (b) => { runOut += String(b); });
  }

  let before = null;
  let runningNodeId = null;
  let doneNodeId = null;
  if (handState) {
    before = handState;
    runningNodeId = 'T-002';
    doneNodeId = 'T-001';
  } else {
    const until = Date.now() + 40000;
    while (Date.now() < until && !before) {
      const st = readState(root);
      const running = (st?.nodes ?? []).find((n) => n.state === 'running' && n.sessionId
        && (!opts.round2 || Number(n.round) >= 2)
        && (st?.sessions ?? []).some((s) => s.sessionId === n.sessionId));
      const done = (st?.nodes ?? []).find((n) => n.state === 'done');
      if (running && done) {
        before = st;
        runningNodeId = running.nodeId;
        doneNodeId = done.nodeId;
      }
      await nap(opts.round2 ? 50 : 100);
    }
  }

  let kill = { ok: false, pid: null };
  if (handState) {
    kill = { ok: true, pid: null, handState: true };
  } else {
    const pid = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8')).pid; }
      catch { return null; }
    })();
    kill.pid = pid;
    if (before) {
      try { process.kill(pid, 'SIGKILL'); kill = { ok: true, pid }; }
      catch (e) { kill = { ok: false, reason: String(e.code ?? e) }; }
    }
    await nap(1200);
    try { child.kill('SIGKILL'); } catch { /* 清理孤儿 */ }
  }
  if (opts.marker === true) {
    fs.mkdirSync(prepared.mockDir, { recursive: true });
    fs.writeFileSync(path.join(prepared.mockDir, 'recovery'), '1', 'utf8');
  }
  // 强杀会留下正被旧 mock 进程持有的 cursor.lock，且 retest-slow 仅 4 步：
  // 恢复期新起的 mock 进程会卡锁或消费第 5 步直接退出（host_unreachable）。
  // 夹具侧清锁并把 cursor 退回最后一步，让恢复期适配器能正常 initialize/方言调用。
  fs.rmSync(path.join(prepared.mockDir, 'cursor.lock'), { force: true });
  fs.rmSync(path.join(prepared.mockDir, 'exhausted'), { force: true });
  if (!handState) fs.writeFileSync(path.join(prepared.mockDir, 'cursor.json'), '{"next":4}\n', 'utf8');
  const beforeEvents = before ? readEvents(root) : [];
  const beforePrompts = promptsOf(promptLog);

  const bootEnv = buildRunEnv(process.env, extra);
  bootEnv.MAESTRO_MOCK_PROMPT_LOG = promptLog;
  const boots = [];
  const corePidOf = () => {
    try { return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8')).pid; }
    catch { return null; }
  };
  let recovered = false;
  for (let attempt = 0; attempt < 2 && !recovered; attempt += 1) {
    if (attempt === 1) {
      // 批一实证：instance.get 健康写与恢复 saveState 的 CAS 冲突会让 recoveredAt 丢失，
      // 再 SIGKILL 一次新核心、重新触发对账（最多重试一次）。
      const p = corePidOf();
      if (p) {
        try { process.kill(p, 'SIGKILL'); } catch { /* 已退出 */ }
      }
      await nap(1200);
    }
    const boot = orch(root, ['status'], { env: bootEnv });
    boots.push({ attempt, exit: boot.exitCode, pid: corePidOf() });
    for (let i = 0; i < 80; i += 1) {
      if (readState(root)?.recoveredAt) {
        recovered = true;
        break;
      }
      await nap(300);
    }
    boots.push({ attempt, pid: corePidOf(), recoveredAt: readState(root)?.recoveredAt ?? null });
  }
  if (hold && before) {
    for (let i = 0; i < 120 && !fs.existsSync(path.join(root, '.mock', 'paused')); i += 1) await nap(100);
  } else {
    await nap(opts.waitAfterMs ?? 3000);
  }

  const afterState = readState(root);
  const events = readEvents(root);
  const prompts = promptsOf(promptLog);
  const status = orch(root, ['status', '--instance', 'INST-001'], { env: bootEnv });
  const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env: bootEnv });
  return {
    ok: Boolean(before) && kill.ok && Boolean(afterState?.recoveredAt),
    before, beforeEvents, beforePrompts, kill, runOut, promptLog, boots,
    runningNodeId, doneNodeId, afterState, events, prompts, status, log, env: bootEnv,
  };
}

export async function run() {
  const c = makeCase('AC-19', {
    scenario: 'dialect-resume',
    title: 'resume 方言：广告 resume 时走不回放',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-19');
  c.root = root;
  try {
    const d = await driveDialect(root, { MAESTRO_MOCK_CAPS: 'resume' },
      { handState: true, hold: true });
    evidence(c, 'given', 'driver.json', JSON.stringify({
      ok: d.ok, kill: d.kill, boots: d.boots, before: d.before, promptLog: d.promptLog,
      runningNodeId: d.runningNodeId, doneNodeId: d.doneNodeId,
    }, null, 2));
    evidence(c, 'given', 'events-before.jsonl',
      d.beforeEvents.map((e) => JSON.stringify(e)).join('\n') || '(受控起点：暂无事件)\n');
    check(c, 'Given：广告 resume（无 load）的恢复窗口构造成功', d.ok === true,
      JSON.stringify({ kill: d.kill, runningNodeId: d.runningNodeId, doneNodeId: d.doneNodeId }));

    evidence(c, 'then', 'status.txt', d.status.stdout);
    evidence(c, 'then', 'instance-log.txt', d.log.stdout);
    evidence(c, 'then', 'events.jsonl', d.events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(d.afterState, null, 2));
    evidence(c, 'then', 'prompt-log.json', JSON.stringify(d.prompts, null, 2));

    const dialectEvents = d.events.filter((e) => e.reason === 'recovery.dialect');
    const main = dialectEvents.filter((e) => e.fallback !== true);
    const fallbacks = dialectEvents.filter((e) => e.fallback === true);
    evidence(c, 'then', 'dialect-events.json', JSON.stringify(dialectEvents, null, 2));

    includes(c, 'Then：instance log 出现 session/resume（不回放）', d.log.stdout, 'session/resume（不回放）');
    excludes(c, 'Then：没有 session/load 尝试', d.log.stdout, 'session/load');
    eq(c, '夹具：session/resume 调用 1 次（recovery.dialect=resume）',
      main.filter((e) => e.detail?.dialect === 'resume').length, 1);
    eq(c, '夹具：session/load 调用 0 次', main.filter((e) => e.detail?.dialect === 'load').length, 0);
    eq(c, '夹具：没有静默新建（dialect=new 为 0）', main.filter((e) => e.detail?.dialect === 'new').length, 0);
    eq(c, '夹具：没有回退事件', fallbacks.length, 0);
    check(c, '夹具：会话恢复标记 dialect=resume',
      (d.afterState?.sessions ?? []).some((s) => s.dialect === 'resume' && s.recovered === true),
      JSON.stringify(d.afterState?.sessions));

    const donePromptsBefore = d.beforePrompts.filter((p) => p.nodeId === d.doneNodeId).length;
    const donePromptsAfter = d.prompts.filter((p) => p.nodeId === d.doneNodeId).length;
    eq(c, ' Then：已完成节点提示次数 0（恢复后不增）', donePromptsAfter - donePromptsBefore, 0);
    note(c, '需求示例会话号 sess-003 是真实 DSH 形态；mock 会话号为 mock-sess-<pid>-<seq>，'
      + '按方言语义断言「恢复：会话 <号> · session/resume（不回放）」，不硬编码示例编号。');
    note(c, '恢复后继续推进用 MAESTRO_TEST_RECOVERY_HOLD=after_assign 冻结，'
      + '使「已完成节点提示 0」不被后续回流污染。');
    note(c, '现场起点用受控 state.json（T-001 done / T-002 round2 running + thinking 会话），'
      + '避免真实 retest-slow 长延迟进程在 SIGKILL 后残留 cursor.lock 与步骤耗尽导致 host_unreachable；'
      + '方言选择、回退与降级仍由产品核心连真 mock ACP 适配器执行。');
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
