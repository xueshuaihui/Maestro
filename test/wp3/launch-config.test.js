import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { deriveDshPaths, probeDshInstalled, resolveDshLaunch, resolveMockLaunch } from '../../src/adapter/dsh-launch.js';
import { DEFAULT_LIMITS, loadHostConfig } from '../../src/adapter/host-config.js';

const FAKE_LOCALAPPDATA = path.join('C:', 'FakeUser', 'AppData', 'Local');
const MOCK = path.resolve('test/fixtures/mock-acp-agent.js');

test('默认推导：%LOCALAPPDATA%\\Programs\\DeepSeek Harness，args=[bin,--profile,acp]，显式覆盖 ELECTRON_RUN_AS_NODE', () => {
  const env = { LOCALAPPDATA: FAKE_LOCALAPPDATA, ELECTRON_RUN_AS_NODE: '0' };
  const derived = deriveDshPaths(env);
  assert.equal(derived.exe, path.join(FAKE_LOCALAPPDATA, 'Programs', 'DeepSeek Harness', 'DeepSeek Harness.exe'));
  assert.match(derived.bin.replace(/\\/g, '/'), /resources\/app\.asar\/dsh\/node_modules\/@deepseek-ai\/dsh\/lib\/bin\.js$/);

  const resolved = resolveDshLaunch({ env });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.launch.source, 'default');
  assert.equal(resolved.launch.command, derived.exe);
  assert.deepEqual(resolved.launch.args, [derived.bin, '--profile', 'acp']);
  // 覆盖而非沿用
  assert.equal(resolved.launch.env.ELECTRON_RUN_AS_NODE, '1');
});

test('env 覆盖优先级最高（MAESTRO_DSH_EXE / BIN / ARGS）', () => {
  const env = {
    LOCALAPPDATA: FAKE_LOCALAPPDATA,
    MAESTRO_DSH_EXE: 'C:/Other/DSH.exe',
    MAESTRO_DSH_BIN: 'C:/Other/bin.js',
    MAESTRO_DSH_ARGS: '--profile custom --verbose',
  };
  const resolved = resolveDshLaunch({ env, config: { launch: { command: 'ignored', args: ['x'] } } });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.launch.source, 'env');
  assert.equal(resolved.launch.command, 'C:/Other/DSH.exe');
  assert.deepEqual(resolved.launch.args, ['C:/Other/bin.js', '--profile', 'custom', '--verbose']);
});

test('配置可指向任意命令（夹具接管 host 的唯一入口）', () => {
  const resolved = resolveDshLaunch({
    env: { LOCALAPPDATA: FAKE_LOCALAPPDATA },
    config: { launch: { command: process.execPath, args: [MOCK, '--hold-session'] } },
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.launch.source, 'config');
  assert.equal(resolved.launch.command, process.execPath);
  assert.deepEqual(resolved.launch.args, [MOCK, '--hold-session']);
  assert.equal(resolved.launch.env.ELECTRON_RUN_AS_NODE, '1');
});

test('resolveMockLaunch 走同一个 launch 形态', () => {
  const resolved = resolveMockLaunch({ mockPath: MOCK, switches: ['--hold-session'] });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.launch.command, process.execPath);
  assert.deepEqual(resolved.launch.args, [MOCK, '--hold-session']);
});

test('probeDshInstalled：路径不存在返回 DSH_SPAWN_FAILED 与「未找到 <path>」', async () => {
  const result = await probeDshInstalled({ env: { LOCALAPPDATA: path.join('C:', 'NoSuchUser', 'Missing') } });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DSH_SPAWN_FAILED');
  assert.match(result.params.cause, /^未找到 /);

  const noLocalAppData = await probeDshInstalled({ env: {} });
  assert.equal(noLocalAppData.ok, false);
  assert.match(noLocalAppData.params.cause, /未找到 LOCALAPPDATA/);
});

test('loadHostConfig：无配置文件用默认；transport 非 stdio → HOST_UNSUPPORTED；坏 JSON → HOST_CONFIG_INVALID', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-wp3-host-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const defaults = await loadHostConfig({ root, env: { LOCALAPPDATA: FAKE_LOCALAPPDATA } });
  assert.equal(defaults.ok, true);
  assert.equal(defaults.transport, 'stdio');
  assert.equal(defaults.source, 'default');
  assert.equal(defaults.dialect.recovery, 'resume');
  assert.deepEqual(defaults.limits, DEFAULT_LIMITS);
  assert.equal(defaults.configPath, null);

  fs.mkdirSync(path.join(root, '.orch', 'hosts'), { recursive: true });
  const file = path.join(root, '.orch', 'hosts', 'dsh.json');

  fs.writeFileSync(file, JSON.stringify({ transport: 'http-sse' }), 'utf8');
  const unsupported = await loadHostConfig({ root });
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.code, 'HOST_UNSUPPORTED');

  fs.writeFileSync(file, '{ not json', 'utf8');
  const invalid = await loadHostConfig({ root });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.code, 'HOST_CONFIG_INVALID');
});

test('loadHostConfig：配置里的 launch 指向 mock 并成功建会话（AC-15 夹具路径）', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-wp3-host2-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.orch', 'hosts'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.orch', 'hosts', 'dsh.json'),
    JSON.stringify({
      transport: 'stdio',
      launch: { command: process.execPath, args: [MOCK, '--hold-session'] },
      dialect: { recovery: 'none' },
      limits: { quietIdleMs: 20, quietCapMs: 120 },
    }),
    'utf8',
  );

  const host = await loadHostConfig({ root });
  assert.equal(host.ok, true);
  assert.equal(host.source, 'config');
  assert.equal(host.launch.command, process.execPath);
  assert.equal(host.dialect.recovery, 'none');
  assert.equal(host.limits.quietIdleMs, 20);
  assert.equal(host.limits.quietCapMs, 120);
  assert.equal(host.limits.initializeTimeoutMs, DEFAULT_LIMITS.initializeTimeoutMs);
});
