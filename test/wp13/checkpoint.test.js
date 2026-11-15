/**
 * WP-1 契约测试：checkpoint/v1 形状、写点返回值、读取守卫与原子写。
 * 纯内存对象 + %TEMP% 独立项目根（fs.mkdtemp / os.tmpdir），结束即清理；
 * 不 spawn 进程、不启核心。断言口径逐字对齐需求 AC-02/03 夹具与 AC-04/05/06 检查点侧契约。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  CHECKPOINT_SCHEMA,
  buildCheckpoint,
  writeCheckpoint,
  loadCheckpoint,
  checkpointPath as checkpointPathFromCore,
} from '../../src/core/checkpoint.js';
import {
  checkpointPath as checkpointPathFromPaths,
  instanceDir,
} from '../../src/persistence/paths.js';

const ALL_KEYS = [
  'schema', 'instanceId', 'rev', 'checkpointId', 'writtenAt', 'coreGeneration',
  'instanceState', 'paused', 'halted', 'template', 'cwd', 'task', 'graph',
  'nodes', 'sessions', 'handoffs', 'escalations', 'artifactRefs',
].sort();

function makeGraph() {
  return {
    id: 'code-loop', title: '编码闭环', nodes: [], edges: [],
    maxRounds: {}, terminals: [], productPolicy: 'declared',
  };
}

function makeState(overrides = {}) {
  return {
    instanceId: 'INST-001',
    rev: 12,
    state: 'running',
    paused: false,
    halted: false,
    template: 'code-loop',
    coreGeneration: 'gen-1',
    nodes: [{
      id: 'T-003', state: 'running', phase: 'assigned', round: 2,
      roleId: 'developer', sessionId: 'sess-003', endedAt: null,
    }],
    sessions: [{
      sessionId: 'sess-003', nodeId: 'T-003', hostId: 'dsh', state: 'thinking',
      policy: 'fresh', dialect: null, lastEventAt: '2026-11-09T10:30:00.000Z',
    }],
    handoffs: [{
      handoffId: 'HO-006', from: 'T-002', to: 'T-003', kind: 'backflow',
      state: 'delivered', deliveryAttempts: 1,
    }],
    escalations: [],
    artifactRefs: [],
    ...overrides,
  };
}

function build(state = makeState()) {
  return buildCheckpoint({ state, graph: makeGraph(), cwd: '/abs/project', task: '任务原文' });
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function withTempRoot(fn) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-wp1-'));
  try {
    await fn(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

const sortedKeys = (value) => Object.keys(value).sort();

test('导出与 schema 常量（§2.1 / §2.2 / 冻结点 1）', () => {
  assert.equal(CHECKPOINT_SCHEMA, 'checkpoint/v1');
  assert.equal(typeof buildCheckpoint, 'function');
  assert.equal(typeof writeCheckpoint, 'function');
  assert.equal(typeof loadCheckpoint, 'function');
  // checkpoint.js 与 paths.js 导出的是同一个路径助手，签名 checkpointPath(root, id) 不变。
  assert.equal(checkpointPathFromCore, checkpointPathFromPaths);
  const root = path.join(os.tmpdir(), 'proj-sample');
  assert.equal(
    checkpointPathFromCore(root, 'INST-001'),
    path.join(instanceDir(root, 'INST-001'), 'state', 'checkpoint.json'),
  );
});

test('buildCheckpoint：全键齐全 / AC-02 / AC-03 逐字断言', () => {
  const cp = build();

  // §6 冻结点 1：全部键，不得增删。
  assert.deepEqual(sortedKeys(cp), ALL_KEYS);
  assert.equal(cp.schema, 'checkpoint/v1');

  // AC-03 夹具：含 instanceId / rev / checkpointId / graph / nodes / sessions / handoffs / paused / halted。
  for (const key of [
    'instanceId', 'rev', 'checkpointId', 'graph', 'nodes',
    'sessions', 'handoffs', 'paused', 'halted',
  ]) {
    assert.ok(Object.prototype.hasOwnProperty.call(cp, key), `missing key: ${key}`);
  }
  assert.equal(cp.instanceId, 'INST-001');
  assert.equal(cp.rev, 12);                 // AC-02：rev 与实例记录一致
  assert.equal(cp.checkpointId, 12);        // D-3 样例：rev 与 checkpointId 同值
  assert.equal(cp.paused, false);
  assert.equal(cp.halted, false);
  assert.equal(cp.instanceState, 'running');
  assert.equal(cp.coreGeneration, 'gen-1');
  assert.equal(cp.template, 'code-loop');
  assert.equal(cp.cwd, '/abs/project');
  assert.equal(cp.task, '任务原文');
  assert.deepEqual(cp.graph, makeGraph());  // 锁定图快照
  assert.ok(!Number.isNaN(Date.parse(cp.writtenAt)));

  // 节点按 D-3 样例投影：id -> nodeId，保留 state / phase / round / sessionId。
  assert.equal(cp.nodes.length, 1);
  assert.deepEqual(sortedKeys(cp.nodes[0]), [
    'endedAt', 'nodeId', 'phase', 'roleId', 'round', 'sessionId', 'state',
  ].sort());
  assert.equal(cp.nodes[0].nodeId, 'T-003');
  assert.equal(cp.nodes[0].phase, 'assigned');
  assert.equal(cp.nodes[0].round, 2);
  assert.equal(cp.sessions.length, 1);
  assert.equal(cp.sessions[0].policy, 'fresh');
  assert.equal(cp.handoffs.length, 1);
  assert.equal(cp.handoffs[0].deliveryAttempts, 1);
  assert.deepEqual(cp.escalations, []);
  assert.deepEqual(cp.artifactRefs, []);
});

test('AC-03：检查点不含提示词全文 / 模型输出 / 凭据', () => {
  const markers = [
    '__SENSITIVE_PROMPT__', '__SENSITIVE_OUTPUT__', '__SENSITIVE_CRED__',
    '__SENSITIVE_KEY__', '__SENSITIVE_HISTORY__', '__NODE_PROMPT__',
    '__NODE_OUTPUT__', '__NODE_CRED__', '__SESS_PROMPT__', '__SESS_OUTPUT__',
    '__SESS_CRED__', '__HANDOFF_SECRET__',
  ];
  const state = makeState({
    promptText: '__SENSITIVE_PROMPT__',
    modelOutput: '__SENSITIVE_OUTPUT__',
    credentials: '__SENSITIVE_CRED__',
    apiKey: '__SENSITIVE_KEY__',
    conversation: '__SENSITIVE_HISTORY__',
    nodes: [{
      id: 'T-003', state: 'running', round: 2,
      promptText: '__NODE_PROMPT__', modelOutput: '__NODE_OUTPUT__', credentials: '__NODE_CRED__',
    }],
    sessions: [{
      sessionId: 'sess-003',
      promptText: '__SESS_PROMPT__', modelOutput: '__SESS_OUTPUT__', credentials: '__SESS_CRED__',
    }],
    handoffs: [{ handoffId: 'HO-006', payload: '__HANDOFF_SECRET__' }],
  });
  const cp = build(state);
  const json = JSON.stringify(cp);
  for (const marker of markers) {
    assert.ok(!json.includes(marker), `leaked value: ${marker}`);
  }
  for (const key of ['promptText', 'modelOutput', 'credentials', 'apiKey', 'conversation', 'payload']) {
    assert.ok(!json.includes(key), `leaked field: ${key}`);
  }
  // 顶层字段只取白名单，绝不整体展开实例记录。
  assert.deepEqual(sortedKeys(cp), ALL_KEYS);
});

test('AC-02：checkpointId 单调递增、rev 与实例记录一致（逐进展写点）', async () => {
  await withTempRoot(async (root) => {
    const seen = [];
    for (let rev = 1; rev <= 3; rev += 1) {
      const state = makeState({ rev });
      const cp = build(state);
      assert.equal(cp.rev, rev);
      assert.equal(cp.checkpointId, rev);
      assert.deepEqual(await writeCheckpoint(root, 'INST-001', cp), { ok: true });
      const loaded = await loadCheckpoint(root, 'INST-001');
      assert.equal(loaded.ok, true);
      assert.equal(loaded.checkpoint.rev, rev);
      seen.push(loaded.checkpoint.checkpointId);
    }
    assert.ok(seen[0] < seen[1] && seen[1] < seen[2], `not monotonic: ${seen.join(',')}`);
  });
});

test('写点强制 checkpointId 单调：同一对象重复写入仍严格递增', async () => {
  await withTempRoot(async (root) => {
    const cp = build(makeState({ rev: 5 }));
    await writeCheckpoint(root, 'INST-001', cp);
    const first = await loadCheckpoint(root, 'INST-001');
    await writeCheckpoint(root, 'INST-001', cp);
    const second = await loadCheckpoint(root, 'INST-001');
    assert.ok(second.checkpoint.checkpointId > first.checkpoint.checkpointId);
    assert.equal(second.checkpoint.rev, 5);   // rev 不受单调推进影响
  });
});

test('写盘 / 读取回环：落盘对象逐字等于 buildCheckpoint 出参、全键齐全', async () => {
  await withTempRoot(async (root) => {
    const cp = build();
    assert.deepEqual(await writeCheckpoint(root, 'INST-001', cp), { ok: true });
    assert.equal(await exists(checkpointPathFromPaths(root, 'INST-001')), true);
    const loaded = await loadCheckpoint(root, 'INST-001');
    assert.equal(loaded.ok, true);
    assert.deepEqual(sortedKeys(loaded), ['checkpoint', 'ok']);
    assert.deepEqual(loaded.checkpoint, cp);
    assert.deepEqual(sortedKeys(loaded.checkpoint), ALL_KEYS);
  });
});

test('AC-04 检查点侧：写失败返回 {ok:false, code} 且不抛异常', async () => {
  await withTempRoot(async (root) => {
    const cp = build();
    // 把项目根指向一个普通文件，使 mkdir(state/) 必然失败，制造真实磁盘写失败。
    const blocker = path.join(root, 'blocker');
    await fs.writeFile(blocker, 'x', 'utf8');
    let result;
    let threw = false;
    try {
      result = await writeCheckpoint(blocker, 'INST-001', cp);
    } catch {
      threw = true;
    }
    assert.equal(threw, false);
    assert.equal(result.ok, false);
    assert.equal(typeof result.code, 'string');
    assert.ok(result.code.length > 0);

    // 序列化异常也必须在 writeCheckpoint 内被收敛，不外抛。
    const cyclic = build();
    cyclic.self = cyclic;
    let second;
    let threw2 = false;
    try {
      second = await writeCheckpoint(root, 'INST-001', cyclic);
    } catch {
      threw2 = true;
    }
    assert.equal(threw2, false);
    assert.equal(second.ok, false);
    assert.equal(typeof second.code, 'string');
  });
});

test('AC-05/06 检查点侧：缺失检查点 -> CHECKPOINT_UNREADABLE 且不写任何文件', async () => {
  await withTempRoot(async (root) => {
    const before = await fs.readdir(root);
    const result = await loadCheckpoint(root, 'INST-001');
    assert.deepEqual(result, { ok: false, code: 'CHECKPOINT_UNREADABLE' });
    assert.deepEqual(await fs.readdir(root), before);
    assert.equal(await exists(path.join(root, '.orch')), false);
    assert.equal(await exists(checkpointPathFromPaths(root, 'INST-001')), false);
  });
});

test('读取守卫：非法 JSON / schema 不符 / instanceId 不符均返回 CHECKPOINT_UNREADABLE', async () => {
  await withTempRoot(async (root) => {
    const file = checkpointPathFromPaths(root, 'INST-001');
    await fs.mkdir(path.dirname(file), { recursive: true });

    const cases = [
      '{ not valid json',
      JSON.stringify({ schema: 'other/v9', instanceId: 'INST-001' }),
      JSON.stringify({ schema: 'checkpoint/v1', instanceId: 'OTHER' }),
      JSON.stringify(null),
    ];
    for (const content of cases) {
      await fs.writeFile(file, content, 'utf8');
      const snapshot = await fs.readFile(file, 'utf8');
      const result = await loadCheckpoint(root, 'INST-001');
      assert.deepEqual(result, { ok: false, code: 'CHECKPOINT_UNREADABLE' });
      // 读路径绝不改写原文件、绝不静默重建。
      assert.equal(await fs.readFile(file, 'utf8'), snapshot);
    }
  });
});

test('buildCheckpoint：对缺字段的兼容缺省（不抛、全键仍在）', () => {
  const empty = buildCheckpoint({});
  assert.deepEqual(sortedKeys(empty), ALL_KEYS);
  assert.equal(empty.schema, 'checkpoint/v1');
  assert.equal(empty.rev, 0);
  assert.equal(empty.checkpointId, 0);
  assert.equal(empty.instanceId, '');
  assert.equal(empty.paused, false);
  assert.equal(empty.halted, false);
  assert.deepEqual(empty.graph, {});
  for (const key of ['nodes', 'sessions', 'handoffs', 'escalations', 'artifactRefs']) {
    assert.ok(Array.isArray(empty[key]), `${key} should be an array`);
  }
  assert.ok(!Number.isNaN(Date.parse(empty.writtenAt)));

  const partial = buildCheckpoint({ state: { instanceId: 'X', rev: 7 } });
  assert.equal(partial.rev, 7);
  assert.equal(partial.checkpointId, 7);
  assert.equal(partial.instanceId, 'X');
  assert.deepEqual(partial.nodes, []);
  assert.deepEqual(partial.sessions, []);

  const malformed = buildCheckpoint({
    state: {
      rev: 'bad', nodes: 'oops', sessions: null, handoffs: 42,
      escalations: 1, artifactRefs: false,
    },
  });
  assert.equal(malformed.rev, 0);
  for (const key of ['nodes', 'sessions', 'handoffs', 'escalations', 'artifactRefs']) {
    assert.deepEqual(malformed[key], []);
  }
});
