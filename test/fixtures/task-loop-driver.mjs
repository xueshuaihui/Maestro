#!/usr/bin/env node
// task-loop driver：准备夹具现场 + 用产品 CLI 发起 `task-loop` 实例（I1.3 / D-9）。
//
// 纪律（iteration-3 §1.7 / §2.12）：
// 1. 只写 `<root>/.mock/` 与 `<root>/.orch/hosts/dsh.json`；**绝不**改 `state.json` 造中间态。
// 2. 实例一律由 `bin/orch.js run` 发起，不 import orchestrator，不走旁路。
// 3. 复用 I1.2 的三件事：`cleanEnv`（必须注入 `NODE_ENV='test'`）、`--stop-after` 的
//    轮询方式、退出码透传。`code-loop-driver.mjs` 不对外导出 `cleanEnv`，因此这里保留
//    同一份实现，不修改那个文件。
// 4. `--prepare-only` 只准备现场，不启核心、不建实例。
//
// 场景文件：`test/fixtures/scenarios/task-loop/<name>.json`（29 个，D-9 场景表）。
//   { "steps": [ { nodeId, round, artifact, content, artifactSkip, artifactUtimes,
//                  mutatePrevious, review, reviewSkip, reviewDecoy, reviewUtimes,
//                  remove, delayMs, hold:{when:'prompt'}, hostError, sessionNew,
//                  message, historyMarker } ],
//     "stopAfter": <n|null> }
// nodeId / round 必须显式写在每一步，**没有** code-loop 的交替 + ceil(n/2) 默认值。

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const MOCK_AGENT_PATH = path.join(HERE, 'mock-acp-agent.js');
export const TASK_SCENARIOS_DIR = path.join(HERE, 'scenarios', 'task-loop');
const ORCH_BIN = path.join(REPO_ROOT, 'bin', 'orch.js');

export const HOST_ID = 'dsh';
export const SUITE = 'task-loop';

/** 任务必须含恰好一行 `产物：<文件名>.md`（全角冒号，D-8）。 */
export const DEFAULT_TASK = [
  '写一篇发布说明，覆盖背景、变更与回滚方案。',
  '产物：release-notes.md',
].join('\n');

const NODE_IDS = ['T-001', 'T-002', 'T-003'];

// ---------------------------------------------------------------- 场景读取

/**
 * 列出 task-loop 场景名（`scenarios/task-loop/*.json` 的文件名去扩展名）。
 * 只认这一层目录：`scenarios/` 根下的 code-loop 场景不受影响。
 */
export function taskScenarioNames({ repoRoot = REPO_ROOT } = {}) {
  const dir = path.join(repoRoot, 'test', 'fixtures', 'scenarios', 'task-loop');
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5));
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
    return [];
  }
  return names.sort();
}

function requireExplicitRound(step, name, index) {
  const where = `场景 ${name} 第 ${index + 1} 步`;
  if (typeof step?.nodeId !== 'string' || !NODE_IDS.includes(step.nodeId)) {
    throw new Error(`${where} 缺少显式 nodeId（只允许 ${NODE_IDS.join(' / ')}）`);
  }
  if (!Number.isInteger(step?.round) || step.round < 1) {
    throw new Error(`${where} 缺少显式 round（正整数）`);
  }
}

/**
 * 取 task-loop 场景定义。**不回落到 code-loop 的内置表**：文件缺失即报错，
 * 避免两套场景表在 `--suite` 之间互相串味。
 */
export function getTaskScenario(name, { repoRoot = REPO_ROOT } = {}) {
  if (typeof name !== 'string' || name.length === 0) throw new Error('场景名必填');
  const filePath = path.join(repoRoot, 'test', 'fixtures', 'scenarios', 'task-loop', `${name}.json`);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err?.code === 'ENOENT') throw new Error(`未知 task-loop 场景：${name}（缺少 ${filePath}）`);
    throw new Error(`场景文件不可解析：${filePath}（${err.message}）`);
  }
  if (!Array.isArray(raw?.steps) || raw.steps.length === 0) {
    throw new Error(`场景没有 steps：${name}`);
  }
  raw.steps.forEach((step, index) => requireExplicitRound(step, name, index));
  return {
    name,
    resolved: name,
    stopAfter: Number.isInteger(raw.stopAfter) && raw.stopAfter > 0 ? raw.stopAfter : null,
    steps: raw.steps.map((step) => ({ ...step })),
  };
}

// ---------------------------------------------------------------- 现场准备

function parseDriverArgv(argv) {
  const opts = {
    root: null,
    scenario: null,
    cwd: null,
    task: null,
    stopAfter: null,
    keep: false,
    reset: false,
    prepareOnly: false,
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
      case '--stop-after': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        const n = Number(value);
        if (!Number.isInteger(n) || n <= 0) throw new Error('--stop-after 需要正整数');
        opts.stopAfter = n;
        break;
      }
      case '--keep':
        opts.keep = true;
        break;
      case '--reset':
        opts.reset = true;
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
    '用法：node test/fixtures/task-loop-driver.mjs --root <绝对路径> --scenario <名>',
    '        [--cwd <任务目录>] [--task <文本>] [--stop-after <n>]',
    '        [--keep] [--prepare-only] [--reset]',
    '',
    `场景（${taskScenarioNames().length}）：${taskScenarioNames().join(', ')}`,
  ].join('\n');
}

/** 宿主配置：mock agent 走与 DSH 完全相同的 `host-config → stdio → acp-client` 路径。 */
export function hostConfigFor(root, scenario) {
  return {
    id: HOST_ID,
    transport: 'stdio',
    launch: {
      command: process.execPath,
      args: [MOCK_AGENT_PATH, '--root', root, '--suite', SUITE, '--scenario', scenario],
    },
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

/**
 * 准备现场：清 `.mock/`（可选）→ cursor.json → `.orch/hosts/dsh.json`。
 * 只碰这两处，不创建实例、不写 state.json。
 */
export function prepareTaskScene({ root, scenario, reset = false }) {
  const mockDir = path.join(root, '.mock');
  if (reset) fs.rmSync(mockDir, { recursive: true, force: true });
  fs.mkdirSync(mockDir, { recursive: true });
  fs.mkdirSync(path.join(mockDir, 'prompts'), { recursive: true });
  fs.mkdirSync(path.join(mockDir, 'history'), { recursive: true });

  const cursorPath = path.join(mockDir, 'cursor.json');
  fs.writeFileSync(cursorPath, JSON.stringify({ next: 1 }), 'utf8');

  const hostPath = path.join(root, '.orch', 'hosts', `${HOST_ID}.json`);
  const host = hostConfigFor(root, scenario);
  writeJson(hostPath, host);

  return { mockDir, cursorPath, hostPath, cursor: { next: 1 }, host };
}

// ---------------------------------------------------------------- 核心驱动

/** 环境覆盖优先级高于 host 配置；残留会让 mock 静默变回真实 DSH。 */
function cleanEnv(extra = {}) {
  const env = { ...process.env };
  delete env.MAESTRO_DSH_EXE;
  delete env.MAESTRO_DSH_BIN;
  delete env.MAESTRO_DSH_ARGS;
  return { ...env, NODE_ENV: 'test', ...extra };
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
    // best-effort：核心本来就没跑也不影响后面
  }
}

/** 发起 `orch run`；stdout 原样透传给本进程的 stdout（D-9 要求）。 */
function startRun({ root, cwd, task, env }) {
  const args = [
    ORCH_BIN,
    'run',
    '--cwd', cwd,
    '--task', task,
    '--template', 'task-loop',
    '--host', HOST_ID,
  ];
  const child = spawn(process.execPath, args, {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout?.on('data', (chunk) => {
    process.stdout.write(chunk);
  });
  child.stderr?.on('data', (chunk) => {
    process.stderr.write(chunk);
  });
  const exited = new Promise((resolve) => {
    child.once('error', (err) => resolve({ code: null, signal: null, error: String(err?.message ?? err) }));
    child.once('exit', (code, signal) => resolve({ code, signal, error: null }));
  });
  return { child, exited };
}

function markerOf(mockDir, name) {
  return fs.existsSync(path.join(mockDir, name));
}

/**
 * 等目标：child 退出 / `.mock/paused` / `.mock/stopped-after-<n>`。
 * 与 code-loop-driver 同一轮询方式（100ms）；keep 时无上限，否则 60 秒后 timeout。
 */
async function waitForTarget({ childExited, mockDir, stopAfter, keep }) {
  const started = Date.now();
  const limit = keep ? Number.POSITIVE_INFINITY : 60_000;
  for (;;) {
    const exited = childExited.done ? childExited.value : null;
    if (exited) return { kind: 'exit', exit: exited };
    if (stopAfter && markerOf(mockDir, `stopped-after-${stopAfter}`)) return { kind: 'stop' };
    if (markerOf(mockDir, 'paused')) return { kind: 'paused' };
    if (Date.now() - started >= limit) return { kind: 'timeout' };
    await delay(100);
  }
}

function waitExit(childExited, ms) {
  return Promise.race([
    childExited,
    delay(ms).then(() => ({ code: null, signal: null, error: 'WAIT_TIMEOUT' })),
  ]);
}

/** 规程：最多等 60 秒外部放行（测试可以自己写 `.mock/release`），否则自己放行。 */
async function releaseAfterWait(mockDir) {
  const releasePath = path.join(mockDir, 'release');
  const waitUntil = Date.now() + 60_000;
  while (!fs.existsSync(releasePath) && Date.now() < waitUntil) {
    await delay(100);
  }
  if (!fs.existsSync(releasePath)) fs.writeFileSync(releasePath, '', 'utf8');
}

function waitSignal() {
  return new Promise((resolve) => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
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

  let scenario;
  try {
    scenario = getTaskScenario(opts.scenario);
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

  const stopAfter = opts.stopAfter ?? scenario.stopAfter;
  const cwd = path.resolve(opts.cwd ?? path.join(root, 'demo-doc'));
  const task = opts.task ?? DEFAULT_TASK;

  const prepared = prepareTaskScene({ root, scenario: opts.scenario, reset: opts.reset });

  if (opts.prepareOnly) {
    process.stdout.write(`${JSON.stringify({
      ok: true,
      prepareOnly: true,
      root,
      cwd,
      scenario: opts.scenario,
      suite: SUITE,
      stopAfter,
      cursorPath: prepared.cursorPath,
      hostPath: prepared.hostPath,
      cursor: prepared.cursor,
      host: prepared.host,
    })}\n`);
    return 0;
  }

  fs.mkdirSync(cwd, { recursive: true });
  const env = cleanEnv({
    ...(stopAfter ? { MAESTRO_TEST_STOP_AFTER: String(stopAfter) } : {}),
  });

  stopCore(root, env);

  const run = startRun({ root, cwd, task, env });
  const childExited = { done: false, value: null };
  const exited = run.exited.then((value) => {
    childExited.done = true;
    childExited.value = value;
    return value;
  });

  const target = await waitForTarget({
    childExited,
    mockDir: prepared.mockDir,
    stopAfter,
    keep: opts.keep,
  });

  if (target.kind === 'stop' || target.kind === 'paused') {
    if (opts.keep) {
      // 保持核心与现场，直到 Ctrl-C（AC 要在另一个终端查 status）。
      process.stderr.write(`task-loop-driver: 已停在 ${target.kind}，Ctrl-C 结束\n`);
      await waitSignal();
      await releaseAfterWait(prepared.mockDir);
    } else {
      await releaseAfterWait(prepared.mockDir);
    }
  } else if (target.kind === 'timeout') {
    await releaseAfterWait(prepared.mockDir);
  }

  const child = target.kind === 'exit' ? target.exit : await waitExit(exited, 180_000);
  if (child?.error === 'WAIT_TIMEOUT') {
    try {
      run.child.kill('SIGKILL');
    } catch {
      // ignore
    }
  }

  stopCore(root, env);

  // 退出码透传：orch run 的退出码就是本驱动的退出码（D-9）。
  if (Number.isInteger(child?.code)) return child.code;
  return target.kind === 'timeout' ? 1 : 0;
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
