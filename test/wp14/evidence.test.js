/**
 * I1.11 WP-6 契约测试：证据投影（src/daemon/evidence.js）。
 *
 * 覆盖：AC-32（两次尝试只取最近一次的五项 + 轮次来自节点 + 逐字段契约）、
 * AC-33（从未执行 / 产物缺失 / 日志缺失三现场：缺项数据位 null、引用不可读
 * 只影响单项、切换节点不崩溃）、AC-34（不泄露日志正文与会话对话文本、体积
 * 上限、无导出/预览类动作字段、源码级 grep 机检）。另补两条真实运行现场
 * （mock 宿主 --fail-tool / --write-ref），验证三数据源端到端同源。
 *
 * 夹具：$TMPDIR 独立根（短前缀 wp14e-，受 macOS socket 路径上限约束）；
 * 按 D-45「真实路径」口径：真实 store 落 state.json + events.jsonl，日志与
 * 产物文件真实落盘；真实运行用 mock 宿主走产品同一条装配链。每个用例自建自清。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

import {
  buildEvidence,
  EVIDENCE_ITEM_KEYS,
  EVIDENCE_LABELS,
} from '../../src/daemon/evidence.js';
import { createAcpClient } from '../../src/adapter/acp-client.js';
import { createStdioTransport } from '../../src/adapter/stdio-transport.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { createStore } from '../../src/persistence/instance-store.js';

const MOCK = path.resolve('test/fixtures/mock-acp-agent.js');
const LIMITS = {
  initializeTimeoutMs: 8000,
  requestTimeoutMs: 8000,
  promptTimeoutMs: 8000,
  quietIdleMs: 30,
  quietCapMs: 200,
};
const CODE_TASK = '给 calc.js 补 div 函数，让 node --test 全绿。改动写在 calc.js\n产物：calc.js';

// ------------------------------------------------------------------ 临时目录

const tempDirs = [];

function makeRoot(tag) {
  // 前缀必须短：<root>/.orch/core.sock 受 macOS 104 字节路径上限约束。
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `wp14e-${tag}-`));
  tempDirs.push(dir);
  return dir;
}

after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------------------------------ 夹具

function craftedState({ instanceId, cwd, nodes, state = 'completed' }) {
  return {
    schemaVersion: 2,
    instanceId,
    state,
    halted: false,
    paused: false,
    rev: 0,
    template: 'code-loop',
    task: CODE_TASK,
    cwd,
    createdAt: '2026-11-15T10:00:00.000Z',
    stateSince: '2026-11-15T10:00:00.000Z',
    counters: { eventSeq: 0, runCount: 1, dispatchCount: 1 },
    nodes,
    sessions: [],
    handoffs: [],
    escalations: [],
    approvals: [],
  };
}

/** 真实 execution.summary 事件的同形事件（字段形状对齐 orchestrator 写入点）。 */
function summaryEvent(seq, nodeId, round, summary) {
  return {
    seq,
    ts: '2026-11-15T10:30:00.000Z',
    object: 'session',
    objectId: `sess-${seq}`,
    result: 'note',
    reason: 'execution.summary',
    detail: { nodeId, round, summary },
  };
}

async function appendAll(store, instanceId, events) {
  for (const event of events) {
    const res = await store.appendEvent(instanceId, event);
    assert.equal(res.ok, true, JSON.stringify(res));
  }
}

function nodeOf(items, nodeId) {
  const hit = items.find((item) => item.nodeId === nodeId);
  assert.ok(hit, `应有节点 ${nodeId} 的条目`);
  return hit;
}

// ------------------------------------------------------------------ AC-32

test('buildEvidence：两次尝试只取最近一次，五项齐全且轮次来自节点（AC-32 / D-7）', async () => {
  const root = makeRoot('ac32');
  const cwd = makeRoot('ac32-cwd');
  const store = createStore({ root });
  await store.save(
    'INST-001',
    craftedState({
      instanceId: 'INST-001',
      cwd,
      nodes: [
        { nodeId: 'T-001', state: 'pending', round: 0, roleId: 'planner', artifactRefs: [] },
        { nodeId: 'T-002', state: 'running', round: 1, roleId: 'worker', artifactRefs: [] },
        {
          nodeId: 'T-003',
          state: 'done',
          round: 2,
          roleId: 'developer',
          sessionId: 'sess-2',
          artifactRefs: [
            { ref: 'calc.js', bytes: 26, sha256: 'a'.repeat(8), verifiedAt: '2026-11-15T10:30:00Z' },
          ],
        },
      ],
    }),
  );
  fs.mkdirSync(path.join(cwd, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'logs', 'T-003-2.txt'), 'log-body-marker 不应出现在投影里\n', 'utf8');
  fs.writeFileSync(path.join(cwd, 'calc.js'), 'module.exports = { div: (a, b) => a / b };\n', 'utf8');
  await appendAll(store, 'INST-001', [
    summaryEvent(1, 'T-003', 1, {
      command: 'npm run lint',
      exitCode: 2,
      keyOutputLines: 4,
      logRef: 'logs/T-003-1.txt',
    }),
    summaryEvent(2, 'T-003', 2, {
      command: 'npm test',
      exitCode: 1,
      keyOutputLines: 12,
      logRef: 'logs/T-003-2.txt',
    }),
  ]);

  const single = await buildEvidence(root, 'INST-001', 'T-003');
  assert.deepEqual(Object.keys(single), ['instanceId', 'items']);
  assert.equal(single.instanceId, 'INST-001');
  assert.equal(single.items.length, 1, '按节点选择只出该节点');

  const item = single.items[0];
  assert.deepEqual(Object.keys(item), EVIDENCE_ITEM_KEYS, '固定八字段模板，顺序即契约序');
  assert.equal(item.nodeId, 'T-003');
  assert.equal(item.round, 2, '轮次取节点 round（③），不是事件里的轮次');
  assert.equal(item.command, 'npm test');
  assert.equal(item.exitCode, 1);
  assert.equal(item.keyOutputLines, 12);
  assert.equal(item.logRef, 'logs/T-003-2.txt');
  assert.deepEqual(item.artifactRefs, [
    { ref: 'calc.js', bytes: 26, sha256: 'a'.repeat(8), verifiedAt: '2026-11-15T10:30:00Z' },
  ], '产物引用含校验时间原值透传（①）');
  assert.deepEqual(item.unreadable, [], '两个引用都真实存在 → 无不可读登记');

  const text = JSON.stringify(single);
  assert.equal(text.includes('npm run lint'), false, '第 1 轮命令不出现（不把两次尝试拼在一起）');
  assert.equal(text.includes('logs/T-003-1.txt'), false, '第 1 轮日志引用不出现');
  assert.equal(text.includes('log-body-marker'), false, '日志正文不出现');

  const all = await buildEvidence(root, 'INST-001', null);
  assert.deepEqual(all.items.map((row) => row.nodeId), ['T-001', 'T-002', 'T-003'], 'null = 全部节点，顺序 = 节点定义序');
  assert.deepEqual(nodeOf(all.items, 'T-001').command, null);
  assert.deepEqual(nodeOf(all.items, 'T-001').artifactRefs, null);
  assert.deepEqual(nodeOf(all.items, 'T-001').unreadable, []);

  assert.equal(EVIDENCE_LABELS.UNPROVIDED, '未提供');
  assert.equal(EVIDENCE_LABELS.LOG_ON_HOST, '完整日志留在宿主');
  assert.equal(EVIDENCE_LABELS.UNREADABLE, '引用不可读');
});

// ------------------------------------------------------------------ AC-33

test('buildEvidence：从未执行 / 产物缺失 / 日志缺失三现场，缺项 null、单项不可读不牵连（AC-33 / BR-21）', async () => {
  const root = makeRoot('ac33');
  const cwd = makeRoot('ac33-cwd');
  const store = createStore({ root });
  await store.save(
    'INST-001',
    craftedState({
      instanceId: 'INST-001',
      cwd,
      nodes: [
        { nodeId: 'T-101', state: 'pending', round: 0, roleId: 'planner', artifactRefs: [] },
        {
          nodeId: 'T-102',
          state: 'done',
          round: 3,
          roleId: 'developer',
          artifactRefs: [{ ref: 'nope.js', bytes: 1, sha256: null, verifiedAt: '2026-11-15T11:00:00Z' }],
        },
        {
          nodeId: 'T-103',
          state: 'done',
          round: 1,
          roleId: 'worker',
          artifactRefs: [{ ref: 'present.js', bytes: 3, sha256: null, verifiedAt: '2026-11-15T11:00:00Z' }],
        },
      ],
    }),
  );
  fs.writeFileSync(path.join(cwd, 'present.js'), 'ok\n', 'utf8');
  fs.mkdirSync(path.join(cwd, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'logs', 'T-102.txt'), 'ok\n', 'utf8');
  await appendAll(store, 'INST-001', [
    summaryEvent(1, 'T-102', 3, {
      command: 'node nope.js',
      exitCode: 0,
      keyOutputLines: 2,
      logRef: 'logs/T-102.txt',
    }),
    summaryEvent(2, 'T-103', 1, {
      command: 'node present.js',
      exitCode: 1,
      keyOutputLines: 5,
      logRef: 'logs/absent.txt',
    }),
  ]);

  const never = await buildEvidence(root, 'INST-001', 'T-101');
  const neverRow = never.items[0];
  assert.equal(neverRow.round, 0, '从未执行节点轮次仍来自节点');
  for (const key of ['command', 'exitCode', 'keyOutputLines', 'logRef', 'artifactRefs']) {
    assert.equal(neverRow[key], null, `五项缺项的数据位是 null（界面渲染「未提供」）：${key}`);
  }
  assert.deepEqual(neverRow.unreadable, [], '无引用就无不可读登记');

  const missingArtifact = await buildEvidence(root, 'INST-001', 'T-102');
  const artifactRow = missingArtifact.items[0];
  assert.deepEqual(artifactRow.unreadable, ['nope.js'], '产物引用不存在 → 该引用值登记进 unreadable');
  assert.deepEqual(artifactRow.artifactRefs, [
    { ref: 'nope.js', bytes: 1, sha256: null, verifiedAt: '2026-11-15T11:00:00Z' },
  ], '引用不可读时引用值本身保留，其余四项照常');
  assert.equal(artifactRow.command, 'node nope.js');
  assert.equal(artifactRow.exitCode, 0);
  assert.equal(artifactRow.keyOutputLines, 2);
  assert.equal(artifactRow.logRef, 'logs/T-102.txt', '日志引用照常');

  const missingLog = await buildEvidence(root, 'INST-001', 'T-103');
  const logRow = missingLog.items[0];
  assert.deepEqual(logRow.unreadable, ['logs/absent.txt'], '日志引用不存在 → 只登记日志项');
  assert.equal(logRow.logRef, 'logs/absent.txt');
  assert.deepEqual(logRow.artifactRefs, [
    { ref: 'present.js', bytes: 3, sha256: null, verifiedAt: '2026-11-15T11:00:00Z' },
  ], '产物引用真实存在 → 不进 unreadable');
  assert.equal(logRow.command, 'node present.js');
  assert.equal(logRow.exitCode, 1);
  assert.equal(logRow.keyOutputLines, 5);

  const all = await buildEvidence(root, 'INST-001', null);
  assert.equal(all.items.length, 3, '三节点都能取到，切换不崩溃、行不省略');
  const flagged = all.items.filter((row) => row.unreadable.length > 0);
  assert.deepEqual(flagged.map((row) => row.unreadable[0]), ['nope.js', 'logs/absent.txt'], '两处「引用不可读」位置正确');
});

// ------------------------------------------------------------------ AC-34

test('buildEvidence：不泄露日志正文与会话对话文本，体积远低于 64 KB（AC-34 / BR-21）', async () => {
  const root = makeRoot('ac34');
  const cwd = makeRoot('ac34-cwd');
  const store = createStore({ root });
  await store.save(
    'INST-001',
    craftedState({
      instanceId: 'INST-001',
      cwd,
      nodes: [
        {
          nodeId: 'T-201',
          state: 'done',
          round: 1,
          roleId: 'developer',
          artifactRefs: [],
        },
      ],
    }),
  );
  const lines = [];
  for (let i = 1; i <= 5000; i += 1) {
    lines.push(i === 1 ? 'biglog-first-不可泄露-A' : i === 5000 ? 'biglog-last-不可泄露-Z' : `biglog-line-${i}`);
  }
  fs.mkdirSync(path.join(cwd, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'logs', 'big.log'), `${lines.join('\n')}\n`, 'utf8');
  await appendAll(store, 'INST-001', [
    summaryEvent(1, 'T-201', 1, {
      command: 'node run.js',
      exitCode: 1,
      keyOutputLines: 5000,
      logRef: 'logs/big.log',
    }),
    {
      seq: 2,
      ts: '2026-11-15T10:31:00.000Z',
      object: 'session',
      objectId: 'sess-9',
      result: 'note',
      reason: 'session.message',
      detail: { text: '对话正文-机密片段-不得出现在证据里' },
    },
  ]);

  const result = await buildEvidence(root, 'INST-001', 'T-201');
  const text = JSON.stringify(result);
  const bytes = Buffer.byteLength(text, 'utf8');
  assert.equal(text.includes('biglog-first-不可泄露-A'), false, '日志第 1 行不出现');
  assert.equal(text.includes('biglog-last-不可泄露-Z'), false, '日志第 5000 行不出现');
  assert.equal(text.includes('对话正文-机密片段'), false, '会话对话文本不出现');
  assert.equal(text.includes('logs/big.log'), true, '只出现引用路径');
  assert.ok(bytes <= 65536, `单次投影序列化 ≤ 65536 字节，实际 ${bytes}`);

  const item = result.items[0];
  assert.deepEqual(Object.keys(item), EVIDENCE_ITEM_KEYS, '只含契约八字段');
  for (const banned of ['export', 'preview', 'openLog']) {
    assert.equal(Object.hasOwn(item, banned), false, `不得出现动作键 ${banned}`);
  }

  // 体积护栏：超长 command 截断并登记，投影总量仍受控。
  await appendAll(store, 'INST-001', [
    summaryEvent(3, 'T-201', 2, { command: 'c'.repeat(10000), exitCode: 2 }),
  ]);
  const guarded = await buildEvidence(root, 'INST-001', 'T-201');
  const guardedRow = guarded.items[0];
  assert.equal(guardedRow.command.length, 2048, '超限 command 截断到上限');
  assert.ok(guardedRow.unreadable.includes(`${EVIDENCE_LABELS.TRUNCATED}：command`), '截断在 unreadable 登记');
  assert.ok(Buffer.byteLength(JSON.stringify(guarded), 'utf8') <= 65536, '截断后总量仍 ≤ 64 KB');

  // 源码级机检（AC-32 / AC-34 架构检查的等价断言）。
  const source = fs.readFileSync(path.resolve('src/daemon/evidence.js'), 'utf8');
  assert.equal(/readFileSync|createReadStream/.test(source), false, 'evidence.js 无读正文调用');
  assert.equal(/session\/update|delta/.test(source), false, 'evidence.js 不触碰会话消息通道');
});

// ------------------------------------------------- 真实运行现场（D-45 真实路径）

function sanitizedEnv() {
  const env = { ...process.env };
  delete env.MAESTRO_DSH_EXE;
  delete env.MAESTRO_DSH_BIN;
  delete env.MAESTRO_DSH_ARGS;
  delete env.MAESTRO_PERMISSION_POLICY;
  return env;
}

function makeMockFactory({ switches = [] } = {}) {
  return {
    async create({ cwd }) {
      const transport = createStdioTransport({
        command: process.execPath,
        args: [MOCK, ...switches],
        env: sanitizedEnv(),
        cwd,
      });
      const client = createAcpClient({ transport, limits: LIMITS });
      return {
        async initialize() {
          const spawned = await transport.spawn();
          if (!spawned.ok) {
            return {
              ok: false,
              error: { code: spawned.code, message: spawned.params?.cause ?? spawned.code },
            };
          }
          return client.initialize();
        },
        newSession: (params) => client.newSession(params),
        prompt: (sessionId, blocks) => client.prompt(sessionId, blocks),
        cancel: (sessionId) => client.cancel(sessionId),
        closeSession: (sessionId) => client.closeSession(sessionId),
        onUpdate: (cb) => client.onUpdate(cb),
        onPermission: (cb) => client.onPermission(cb),
        dispose: () => client.dispose(),
      };
    },
  };
}

async function bootReal(tag, { switches = [] } = {}) {
  const root = makeRoot(`${tag}-root`);
  const cwd = makeRoot(`${tag}-cwd`);
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const orchestrator = createOrchestrator({
    store,
    bus,
    adapterFactory: makeMockFactory({ switches }),
    generation: 'gen-wp14',
    env: { NODE_ENV: 'test' },
  });
  const started = await orchestrator.startRun({ cwd, task: CODE_TASK, earlyReturn: true });
  assert.equal(started.ok, true, JSON.stringify(started));
  return { root, cwd, store, orch: orchestrator, async teardown() { await orchestrator.dispose(); } };
}

async function waitFor(predicate, { timeoutMs = 15_000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() > deadline) throw new Error('waitFor 超时');
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

test('真实运行·失败摘要：mock 宿主 --fail-tool 后四要素 + 轮次齐全（AC-32 数据源端到端）', async () => {
  const env = await bootReal('real-fail', { switches: ['--fail-tool'] });
  try {
    await waitFor(async () => {
      const evidence = await buildEvidence(env.root, 'INST-001', 'T-001');
      return evidence.items.length === 1 && evidence.items[0].command !== null;
    });

    const evidence = await buildEvidence(env.root, 'INST-001', 'T-001');
    const item = evidence.items[0];
    assert.equal(item.nodeId, 'T-001');
    assert.equal(item.round, 1, '轮次来自真实快照节点字段');
    assert.equal(item.command, 'node out/run.js');
    assert.equal(item.exitCode, 1);
    assert.equal(item.keyOutputLines, 3);
    assert.equal(item.logRef, 'host-logs/T-001.log', '夹具只给引用字符串，不创建日志');
    assert.deepEqual(item.unreadable, ['host-logs/T-001.log'], '宿主日志真实不存在 → 登记不可读');
    assert.equal(item.artifactRefs, null, '失败步骤不落产物 → 缺项 null');

    const all = await buildEvidence(env.root, 'INST-001', null);
    assert.equal(all.items.length >= 1, true, '全节点视图能出条目');
    assert.deepEqual(
      all.items.find((row) => row.nodeId === 'T-001').command,
      'node out/run.js',
      '全节点视图与按节点选择同源',
    );
  } finally {
    await env.teardown();
  }
});

test('真实运行·产物引用：mock 宿主 --write-ref 后 artifactRefs 含校验时间且真实可读（数据源①端到端）', async () => {
  const env = await bootReal('real-refs', { switches: ['--write-ref', 'calc.js'] });
  try {
    await waitFor(async () => {
      const evidence = await buildEvidence(env.root, 'INST-001', 'T-001');
      return evidence.items.length === 1 && evidence.items[0].artifactRefs !== null;
    });

    const evidence = await buildEvidence(env.root, 'INST-001', 'T-001');
    const item = evidence.items[0];
    assert.equal(item.artifactRefs.length, 1);
    const ref = item.artifactRefs[0];
    assert.equal(ref.ref, 'calc.js');
    assert.equal(typeof ref.verifiedAt, 'string', '真实运行写入 verifiedAt');
    assert.ok(ref.verifiedAt.length > 0);
    assert.deepEqual(item.unreadable, [], '产物真实落盘 → 无不可读登记');

    const onDisk = fs.statSync(path.join(env.cwd, 'calc.js'));
    assert.equal(ref.bytes, onDisk.size, 'bytes 与磁盘现值一致（原值透传）');
  } finally {
    await env.teardown();
  }
});
