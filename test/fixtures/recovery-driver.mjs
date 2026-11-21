#!/usr/bin/env node
// recovery driver（I1.8 / WP-6）：造「恢复现场」并跑一次 kill → 重启对账。
//
// 与两个既有 driver 的关系：只复用它们的现场准备与场景表，不改既有参数语义。
// 所有环境一律经 `buildRunEnv`（NODE_ENV=test），`MAESTRO_MOCK_*` 经
// `mockArgsFromEnv` 转成 mock agent 的既有/新增开关。
//
// 场景（拆分 §2.13 的四个正式名）：
//   checkpoint-advance  AC-09：回流中途 kill daemon，重启后从检查点继续
//   dialect-resume      AC-19 / AC-24：mock 只广告 resume，恢复走不回放
//   redeliver           AC-32 / AC-35 / AC-61：交接包已投递/已构造窗口内强杀
//   e2e                 AC-58：回流崩溃 → 恢复 → 人工节点 → 完成
// 另加三个别名，供 AC-42 / AC-44 / AC-63 的现场构造：
//   crash-rebuild       AC-42（MAESTRO_MOCK_CRASH=after_first_update）
//   crash-twice         AC-63（MAESTRO_MOCK_CRASH=twice）
//   slow                AC-44 / AC-45（MAESTRO_MOCK_SLOW=1 + MAESTRO_TEST_SLOW_MS）
//
// 纪律：
// 1. 项目根只允许 `%TEMP%`；不写仓库内文件。
// 2. 强杀一律读 `.orch/core.json` 的 pid 后 `SIGKILL`，**不用** `orch core stop`
//    （后者是显式中断，语义不同）。
// 3. 不 import orchestrator / 不旁路写 state.json；恢复只通过 `orch status`
//    冷启动核心触发 `reconcileOnBoot`。
// 4. 不硬编码 bash；落盘一律 Node `fs`。

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  REPO_ROOT,
  buildRunEnv,
  getScenario,
  mockArgsFromEnv,
  prepareScene,
} from './code-loop-driver.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const RECOVERY_FIXTURES_DIR = path.join(HERE, 'recovery');
export const HUMAN_NODE_STATE_FIXTURE = path.join(RECOVERY_FIXTURES_DIR, 'human-node-state.json');
export const GRAPH_TIMEOUT_FIXTURE = path.join(RECOVERY_FIXTURES_DIR, 'graph-timeout.json');

const ORCH_BIN = path.join(REPO_ROOT, 'bin', 'orch.js');

const SCENARIOS = Object.freeze({
  'checkpoint-advance': {
    graphScenario: 'backflow',
    killAfter: [1200],
    env: {},
    intent: 'AC-09：回流中途强杀，重启后从检查点继续',
  },
  'dialect-resume': {
    graphScenario: 'backflow',
    killAfter: [1200],
    env: { MAESTRO_MOCK_CAPS: 'resume' },
    intent: 'AC-19 / AC-24：只广告 resume，恢复不回放已完成节点',
  },
  redeliver: {
    graphScenario: 'backflow',
    killAfter: [1200],
    env: {},
    intent: 'AC-32 / AC-35 / AC-61：交接包投递窗口内强杀并重投',
  },
  e2e: {
    // 用 pass 图（T-001 开发 / T-002 测试，测试一次通过）：状态驱动 kill 命中
    // 「T-001 done + T-002 running + created 交接包」后恢复，T-002 继续投递即完成，
    // 不会再触发「第 1 轮不通过 → 回流重测 T-001」把已完成节点二次派发。
    graphScenario: 'pass',
    killAfter: [1500],
    env: {},
    intent: 'AC-58：回流崩溃 → 恢复 → 人工节点 → 完成',
  },
  'crash-rebuild': {
    graphScenario: 'pass',
    killAfter: [],
    runMs: 15000,
    env: { MAESTRO_MOCK_CRASH: 'after_first_update' },
    intent: 'AC-42：首个 update 后崩溃，重建后重试当前轮',
  },
  'crash-twice': {
    graphScenario: 'pass',
    killAfter: [],
    runMs: 15000,
    env: { MAESTRO_MOCK_CRASH: 'twice' },
    intent: 'AC-63：重建后的会话再次崩溃，直接升级不再重建',
  },
  slow: {
    graphScenario: 'pass',
    killAfter: [],
    runMs: 10000,
    env: { MAESTRO_MOCK_SLOW: '1', MAESTRO_TEST_SLOW_MS: '100' },
    intent: 'AC-44 / AC-45：进程存活无 update，判定运行慢',
  },
});

export function recoveryScenarioNames() {
  return Object.keys(SCENARIOS).sort();
}

/**
 * `MAESTRO_TEST_GRAPH` 的夹具侧门禁：仅 `NODE_ENV=test` 且显式给出**绝对存在的
 * 文件**才返回路径。产品侧（`src/core/orchestrator.js`，WP-4）必须实现同一条门禁。
 */
export function resolveTestGraph(env = process.env, { exists = fs.existsSync } = {}) {
  if (env?.NODE_ENV !== 'test') return null;
  const raw = env.MAESTRO_TEST_GRAPH;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (!path.isAbsolute(raw)) return null;
  try {
    if (!exists(raw)) return null;
  } catch {
    return null;
  }
  return path.normalize(raw);
}

function parseDriverArgv(argv) {
  const opts = {
    root: null,
    scenario: null,
    cwd: null,
    task: null,
    reset: false,
    keep: false,
    prepareOnly: false,
    killAfter: [],
    killWhen: null,
    runMs: null,
    waitMs: 5000,
    help: false,
  };
  const nextValue = (i, inline) => (inline !== undefined ? inline : argv[i + 1]);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`多余的参数：${arg}`);
    const eq = arg.indexOf('=');
    const key = eq >= 0 ? arg.slice(0, eq) : arg;
    const inline = eq >= 0 ? arg.slice(eq + 1) : undefined;
    switch (key) {
      case '--root': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        if (typeof value !== 'string' || value.length === 0) throw new Error('--root 需要一个值');
        opts.root = value;
        break;
      }
      case '--scenario': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        if (typeof value !== 'string' || value.length === 0) throw new Error('--scenario 需要一个值');
        opts.scenario = value;
        break;
      }
      case '--cwd': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        opts.cwd = value ?? null;
        break;
      }
      case '--task': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        opts.task = value ?? null;
        break;
      }
      case '--kill-after': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0) throw new Error('--kill-after 需要非负整数毫秒');
        opts.killAfter.push(n);
        break;
      }
      case '--kill-when': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        if (value !== 'done-running' && value !== 'done-running-created') {
          throw new Error('--kill-when 只支持 done-running | done-running-created');
        }
        opts.killWhen = value;
        break;
      }
      case '--run-ms': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        const n = Number(value);
        if (!Number.isInteger(n) || n <= 0) throw new Error('--run-ms 需要正整数');
        opts.runMs = n;
        break;
      }
      case '--wait-ms': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0) throw new Error('--wait-ms 需要非负整数');
        opts.waitMs = n;
        break;
      }
      case '--reset':
        opts.reset = true;
        break;
      case '--keep':
        opts.keep = true;
        break;
      case '--prepare-only':
        opts.prepareOnly = true;
        break;
      case '--help':
        opts.help = true;
        break;
      default:
        throw new Error(`未知参数：${key}`);
    }
  }
  return opts;
}

function usage() {
  return [
    '用法：node test/fixtures/recovery-driver.mjs --root <绝对路径> --scenario <名>',
    '        [--cwd <目录>] [--task <文本>] [--kill-after <毫秒>]... [--run-ms <n>]',
    '        [--kill-when=done-running|done-running-created] [--wait-ms <n>]',
    '        [--reset] [--keep] [--prepare-only]',
    '',
    `场景：${recoveryScenarioNames().join(', ')}`,
  ].join('\n');
}

function corePid(root) {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8'));
    return Number.isInteger(meta?.pid) ? meta.pid : null;
  } catch {
    return null;
  }
}

function killCore(root) {
  const pid = corePid(root);
  if (pid === null) return { ok: false, reason: 'CORE_PID_MISSING' };
  try {
    process.kill(pid, 'SIGKILL');
    return { ok: true, pid };
  } catch (err) {
    return { ok: false, pid, reason: String(err?.code ?? err?.message ?? err) };
  }
}

function stopCore(root, env) {
  try {
    spawnSync(process.execPath, [ORCH_BIN, 'core', 'stop'], {
      cwd: root,
      env,
      timeout: 5_000,
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch {
    // best-effort
  }
}

function startRun({ root, cwd, task, env }) {
  const child = spawn(
    process.execPath,
    [ORCH_BIN, 'run', '--cwd', cwd, '--task', task, '--template', 'code-loop', '--host', 'mock'],
    { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  );
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    stdout += text;
    process.stderr.write(text);
  });
  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    stderr += text;
    process.stderr.write(text);
  });
  const exited = new Promise((resolve) => {
    child.once('error', (err) => resolve({ code: null, signal: null, error: String(err?.message ?? err) }));
    child.once('exit', (code, signal) => resolve({ code, signal, error: null }));
  });
  return { child, exited, getStdout: () => stdout, getStderr: () => stderr };
}

/** `orch status --instance` 冷启动核心；启动对账在监听前完成（D-5）。 */
function runStatus(root, instanceId, env) {
  const res = spawnSync(process.execPath, [ORCH_BIN, 'status', '--instance', instanceId], {
    cwd: root,
    env,
    timeout: 60_000,
    encoding: 'utf8',
    windowsHide: true,
  });
  return { code: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '', error: res.error ?? null };
}

/** `orch instance log` 同样冷启动核心，但渲染的是事件行（含恢复摘要行）。 */
function runLog(root, instanceId, env) {
  const res = spawnSync(process.execPath, [ORCH_BIN, 'instance', 'log', '--instance', instanceId], {
    cwd: root,
    env,
    timeout: 60_000,
    encoding: 'utf8',
    windowsHide: true,
  });
  return { code: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '', error: res.error ?? null };
}

/**
 * 状态驱动的 kill 条件：取代固定毫秒延迟，等到 state.nodes 里同时出现
 * 「至少 1 个 done」与「至少 1 个 running」，并（按 killWhen 要求）拿到交接包。
 * `done-running-created` 额外要求一个 state=created 的交接包，用于观测
 * recovery.handoff created→delivered 这一迁移。
 */
function killWindowOpen(killWhen, root) {
  if (killWhen !== 'done-running' && killWhen !== 'done-running-created') return false;
  const state = readLatestState(root)?.state;
  const nodes = Array.isArray(state?.nodes) ? state.nodes : [];
  const hasDone = nodes.some((n) => n?.state === 'done');
  const hasRunning = nodes.some((n) => n?.state === 'running');
  if (!hasDone || !hasRunning) return false;
  const handoffs = Array.isArray(state?.handoffs) ? state.handoffs : [];
  if (killWhen === 'done-running-created') {
    return handoffs.some((h) => h?.state === 'created');
  }
  return handoffs.length > 0;
}

function readLatestState(root) {
  const dir = path.join(root, '.orch', 'instances');
  let ids = [];
  try {
    ids = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const candidates = [];
  for (const id of ids) {
    const file = path.join(dir, id, 'state.json');
    try {
      const stat = fs.statSync(file);
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      candidates.push({ id, file, mtimeMs: stat.mtimeMs, state: parsed });
    } catch {
      // 半截实例或坏文件：跳过
    }
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0] ?? null;
}

function readCheckpoint(root, instanceId) {
  const file = path.join(root, '.orch', 'instances', instanceId, 'state', 'checkpoint.json');
  try {
    return { file, value: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return { file, value: null };
  }
}

function readEvents(root, instanceId, limit = 40) {
  const file = path.join(root, '.orch', 'instances', instanceId, 'events.jsonl');
  try {
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    return lines.slice(-limit).map((line) => {
      try {
        const ev = JSON.parse(line);
        return { seq: ev.seq, type: ev.type, detail: ev.detail ?? null };
      } catch {
        return { type: 'UNPARSEABLE' };
      }
    });
  } catch {
    return [];
  }
}

function readPromptLog(file) {
  if (typeof file !== 'string' || file.length === 0) return [];
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function promptCount(mockDir) {
  try {
    return fs.readdirSync(path.join(mockDir, 'prompts')).filter((name) => /^\d+\.json$/.test(name)).length;
  } catch {
    return 0;
  }
}

/**
 * Mark the scene as "booting core again". The mock agent's
 * `MAESTRO_MOCK_SPAWN_FAIL_ON_RECOVER=1` fails a spawn only when this marker or
 * `crash-count` exists, so the first normal run is never affected.
 */
function markRecovery(mockDir) {
  try {
    fs.mkdirSync(mockDir, { recursive: true });
    fs.writeFileSync(path.join(mockDir, 'recovery'), '1', 'utf8');
  } catch {
    // marker 写不出来时退化为 crash-count 判定
  }
}

function waitExit(exited, ms) {
  return Promise.race([
    exited,
    delay(ms).then(() => ({ code: null, signal: null, error: 'WAIT_TIMEOUT' })),
  ]);
}

async function waitFor(predicate, ms, stepMs = 100) {
  const until = Date.now() + ms;
  for (;;) {
    if (predicate()) return true;
    if (Date.now() >= until) return false;
    await delay(stepMs);
  }
}

function waitSignal() {
  return new Promise((resolve) => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
}

function snapshotsOf(snapshot) {
  if (!snapshot?.state) return null;
  return {
    instanceId: snapshot.state.instanceId ?? snapshot.id,
    state: snapshot.state.state,
    rev: snapshot.state.rev,
    recoveredAt: snapshot.state.recoveredAt ?? null,
    nodes: (snapshot.state.nodes ?? []).map((node) => ({
      nodeId: node.nodeId,
      nodeType: node.nodeType ?? null,
      state: node.state,
      phase: node.phase ?? null,
      round: node.round ?? null,
    })),
    handoffs: (snapshot.state.handoffs ?? []).map((handoff) => ({
      handoffId: handoff.handoffId,
      state: handoff.state,
      deliveryAttempts: handoff.deliveryAttempts ?? null,
    })),
  };
}

async function main(argv) {
  let opts;
  try {
    opts = parseDriverArgv(argv);
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${usage()}\n`);
    return 2;
  }
  if (opts.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (!opts.root) {
    process.stderr.write(`--root 必填\n\n${usage()}\n`);
    return 2;
  }
  if (!opts.scenario) {
    process.stderr.write(`--scenario 必填\n\n${usage()}\n`);
    return 2;
  }
  const definition = SCENARIOS[opts.scenario];
  if (!definition) {
    process.stderr.write(`未知场景：${opts.scenario}\n\n${usage()}\n`);
    return 2;
  }

  try {
    getScenario(definition.graphScenario);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 2;
  }

  let root;
  try {
    root = fs.realpathSync.native(path.resolve(opts.root));
  } catch {
    root = path.resolve(opts.root);
  }
  fs.mkdirSync(root, { recursive: true });

  // 场景默认 env < 外部显式 MAESTRO_* 覆盖（外部调 `--kill-after` 也覆盖默认）。
  const explicit = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('MAESTRO_')) explicit[key] = value;
  }
  const seamEnv = { ...definition.env, ...explicit };
  const env = buildRunEnv(process.env, seamEnv);
  const testGraph = resolveTestGraph(env);
  if (testGraph) {
    env.MAESTRO_TEST_GRAPH = testGraph;
  } else if (env.MAESTRO_TEST_GRAPH !== undefined) {
    // 显式给出但不是「NODE_ENV=test + 绝对存在的文件」：夹具侧不把它带进子进程。
    delete env.MAESTRO_TEST_GRAPH;
  }

  const cwd = path.resolve(opts.cwd ?? path.join(root, 'demo-recovery'));
  const task = opts.task ?? [
    '修复 calc.js 的除零边界，并补一条回归测试。',
    '改动写在 calc.js',
    '产物：calc.js',
  ].join('\n');
  const killAfter = opts.killAfter.length > 0 ? opts.killAfter : definition.killAfter;
  const killWhen = opts.killWhen;
  const runMs = opts.runMs ?? definition.runMs ?? 60_000;

  const prepared = prepareScene({
    root,
    scenario: definition.graphScenario,
    reset: opts.reset,
    mockArgs: mockArgsFromEnv(env),
  });
  fs.mkdirSync(cwd, { recursive: true });

  // 恢复重派发可能以 null hostId 落到默认 `dsh`；夹具侧让默认 host 也指向同一个
  // mock agent（host-config 文档化的夹具接管入口），避免恢复期误落真实 DSH —— 真实
  // 宿主不消费场景步、会无限 tool_call，掩盖产品真实行为。仅在状态驱动 kill 场景启用。
  if (killWhen) {
    try {
      const hostsDir = path.join(root, '.orch', 'hosts');
      const mockCfg = JSON.parse(fs.readFileSync(prepared.hostPath, 'utf8'));
      fs.mkdirSync(hostsDir, { recursive: true });
      fs.writeFileSync(
        path.join(hostsDir, 'dsh.json'),
        `${JSON.stringify({ ...mockCfg, id: 'dsh' }, null, 2)}\n`,
        'utf8',
      );
    } catch {
      // 写不出来时退化为原行为
    }
  }

  if (opts.prepareOnly) {
    process.stdout.write(`${JSON.stringify({
      ok: true,
      prepareOnly: true,
      scenario: opts.scenario,
      intent: definition.intent,
      root,
      cwd,
      graphScenario: definition.graphScenario,
      killAfter,
      testGraph,
      hostPath: prepared.hostPath,
      host: prepared.host,
    })}\n`);
    return 0;
  }

  stopCore(root, env);
  const t0 = Date.now();
  const run = startRun({ root, cwd, task, env });
  let runDone = false;
  run.exited.then(() => {
    runDone = true;
  });
  const exits = [];
  const kills = [];
  const killWaits = [];
  let snapshotBeforeKill = null;
  let snapshotAfterKill = null;

  const initial = await waitFor(() => promptCount(prepared.mockDir) > 0 || runDone, 30_000);
  if (!initial) {
    fs.writeFileSync(path.join(prepared.mockDir, 'release'), '', 'utf8');
  }

  for (let index = 0; index < killAfter.length; index += 1) {
    if (index === 0) {
      const ready = await waitFor(() => promptCount(prepared.mockDir) > 0 || runDone, 30_000);
      if (!ready || runDone) break;
    } else {
      // 上一轮末尾已经用 `status` 冷启动核心；这里等它可杀并把恢复推进一点点。
      await waitFor(() => corePid(root) !== null, 10_000);
      const before = promptCount(prepared.mockDir);
      await waitFor(() => promptCount(prepared.mockDir) > before, 5_000);
    }
    if (killWhen) {
      // 状态驱动 kill：取代固定毫秒延迟，等到「done + running（+ created 交接包）」
      // 窗口真正出现再 SIGKILL。超时仍按原快照杀，窗口判定落 killWaits 证据。
      const opened = await waitFor(() => killWindowOpen(killWhen, root), 30_000, 100);
      killWaits.push({
        index,
        killWhen,
        opened,
        atMs: Date.now() - t0,
        state: snapshotsOf(readLatestState(root)),
      });
    } else {
      await delay(killAfter[index]);
    }
    if (corePid(root) === null) {
      const current = readLatestState(root);
      const id = current?.state?.instanceId ?? current?.id ?? null;
      if (id) {
        markRecovery(prepared.mockDir);
        runStatus(root, id, env);
      }
      await waitFor(() => corePid(root) !== null, 10_000);
    }
    snapshotBeforeKill = snapshotBeforeKill ?? readLatestState(root);
    const killed = killCore(root);
    kills.push({ ...killed, atMs: Date.now() - t0, promptCount: promptCount(prepared.mockDir) });
    const exit = index === 0
      ? await waitExit(run.exited, 15_000)
      : { code: null, signal: null, error: 'NO_RUN_CHILD_AFTER_RESTART' };
    exits.push(exit);
    snapshotAfterKill = readLatestState(root);
    if (index < killAfter.length - 1) {
      // 为下一次强杀重新拉起核心；`status` 的启动对账即恢复入口。
      const latest = readLatestState(root);
      const id = latest?.state?.instanceId ?? latest?.id ?? null;
      if (id) {
        markRecovery(prepared.mockDir);
        runStatus(root, id, env);
      }
      await delay(300);
    }
  }

  // 没有 kill 的场景：等 orch run 自然结束（或 runMs 到点后放行/强杀）。
  if (killAfter.length === 0) {
    const exit = await waitExit(run.exited, runMs);
    exits.push(exit);
    if (exit?.error === 'WAIT_TIMEOUT') {
      try {
        killCore(root);
      } catch {
        // ignore
      }
    }
  }

  const latest = readLatestState(root);
  const instanceId = latest?.state?.instanceId ?? latest?.id ?? null;
  let recovery = null;
  let recoveryLog = null;
  let snapshotAfterRecovery = null;
  let terminalWait = null;
  let checkpoint = null;
  let events = [];
  if (instanceId) {
    markRecovery(prepared.mockDir);
    recovery = runStatus(root, instanceId, env);
    // 恢复瞬间的快照：此时实例通常仍是 running，用于「运行中/重新派发」判定。
    snapshotAfterRecovery = readLatestState(root);
    // 事件行（含「恢复：检查点 …」摘要行）只在 instance log 渲染。
    // 只在状态驱动 kill 模式额外冷启动取 log：其它场景沿用原来的取证路径，
    // 避免一次额外的 core 启动改变 afterRecovery 快照（回归实测会撞红 AC-03）。
    if (killWhen) recoveryLog = runLog(root, instanceId, env);
    if (opts.waitMs > 0) {
      if (killWhen) {
        // 状态轮询优先：到「完成/升级」终态即停，避免负载下固定 sleep 过长/过短。
        const waitStart = Date.now();
        const terminal = await waitFor(() => {
          const s = readLatestState(root)?.state?.state;
          return s === 'completed' || s === 'suspended';
        }, opts.waitMs, 200);
        terminalWait = {
          mode: 'poll',
          terminal,
          waitedMs: Date.now() - waitStart,
          finalState: readLatestState(root)?.state?.state ?? null,
        };
      } else {
        // 原有口径一字不改：固定 sleep，保证其它场景的恢复瞬间快照不受影响。
        await delay(opts.waitMs);
      }
    }
    checkpoint = readCheckpoint(root, instanceId);
    events = readEvents(root, instanceId);
  }

  const after = readLatestState(root);
  const prompts = readPromptLog(env.MAESTRO_MOCK_PROMPT_LOG);

  const summary = {
    ok: Boolean(instanceId) && kills.every((k) => k.ok),
    scenario: opts.scenario,
    intent: definition.intent,
    root,
    cwd,
    instanceId,
    graphScenario: definition.graphScenario,
    killAfter,
    killWhen,
    killWaits,
    kills,
    testGraph,
    runMs,
    waitMs: opts.waitMs,
    exitCodes: exits.map((item) => item?.code ?? null),
    before: snapshotsOf(snapshotBeforeKill ?? latest),
    afterKill: snapshotsOf(snapshotAfterKill),
    afterRecovery: snapshotsOf(snapshotAfterRecovery ?? after),
    afterTerminal: snapshotsOf(after),
    terminalWait,
    recoveryStatus: recovery ? { code: recovery.code, stdout: recovery.stdout.slice(-2000) } : null,
    recoveryLog: recoveryLog ? { code: recoveryLog.code, stdout: recoveryLog.stdout.slice(-4000) } : null,
    checkpoint: checkpoint ? { file: checkpoint.file, present: checkpoint.value !== null, value: checkpoint.value } : null,
    prompts,
    events,
    durationMs: Date.now() - t0,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);

  if (opts.keep) {
    process.stderr.write('recovery-driver: 现场已保留，Ctrl-C 结束\n');
    await waitSignal();
  }
  stopCore(root, env);
  return summary.ok ? 0 : 1;
}

function isMain() {
  const entry = process.argv[1];
  if (typeof entry !== 'string' || entry.length === 0) return false;
  try {
    return pathToFileURL(fs.realpathSync.native(path.resolve(entry))).href.toLowerCase()
      === pathToFileURL(fs.realpathSync.native(fileURLToPath(import.meta.url))).href.toLowerCase();
  } catch {
    return path.resolve(entry).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
  }
}

if (isMain()) {
  const code = await main(process.argv.slice(2));
  process.exit(code);
}

export { SCENARIOS as RECOVERY_SCENARIOS };
