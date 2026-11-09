import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createAcpClient } from '../../src/adapter/acp-client.js';
import { createNormalizer } from '../../src/adapter/session-state.js';
import { createStdioTransport } from '../../src/adapter/stdio-transport.js';

const MOCK = path.resolve('test/fixtures/mock-acp-agent.js');
const LIMITS = {
  initializeTimeoutMs: 8000,
  requestTimeoutMs: 8000,
  promptTimeoutMs: 8000,
  quietIdleMs: 30,
  quietCapMs: 300,
};

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-wp3-'));
}

async function start({ switches = [], cwd, limits = LIMITS } = {}) {
  const transport = createStdioTransport({
    command: process.execPath,
    args: [MOCK, ...switches],
    env: process.env,
    cwd,
  });
  const spawned = await transport.spawn();
  assert.equal(spawned.ok, true, JSON.stringify(spawned));
  const client = createAcpClient({ transport, limits });
  return { transport, client };
}

test('真实 transport + client 跑通 initialize → newSession → prompt → end_turn，且 tool_call 可观测', async () => {
  const cwd = tmpDir();
  const { client } = await start({ cwd, switches: ['--write-ref', 'out/probe.txt'] });
  try {
    const init = await client.initialize();
    assert.equal(init.ok, true, JSON.stringify(init));
    assert.equal(init.result.protocolVersion, 1);
    assert.deepEqual(Object.keys(init.result.sessionCapabilities).sort(), ['close', 'list', 'resume']);

    const created = await client.newSession({ cwd, mcpServers: [] });
    assert.equal(created.ok, true, JSON.stringify(created));
    assert.match(created.result.sessionId, /^mock-sess-/);

    const sessionId = created.result.sessionId;
    const normalizer = createNormalizer();
    normalizer.onPromptSent(sessionId, 'turn-1');

    const seenNames = [];
    let toolNameSeen = null;
    let stateWhileTool = null;
    client.onUpdate(({ sessionId: sid, update }) => {
      seenNames.push(update?.sessionUpdate);
      const reduced = normalizer.reduce('thinking', update, { sessionId: sid, turnId: 'turn-1' });
      if (reduced.toolName) {
        toolNameSeen = reduced.toolName;
        stateWhileTool = reduced.state;
      }
    });

    const prompted = await client.prompt(sessionId, [{ type: 'text', text: 'please write' }]);
    assert.equal(prompted.ok, true, JSON.stringify(prompted));
    assert.equal(prompted.result.stopReason, 'end_turn');

    assert.ok(seenNames.includes('tool_call'), `frames=${seenNames.join(',')}`);
    assert.ok(seenNames.includes('tool_call_update'));
    assert.ok(seenNames.includes('agent_thought_chunk'));
    assert.ok(seenNames.includes('agent_message_chunk'));
    assert.equal(toolNameSeen, 'write');
    assert.equal(stateWhileTool, 'tool_running');

    // 真实落盘（写 cwd 内的相对路径）
    const artifact = path.join(cwd, 'out', 'probe.txt');
    assert.equal(fs.existsSync(artifact), true);
    assert.equal(fs.readFileSync(artifact, 'utf8'), 'mock write: ok\n');
  } finally {
    await client.dispose();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('--session-missing：对未知 session prompt 得到 -32602 + unknown session 原文', async () => {
  const cwd = tmpDir();
  const { client } = await start({ cwd, switches: ['--session-missing', '--hold-session'] });
  try {
    assert.equal((await client.initialize()).ok, true);
    const created = await client.newSession({ cwd });
    assert.equal(created.ok, true);

    const prompted = await client.prompt('mock-sess-does-not-exist', [{ type: 'text', text: 'hi' }]);
    assert.equal(prompted.ok, false);
    assert.equal(prompted.error.code, -32602);
    assert.match(prompted.error.message, /unknown session/);
    // 宿主原文不得被改写
    assert.equal(prompted.error.message, 'unknown session');
  } finally {
    await client.dispose();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('quietWindow / drain-quiet：建会话后的噪声帧在 newSession 返回前已被收到', async () => {
  const cwd = tmpDir();
  const { client } = await start({ cwd, switches: ['--noise-on-session-new'] });
  const updates = [];
  client.onUpdate((u) => updates.push(u));
  try {
    assert.equal((await client.initialize()).ok, true);
    const created = await client.newSession({ cwd });
    assert.equal(created.ok, true);
    assert.equal(updates.length >= 1, true, 'newSession 返回前应已收到 available_commands_update');
    assert.equal(updates[0].update.sessionUpdate, 'available_commands_update');
  } finally {
    await client.dispose();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('permission=ask：回调应答 allow-once → end_turn 且文件落盘', async () => {
  const cwd = tmpDir();
  const { client } = await start({ cwd, switches: ['--permission=ask', '--write-ref', 'out/ok.txt'] });
  try {
    assert.equal((await client.initialize()).ok, true);
    const created = await client.newSession({ cwd });
    const asked = [];
    client.onPermission((ctx) => {
      asked.push({ toolCallId: ctx.toolCallId, options: ctx.options.map((o) => o.optionId) });
      ctx.respond({ outcome: { outcome: 'selected', optionId: 'allow-once' } });
    });

    const prompted = await client.prompt(created.result.sessionId, 'go');
    assert.equal(prompted.ok, true);
    assert.equal(prompted.result.stopReason, 'end_turn');
    assert.equal(asked.length, 1);
    assert.deepEqual(asked[0].options, ['allow-once', 'reject-once']);
    assert.equal(fs.existsSync(path.join(cwd, 'out', 'ok.txt')), true);
  } finally {
    await client.dispose();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('permission=ask：回调应答 reject-once → refusal 且不写文件（AC-18 夹具路径）', async () => {
  const cwd = tmpDir();
  const { client } = await start({ cwd, switches: ['--permission=ask', '--write-ref', 'out/denied.txt'] });
  try {
    assert.equal((await client.initialize()).ok, true);
    const created = await client.newSession({ cwd });
    client.onPermission((ctx) => ctx.respond({ outcome: { outcome: 'selected', optionId: 'reject-once' } }));

    const prompted = await client.prompt(created.result.sessionId, 'go');
    assert.equal(prompted.ok, true);
    assert.equal(prompted.result.stopReason, 'refusal');
    assert.equal(fs.existsSync(path.join(cwd, 'out', 'denied.txt')), false);
  } finally {
    await client.dispose();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('permission=ask：无回调时按默认策略 allow-once 自动应答', async () => {
  const cwd = tmpDir();
  const { client } = await start({ cwd, switches: ['--permission=ask'] });
  try {
    assert.equal((await client.initialize()).ok, true);
    const created = await client.newSession({ cwd });
    const prompted = await client.prompt(created.result.sessionId, 'go');
    assert.equal(prompted.ok, true);
    assert.equal(prompted.result.stopReason, 'end_turn');
  } finally {
    await client.dispose();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('宿主错误码与原文原样透出（-32603 / -32099）', async () => {
  const cwd = tmpDir();
  for (const [flag, code] of [
    ['--host-error', -32603],
    ['--unknown-error', -32099],
  ]) {
    const { client } = await start({ cwd, switches: [flag] });
    try {
      assert.equal((await client.initialize()).ok, true);
      const created = await client.newSession({ cwd });
      const prompted = await client.prompt(created.result.sessionId, 'go');
      assert.equal(prompted.ok, false);
      assert.equal(prompted.error.code, code);
      assert.equal(typeof prompted.error.message, 'string');
      assert.ok(prompted.error.message.length > 0);
    } finally {
      await client.dispose();
    }
  }
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('cancel 是通知：无响应，turn 以 stopReason=cancelled 收敛（F1）', async () => {
  const cwd = tmpDir();
  const { client } = await start({ cwd, switches: ['--turn-delay-ms', '5000'] });
  const updates = [];
  client.onUpdate((u) => updates.push(u));
  try {
    assert.equal((await client.initialize()).ok, true);
    const created = await client.newSession({ cwd });
    const pendingPrompt = client.prompt(created.result.sessionId, 'long task');
    const toolCallDeadline = Date.now() + 5000;
    while (!updates.some((u) => u.update?.sessionUpdate === 'tool_call') && Date.now() < toolCallDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.ok(updates.some((u) => u.update?.sessionUpdate === 'tool_call'));

    const cancelled = await client.cancel(created.result.sessionId);
    assert.equal(cancelled.ok, true);

    const prompted = await pendingPrompt;
    assert.equal(prompted.ok, true);
    assert.equal(prompted.result.stopReason, 'cancelled');
  } finally {
    await client.dispose();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
