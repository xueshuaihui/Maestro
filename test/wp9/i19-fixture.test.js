/**
 * WP-5 / I1.9：mock-acp-agent.js 失败摘要开关的契约测试。
 *
 * 真实 spawn 宿主进程，走 NDJSON over stdio（initialize → session/new → session/prompt），
 * 按 '\n' 切行读【原始帧】；刻意不经 acp-client / normalizer 归一化，直接验证 D-10
 * 冻结的帧载体形状（execution 挂在原始帧上）。临时根用 os.tmpdir() 独立目录，
 * NODE_ENV=test，测完 t.after 清理。
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const REPO = path.resolve('.');
const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');

function childEnv() {
  return { ...process.env, NODE_ENV: 'test' };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, { timeoutMs = 8000, intervalMs = 15 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = predicate();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('waitFor 超时');
    await sleep(intervalMs);
  }
}

/** 取一次完整 prompt 会话收集到的 tool_call / 完成帧。 */
function pickFrames(updates) {
  const toolCall = updates.find((u) => u.sessionUpdate === 'tool_call');
  const toolCallUpdates = updates.filter((u) => u.sessionUpdate === 'tool_call_update');
  const completion = toolCallUpdates.at(-1);
  return { toolCall, completion };
}

/**
 * 起一次完整会话，返回原始帧与进程结果。
 * 自动应答 session/request_permission（放行），避免 --permission=deny 挂到 60s 超时；
 * deny 仍由宿主确定性拒绝，属既有行为。
 */
async function runSession(switches, task = '执行 out/run.js') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i19-fixture-'));
  const child = spawn(process.execPath, [MOCK, ...switches], {
    cwd: root,
    env: childEnv(),
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const send = (obj) => {
    if (!child.stdin.writableEnded) child.stdin.write(`${JSON.stringify(obj)}\n`);
  };

  const frames = [];
  let stdoutBuf = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdoutBuf += chunk;
    for (;;) {
      const nl = stdoutBuf.indexOf('\n');
      if (nl < 0) return;
      const line = stdoutBuf.slice(0, nl).replace(/\r$/, '');
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (!line.trim()) continue;
      let frame;
      try {
        frame = JSON.parse(line);
      } catch {
        continue;
      }
      frames.push(frame);
      // 服务端发起的审批请求：放行（deny 仍会确定性拒绝，属既有行为）。
      if (frame.method === 'session/request_permission' && frame.id !== undefined) {
        send({
          jsonrpc: '2.0',
          id: frame.id,
          result: { outcome: { outcome: 'selected', optionId: 'allow-once' } },
        });
      }
    }
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  const done = new Promise((resolve) => {
    child.on('close', (code, signal) => resolve({ code, signal }));
  });

  const replyFor = (id) =>
    frames.find((f) => f.id === id && (f.result !== undefined || f.error !== undefined));
  const updates = () =>
    frames.filter((f) => f.method === 'session/update').map((f) => f.params.update);

  const cleanup = () => {
    if (child.exitCode === null && child.signalCode === null) {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  };

  try {
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: 1, clientCapabilities: {} } });
    await waitFor(() => replyFor(1));
    assert.equal(replyFor(1).result.protocolVersion, 1);

    send({ jsonrpc: '2.0', id: 2, method: 'session/new', params: { cwd: root, mcpServers: [] } });
    const created = await waitFor(() => replyFor(2));
    const sessionId = created.result?.sessionId;
    assert.match(String(sessionId), /^mock-sess-/);

    send({
      jsonrpc: '2.0',
      id: 3,
      method: 'session/prompt',
      params: { sessionId, prompt: [{ type: 'text', text: task }] },
    });
    const promptReply = await waitFor(() => replyFor(3));

    // 关闭 stdin：宿主在非场景模式下由 stdin 'end' 正常 process.exit(0)。
    child.stdin.end();
    const exit = await Promise.race([
      done,
      sleep(5000).then(() => {
        child.kill('SIGKILL');
        return { code: null, signal: 'SIGKILL', timedOut: true };
      }),
    ]);

    return {
      root,
      frames,
      updates: updates(),
      promptReply,
      stderr,
      exitCode: exit.code,
      cleanup,
    };
  } catch (err) {
    cleanup();
    throw err;
  }
}

// ---------------------------------------------------------------- 1. 默认：零变化
test('默认（无新开关）：帧序列与既有行为一致，tool_call 无 execution、完成帧 completed', async (t) => {
  const r = await runSession([]);
  t.after(r.cleanup);

  assert.deepEqual(
    r.updates.map((u) => u.sessionUpdate),
    ['agent_thought_chunk', 'tool_call', 'tool_call_update', 'tool_call_update', 'agent_message_chunk'],
  );
  // 任一原始帧都不得出现 execution（证明不带开关时一个字段都没变）。
  assert.ok(
    r.updates.every((u) => !Object.hasOwn(u, 'execution')),
    '默认路径任何帧都不得有 execution',
  );

  const { toolCall, completion } = pickFrames(r.updates);
  assert.deepEqual(Object.keys(toolCall).sort(), ['kind', 'sessionUpdate', 'status', 'title', 'toolCallId']);
  assert.equal(toolCall.title, 'write');
  assert.equal(completion.status, 'completed');
  assert.ok(!Object.hasOwn(completion, 'execution'));
  assert.equal(completion.content[0].content.text, 'Tool completed');

  assert.equal(r.promptReply.result.stopReason, 'end_turn');
  assert.equal(r.exitCode, 0);
  assert.equal(r.stderr, '');
});

// ---------------------------------------------------------------- 2. --fail-tool 四项
test('--fail-tool：command/title/failed/execution 四项逐项相等', async (t) => {
  const r = await runSession(['--fail-tool']);
  t.after(r.cleanup);

  const { toolCall, completion } = pickFrames(r.updates);
  assert.deepEqual(toolCall.execution, { command: 'node out/run.js' });
  assert.equal(toolCall.title, 'write', '命令行不得冒充 title/工具名');
  assert.equal(completion.status, 'failed');
  assert.deepEqual(completion.execution, {
    exitCode: 1,
    keyOutputLines: 3,
    logRef: 'host-logs/T-001.log',
  });

  // D-10 四要素：command 在 tool_call，其余三项在 tool_call_update，合并后四项齐全。
  const merged = { ...toolCall.execution, ...completion.execution };
  assert.equal(merged.command, 'node out/run.js');
  assert.equal(merged.exitCode, 1);
  assert.equal(merged.keyOutputLines, 3);
  assert.equal(merged.logRef, 'host-logs/T-001.log');
  assert.deepEqual(Object.keys(merged).sort(), ['command', 'exitCode', 'keyOutputLines', 'logRef']);
});

// ---------------------------------------------------------------- 3. --fail-tool-no-refs 缺项
test('--fail-tool-no-refs：execution 恰有 command 与 exitCode，两项缺项键不得出现', async (t) => {
  const r = await runSession(['--fail-tool-no-refs']);
  t.after(r.cleanup);

  const { toolCall, completion } = pickFrames(r.updates);
  assert.deepEqual(toolCall.execution, { command: 'node out/run.js' });
  assert.equal(completion.status, 'failed');
  assert.deepEqual(completion.execution, { exitCode: 1 });

  const merged = { ...toolCall.execution, ...completion.execution };
  assert.deepEqual(Object.keys(merged).sort(), ['command', 'exitCode']);
  assert.equal(Object.hasOwn(merged, 'keyOutputLines'), false);
  assert.equal(Object.hasOwn(merged, 'logRef'), false);
  // 两帧各自的 execution 也都不得含缺项键。
  assert.equal(Object.hasOwn(toolCall.execution, 'keyOutputLines'), false);
  assert.equal(Object.hasOwn(toolCall.execution, 'logRef'), false);
  assert.equal(Object.hasOwn(completion.execution, 'keyOutputLines'), false);
  assert.equal(Object.hasOwn(completion.execution, 'logRef'), false);
});

// ---------------------------------------------------------------- 4. 既有开关不回归
test('回归 --slow-tool：title 取自定义值、无 execution、完成帧 completed', async (t) => {
  const r = await runSession(['--slow-tool', 'custom_w']);
  t.after(r.cleanup);

  const { toolCall, completion } = pickFrames(r.updates);
  assert.equal(toolCall.title, 'custom_w');
  assert.ok(!Object.hasOwn(toolCall, 'execution'));
  assert.equal(completion.status, 'completed');
  assert.ok(!Object.hasOwn(completion, 'execution'));
  assert.equal(r.promptReply.result.stopReason, 'end_turn');
});

test('回归 --write-ref：rawInput.file_path + 真实落盘、无 execution、完成帧 completed', async (t) => {
  const r = await runSession(['--write-ref', 'out/probe.txt']);
  t.after(r.cleanup);

  const { toolCall, completion } = pickFrames(r.updates);
  assert.equal(toolCall.title, 'write');
  assert.ok(toolCall.rawInput && typeof toolCall.rawInput.file_path === 'string');
  assert.equal(path.isAbsolute(toolCall.rawInput.file_path), true);
  assert.equal(toolCall.rawInput.content, 'mock write: ok\n');
  assert.ok(!Object.hasOwn(toolCall, 'execution'));

  const artifact = path.join(r.root, 'out', 'probe.txt');
  assert.equal(fs.existsSync(artifact), true);
  assert.equal(fs.readFileSync(artifact, 'utf8'), 'mock write: ok\n');

  assert.equal(completion.status, 'completed');
  assert.ok(!Object.hasOwn(completion, 'execution'));
  assert.equal(completion.content[0].content.text, 'Created file');
  assert.equal(r.promptReply.result.stopReason, 'end_turn');
});

test('回归 --permission=deny：拒绝帧形状不变（无 execution、refusal）', async (t) => {
  const r = await runSession(['--permission=deny']);
  t.after(r.cleanup);

  const { toolCall, completion } = pickFrames(r.updates);
  assert.equal(toolCall.title, 'write');
  assert.ok(!Object.hasOwn(toolCall, 'execution'));
  assert.equal(completion.status, 'failed');
  assert.ok(!Object.hasOwn(completion, 'execution'));
  assert.equal(completion.content[0].content.text, 'Rejected by user');
  assert.equal(r.promptReply.result.stopReason, 'refusal');
  // 拒绝分支既有行为：不发 agent_message_chunk。
  assert.ok(!r.updates.some((u) => u.sessionUpdate === 'agent_message_chunk'));
});

// ---------------------------------------------------------------- 5. 失败步骤仍正常收尾
test('失败步骤：进程正常退出、无堆栈、stopReason 仍为 end_turn（不新增失败码）', async (t) => {
  for (const sw of [['--fail-tool'], ['--fail-tool-no-refs']]) {
    const r = await runSession(sw);
    t.after(r.cleanup);
    assert.equal(r.exitCode, 0, `exitCode，switches=${sw.join(' ')}，stderr=${r.stderr}`);
    assert.equal(r.stderr, '', `不得有堆栈/错误输出，switches=${sw.join(' ')}`);
    assert.equal(r.promptReply.result.stopReason, 'end_turn');
    // 成败只由核心产出核对裁决：agent_message_chunk 与 end_turn 都照常保留。
    assert.equal(r.updates.at(-1).sessionUpdate, 'agent_message_chunk');
  }
});

// ---------------------------------------------------------------- 6. 双开关 no-refs 优先
test('两开关同时给出：以 --fail-tool-no-refs 优先（缺项变体）', async (t) => {
  const r = await runSession(['--fail-tool', '--fail-tool-no-refs']);
  t.after(r.cleanup);

  const { toolCall, completion } = pickFrames(r.updates);
  assert.deepEqual(toolCall.execution, { command: 'node out/run.js' });
  assert.equal(completion.status, 'failed');
  // 缺项变体胜出：execution 只有 exitCode，四项中的两项不得出现。
  assert.deepEqual(completion.execution, { exitCode: 1 });
  const merged = { ...toolCall.execution, ...completion.execution };
  assert.equal(Object.hasOwn(merged, 'keyOutputLines'), false);
  assert.equal(Object.hasOwn(merged, 'logRef'), false);
  assert.equal(r.promptReply.result.stopReason, 'end_turn');
});
