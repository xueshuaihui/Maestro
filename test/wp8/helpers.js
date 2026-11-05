import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createAdapterFactory } from '../../src/adapter/factory.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { createStore } from '../../src/persistence/instance-store.js';

export const MOCK = path.resolve('test/fixtures/mock-acp-agent.js');

export const LIMITS = {
  initializeTimeoutMs: 8000,
  requestTimeoutMs: 8000,
  promptTimeoutMs: 8000,
  quietIdleMs: 30,
  quietCapMs: 200,
};

export function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor(predicate, { timeoutMs = 15_000, intervalMs = 20 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() > deadline) throw new Error('waitFor 超时');
    await sleep(intervalMs);
  }
}

/** 去掉可能影响审批策略与宿主路径的环境变量。 */
export function sanitizedEnv() {
  const env = { ...process.env };
  for (const key of [
    'MAESTRO_DSH_EXE',
    'MAESTRO_DSH_BIN',
    'MAESTRO_DSH_ARGS',
    'MAESTRO_PERMISSION_POLICY',
  ]) {
    delete env[key];
  }
  return env;
}

export function writeHostConfig(root, switches = [], { permissionPolicy = null } = {}) {
  const dir = path.join(root, '.orch', 'hosts');
  fs.mkdirSync(dir, { recursive: true });
  const config = {
    transport: 'stdio',
    launch: { command: process.execPath, args: [MOCK, ...switches] },
    limits: { ...LIMITS },
  };
  if (permissionPolicy) config.limits.permissionPolicy = permissionPolicy;
  fs.writeFileSync(path.join(dir, 'dsh.json'), JSON.stringify(config, null, 2), 'utf8');
}

/**
 * 真实 store / bus / orchestrator + mock 宿主（与产品同一条装配链）。
 * @param {{switches?: string[], permissionPolicy?: string|null, configPolicy?: string|null}} options
 */
export async function setup({ switches = [], permissionPolicy = null, configPolicy = null } = {}) {
  const root = tmpDir('maestro-wp8-root-');
  const cwd = tmpDir('maestro-wp8-cwd-');
  writeHostConfig(root, switches, { permissionPolicy: configPolicy });

  const store = createStore({ root });
  const bus = createEventBus({ store });
  const events = [];
  bus.subscribe((event) => events.push(event));
  const orch = createOrchestrator({
    store,
    bus,
    adapterFactory: createAdapterFactory({ root, env: sanitizedEnv() }),
    generation: 'gen-wp8',
    env: sanitizedEnv(),
    ...(permissionPolicy ? { permissionPolicy } : {}),
  });

  return {
    root,
    cwd,
    store,
    bus,
    orch,
    events,
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

/**
 * v2 数组投影（D-6）：`state.json` 的 `node` / `session` / `handoff` 是数组。
 * 测试断言统一用这三个辅助取"第一个节点 / 当前会话 / 最后一张交接包"。
 */
export function firstNode(state) {
  return Array.isArray(state?.nodes) ? (state.nodes[0] ?? null) : null;
}

export function currentSession(state) {
  const list = Array.isArray(state?.sessions) ? state.sessions : [];
  return list.length > 0 ? list[list.length - 1] : null;
}

export function lastHandoff(state) {
  const list = Array.isArray(state?.handoffs) ? state.handoffs : [];
  return list.length > 0 ? list[list.length - 1] : null;
}

/** 读磁盘快照（不带任何内存副本）。 */
export async function diskState(store, instanceId) {
  const loaded = await store.load(instanceId);
  if (!loaded.ok) throw new Error(`load ${instanceId} 失败：${loaded.code}`);
  return loaded.state;
}
