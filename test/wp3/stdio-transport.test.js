import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import test from 'node:test';

import { createStdioTransport } from '../../src/adapter/stdio-transport.js';

const NO_SUCH_BIN = path.join(os.tmpdir(), 'maestro-wp3-no-such-binary-xyz.exe');

function nodeScript(lines) {
  return [process.execPath, ['-e', lines.join('\n')]];
}

function waitFor(predicate, { timeoutMs = 5000, intervalMs = 20 } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      let value;
      try {
        value = predicate();
      } catch (err) {
        clearInterval(timer);
        reject(err);
        return;
      }
      if (value) {
        clearInterval(timer);
        resolve(value);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error('waitFor 超时'));
      }
    }, intervalMs);
  });
}

test('NDJSON：两行同写 / 半行分片 / 空行 / 末尾无换行 / 坏 JSON 不断连', async () => {
  const [command, args] = nodeScript([
    "process.stdout.write('{\"a\":1}\\n{\"b\":2}\\n\\n{\"par');",
    "setTimeout(() => process.stdout.write('tial\":3}\\nnot-json\\n{\"d\":4}'), 80);",
    'setTimeout(() => process.exit(0), 350);',
  ]);
  const transport = createStdioTransport({ command, args, env: process.env, settleMs: 25 });

  const messages = [];
  const parseErrors = [];
  transport.onMessage((obj) => messages.push(obj));
  transport.onParseError(({ line, error }) => parseErrors.push({ line, error }));

  const spawned = await transport.spawn();
  assert.equal(spawned.ok, true, JSON.stringify(spawned));

  await waitFor(() => messages.length >= 4 && transport.isExited(), { timeoutMs: 5000 });

  assert.deepEqual(
    messages.map((m) => Object.values(m)[0]),
    [1, 2, 3, 4],
  );
  assert.equal(parseErrors.length, 1);
  assert.equal(parseErrors[0].line, 'not-json');
  assert.match(parseErrors[0].error.message, /无法解析/);

  await transport.dispose({ timeoutMs: 500 });
});

test('单行超 maxFrameBytes：onParseError 报 IPC_FRAME_TOO_LARGE 并自动 dispose', async () => {
  const [command, args] = nodeScript([
    "process.stdout.write('x'.repeat(256));",
    'setInterval(() => {}, 1000);',
  ]);
  const transport = createStdioTransport({
    command,
    args,
    env: process.env,
    maxFrameBytes: 32,
    settleMs: 25,
  });

  const parseErrors = [];
  transport.onParseError((payload) => parseErrors.push(payload));
  const spawned = await transport.spawn();
  assert.equal(spawned.ok, true, JSON.stringify(spawned));

  await waitFor(() => parseErrors.length > 0, { timeoutMs: 3000 });
  assert.equal(parseErrors[0].error.code, 'IPC_FRAME_TOO_LARGE');

  await waitFor(() => transport.isExited(), { timeoutMs: 5000 });
});

test('spawn 失败：返回 DSH_SPAWN_FAILED 且 cause 有内容', async () => {
  const transport = createStdioTransport({
    command: NO_SUCH_BIN,
    args: [],
    env: process.env,
    settleMs: 50,
  });
  const spawned = await transport.spawn();
  assert.equal(spawned.ok, false);
  assert.equal(spawned.code, 'DSH_SPAWN_FAILED');
  assert.ok(spawned.params.cause.length > 0);
});

test('立即退出：stderr 尾部进入 cause（最多 20 行、去空行）', async () => {
  const [command, args] = nodeScript([
    "process.stderr.write('boom-line-1\\n\\nboom-line-2\\n');",
    'setTimeout(() => process.exit(3), 20);',
  ]);
  const transport = createStdioTransport({ command, args, env: process.env, settleMs: 400 });

  const spawned = await transport.spawn();
  assert.equal(spawned.ok, false);
  assert.equal(spawned.code, 'DSH_SPAWN_FAILED');
  assert.match(spawned.params.cause, /boom-line-1/);
  assert.match(spawned.params.cause, /boom-line-2/);
  // 空行被丢弃
  assert.ok(!spawned.params.cause.includes('\n\n'));

  const tail = transport.stderrTail(20);
  assert.deepEqual(tail, ['boom-line-1', 'boom-line-2']);
  await transport.dispose({ timeoutMs: 500 });
});

test('dispose：忽略 stdin EOF 的子进程也会被终止，不留孤儿', async () => {
  const [command, args] = nodeScript(['setInterval(() => {}, 1000);']);
  const transport = createStdioTransport({ command, args, env: process.env, settleMs: 40 });
  const spawned = await transport.spawn();
  assert.equal(spawned.ok, true);

  const pid = spawned.pid;
  await transport.dispose({ timeoutMs: 300 });

  await waitFor(() => {
    try {
      process.kill(pid, 0);
      return false;
    } catch {
      return true;
    }
  }, { timeoutMs: 3000 });
});

test('send 串行化：并发写入不交错，每行都是完整 JSON', async () => {
  const [command, args] = nodeScript([
    "let buf='';",
    "process.stdin.on('data', (c) => { buf += c.toString('utf8'); });",
    "process.stdin.on('end', () => { process.stdout.write(JSON.stringify({ lines: buf.trim().split('\\n').length, allJson: buf.trim().split('\\n').every((l) => { try { JSON.parse(l); return true; } catch { return false; } }) }) + '\\n'); });",
  ]);
  const transport = createStdioTransport({ command, args, env: process.env, settleMs: 40 });
  const spawned = await transport.spawn();
  assert.equal(spawned.ok, true, JSON.stringify(spawned));

  const received = [];
  transport.onMessage((obj) => received.push(obj));

  await Promise.all(
    Array.from({ length: 20 }, (_, i) => transport.send({ jsonrpc: '2.0', id: i + 1, method: 'ping' })),
  );
  transport.dispose({ timeoutMs: 500 });
  await waitFor(() => received.length >= 1, { timeoutMs: 3000 });

  assert.equal(received[0].lines, 20);
  assert.equal(received[0].allJson, true);
});
