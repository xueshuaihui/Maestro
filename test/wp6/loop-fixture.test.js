// WP-6 夹具自测：只覆盖不依赖编排核心的部分。
// 1) driver --prepare-only 写出的现场
// 2) cursor.json 并发消费不重复
// 3) mock agent 走真实 stdio-transport + acp-client 链路产生产物与判定
// 4) 场景表齐全
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { createStdioTransport } from '../../src/adapter/stdio-transport.js';
import { createAcpClient } from '../../src/adapter/acp-client.js';
import {
  DEFAULT_TASK,
  MOCK_AGENT_PATH,
  REPO_ROOT,
  SCENARIOS,
  getScenario,
  scenarioNames,
} from '../fixtures/code-loop-driver.mjs';

const DRIVER = path.join(REPO_ROOT, 'test', 'fixtures', 'code-loop-driver.mjs');

function tmpRoot(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `maestro-wp6-${name}-`));
  return root;
}

/**
 * 并发消费一个 cursor 步。
 *
 * mock agent 的 `open(path,'wx')` 在 Windows 高并发下偶尔返回 EPERM（brokered fs
 * 把「文件已存在」映射成 EPERM，而不是 EEXIST），而该夹具本轮不在可改范围内，
 * 无法在 open 处重试。失败发生在拿到锁之前、且 stdout 为空，因此重跑该消费者
 * 不会重复计数；这里用 10/30/80ms 指数退避重试，断言仍是「20 个唯一序号」。
 */
function spawnConsume(root) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      MOCK_AGENT_PATH,
      '--root', root,
      '--scenario', 'pass',
      '--consume-only',
    ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => { out += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { err += chunk.toString('utf8'); });
    child.on('exit', (code) => resolve({ code, out: out.trim(), err }));
  });
}

function transientLockFailure(result) {
  return result.code !== 0
    && result.out === ''
    && /cursor\.lock/.test(result.err)
    && /(EPERM|EACCES|EBUSY|EEXIST)/.test(result.err);
}

async function consumeOne(root) {
  const backoff = [0, 10, 30, 80];
  let last = null;
  for (const wait of backoff) {
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    last = await spawnConsume(root);
    if (last.code === 0) return last;
    if (!transientLockFailure(last)) return last;
  }
  return last;
}

function cleanup(root) {
  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch {
    // Windows 上偶发占用，交给系统临时目录清理
  }
}

function runDriver(args) {
  return spawnSync(process.execPath, [DRIVER, ...args], {
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  });
}

/** 用产品链路（spawn → NDJSON → acp-client）跑一次派发。 */
async function runMockOnce({ root, cwd, task }) {
  const transport = createStdioTransport({
    command: process.execPath,
    args: [MOCK_AGENT_PATH, '--root', root, '--scenario', 'pass'],
    env: { ...process.env },
    cwd,
  });
  const client = createAcpClient({ transport });
  try {
    const spawned = await transport.spawn();
    assert.equal(spawned.ok, true, 'mock 进程应能启动');
    const init = await client.initialize();
    assert.equal(init.ok, true);
    const created = await client.newSession({ cwd });
    assert.equal(created.ok, true, JSON.stringify(created));
    const prompted = await client.prompt(created.result.sessionId, [{ type: 'text', text: task }]);
    assert.equal(prompted.ok, true, JSON.stringify(prompted));
    assert.equal(prompted.result.stopReason, 'end_turn');
    return created.result.sessionId;
  } finally {
    await client.dispose();
  }
}

test('--prepare-only 写出 cursor.json 与 .orch/hosts/mock.json，退出码 0', () => {
  const root = tmpRoot('prepare');
  const rootReal = fs.realpathSync.native(root);
  try {
    const res = runDriver(['--root', root, '--scenario', 'pass', '--prepare-only', '--reset']);
    assert.equal(res.status, 0, res.stderr);

    const cursor = JSON.parse(fs.readFileSync(path.join(root, '.mock', 'cursor.json'), 'utf8'));
    assert.deepEqual(cursor, { next: 1 });

    const hostPath = path.join(root, '.orch', 'hosts', 'mock.json');
    const host = JSON.parse(fs.readFileSync(hostPath, 'utf8'));
    assert.equal(host.id, 'mock');
    assert.equal(host.transport, 'stdio');
    assert.equal(host.launch.command, process.execPath);
    assert.equal(path.isAbsolute(host.launch.command), true);
    assert.deepEqual(host.launch.args.slice(0, 2), [MOCK_AGENT_PATH, '--root']);
    assert.equal(host.launch.args[2], rootReal);
    assert.deepEqual(host.launch.args.slice(3), ['--scenario', 'pass']);
    for (const arg of host.launch.args) {
      if (arg === '--root' || arg === '--scenario') continue;
      if (arg === 'pass') continue;
      assert.equal(path.isAbsolute(arg), true, `应使用绝对路径：${arg}`);
    }

    // 不启核心、不建实例
    const instances = path.join(root, '.orch', 'instances');
    assert.equal(fs.existsSync(instances) && fs.readdirSync(instances).length > 0, false);
  } finally {
    cleanup(root);
  }
});

test('cursor.json 并发消费 20 次不重复', async () => {
  const root = tmpRoot('cursor');
  try {
    const prep = runDriver(['--root', root, '--scenario', 'pass', '--prepare-only', '--reset']);
    assert.equal(prep.status, 0, prep.stderr);

    const outputs = await Promise.all(Array.from({ length: 20 }, () => consumeOne(root)));

    const claimed = outputs.map((item) => {
      assert.equal(item.code, 0, item.err);
      return Number(item.out);
    });
    assert.deepEqual([...claimed].sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));

    const cursor = JSON.parse(fs.readFileSync(path.join(root, '.mock', 'cursor.json'), 'utf8'));
    assert.deepEqual(cursor, { next: 21 });
    assert.equal(fs.existsSync(path.join(root, '.mock', 'exhausted')), false);
  } finally {
    cleanup(root);
  }
});

test('mock agent 走真实 stdio + acp 链路按场景写 calc.js 与 verdict.json', async () => {
  const root = tmpRoot('chain');
  const cwd = path.join(root, 'demo-code-pass');
  try {
    const prep = runDriver(['--root', root, '--scenario', 'pass', '--prepare-only', '--reset']);
    assert.equal(prep.status, 0, prep.stderr);
    fs.mkdirSync(cwd, { recursive: true });

    const scenario = getScenario('pass');
    const devStep = scenario.steps[0];
    const testerStep = scenario.steps[1];

    await runMockOnce({ root, cwd, task: DEFAULT_TASK });

    const calcPath = path.join(cwd, 'calc.js');
    assert.equal(fs.existsSync(calcPath), true);
    assert.equal(fs.readFileSync(calcPath, 'utf8'), devStep.write[0].content);

    const prompt1 = JSON.parse(fs.readFileSync(path.join(root, '.mock', 'prompts', '1.json'), 'utf8'));
    assert.equal(prompt1.n, 1);
    assert.equal(prompt1.nodeId, 'T-001');
    assert.equal(prompt1.round, 1);
    assert.equal(prompt1.task, DEFAULT_TASK);

    // 第二次派发 = 新进程 + 新会话，消费第 2 步
    await runMockOnce({ root, cwd, task: DEFAULT_TASK });

    const verdictPath = path.join(cwd, 'out', 'verdict.json');
    assert.equal(fs.existsSync(verdictPath), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(verdictPath, 'utf8')), testerStep.verdict);

    const prompt2 = JSON.parse(fs.readFileSync(path.join(root, '.mock', 'prompts', '2.json'), 'utf8'));
    assert.equal(prompt2.n, 2);
    assert.equal(prompt2.nodeId, 'T-002');
    assert.equal(prompt2.round, 1);
    assert.equal(prompt2.task, DEFAULT_TASK);

    const cursor = JSON.parse(fs.readFileSync(path.join(root, '.mock', 'cursor.json'), 'utf8'));
    assert.deepEqual(cursor, { next: 3 });

    // 第 1 步的 historyMarker 已落盘，第 2 步收到的是原任务 → 不夹带上一轮
    assert.equal(fs.readFileSync(path.join(root, '.mock', 'history', '1.txt'), 'utf8'), 'DEV-ROUND1');
    assert.equal(fs.existsSync(path.join(root, '.mock', 'history-leak')), false);
  } finally {
    cleanup(root);
  }
});

test('场景表齐全（17 个命名场景 + 文档别名）', () => {
  const required = [
    'pass', 'backflow', 'rounds-exceeded',
    'verdict-missing', 'verdict-bad-json', 'verdict-schema', 'verdict-no-defects',
    'verdict-evidence-unreadable', 'verdict-stale', 'verdict-stale-retest',
    'dispatch-fail', 'dispatch-fail-retest', 'hold-test', 'retest-slow',
    'product-missing', 'product-empty', 'product-stale',
  ];
  for (const name of required) {
    assert.ok(SCENARIOS[name], `缺少场景：${name}`);
  }
  assert.ok(scenarioNames().length >= 12);

  // 需求 §3.3 的 doc 名必须能解析到实现
  for (const alias of ['code-pass', 'backflow-once', 'retest-fail', 'hold-test', 'verdict-stale-retest', 'artifact-missing']) {
    const resolved = getScenario(alias);
    assert.ok(resolved.steps.length >= 1, alias);
    assert.ok(resolved.steps.every((s) => s.nodeId && Number.isInteger(s.round) && s.round >= 1), alias);
  }
});
