/**
 * WP-9 端到端：真实 `bin/orch.js` + 真核心进程 + `mock-acp-agent.js` 宿主。
 *
 * 三个场景（C-1 / C-2 / C-3）都跑在 `os.tmpdir()` 下的临时项目根，跑完停核心并清目录，
 * 避免在仓库里留下 `.orch` 或孤儿核心。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = path.resolve('.');
const BIN = path.join(REPO, 'bin', 'orch.js');
const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');

const LIMITS = {
  initializeTimeoutMs: 15_000,
  requestTimeoutMs: 15_000,
  promptTimeoutMs: 30_000,
  quietIdleMs: 30,
  quietCapMs: 200,
};

function sanitizedEnv() {
  const env = { ...process.env };
  for (const key of ['MAESTRO_DSH_EXE', 'MAESTRO_DSH_BIN', 'MAESTRO_DSH_ARGS', 'MAESTRO_PERMISSION_POLICY']) {
    delete env[key];
  }
  return env;
}

/** 临时项目根 + 任务目录 + `.orch/hosts/dsh.json`（字段与 host-config.js 一致）。 */
function makeProject(tag, switches = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `maestro-wp9-${tag}-`));
  const taskCwd = path.join(root, 'work');
  fs.mkdirSync(path.join(root, '.orch', 'hosts'), { recursive: true });
  fs.mkdirSync(taskCwd, { recursive: true });
  fs.writeFileSync(
    path.join(root, '.orch', 'hosts', 'dsh.json'),
    JSON.stringify(
      {
        transport: 'stdio',
        launch: { command: process.execPath, args: [MOCK, ...switches] },
        limits: { ...LIMITS },
      },
      null,
      2,
    ),
    'utf8',
  );
  return { root, taskCwd };
}

function stopCore(root) {
  spawnSync(process.execPath, [BIN, 'core', 'stop'], {
    cwd: root,
    env: sanitizedEnv(),
    timeout: 20_000,
    windowsHide: true,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 核心是 detached 进程：`core stop` 回包后它可能仍在 flush `.orch` 下的日志/管道文件。
 * 本机的 safe-delete shim 会把文件移入回收站而非直接删除，单次 rmSync 可能与尾随写入
 * 竞态抛 ENOTEMPTY。显式重试若干次即可收敛（不改任何断言，只加固清理）。
 */
async function removeProject(root) {
  const deadline = Date.now() + 8000;
  for (;;) {
    try {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      return;
    } catch (err) {
      const transient = err?.code === 'ENOTEMPTY' || err?.code === 'EBUSY' || err?.code === 'EPERM';
      if (!transient || Date.now() >= deadline) throw err;
      await sleep(150);
    }
  }
}

async function cleanup(root) {
  try {
    stopCore(root);
  } finally {
    await removeProject(root);
  }
}

/** 异步起一个 CLI，边跑边累积 stdout（场景 2/3 需要在它运行期间采样）。 */
function spawnCli(args, cwd) {
  const child = spawn(process.execPath, [BIN, ...args], {
    cwd,
    env: sanitizedEnv(),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const state = { child, stdout: '', stderr: '', code: null };
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    state.stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    state.stderr += chunk;
  });
  state.done = new Promise((resolve) => {
    child.on('error', (err) => {
      state.stderr += String(err);
      resolve(-1);
    });
    child.on('close', (code) => {
      state.code = code;
      resolve(code);
    });
  });
  return state;
}

async function waitFor(predicate, { timeoutMs = 20_000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() > deadline) return false;
    await sleep(intervalMs);
  }
}

function status(cwd, instanceId) {
  return spawnSync(process.execPath, [BIN, 'status', '--instance', instanceId], {
    cwd,
    env: sanitizedEnv(),
    timeout: 20_000,
    encoding: 'utf8',
    windowsHide: true,
  });
}

// ---------------------------------------------------------------- C-1

test('C-1 端到端：--session-missing → 会话已失效，无未知错误，exit 1', { timeout: 90_000 }, async () => {
  const { root, taskCwd } = makeProject('c1', ['--session-missing']);
  try {
    const run = spawnCli(['run', '--cwd', taskCwd, '--task', '写一段产品说明'], root);
    const code = await run.done;

    assert.equal(code, 1, `stdout:\n${run.stdout}\nstderr:\n${run.stderr}`);
    assert.ok(run.stdout.includes('会话已失效，需要重新创建'), `stdout:\n${run.stdout}`);
    assert.ok(!run.stdout.includes('未知错误'), `stdout:\n${run.stdout}`);
    assert.ok(!run.stderr.includes('未知错误'), `stderr:\n${run.stderr}`);
  } finally {
    await cleanup(root);
  }
});

// ---------------------------------------------------------------- C-2

test('C-2 端到端：tool_running 的 status 会话行含"已运行 Ns"（N>0）', { timeout: 90_000 }, async () => {
  const { root, taskCwd } = makeProject('c2', ['--write-ref', 'out/intro.md', '--turn-delay-ms', '4000']);
  try {
    const run = spawnCli(['run', '--cwd', taskCwd, '--task', '写一段说明，保存到 out/intro.md'], root);

    const started = await waitFor(() => run.stdout.includes('任务已投递'));
    assert.ok(started, `run 未投递成功：\n${run.stdout}\n${run.stderr}`);
    // 让工具调用窗口稳定一下（mock 的 tool_running 会保持 4s）
    await sleep(1200);

    const sampled = status(root, 'INST-001');
    assert.equal(sampled.status, 0, `status stderr:\n${sampled.stderr}\nstdout:\n${sampled.stdout}`);
    assert.ok(sampled.stdout.includes('调用工具（write）'), sampled.stdout);

    const match = /已运行 (?:(\d+)m)?(\d+)s/.exec(sampled.stdout);
    assert.ok(match, sampled.stdout);
    const seconds = Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
    assert.ok(seconds > 0, sampled.stdout);

    const code = await run.done;
    assert.equal(code, 0, `stdout:\n${run.stdout}\nstderr:\n${run.stderr}`);
  } finally {
    await cleanup(root);
  }
});

// ---------------------------------------------------------------- C-3

test('C-3 端到端：跑到一半 core stop → 已中断，无未知错误，exit 1', { timeout: 90_000 }, async () => {
  const { root, taskCwd } = makeProject('c3', ['--turn-delay-ms', '8000']);
  try {
    const run = spawnCli(['run', '--cwd', taskCwd, '--task', '写一段很长的说明'], root);

    const started = await waitFor(() => run.stdout.includes('任务已投递'));
    assert.ok(started, `run 未投递成功：\n${run.stdout}\n${run.stderr}`);
    // 此时应在 tool_running（mock 保持 8s），再来一记 core stop
    await sleep(800);
    const stopped = spawnSync(process.execPath, [BIN, 'core', 'stop'], {
      cwd: root,
      env: sanitizedEnv(),
      timeout: 20_000,
      encoding: 'utf8',
      windowsHide: true,
    });
    assert.equal(stopped.status, 0, `core stop stderr:\n${stopped.stderr}\nstdout:\n${stopped.stdout}`);

    const code = await run.done;
    assert.equal(code, 1, `stdout:\n${run.stdout}\nstderr:\n${run.stderr}`);
    assert.ok(run.stdout.includes('已中断'), `stdout:\n${run.stdout}`);
    assert.ok(!run.stdout.includes('未知错误'), `stdout:\n${run.stdout}`);
    assert.ok(!run.stdout.includes('IPC_CLOSED'), `stdout:\n${run.stdout}`);
  } finally {
    await cleanup(root);
  }
});

// ---------------------------------------------------------------- C-5

test('C-5 内部通道只看位置参数：run --cwd core --task serve 不劫持', { timeout: 60_000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-wp9-c5-'));
  try {
    // 两个 token（core / serve）都在，但都不是位置参数；缺 --instance 的值 → 用法错误（exit 2）
    const result = spawnSync(
      process.execPath,
      [BIN, 'run', '--task', 'serve', '--cwd', 'core', '--instance'],
      { cwd: root, env: sanitizedEnv(), timeout: 20_000, encoding: 'utf8', windowsHide: true },
    );

    assert.equal(result.status, 2, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    assert.ok(result.stdout.includes('用法：orch run'), result.stdout);
    assert.ok(result.stdout.includes('--instance 需要一个值'), result.stdout);
    // 用法错误发生在连核心之前：不应留下 .orch
    assert.equal(fs.existsSync(path.join(root, '.orch')), false);
  } finally {
    await removeProject(root);
  }
});
