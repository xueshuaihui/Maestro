import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createClient } from '../../src/daemon/client.js';
import { ensureCore, isAlive, stopCore } from '../../src/daemon/lifecycle.js';
import { coreMetaPath, pipeName as pipeNameFor } from '../../src/persistence/paths.js';

const tempDirs = [];
const spawnedRoots = new Set();

after(async () => {
  // 不给任何用例留下孤儿核心。
  for (const root of spawnedRoots) {
    await stopCore({ root, timeoutMs: 5000 }).catch(() => {});
  }
  for (const dir of tempDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

async function makeProject(tag) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `maestro-wp5-life-${tag}-`));
  tempDirs.push(dir);
  return dir;
}

test('isAlive：没有核心时为 false，且不拉起任何进程', async () => {
  const root = await makeProject('alive');
  assert.equal(await isAlive({ root }), false);
});

test('connect({ensure:false})：核心没在跑 → CORE_NOT_RUNNING', async () => {
  const root = await makeProject('norun');
  const client = createClient({ root });
  try {
    const res = await client.connect({ ensure: false });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'CORE_NOT_RUNNING');
  } finally {
    await client.close();
  }
});

test('自动拉起：detached 起真进程，ping 拿到 pid/generation，stopCore 清干净', async () => {
  const root = await makeProject('coldstart');
  spawnedRoots.add(root);

  assert.equal(await isAlive({ root }), false);

  const t0 = Date.now();
  const res = await ensureCore({ root });
  const wallMs = Date.now() - t0;

  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(res.coldStart, true, '首次拉起必须判定为冷启动');
  assert.ok(Number.isInteger(res.pid) && res.pid > 0);
  assert.notEqual(res.pid, process.pid, '核心必须是独立进程');
  assert.match(res.generation, /^gen-[0-9a-f]+$/);
  assert.ok(res.elapsedMs > 0 && res.elapsedMs <= wallMs + 50, `elapsedMs=${res.elapsedMs} wall=${wallMs}`);
  // 冷启动预算 30s；本地空核心应在 10s 内起来。
  assert.ok(res.elapsedMs < 10000, `冷启动耗时异常：${res.elapsedMs}ms`);

  assert.equal(await isAlive({ root }), true);

  const stopT0 = Date.now();
  const stopped = await stopCore({ root, timeoutMs: 5000 });
  assert.equal(stopped.ok, true, JSON.stringify(stopped));
  assert.equal(stopped.exit, 'graceful');
  assert.equal(stopped.pid, res.pid);
  assert.ok(stopped.elapsedMs < 5000, `停止耗时异常：${stopped.elapsedMs}ms`);

  spawnedRoots.delete(root);

  // 管道断开只是必要条件；这里再确认进程真的退出了。
  let gone = false;
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      process.kill(res.pid, 0);
    } catch (err) {
      if (err?.code === 'ESRCH') {
        gone = true;
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.equal(gone, true, `核心进程 ${res.pid} 未退出`);
  assert.ok(Date.now() - stopT0 < 5000, 'core stop 必须 ≤5s 退出');
  assert.equal(await isAlive({ root }), false);

  // `core.json` 只用于诊断，进程走了也应仍可读。
  const meta = JSON.parse(await fs.readFile(coreMetaPath(root), 'utf8'));
  assert.equal(meta.pid, res.pid);
  assert.equal(meta.pipeName, pipeNameFor(root));
});

test('stopCore：核心本来就没在跑时幂等返回 not-running', async () => {
  const root = await makeProject('stop-idempotent');
  const res = await stopCore({ root });
  assert.equal(res.ok, true);
  assert.equal(res.exit, 'not-running');
});

test('EACCES：管道无权限 → 直接 CORE_START_FAILED，不反复拉起（R6）', async () => {
  const root = await makeProject('eacces');
  let connectCalls = 0;
  let spawnCalls = 0;

  const client = createClient({
    root,
    connectImpl: () => {
      connectCalls += 1;
      const fake = new EventEmitter();
      fake.destroy = () => {};
      fake.write = () => true;
      process.nextTick(() => {
        const err = new Error('connect EACCES');
        err.code = 'EACCES';
        fake.emit('error', err);
      });
      return fake;
    },
    spawnImpl: () => {
      spawnCalls += 1;
      throw new Error('不应被调用');
    },
  });

  try {
    const res = await client.connect({ ensure: true });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'CORE_START_FAILED');
    assert.equal(res.params.errno, 'EACCES');
    assert.equal(connectCalls, 1, '权限错误不得重试');
    assert.equal(spawnCalls, 0, '权限错误不得拉起核心');
  } finally {
    await client.close();
  }
});

test('冷启动超时：CORE_START_FAILED 且带 elapsedMs/cause，不无限轮询', async () => {
  const root = await makeProject('timeout');
  let spawnCalls = 0;

  const client = createClient({
    root,
    spawnImpl: () => {
      spawnCalls += 1;
      const child = new EventEmitter();
      child.pid = 424242;
      child.unref = () => {};
      return child;
    },
  });

  try {
    const t0 = Date.now();
    const res = await client.connect({ ensure: true, coldStartTimeoutMs: 400 });
    const elapsed = Date.now() - t0;

    assert.equal(res.ok, false);
    assert.equal(res.code, 'CORE_START_FAILED');
    assert.equal(res.params.cause, '30s 内未能连接核心');
    assert.equal(res.params.pid, 424242);
    assert.ok(res.params.elapsedMs >= 0);
    assert.equal(spawnCalls, 1, '只允许拉起一次');
    assert.ok(elapsed < 3000, `超时路径不得无限重试：${elapsed}ms`);
  } finally {
    await client.close();
  }
});
