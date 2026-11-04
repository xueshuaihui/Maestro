/**
 * WP-9：CLI 渲染层缺陷（C-1 / C-2 / C-3 / C-4 / C-7）与 S-1 / S-2 的回归测试。
 *
 * 这里的用例都是纯函数或注入式假客户端，不依赖真实核心；真实三进程路径见
 * `test/wp9/cli-e2e.test.js`。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import * as render from '../../src/cli/render.js';
import { main } from '../../src/cli/main.js';
import { extractDeclaredArtifacts } from '../../src/core/verify-artifact.js';
import { createServer } from '../../src/daemon/server.js';
import { createClient } from '../../src/daemon/client.js';
import { createStore } from '../../src/persistence/instance-store.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { instanceDir, statePath } from '../../src/persistence/paths.js';

// ---------------------------------------------------------------- 假客户端

/** `orch run` 用：第一段正常，run.wait 直接给连接层错误，重连行为可配。 */
function fakeRunClient(script = {}) {
  const calls = [];
  let connects = 0;
  const snapshot = script.snapshot ?? {
    instanceId: 'INST-001',
    state: 'running',
    elapsedMs: 1000,
    node: { state: 'running' },
    session: { state: 'thinking' },
  };
  return {
    calls,
    async connect(opts = {}) {
      connects += 1;
      calls.push({ method: 'connect', opts });
      if (connects === 1) return { ok: true };
      return script.reconnect ?? { ok: false, code: 'CORE_NOT_RUNNING' };
    },
    async request(method, params) {
      calls.push({ method, params });
      if (method === 'run.start') return { ok: true, result: { instanceId: 'INST-001', sessionId: 'sess-1' } };
      if (method === 'instance.get') {
        if (connects > 1 && script.afterGet !== undefined) return script.afterGet;
        return { ok: true, result: snapshot };
      }
      if (method === 'run.wait') return script.wait ?? { ok: false, code: 'IPC_CLOSED', params: {} };
      return { ok: false, code: 'UNKNOWN_ERROR', params: {} };
    },
    subscribe() {
      return () => {};
    },
    async close() {},
  };
}

/** `orch status --instance` 用：只回一个固定快照。 */
function fakeStatusClient(snapshot) {
  return {
    async connect() {
      return { ok: true };
    },
    async request(method) {
      if (method === 'instance.get') return { ok: true, result: snapshot };
      return { ok: false, code: 'UNKNOWN_ERROR', params: {} };
    },
    async close() {},
  };
}

async function runMain(argv, client) {
  const lines = [];
  const code = await main(argv, {
    cwd: process.cwd(),
    out: (line) => lines.push(line),
    createClient: () => client,
  });
  return { code, lines, text: lines.join('\n') };
}

// ---------------------------------------------------------------- C-1

test('C-1 renderNodeFailure：SESSION_INVALID 是"会话已失效"，不是未知错误', () => {
  const failure = render.renderNodeFailure({
    node: { state: 'failed', failure: { code: 'SESSION_INVALID', message: 'unknown session' } },
    session: { state: 'idle' },
  });
  assert.equal(failure, '会话已失效，需要重新创建');
  assert.ok(!failure.includes('未知错误'));

  const nodeLine = render.renderNodeLine({
    node: { state: 'failed', failure: { code: 'SESSION_INVALID', message: 'unknown session' } },
  });
  assert.equal(nodeLine, '节点 失败 · 会话已失效，需要重新创建');
});

test('C-1 renderNodeFailure：NODE_BUSY 走防御分支', () => {
  assert.equal(
    render.renderNodeFailure({ node: { state: 'failed', failure: { code: 'NODE_BUSY', message: 'busy' } } }),
    '该节点正在执行，本次未发起',
  );
});

test('C-1 run 收尾：SESSION_INVALID 的节点行与失败行都不出现"未知错误"', async () => {
  const snapshot = {
    instanceId: 'INST-001',
    state: 'failed',
    elapsedMs: 900,
    node: { state: 'failed', failure: { code: 'SESSION_INVALID', message: 'unknown session' } },
    session: { state: 'idle' },
  };
  const client = fakeRunClient({ snapshot, wait: { ok: true, result: snapshot } });
  const { code, lines, text } = await runMain(
    ['run', '--cwd', '.', '--task', '写一段说明'],
    client,
  );
  assert.equal(code, 1);
  assert.ok(text.includes('会话已失效，需要重新创建'), text);
  assert.ok(!text.includes('未知错误'), text);
  // 节点行 + 收尾失败行各一次；至少出现一次即可
  assert.ok(lines.filter((line) => line.includes('会话已失效，需要重新创建')).length >= 1);
});

// ---------------------------------------------------------------- C-2

test('C-2 tool_running 行带工具名与时长，时长随快照变化', () => {
  const make = (elapsedMs) =>
    render.renderSessionLine({
      elapsedMs,
      session: { state: 'tool_running', toolName: 'write' },
    });

  const first = make(3000);
  const second = make(7000);
  assert.equal(first, '会话 执行中 · 调用工具（write） · 已运行 3s');
  assert.equal(second, '会话 执行中 · 调用工具（write） · 已运行 7s');
  assert.ok(first.includes('调用工具（write）'));
  assert.notEqual(first, second);
});

test('C-2 tool_running 无时长信息时不硬造 0s（工具名段保持 AC-16 原样）', () => {
  assert.equal(
    render.renderSessionLine({ session: { state: 'tool_running', toolName: 'write' } }),
    '会话 执行中 · 调用工具（write）',
  );
});

test('C-2 status 路径：两次采样的 tool_running 会话行时长递增', async () => {
  const snapshot = (elapsedMs) => ({
    instanceId: 'INST-001',
    state: 'running',
    elapsedMs,
    node: { state: 'running' },
    session: { state: 'tool_running', toolName: 'write' },
  });

  const a = await runMain(['status', '--instance', 'INST-001'], fakeStatusClient(snapshot(2000)));
  const b = await runMain(['status', '--instance', 'INST-001'], fakeStatusClient(snapshot(5000)));
  assert.equal(a.code, 0);
  assert.equal(b.code, 0);
  assert.ok(a.text.includes('已运行 2s'), a.text);
  assert.ok(b.text.includes('已运行 5s'), b.text);
  assert.ok(a.text.includes('调用工具（write）'), a.text);
});

// ---------------------------------------------------------------- C-3

test('C-3 IPC_CLOSED 后以 ensure:false 重连，快照 interrupted → 打停点 note，不报未知错误', async () => {
  const interrupted = {
    instanceId: 'INST-001',
    state: 'interrupted',
    node: { state: 'running' },
    session: { state: 'thinking' },
  };
  const client = fakeRunClient({
    reconnect: { ok: true },
    afterGet: { ok: true, result: interrupted },
  });
  const { code, text } = await runMain(['run', '--cwd', '.', '--task', '写一段说明'], client);

  assert.equal(code, 1);
  assert.ok(text.includes('实例 INST-001 · 已中断 ｜ 停在节点 执行中 / 会话 执行中'), text);
  assert.ok(!text.includes('未知错误'), text);
  assert.ok(!text.includes('IPC_CLOSED'), text);

  const reconnects = client.calls.filter((call) => call.method === 'connect' && call.opts.ensure === false);
  assert.equal(reconnects.length, 1, '断连后必须只重连、不拉起新核心');
});

test('C-3 重连失败 → "核心已停止"一行（中文来自 labels），仍不报未知错误', async () => {
  const client = fakeRunClient({ reconnect: { ok: false, code: 'CORE_NOT_RUNNING' } });
  const { code, text } = await runMain(['run', '--cwd', '.', '--task', '写一段说明'], client);

  assert.equal(code, 1);
  assert.ok(text.includes('实例 INST-001 · 已中断 ｜ 核心已停止'), text);
  assert.ok(!text.includes('未知错误'), text);
});

test('C-3 重连成功但取不到快照 → 同样落到"核心已停止"', async () => {
  const client = fakeRunClient({
    reconnect: { ok: true },
    afterGet: { ok: false, code: 'CORE_NOT_RUNNING', params: {} },
  });
  const { code, text } = await runMain(['run', '--cwd', '.', '--task', '写一段说明'], client);
  assert.equal(code, 1);
  assert.ok(text.includes('已中断 ｜ 核心已停止'), text);
  assert.ok(!text.includes('未知错误'), text);
});

// ---------------------------------------------------------------- C-4 / C-7

test('C-4 status：sessionStalled 时显示"无新事件"，未静默时不显示', async () => {
  const base = {
    instanceId: 'INST-001',
    state: 'running',
    elapsedMs: 11_000,
    node: { state: 'running' },
    session: { state: 'thinking' },
  };

  const stalled = await runMain(
    ['status', '--instance', 'INST-001'],
    fakeStatusClient({ ...base, sessionStalled: true }),
  );
  assert.equal(stalled.code, 0);
  assert.ok(stalled.text.includes('会话 执行中 · 已运行 11s · 无新事件'), stalled.text);

  const quiet = await runMain(
    ['status', '--instance', 'INST-001'],
    fakeStatusClient({ ...base, sessionStalled: false }),
  );
  assert.equal(quiet.code, 0);
  assert.ok(!quiet.text.includes('无新事件'), quiet.text);
  assert.ok(quiet.text.includes('会话 执行中 · 已运行 11s'), quiet.text);
});

test('C-7 status：interrupted 只打一行实例信息（带停点），不重复', async () => {
  const snapshot = {
    instanceId: 'INST-001',
    state: 'interrupted',
    elapsedMs: 42_000,
    node: { state: 'running' },
    session: { state: 'thinking' },
  };
  const { code, lines } = await runMain(['status', '--instance', 'INST-001'], fakeStatusClient(snapshot));
  assert.equal(code, 0);

  const instanceLines = lines.filter((line) => line.startsWith('实例 INST-001'));
  assert.equal(instanceLines.length, 1, lines.join('\n'));
  assert.equal(instanceLines[0], '实例 INST-001 · 已中断 ｜ 停在节点 执行中 / 会话 执行中');
});

test('C-7 run 收尾：interrupted 只出现一次 note，不再重复实例行', async () => {
  const snapshot = {
    instanceId: 'INST-001',
    state: 'interrupted',
    elapsedMs: 5000,
    node: { state: 'running' },
    session: { state: 'thinking' },
  };
  const client = fakeRunClient({ snapshot, wait: { ok: true, result: snapshot } });
  const { code, lines } = await runMain(['run', '--cwd', '.', '--task', '写一段说明'], client);
  assert.equal(code, 1);
  assert.equal(
    lines.filter((line) => line === '实例 INST-001 · 已中断 ｜ 停在节点 执行中 / 会话 执行中').length,
    1,
    lines.join('\n'),
  );
});

// ---------------------------------------------------------------- S-1

test('S-1 instance.get：STATE_CORRUPT 透出 backupPath（指向 state.json.corrupt）', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-wp9-s1-'));
  const instanceId = 'INST-001';
  try {
    await fs.mkdir(instanceDir(root, instanceId), { recursive: true });
    await fs.writeFile(statePath(root, instanceId), '{ not json', 'utf8');

    const store = createStore({ root });
    const bus = createEventBus({ store });
    const orchestrator = createOrchestrator({
      store,
      bus,
      adapterFactory: { async create() { throw new Error('unused'); } },
      generation: 'gen-wp9-s1',
    });
    const server = createServer({ root, orchestrator, bus, generation: 'gen-wp9-s1', logger: () => {}, exitOnStop: false });
    const listened = await server.listen();
    assert.equal(listened.ok, true, JSON.stringify(listened));

    const client = createClient({ root });
    const connected = await client.connect({ ensure: false });
    assert.equal(connected.ok, true, JSON.stringify(connected));

    try {
      const res = await client.request('instance.get', { instanceId }, { timeoutMs: 5000 });
      assert.equal(res.ok, false);
      assert.equal(res.code, 'STATE_CORRUPT');
      assert.ok(typeof res.params?.backupPath === 'string' && res.params.backupPath.length > 0, JSON.stringify(res));
      assert.ok(res.params.backupPath.endsWith('state.json.corrupt'), res.params.backupPath);
    } finally {
      await client.close();
      await server.close();
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- S-2

test('S-2 extractDeclaredArtifacts：评审给出的 6 条样例全部成立', () => {
  const cases = [
    ['写一段 200 字的产品说明，保存到 out/intro.md', ['out/intro.md']],
    ['把结果写入 reports/summary.md 和 notes.txt', ['reports/summary.md', 'notes.txt']],
    ['随便聊聊', []],
    ['保存到 ../../etc/passwd', []],
    ['用 Node.js 写一段说明，保存到 out/intro.md', ['out/intro.md']],
    ['用 Node.js 写一段说明', []],
  ];
  for (const [input, expected] of cases) {
    assert.deepEqual(extractDeclaredArtifacts(input), expected, input);
  }
});

test('S-2 越界与绝对路径仍然一律拒绝', () => {
  assert.deepEqual(extractDeclaredArtifacts('保存到 /etc/passwd'), []);
  assert.deepEqual(extractDeclaredArtifacts('保存到 C:\\Windows\\win.ini'), []);
  assert.deepEqual(extractDeclaredArtifacts('输出到 ../out/a.md'), []);
  // 引导词从句之外的裸文件名不再被当成声明产出
  assert.deepEqual(extractDeclaredArtifacts('产出是 notes.txt'), []);
  // 含分隔符的裸路径仍然接受
  assert.deepEqual(extractDeclaredArtifacts('写下 out/a.md'), ['out/a.md']);
});
