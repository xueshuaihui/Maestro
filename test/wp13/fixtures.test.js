/**
 * WP-6 夹具契约自检（拆分 §2.12 / §2.13 / §4 WP-6）。
 *
 * 只验证夹具与 M-7 接缝本身，不 import 任何产品实现、不启核心：
 *   - 四组 mock 能力广告（resume / load / both / none）经 `MAESTRO_MOCK_CAPS`
 *     → driver 环境转参数 → mock agent 实际 initialize 结果；
 *   - 既有 `--prompt-failures` / `--hold-session` 语义未被改动；
 *   - `MAESTRO_TEST_PAUSE` 既有三值与两个新值均由 driver 原样透传；
 *   - `MAESTRO_TEST_GRAPH` 仅 `NODE_ENV=test` + 显式绝对存在路径才生效；
 *   - `human-node-state.json` / `graph-timeout.json` 的形状；
 *   - `MAESTRO_MOCK_PROMPT_FAILURES` / `MAESTRO_MOCK_PROMPT_LOG` 的转参数与落盘。
 *
 * 项目根一律 `%TEMP%`（fs.mkdtemp），结束即清理。
 */
import test from 'node:test';
import { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

import * as codeDriver from '../fixtures/code-loop-driver.mjs';
import * as taskDriver from '../fixtures/task-loop-driver.mjs';
import {
  GRAPH_TIMEOUT_FIXTURE,
  HUMAN_NODE_STATE_FIXTURE,
  RECOVERY_SCENARIOS,
  resolveTestGraph,
} from '../fixtures/recovery-driver.mjs';

const MOCK_AGENT = path.join(import.meta.dirname, '..', 'fixtures', 'mock-acp-agent.js');
const DRIVERS = [
  ['code-loop-driver', codeDriver],
  ['task-loop-driver', taskDriver],
];

let TMP_ROOT;
const agents = new Set();

function seamEnv(extra = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('MAESTRO_')) delete env[key];
  }
  return { ...env, NODE_ENV: 'test', ...extra };
}

function startAgent(args = [], env = {}, options = {}) {
  const child = spawn(process.execPath, [MOCK_AGENT, ...args], {
    env: seamEnv(env),
    cwd: options.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const messages = [];
  const waiters = [];
  let buffer = '';
  let rpcId = 1;

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    for (;;) {
      const nl = buffer.indexOf('\n');
      if (nl < 0) break;
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (!line.trim()) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      const waiterIndex = waiters.findIndex((waiter) => waiter.match(msg));
      if (waiterIndex >= 0) {
        const [waiter] = waiters.splice(waiterIndex, 1);
        waiter.resolve(msg);
      } else {
        messages.push(msg);
      }
    }
  });

  const agent = {
    child,
    messages,
    send(message) {
      child.stdin.write(JSON.stringify(message) + '\n');
    },
    next(match, timeoutMs = 4000) {
      const existing = messages.findIndex(match);
      if (existing >= 0) {
        const [msg] = messages.splice(existing, 1);
        return Promise.resolve(msg);
      }
      return new Promise((resolve, reject) => {
        const waiter = { match, resolve };
        waiters.push(waiter);
        const timer = setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error('mock agent 等待回包超时'));
        }, timeoutMs);
        timer.unref?.();
      });
    },
    request(method, params = {}) {
      const id = rpcId++;
      agent.send({ jsonrpc: '2.0', id, method, params });
      return agent.next((msg) => msg.id === id);
    },
    notify(method, params = {}) {
      agent.send({ jsonrpc: '2.0', method, params });
    },
    waitExit(timeoutMs = 4000) {
      if (child.exitCode !== null || child.signalCode !== null) {
        return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
      }
      return Promise.race([
        once(child, 'exit').then(([code, signal]) => ({ code, signal })),
        delay(timeoutMs).then(() => ({ timeout: true })),
      ]);
    },
    async dispose() {
      agents.delete(agent);
      if (child.exitCode !== null || child.signalCode !== null) return;
      try {
        child.stdin.end();
      } catch {
        // ignore
      }
      const exited = await Promise.race([
        once(child, 'exit').then(() => true),
        delay(1000).then(() => false),
      ]);
      if (!exited) {
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
        await Promise.race([once(child, 'exit'), delay(1000)]);
      }
    },
  };
  agents.add(agent);
  return agent;
}

async function tempDir(prefix) {
  if (!TMP_ROOT) TMP_ROOT = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-wp6-'));
  return fs.mkdtemp(path.join(TMP_ROOT, `${prefix}-`));
}

async function initAgent(args = []) {
  const agent = startAgent(args);
  const init = await agent.request('initialize', { protocolVersion: 1, clientCapabilities: {} });
  assert.equal(init.error, undefined, `initialize 失败：${JSON.stringify(init.error)}`);
  return { agent, result: init.result };
}

after(async () => {
  for (const agent of [...agents]) {
    await agent.dispose();
  }
  if (TMP_ROOT) await fs.rm(TMP_ROOT, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// M-7：driver 环境 → mock 参数
// ---------------------------------------------------------------------------

test('M-7: both drivers translate every MAESTRO_MOCK_* seam into mock switches', () => {
  const env = {
    NODE_ENV: 'test',
    MAESTRO_MOCK_CAPS: 'both',
    MAESTRO_MOCK_RESUME: 'fail',
    MAESTRO_MOCK_LOAD: 'fail',
    MAESTRO_MOCK_NEW_FAIL: '1',
    MAESTRO_MOCK_CRASH: 'twice',
    MAESTRO_MOCK_SLOW: '1',
    MAESTRO_MOCK_SPAWN_FAIL_ON_RECOVER: '1',
    MAESTRO_MOCK_PROMPT_FAILURES: '3',
    MAESTRO_MOCK_PROMPT_LOG: path.join(os.tmpdir(), 'wp6-prompts.ndjson'),
  };
  const expected = [
    '--caps', 'both',
    '--resume-fail',
    '--load-fail',
    '--new-fail',
    '--crash', 'twice',
    '--slow',
    '--spawn-fail-on-recover',
    '--prompt-failures', '3',
    '--prompt-log', env.MAESTRO_MOCK_PROMPT_LOG,
  ];
  for (const [name, driver] of DRIVERS) {
    assert.deepEqual(driver.mockArgsFromEnv(env), expected, `${name} 转参数不一致`);
    assert.deepEqual(
      driver.mockArgsFromEnv({ ...env, NODE_ENV: 'production' }),
      [],
      `${name} 不得在 NODE_ENV!=test 时读取 MAESTRO_MOCK_*`,
    );
  }
});

test('M-7: invalid caps/crash values and non-positive failures are ignored', () => {
  const env = {
    NODE_ENV: 'test',
    MAESTRO_MOCK_CAPS: 'bogus',
    MAESTRO_MOCK_CRASH: 'sometimes',
    MAESTRO_MOCK_PROMPT_FAILURES: '0',
    MAESTRO_MOCK_RESUME: 'ok',
    MAESTRO_MOCK_LOAD: 'ok',
  };
  for (const [name, driver] of DRIVERS) {
    assert.deepEqual(driver.mockArgsFromEnv(env), [], `${name} 接受了非法取值`);
  }
});

// ---------------------------------------------------------------------------
// MAESTRO_TEST_PAUSE：既有三值 + 两个新值原样透传
// ---------------------------------------------------------------------------

test('MAESTRO_TEST_PAUSE: three legacy values and two new values pass through byte-for-byte', () => {
  const values = [
    'after_accepted',
    'after_output',
    'after_verdict',
    'after_accepted:developer',
    'after_output:T-002',
    'after_verdict:T-003',
    'after_assign',
    'after_assign:T-003',
    'after_handoff_created',
    'after_handoff_created:HO-002',
  ];
  for (const value of values) {
    for (const [name, driver] of DRIVERS) {
      const env = driver.buildRunEnv({ NODE_ENV: 'test', MAESTRO_TEST_PAUSE: value });
      assert.equal(env.MAESTRO_TEST_PAUSE, value, `${name} 改写了 MAESTRO_TEST_PAUSE=${value}`);
      assert.equal(env.NODE_ENV, 'test');
      assert.deepEqual(
        driver.mockArgsFromEnv({ NODE_ENV: 'test', MAESTRO_TEST_PAUSE: value }),
        [],
        `${name} 不得把产品侧暂停接缝转成 mock 参数`,
      );
    }
  }
});

test('other M-7 product seams are forwarded untouched by both drivers', () => {
  const graph = path.join(os.tmpdir(), 'graph.json');
  const base = {
    NODE_ENV: 'test',
    MAESTRO_FAULT: 'checkpoint_write:fail',
    MAESTRO_TEST_SLOW_MS: '100',
    MAESTRO_TEST_RECOVERY_HOLD: 'after_assign',
    MAESTRO_TEST_GRAPH: graph,
  };
  for (const [name, driver] of DRIVERS) {
    const env = driver.buildRunEnv(base);
    assert.equal(env.MAESTRO_FAULT, 'checkpoint_write:fail', `${name} 改写 MAESTRO_FAULT`);
    assert.equal(env.MAESTRO_TEST_SLOW_MS, '100', `${name} 改写 MAESTRO_TEST_SLOW_MS`);
    assert.equal(env.MAESTRO_TEST_RECOVERY_HOLD, 'after_assign', `${name} 改写 RECOVERY_HOLD`);
    assert.equal(env.MAESTRO_TEST_GRAPH, graph, `${name} 改写 TEST_GRAPH`);
  }
});

test('MAESTRO_TEST_GRAPH is honoured only with NODE_ENV=test and an explicit absolute file', () => {
  assert.equal(resolveTestGraph({ NODE_ENV: 'production', MAESTRO_TEST_GRAPH: GRAPH_TIMEOUT_FIXTURE }), null);
  assert.equal(resolveTestGraph({ NODE_ENV: 'test' }), null);
  assert.equal(resolveTestGraph({ NODE_ENV: 'test', MAESTRO_TEST_GRAPH: 'relative/graph.json' }), null);
  assert.equal(resolveTestGraph({ NODE_ENV: 'test', MAESTRO_TEST_GRAPH: path.join(os.tmpdir(), 'missing-graph.json') }), null);
  assert.equal(
    resolveTestGraph({ NODE_ENV: 'test', MAESTRO_TEST_GRAPH: GRAPH_TIMEOUT_FIXTURE }),
    path.normalize(GRAPH_TIMEOUT_FIXTURE),
  );
});

// ---------------------------------------------------------------------------
// 四组能力广告（driver 转参数 → agent initialize 实际结果）
// ---------------------------------------------------------------------------

test('MAESTRO_MOCK_CAPS: resume / load / both / none advertisements', async () => {
  const ads = {};
  for (const mode of ['resume', 'load', 'both', 'none']) {
    const args = codeDriver.mockArgsFromEnv({ NODE_ENV: 'test', MAESTRO_MOCK_CAPS: mode });
    const { agent, result } = await initAgent(args);
    ads[mode] = result;
    await agent.dispose();
  }

  const capsOf = (ad) => ad.agentCapabilities.sessionCapabilities;
  assert.deepEqual(Object.keys(capsOf(ads.resume)).sort(), ['close', 'list', 'resume']);
  assert.equal(Object.hasOwn(capsOf(ads.resume), 'load'), false);
  assert.equal(ads.resume.loadSession, undefined);

  assert.equal(ads.load.loadSession, true);
  assert.equal(Object.hasOwn(capsOf(ads.load), 'resume'), false);
  assert.equal(Object.hasOwn(capsOf(ads.load), 'load'), false);

  assert.equal(ads.both.loadSession, true);
  assert.equal(Object.hasOwn(capsOf(ads.both), 'resume'), true);

  assert.equal(ads.none.loadSession, undefined);
  assert.equal(Object.hasOwn(capsOf(ads.none), 'resume'), false);
});

test('default advertisement is unchanged (close/list/resume, no load)', async () => {
  const { agent, result } = await initAgent([]);
  assert.deepEqual(result.agentCapabilities.sessionCapabilities, { close: {}, list: {}, resume: {} });
  assert.equal(result.loadSession, undefined);
  await agent.dispose();
});

// ---------------------------------------------------------------------------
// 既有 mock 参数语义：--prompt-failures / --hold-session
// ---------------------------------------------------------------------------

test('MAESTRO_MOCK_PROMPT_FAILURES -> existing --prompt-failures semantics', async () => {
  const args = codeDriver.mockArgsFromEnv({ NODE_ENV: 'test', MAESTRO_MOCK_PROMPT_FAILURES: '1' });
  const { agent } = await initAgent(args);
  const dir = await tempDir('prompt-failures');
  const ns = await agent.request('session/new', { cwd: dir, mcpServers: [] });
  const sessionId = ns.result.sessionId;

  const first = await agent.request('session/prompt', {
    sessionId,
    prompt: [{ type: 'text', text: 'first attempt' }],
  });
  assert.equal(first.error?.code, -32603);
  assert.equal(first.result, undefined);

  const second = await agent.request('session/prompt', {
    sessionId,
    prompt: [{ type: 'text', text: 'second attempt' }],
  });
  assert.equal(second.error, undefined);
  assert.equal(second.result.stopReason, 'end_turn');
  await agent.dispose();
});

test('existing --hold-session semantics unchanged (only cancel wakes it)', async () => {
  const { agent } = await initAgent(['--hold-session']);
  const dir = await tempDir('hold-session');
  const ns = await agent.request('session/new', { cwd: dir, mcpServers: [] });
  const sessionId = ns.result.sessionId;
  const promptId = 900;
  agent.send({
    jsonrpc: '2.0',
    id: promptId,
    method: 'session/prompt',
    params: { sessionId, prompt: [{ type: 'text', text: 'hold me' }] },
  });
  await delay(300);
  assert.equal(
    agent.messages.some((msg) => msg.id === promptId),
    false,
    '--hold-session 在取消前不得回包',
  );
  agent.notify('session/cancel', { sessionId });
  const reply = await agent.next((msg) => msg.id === promptId);
  assert.equal(reply.result.stopReason, 'cancelled');
  await agent.dispose();
});

// ---------------------------------------------------------------------------
// 崩溃 / 重建 / 恢复期起进程失败
// ---------------------------------------------------------------------------

test('MAESTRO_MOCK_CRASH=after_first_update crashes once; the rebuild survives', async () => {
  const dir = await tempDir('crash-once');
  const args = codeDriver.mockArgsFromEnv({ NODE_ENV: 'test', MAESTRO_MOCK_CRASH: 'after_first_update' });

  const first = startAgent(args, {}, { cwd: dir });
  await first.request('initialize', { protocolVersion: 1 });
  const ns1 = await first.request('session/new', { cwd: dir, mcpServers: [] });
  first.send({
    jsonrpc: '2.0',
    id: 71,
    method: 'session/prompt',
    params: { sessionId: ns1.result.sessionId, prompt: [{ type: 'text', text: 'crash me' }] },
  });
  const exit = await first.waitExit(4000);
  assert.equal(exit.code, 1);
  assert.ok(first.messages.some((msg) => msg.method === 'session/update'), '崩溃前应已发出首个 update');

  const second = startAgent(args, {}, { cwd: dir });
  await second.request('initialize', { protocolVersion: 1 });
  const ns2 = await second.request('session/new', { cwd: dir, mcpServers: [] });
  const reply = await second.request('session/prompt', {
    sessionId: ns2.result.sessionId,
    prompt: [{ type: 'text', text: 'retry' }],
  });
  assert.equal(reply.result.stopReason, 'end_turn');
  await second.dispose();
});

test('MAESTRO_MOCK_CRASH=twice crashes the rebuild once more, then stops crashing', async () => {
  const dir = await tempDir('crash-twice');
  const args = codeDriver.mockArgsFromEnv({ NODE_ENV: 'test', MAESTRO_MOCK_CRASH: 'twice' });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const agent = startAgent(args, {}, { cwd: dir });
    await agent.request('initialize', { protocolVersion: 1 });
    const ns = await agent.request('session/new', { cwd: dir, mcpServers: [] });
    agent.send({
      jsonrpc: '2.0',
      id: 80 + attempt,
      method: 'session/prompt',
      params: { sessionId: ns.result.sessionId, prompt: [{ type: 'text', text: `crash ${attempt}` }] },
    });
    const exit = await agent.waitExit(4000);
    assert.equal(exit.code, 1, `第 ${attempt + 1} 次崩溃应退出 1`);
  }

  const third = startAgent(args, {}, { cwd: dir });
  await third.request('initialize', { protocolVersion: 1 });
  const ns = await third.request('session/new', { cwd: dir, mcpServers: [] });
  const reply = await third.request('session/prompt', {
    sessionId: ns.result.sessionId,
    prompt: [{ type: 'text', text: 'third time' }],
  });
  assert.equal(reply.result.stopReason, 'end_turn');
  await third.dispose();
});

test('MAESTRO_MOCK_SPAWN_FAIL_ON_RECOVER fails only after a crash/recovery marker', async () => {
  const dir = await tempDir('spawn-fail');
  const args = codeDriver.mockArgsFromEnv({ NODE_ENV: 'test', MAESTRO_MOCK_SPAWN_FAIL_ON_RECOVER: '1' });

  const ok = startAgent(args, {}, { cwd: dir });
  const init = await ok.request('initialize', { protocolVersion: 1 });
  assert.ok(init.result, '首次 spawn 不应失败');
  await ok.dispose();

  await fs.mkdir(path.join(dir, '.mock'), { recursive: true });
  await fs.writeFile(path.join(dir, '.mock', 'crash-count'), '1', 'utf8');
  const failed = startAgent(args, {}, { cwd: dir });
  const exit = await failed.waitExit(4000);
  assert.equal(exit.code, 9);
  await failed.dispose();
});

test('MAESTRO_MOCK_NEW_FAIL fails only in a rebuild/recovery scene (AC-23 / AC-43)', async () => {
  const dir = await tempDir('new-fail');
  const args = codeDriver.mockArgsFromEnv({ NODE_ENV: 'test', MAESTRO_MOCK_NEW_FAIL: '1' });

  const first = startAgent(args, {}, { cwd: dir });
  await first.request('initialize', { protocolVersion: 1 });
  const firstNew = await first.request('session/new', { cwd: dir, mcpServers: [] });
  assert.equal(typeof firstNew.result?.sessionId, 'string', '首次 session/new 必须成功');
  await first.dispose();

  await fs.mkdir(path.join(dir, '.mock'), { recursive: true });
  await fs.writeFile(path.join(dir, '.mock', 'crash-count'), '1', 'utf8');
  const second = startAgent(args, {}, { cwd: dir });
  await second.request('initialize', { protocolVersion: 1 });
  const secondNew = await second.request('session/new', { cwd: dir, mcpServers: [] });
  assert.equal(secondNew.error?.code, -32603);
  assert.equal(secondNew.result, undefined);
  await second.dispose();
});

// ---------------------------------------------------------------------------
// MAESTRO_MOCK_PROMPT_LOG：NDJSON {sessionId, nodeId, round, text}
// ---------------------------------------------------------------------------

test('MAESTRO_MOCK_PROMPT_LOG appends one NDJSON record per session/prompt', async () => {
  const dir = await tempDir('prompt-log');
  const logFile = path.join(dir, 'prompts.ndjson');
  const args = codeDriver.mockArgsFromEnv({
    NODE_ENV: 'test',
    MAESTRO_MOCK_PROMPT_LOG: logFile,
    MAESTRO_MOCK_NODE_ID: 'T-003',
    MAESTRO_MOCK_ROUND: '2',
  });
  const { agent } = await initAgent(args);
  const cwd = path.join(dir, 'cwd');
  await fs.mkdir(cwd, { recursive: true });
  const ns = await agent.request('session/new', { cwd, mcpServers: [] });
  const sessionId = ns.result.sessionId;
  const prompt = await agent.request('session/prompt', {
    sessionId,
    prompt: [{ type: 'text', text: 'current round task' }],
  });
  assert.equal(prompt.result.stopReason, 'end_turn');
  await agent.dispose();

  const lines = (await fs.readFile(logFile, 'utf8')).split('\n').filter(Boolean);
  assert.equal(lines.length, 1);
  const record = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(record).sort(), ['nodeId', 'round', 'sessionId', 'text']);
  assert.equal(record.sessionId, sessionId);
  assert.equal(record.nodeId, 'T-003');
  assert.equal(record.round, 2);
  assert.equal(record.text, 'current round task');
});

test('MAESTRO_MOCK_PROMPT_LOG infers nodeId from the stage path when the host omits it', async () => {
  const dir = await tempDir('prompt-log-infer');
  const logFile = path.join(dir, 'prompts.ndjson');
  const args = codeDriver.mockArgsFromEnv({ NODE_ENV: 'test', MAESTRO_MOCK_PROMPT_LOG: logFile });
  const { agent } = await initAgent(args);
  const cwd = path.join(dir, 'cwd');
  await fs.mkdir(cwd, { recursive: true });
  const ns = await agent.request('session/new', { cwd, mcpServers: [] });
  const sessionId = ns.result.sessionId;
  await agent.request('session/prompt', {
    sessionId,
    prompt: [{ type: 'text', text: `任务\n本节点阶段区：${path.join(cwd, 'stage', 'T-003')}` }],
  });
  await agent.dispose();

  const [record] = (await fs.readFile(logFile, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(record.nodeId, 'T-003');
  assert.equal(record.round, null);
});

test('MAESTRO_MOCK_PROMPT_LOG records failed attempts as well', async () => {  const dir = await tempDir('prompt-log-fail');
  const logFile = path.join(dir, 'prompts.ndjson');
  const args = codeDriver.mockArgsFromEnv({
    NODE_ENV: 'test',
    MAESTRO_MOCK_PROMPT_LOG: logFile,
    MAESTRO_MOCK_PROMPT_FAILURES: '1',
  });
  const { agent } = await initAgent(args);
  const cwd = path.join(dir, 'cwd');
  await fs.mkdir(cwd, { recursive: true });
  const ns = await agent.request('session/new', { cwd, mcpServers: [] });
  const sessionId = ns.result.sessionId;
  await agent.request('session/prompt', { sessionId, prompt: [{ type: 'text', text: 'one' }] });
  await agent.request('session/prompt', { sessionId, prompt: [{ type: 'text', text: 'two' }] });
  await agent.dispose();

  const records = (await fs.readFile(logFile, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.deepEqual(records.map((item) => item.text), ['one', 'two']);
  assert.ok(records.every((item) => item.sessionId === sessionId));
});

// ---------------------------------------------------------------------------
// 两个新 fixture 的形状
// ---------------------------------------------------------------------------

test('human-node-state.json: a human node is preset at running', async () => {
  const doc = JSON.parse(await fs.readFile(HUMAN_NODE_STATE_FIXTURE, 'utf8'));
  assert.equal(doc.schemaVersion, 2);
  assert.equal(typeof doc.instanceId, 'string');
  const human = (doc.nodes ?? []).find((node) => node.nodeType === 'human');
  assert.ok(human, '缺少 nodeType === human 的节点');
  assert.equal(human.state, 'running');
  assert.equal(human.nodeId, 'T-004');
});

test('graph-timeout.json: the review node declares timeout: 2 (seconds)', async () => {
  const graph = JSON.parse(await fs.readFile(GRAPH_TIMEOUT_FIXTURE, 'utf8'));
  assert.equal(graph.id, 'task-loop');
  assert.equal(graph.entry, 'T-001');
  assert.equal(graph.terminal, 'T-003');
  const review = (graph.nodes ?? []).find((node) => node.nodeId === 'T-003' || node.roleId === 'reviewer');
  assert.ok(review, '缺少审核节点');
  assert.equal(review.timeout, 2);
  assert.equal(review.judge, 'review');
  assert.ok(Array.isArray(graph.edges) && graph.edges.length === 4);
});

test('recovery-driver exposes the four formal scenarios plus the three AC aliases', () => {
  const names = Object.keys(RECOVERY_SCENARIOS);
  for (const name of ['checkpoint-advance', 'dialect-resume', 'redeliver', 'e2e']) {
    assert.ok(names.includes(name), `缺少正式场景 ${name}`);
  }
  for (const name of ['crash-rebuild', 'crash-twice', 'slow']) {
    assert.ok(names.includes(name), `缺少 AC 别名场景 ${name}`);
  }
});
