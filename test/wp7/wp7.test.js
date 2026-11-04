import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createAdapterFactory } from '../../src/adapter/factory.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { createClient } from '../../src/daemon/client.js';
import { createServer } from '../../src/daemon/server.js';
import { createStore } from '../../src/persistence/instance-store.js';

const MOCK = path.resolve('test/fixtures/mock-acp-agent.js');

const LIMITS = {
  initializeTimeoutMs: 8000,
  requestTimeoutMs: 8000,
  promptTimeoutMs: 30_000,
  quietIdleMs: 30,
  quietCapMs: 200,
};

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** 去掉可能覆盖配置的环境变量，确保 <root>/.orch/hosts/dsh.json 真的生效。 */
function sanitizedEnv() {
  const env = { ...process.env };
  for (const key of ['MAESTRO_DSH_EXE', 'MAESTRO_DSH_BIN', 'MAESTRO_DSH_ARGS']) delete env[key];
  return env;
}

function writeHostConfig(root, switches = []) {
  const dir = path.join(root, '.orch', 'hosts');
  fs.mkdirSync(dir, { recursive: true });
  const config = {
    transport: 'stdio',
    launch: {
      command: process.execPath,
      args: [MOCK, ...switches],
    },
    limits: LIMITS,
  };
  fs.writeFileSync(path.join(dir, 'dsh.json'), JSON.stringify(config, null, 2), 'utf8');
}

async function setup({ switches = [] } = {}) {
  const root = tmpDir('maestro-wp7-root-');
  const cwd = tmpDir('maestro-wp7-cwd-');
  writeHostConfig(root, switches);

  const store = createStore({ root });
  const bus = createEventBus({ store });
  const orch = createOrchestrator({
    store,
    bus,
    adapterFactory: createAdapterFactory({ root, env: sanitizedEnv() }),
    generation: 'gen-wp7',
  });
  return {
    root,
    cwd,
    store,
    bus,
    orch,
    async teardown() {
      try {
        await orch.dispose();
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('factory：<root>/.orch/hosts/dsh.json 的 launch 覆盖生效，能对 mock 宿主建会话', async () => {
  const root = tmpDir('maestro-wp7-factory-root-');
  const cwd = tmpDir('maestro-wp7-factory-cwd-');
  writeHostConfig(root, ['--write-ref', 'out/intro.md']);

  const factory = createAdapterFactory({ root, env: sanitizedEnv() });
  let adapter = null;
  try {
    const created = await factory.create({ cwd });
    assert.equal(created.ok, true, JSON.stringify(created));
    adapter = created.adapter;

    // create() 内部已完成 spawn → initialize → session/new
    assert.match(String(adapter.sessionId), /^mock-sess-/);
    assert.equal(adapter.launch.source, 'config');
    assert.equal(adapter.launch.command, process.execPath);

    // orchestrator 的既有消费序列（initialize / newSession）复用的是同一个会话
    const again = await adapter.initialize();
    assert.equal(again.ok, true);
    const session = await adapter.newSession({ cwd, mcpServers: [] });
    assert.equal(session.ok, true);
    assert.equal(session.result.sessionId, adapter.sessionId);
  } finally {
    if (adapter) await adapter.dispose().catch(() => {});
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('早返回：turn-delay 3000ms 下 startRun 1s 内 resolve，随后 waitForRun 到 completed', async () => {
  const env = await setup({ switches: ['--write-ref', 'out/intro.md', '--turn-delay-ms', '3000'] });
  try {
    const startedAt = Date.now();
    const result = await env.orch.startRun({
      cwd: env.cwd,
      task: '写一段说明，保存到 out/intro.md',
      earlyReturn: true,
    });
    const elapsed = Date.now() - startedAt;

    assert.equal(result.ok, true, JSON.stringify(result));
    assert.ok(elapsed < 1000, `早返回必须早于 turn 结束，实际 ${elapsed}ms`);
    assert.equal(result.instanceId, 'INST-001');
    assert.equal(result.nodeId, 'T-001');
    assert.match(String(result.sessionId), /^mock-sess-/);

    const waited = await env.orch.waitForRun({ instanceId: result.instanceId, timeoutMs: 30_000 });
    assert.equal(waited.ok, true, JSON.stringify(waited));
    assert.equal(waited.snapshot.state, 'completed');
    assert.equal(waited.snapshot.node.state, 'done');
    assert.equal(fs.existsSync(path.join(env.cwd, 'out', 'intro.md')), true);
  } finally {
    await env.teardown();
  }
});

test('后台失败：--host-error + 早返回不抛未捕获异常，waitForRun 得到 failed', async () => {
  const env = await setup({ switches: ['--host-error'] });
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: '随便写点什么', earlyReturn: true });
    assert.equal(result.ok, true, JSON.stringify(result));

    const waited = await env.orch.waitForRun({ instanceId: result.instanceId, timeoutMs: 30_000 });
    assert.equal(waited.ok, true, JSON.stringify(waited));
    assert.equal(waited.snapshot.state, 'failed');
    assert.equal(waited.snapshot.node.state, 'failed');

    // 给潜在的 unhandledRejection 一个冒头机会
    await sleep(150);
    assert.equal(unhandled.length, 0, `不得有未捕获拒绝：${unhandled.map(String).join('; ')}`);
  } finally {
    process.off('unhandledRejection', onUnhandled);
    await env.teardown();
  }
});

test('run.wait：运行中挂起到终态；不存在的实例返回 NOT_RUNNING', async () => {
  const root = tmpDir('maestro-wp7-server-root-');
  const cwd = tmpDir('maestro-wp7-server-cwd-');
  writeHostConfig(root, ['--write-ref', 'out/intro.md', '--turn-delay-ms', '1200']);

  const store = createStore({ root });
  const bus = createEventBus({ store });
  const orch = createOrchestrator({
    store,
    bus,
    adapterFactory: createAdapterFactory({ root, env: sanitizedEnv() }),
    generation: 'gen-wp7-server',
  });
  const server = createServer({ root, orchestrator: orch, bus, generation: 'gen-wp7-server', logger: () => {} });
  let client = null;
  try {
    const listened = await server.listen();
    assert.equal(listened.ok, true, JSON.stringify(listened));

    client = createClient({ root });
    const connected = await client.connect({ ensure: false });
    assert.equal(connected.ok, true, JSON.stringify(connected));

    const started = await client.request('run.start', { cwd, task: '写一段说明，保存到 out/intro.md' });
    assert.equal(started.ok, true, JSON.stringify(started));
    assert.deepEqual(Object.keys(started.result).sort(), ['instanceId', 'nodeId', 'sessionId']);

    const t0 = Date.now();
    const waited = await client.request('run.wait', { instanceId: started.result.instanceId, timeoutMs: 20_000 });
    const elapsed = Date.now() - t0;
    assert.equal(waited.ok, true, JSON.stringify(waited));
    assert.equal(waited.result.state, 'completed');
    assert.ok(elapsed >= 500, `运行中应真的挂起，实际 ${elapsed}ms`);

    const missing = await client.request('run.wait', { instanceId: 'INST-404' });
    assert.equal(missing.ok, false);
    assert.equal(missing.code, 'NOT_RUNNING');

    const ping = await client.ping();
    assert.equal(ping.ok, true);
    assert.equal(ping.result.mode, 'real');
  } finally {
    if (client) await client.close().catch(() => {});
    await server.close().catch(() => {});
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('默认行为未变：startRun 不传 earlyReturn 仍返回终态快照', async () => {
  const env = await setup({ switches: ['--write-ref', 'out/intro.md'] });
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: '写一段说明，保存到 out/intro.md' });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.instanceId, 'INST-001');
    assert.match(String(result.sessionId), /^mock-sess-/);
    assert.equal(result.snapshot.state, 'completed');
    assert.equal(result.snapshot.node.state, 'done');
    assert.equal(result.stopReason, 'end_turn');
  } finally {
    await env.teardown();
  }
});
