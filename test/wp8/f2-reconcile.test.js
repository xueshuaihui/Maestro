import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createServer } from '../../src/daemon/server.js';
import { statePath } from '../../src/persistence/paths.js';
import { sleep, tmpDir } from './helpers.js';

function seedRunning(root) {
  const dir = `${root}/.orch/instances/INST-001`;
  fs.mkdirSync(dir, { recursive: true });
  const at = new Date().toISOString();
  const state = {
    schemaVersion: 1,
    instanceId: 'INST-001',
    coreGeneration: 'gen-old',
    createdAt: at,
    updatedAt: at,
    state: 'running',
    stateSince: at,
    cwd: root,
    task: '跑到一半',
    roleId: 'worker',
    node: { nodeId: 'T-001', state: 'running', stateSince: at, startedAt: at, endedAt: null, failure: null, note: null },
    session: {
      sessionId: 'sess-old',
      hostId: 'dsh',
      state: 'thinking',
      stateSince: at,
      createdAt: at,
      lastEventAt: at,
      toolName: null,
      turnId: 'turn-1',
      pendingPermission: null,
      quarantined: false,
    },
    handoff: { handoffId: 'HO-001', state: 'delivered', createdAt: at, deliveredAt: at },
    artifactRefs: [],
    hostRaw: {},
    counters: { eventSeq: 0, runCount: 1 },
  };
  fs.writeFileSync(statePath(root, 'INST-001'), JSON.stringify(state, null, 2), 'utf8');
  return state;
}

const fakeBus = { subscribe: () => () => {} };

function makeOrchestrator({ root, reconcile }) {
  return {
    reconcileCalls: 0,
    async reconcileOnBoot() {
      this.reconcileCalls += 1;
      return reconcile();
    },
    async interruptAll() {
      return { ok: true, interrupted: [] };
    },
    async dispose() {},
  };
}

test('F-2：第二个核心在 EADDRINUSE 退出前不跑对账，第一个核心的 running 实例保持原样', async () => {
  const root = tmpDir('maestro-wp8-core-');
  const seeded = seedRunning(root);
  const before = fs.readFileSync(statePath(root, 'INST-001'), 'utf8');

  const orchA = makeOrchestrator({ root, reconcile: async () => ({ ok: true, interrupted: [] }) });
  const serverA = createServer({ root, orchestrator: orchA, bus: fakeBus, generation: 'gen-a', exitOnStop: false });

  // 若在监听前对账，B 会像旧实现一样把 running 改成 interrupted —— 用它当探针。
  const orchB = makeOrchestrator({
    root,
    reconcile: async () => {
      const file = statePath(root, 'INST-001');
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      parsed.state = 'interrupted';
      fs.writeFileSync(file, JSON.stringify(parsed, null, 2), 'utf8');
      return { ok: true, interrupted: ['INST-001'] };
    },
  });
  const serverB = createServer({ root, orchestrator: orchB, bus: fakeBus, generation: 'gen-b', exitOnStop: false });

  try {
    const listened = await serverA.listen();
    assert.equal(listened.ok, true, JSON.stringify(listened));
    assert.equal(orchA.reconcileCalls, 1, '拥有管道的核心应在监听成功后对账');

    const second = await serverB.listen();
    assert.equal(second.ok, false);
    assert.equal(second.code, 'CORE_ALREADY_RUNNING');
    assert.equal(orchB.reconcileCalls, 0, 'CORE_ALREADY_RUNNING 分支必须零副作用');

    const after = fs.readFileSync(statePath(root, 'INST-001'), 'utf8');
    assert.equal(after, before, '第一个核心的 state.json 不得被第二个核心改动');
    assert.equal(JSON.parse(after).state, seeded.state);
  } finally {
    await serverA.close({ mode: 'test', timeoutMs: 2000 });
    await sleep(20);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
