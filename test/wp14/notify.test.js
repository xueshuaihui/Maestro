/**
 * 通知域契约测试（I1.11 WP-1，AC-01 / AC-02 / AC-03 / AC-05 / AC-06 / AC-07）。
 *
 * 覆盖点：
 * - AC-01/02/03：三类事件 → 意图，标题与正文按附录 A-1 五段固定段序逐字；
 * - AC-05：总开关与三类分项关闭后不产生该类意图，重开后恢复；
 * - AC-06：升级 9999ms 抑制 / 10001ms 放行的边界；异常 60s 窗口内合并为
 *   一条（mergedCount 累加、正文含「共 N 次」）；窗口过期后按新组处理；
 * - AC-07：状态读失败 / 偏好读失败不阻断后续意图（投递在壳层，本层只产意图）；
 * - 架构锚点（AC-01/02/03/06/07 的 grep 判据）：notify.js 内零
 *   `new EventEmitter` / `setInterval` / `setTimeout` / `saveState` /
 *   `P90` / `TTL` / `throw new Error`；
 * - 与真实事件总线（createEventBus）的兼容：订阅侧拿到的记录不含
 *   instanceId，实例号一律从状态投影或 objectId 取。
 *
 * 全部时钟注入（now + schedule），不依赖真实时序；夹具不落仓库内。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createNotifier, DEDUP, NOTIFY_LABELS } from '../../src/daemon/notify.js';
import { createEventBus } from '../../src/core/event-bus.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NOTIFY_FILE = path.join(HERE, '..', '..', 'src', 'daemon', 'notify.js');

// ---------------------------------------------------------------- 夹具

/** 可拨指针与手动触发的注入时钟。 */
function makeClock(start = 0) {
  let t = start;
  const timers = [];
  return {
    now: () => t,
    advance(ms) {
      t += ms;
    },
    schedule(fn, ms) {
      const entry = { fn, at: t + ms, cancelled: false };
      timers.push(entry);
      return () => {
        entry.cancelled = true;
      };
    },
    /** 触发所有到期回调（按挂载顺序），返回触发数。 */
    fireDue() {
      let fired = 0;
      for (const e of timers) {
        if (!e.cancelled && e.at <= t) {
          e.cancelled = true;
          e.fn();
          fired += 1;
        }
      }
      return fired;
    },
    pendingCount: () => timers.filter((e) => !e.cancelled).length,
  };
}

/** 最小事件总线：subscribe + 同步广播（与既有总线语义一致）。 */
function makeBus() {
  const handlers = new Set();
  return {
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    emit(event) {
      for (const handler of [...handlers]) handler({ ...event });
    },
  };
}

/** 实例状态投影夹具（字段可缺，缺段渲染 —）。 */
function snapshot(overrides = {}) {
  return {
    instanceId: 'INST-001',
    state: 'running',
    health: { level: 'normal' },
    workflowName: '单节点',
    nodes: [{ nodeId: 'T-001', roleName: '执行者', round: 1, state: 'done' }],
    escalations: [
      {
        escalationId: 'ESC-001',
        state: 'pending',
        nodeId: 'T-001',
        round: 1,
        reasonDetail: '执行失败：测试未通过',
      },
    ],
    ...overrides,
  };
}

const escalationEvent = (escalationId = 'ESC-001', detail = undefined) => ({
  object: 'escalation',
  objectId: escalationId,
  from: null,
  to: 'pending',
  result: 'applied',
  reason: 'escalation.created',
  detail: detail ?? { nodeId: 'T-001', round: 1, reasonCode: 'execution_failed' },
});

const instanceEvent = (to, from = 'running') => ({
  object: 'instance',
  objectId: 'INST-001',
  from,
  to,
  result: 'applied',
  reason: 'state.change',
  detail: null,
});

const healthEvent = (detail = { message: '会话 mock-sess-12345-1 崩溃' }) => ({
  object: 'health',
  objectId: 'INST-001',
  from: 'normal',
  to: 'attention',
  result: 'applied',
  reason: 'health.changed',
  detail,
});

/** 后台消费 intents$；dispose 后 for-await 自然收口。 */
function collector(notifier) {
  const seen = [];
  const task = (async () => {
    try {
      for await (const intent of notifier.intents$) {
        seen.push(intent);
      }
    } catch {
      // dispose 后的收口，不视为失败。
    }
  })();
  return { seen, task };
}

async function until(fn, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fn()) return true;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return fn();
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

// ---------------------------------------------------------------- 常量与导出

test('DEDUP 窗口常量与 NOTIFY_LABELS 类别词符合附录 A-1 / A-2', () => {
  assert.deepEqual({ ...DEDUP }, { ESCALATION_MS: 10_000, ANOMALY_MS: 60_000 });
  assert.equal(NOTIFY_LABELS.CATEGORY.escalation, '升级待处理');
  assert.equal(NOTIFY_LABELS.CATEGORY.completed, '实例完成');
  assert.equal(NOTIFY_LABELS.CATEGORY.anomaly, '实例异常');
  assert.equal(NOTIFY_LABELS.SEG_MISSING, '—');
  assert.equal(NOTIFY_LABELS.SEG_SEPARATOR, ' · ');
});

test('架构锚点：notify.js 内无定时器直调 / 状态写 / 错误上抛字面量', () => {
  const text = fs.readFileSync(NOTIFY_FILE, 'utf8');
  for (const pattern of [
    'new EventEmitter',
    'setInterval',
    'setTimeout',
    'saveState',
    'P90',
    'TTL',
    'throw new Error',
  ]) {
    assert.ok(!text.includes(pattern), `notify.js 不应包含 ${pattern}`);
  }
});

// ---------------------------------------------------------------- AC-01

test('AC-01: 升级待处理事件产生升级意图，标题与正文五段逐字', async () => {
  const clock = makeClock();
  const bus = makeBus();
  const notifier = createNotifier({ bus, getInstanceStates: async () => [snapshot()], clock });
  const c = collector(notifier);

  bus.emit(escalationEvent());
  assert.ok(await until(() => c.seen.length >= 1), '升级意图未产生');
  const intent = c.seen[0];

  assert.equal(intent.kind, 'escalation');
  assert.deepEqual(intent.ids, ['ESC-001']);
  assert.equal(intent.instanceId, 'INST-001');
  assert.equal(intent.title, '通知 升级待处理 · INST-001');
  assert.equal(
    intent.body,
    '实例 INST-001 · 升级 ESC-001 · 节点 T-001 执行者 · 第 1 轮 · 执行失败：测试未通过',
  );
  assert.equal(intent.mergedCount, 1);
  assert.ok(Number.isFinite(intent.at));

  // 正文不含会话内容 / 日志正文 / 产物内容（BR-33）——即只有五个段。
  assert.equal(intent.body.split(' · ').length, 5);

  await notifier.dispose();
  await c.task;
});

test('AC-01 变体: 状态里读不到的段渲染 — 不省略', async () => {
  const clock = makeClock();
  const bus = makeBus();
  const empty = snapshot();
  empty.escalations = [
    { escalationId: 'ESC-002', state: 'pending', nodeId: null, round: null, reasonDetail: '' },
  ];
  empty.nodes = [];
  const notifier = createNotifier({ bus, getInstanceStates: async () => [empty], clock });
  const c = collector(notifier);

  bus.emit(escalationEvent('ESC-002', { reasonCode: 'execution_failed' }));
  assert.ok(await until(() => c.seen.length >= 1));
  assert.equal(
    c.seen[0].body,
    '实例 INST-001 · 升级 ESC-002 · 节点 — · 第 — 轮 · —',
  );

  await notifier.dispose();
  await c.task;
});

// ---------------------------------------------------------------- AC-02

test('AC-02: 实例完成事件产生完成意图，同一实例生命周期只一次', async () => {
  const clock = makeClock();
  const bus = makeBus();
  const states = [snapshot({ state: 'completed' })];
  const notifier = createNotifier({ bus, getInstanceStates: async () => states, clock });
  const c = collector(notifier);

  bus.emit(instanceEvent('completed'));
  assert.ok(await until(() => c.seen.length >= 1));
  const intent = c.seen[0];

  assert.equal(intent.kind, 'completed');
  assert.deepEqual(intent.ids, []);
  assert.equal(intent.title, '通知 实例完成 · INST-001');
  assert.equal(
    intent.body,
    '实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已完成，单节点 1/1',
  );
  assert.equal(intent.body.split(' · ').length, 5);
  assert.equal(intent.mergedCount, 1);

  // 同一实例的第二次完成事件不再产生意图。
  bus.emit(instanceEvent('completed'));
  await settle();
  assert.equal(c.seen.length, 1);

  await notifier.dispose();
  await c.task;
});

test('AC-02 变体: 实例不可读时完成意图仍产生，缺段渲染 —', async () => {
  const clock = makeClock();
  const bus = makeBus();
  const notifier = createNotifier({ bus, getInstanceStates: async () => [], clock });
  const c = collector(notifier);

  bus.emit(instanceEvent('completed'));
  assert.ok(await until(() => c.seen.length >= 1));
  assert.equal(c.seen[0].body, '实例 INST-001 · 升级 — · 节点 — · 第 — 轮 · 已完成');

  await notifier.dispose();
  await c.task;
});

// ---------------------------------------------------------------- AC-03

test('AC-03: 实例中断产生异常意图（单条形态），2 秒内即发且只此一条', async () => {
  const clock = makeClock();
  const bus = makeBus();
  const states = [snapshot({ state: 'interrupted', health: { level: 'ended' } })];
  const notifier = createNotifier({ bus, getInstanceStates: async () => states, clock });
  const c = collector(notifier);

  bus.emit(instanceEvent('interrupted'));
  // 首条立即发（D-46 / AC-03 / BR-01）：不进窗口等待。
  assert.ok(await until(() => c.seen.length >= 1));

  assert.equal(c.seen.length, 1);
  const intent = c.seen[0];
  assert.equal(intent.kind, 'anomaly');
  assert.deepEqual(intent.ids, []);
  assert.equal(intent.title, '通知 实例异常 · INST-001');
  assert.equal(
    intent.body,
    '实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已中断，需关注',
  );
  assert.equal(intent.body.split(' · ').length, 5);
  assert.ok(intent.body.startsWith('实例 INST-001 · 升级 — '));
  assert.ok(intent.body.includes('已中断'));
  assert.ok(intent.body.includes('需关注'));
  assert.equal(intent.mergedCount, 1);
  // 事件发生到意图产生 < 2s（注入时钟下即发，延迟为 0）。
  assert.ok(intent.at - 0 < 2_000, `首条意图延迟 ${intent.at}ms 应 < 2s`);

  // 窗口关闭定型：count === 1 只清组不发，不产生第二条。
  await settle();
  assert.equal(clock.pendingCount(), 1);
  clock.advance(60_000);
  assert.equal(clock.fireDue(), 1);
  await settle();
  assert.equal(c.seen.length, 1, '单异常在窗口关闭后不重复发');

  // 窗口过期后的新异常开启新组：首条即发。
  clock.advance(1_000);
  bus.emit(instanceEvent('interrupted'));
  assert.ok(await until(() => c.seen.length >= 2));
  assert.equal(c.seen[1].mergedCount, 1);

  await notifier.dispose();
  await c.task;
});

test('AC-03 变体: 窗口内的健康度刷新并入同组，去重后仍只算一条', async () => {
  const clock = makeClock();
  const bus = makeBus();
  const states = [snapshot({ state: 'interrupted', health: { level: 'attention' } })];
  const notifier = createNotifier({ bus, getInstanceStates: async () => states, clock });
  const c = collector(notifier);

  bus.emit(instanceEvent('interrupted'));
  assert.ok(await until(() => c.seen.length >= 1));
  assert.equal(
    c.seen[0].body,
    '实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已中断，需关注',
  );
  assert.equal(c.seen[0].mergedCount, 1);

  // 窗口内的健康度刷新并入同组：立即重发一条更新意图（合并形态、计数递增）。
  bus.emit(healthEvent({ message: '重启后健康度刷新' }));
  assert.ok(await until(() => c.seen.length >= 2));
  assert.equal(c.seen[1].mergedCount, 2);
  assert.equal(
    c.seen[1].body,
    '实例 INST-001 · 升级 — · 节点 — · 第 — 轮 · 已中断，共 2 次，最近：重启后健康度刷新',
  );
  // 按 (kind, instanceId) 意图组去重后计数 1（D-46 探针判读口径）。
  const groups = new Set(c.seen.map((i) => `${i.kind}::${i.instanceId}`));
  assert.equal(groups.size, 1);

  // 窗口关闭定型：count > 1 补发一条合并形态定稿。
  await settle();
  clock.advance(60_000);
  assert.equal(clock.fireDue(), 1);
  assert.ok(await until(() => c.seen.length >= 3));
  assert.equal(c.seen[2].mergedCount, 2);
  assert.equal(c.seen[2].body, c.seen[1].body);

  await notifier.dispose();
  await c.task;
});

test('AC-03 变体: 实例不可读时异常意图退化为事件自带的状态词', async () => {
  const clock = makeClock();
  const bus = makeBus();
  const notifier = createNotifier({ bus, getInstanceStates: async () => [], clock });
  const c = collector(notifier);

  bus.emit(instanceEvent('failed'));
  await settle();
  clock.advance(60_000);
  clock.fireDue();
  assert.ok(await until(() => c.seen.length >= 1));
  assert.equal(c.seen[0].body, '实例 INST-001 · 升级 — · 节点 — · 第 — 轮 · 失败，需关注');

  await notifier.dispose();
  await c.task;
});

// ---------------------------------------------------------------- AC-05

test('AC-05: 关掉分项后该类不产生意图，重开后恢复；总开关关掉全静默', async () => {
  const clock = makeClock();
  const bus = makeBus();
  let prefs = { enabled: true, escalate: true, completed: true, anomaly: true };
  const states = [snapshot({ state: 'completed' })];
  const notifier = createNotifier({
    bus,
    getInstanceStates: async () => states,
    clock,
    prefsRead: async () => prefs,
  });
  const c = collector(notifier);

  // 关掉「实例完成」分项 → 完成事件不产生意图。
  prefs = { ...prefs, completed: false };
  bus.emit(instanceEvent('completed'));
  await settle();
  assert.equal(c.seen.length, 0);

  // 重新打开 → 再触发一次 → 产生。
  prefs = { ...prefs, completed: true };
  bus.emit(instanceEvent('completed'));
  assert.ok(await until(() => c.seen.length >= 1));
  assert.equal(c.seen[0].kind, 'completed');

  // 关掉总开关 → 升级事件不产生意图。
  prefs = { ...prefs, enabled: false };
  bus.emit(escalationEvent());
  await settle();
  assert.equal(c.seen.length, 1);

  // 队列与托盘数字照常更新属于队列投影职责：本层关掉开关只影响意图产生。
  await notifier.dispose();
  await c.task;
});

test('AC-05 变体: 关掉升级分项不影响完成与异常两类', async () => {
  const clock = makeClock();
  const bus = makeBus();
  const states = [snapshot({ state: 'completed' })];
  const notifier = createNotifier({
    bus,
    getInstanceStates: async () => states,
    clock,
    prefsRead: async () => ({ enabled: true, escalate: false, completed: true, anomaly: true }),
  });
  const c = collector(notifier);

  bus.emit(escalationEvent());
  await settle();
  assert.equal(c.seen.length, 0, '升级分项关闭后不应产生升级意图');

  bus.emit(instanceEvent('completed'));
  assert.ok(await until(() => c.seen.length >= 1));
  assert.equal(c.seen[0].kind, 'completed');

  await notifier.dispose();
  await c.task;
});

// ---------------------------------------------------------------- AC-06

test('AC-06: 同一升级 9999ms 抑制、10001ms 放行（注入时钟边界）', async () => {
  const clock = makeClock();
  const bus = makeBus();
  const notifier = createNotifier({ bus, getInstanceStates: async () => [snapshot()], clock });
  const c = collector(notifier);

  // 第 1 条：立即产生。
  bus.emit(escalationEvent('ESC-001'));
  assert.ok(await until(() => c.seen.length >= 1));

  // 9999ms 处重复触发：仍在 10s 窗口内，抑制。
  clock.advance(9999);
  bus.emit(escalationEvent('ESC-001'));
  await settle();
  assert.equal(c.seen.length, 1);

  // 10001ms 处再触发：窗口已过，放行第 2 条。
  clock.advance(2); // 累计 10001ms
  bus.emit(escalationEvent('ESC-001'));
  assert.ok(await until(() => c.seen.length >= 2));
  assert.equal(c.seen[1].mergedCount, 1);

  await notifier.dispose();
  await c.task;
});

test('AC-06: 不同升级编号互不影响去重窗口', async () => {
  const clock = makeClock();
  const bus = makeBus();
  const states = [
    snapshot(),
    snapshot({
      instanceId: 'INST-002',
      state: 'running',
      nodes: [{ nodeId: 'T-001', roleName: '测试', round: 1, state: 'running' }],
      escalations: [
        { escalationId: 'ESC-002', state: 'pending', nodeId: 'T-001', round: 1, reasonDetail: '执行失败：命令超时' },
      ],
    }),
  ];
  const notifier = createNotifier({ bus, getInstanceStates: async () => states, clock });
  const c = collector(notifier);

  bus.emit(escalationEvent('ESC-001'));
  assert.ok(await until(() => c.seen.length >= 1));
  bus.emit(escalationEvent('ESC-002'));
  assert.ok(await until(() => c.seen.length >= 2));
  assert.equal(c.seen[0].instanceId, 'INST-001');
  assert.equal(c.seen[1].instanceId, 'INST-002');

  await notifier.dispose();
  await c.task;
});

test('AC-06: 同一实例同类异常 60s 窗口内合并，mergedCount [1,2,3,4] 单调递增', async () => {
  const clock = makeClock();
  const bus = makeBus();
  const states = [snapshot({ state: 'interrupted' })];
  const notifier = createNotifier({ bus, getInstanceStates: async () => states, clock });
  const c = collector(notifier);

  // 4 次同类异常：第 2~4 次间隔 5s（AC-06 When ③）。每次先让事件泵处理完
  // 再拨时钟，保证合并组的挂载时刻与首次异常对齐。
  bus.emit(instanceEvent('interrupted'));
  assert.ok(await until(() => c.seen.length >= 1), '首条异常立即产生意图');
  clock.advance(5_000);
  bus.emit(healthEvent({ message: '会话 mock-sess-12345-1 崩溃' }));
  assert.ok(await until(() => c.seen.length >= 2));
  clock.advance(5_000);
  bus.emit(instanceEvent('failed'));
  assert.ok(await until(() => c.seen.length >= 3));
  clock.advance(5_000);
  bus.emit(instanceEvent('interrupted'));
  assert.ok(await until(() => c.seen.length >= 4));

  // 意图组去重后计数 1（D-46 探针判读口径：壳层按 (kind, instanceId) 替换呈现）。
  const groups = new Set(c.seen.map((i) => `${i.kind}::${i.instanceId}`));
  assert.equal(groups.size, 1);
  assert.deepEqual(
    c.seen.map((i) => i.mergedCount),
    [1, 2, 3, 4],
    'mergedCount 单调递增',
  );
  // 首条 at 与首次异常的间隔 < 2s（对齐 AC-03 / BR-01）。
  assert.ok(c.seen[0].at - 0 < 2_000, `首条意图延迟 ${c.seen[0].at}ms 应 < 2s`);

  // 末条匹配 A-1 合并形态：段数 5、含「共 4 次」与最近原因。
  const last = c.seen[c.seen.length - 1];
  assert.equal(last.mergedCount, 4);
  assert.equal(
    last.body,
    '实例 INST-001 · 升级 — · 节点 — · 第 — 轮 · 已中断，共 4 次，最近：会话 mock-sess-12345-1 崩溃',
  );
  assert.equal(last.body.split(' · ').length, 5, '合并形态段数仍为 5');

  // 窗口关闭定型：count > 1 补发一条定稿（正文与末条更新一致）。
  await settle();
  clock.advance(45_000); // 距首次 60s
  assert.equal(clock.fireDue(), 1);
  assert.ok(await until(() => c.seen.length >= 5));
  assert.equal(c.seen[4].mergedCount, 4);
  assert.equal(c.seen[4].body, last.body);

  await notifier.dispose();
  await c.task;
});

test('AC-06: 异常窗口 59999ms 内并入、60001ms 起按新组即发', async () => {
  const clock = makeClock();
  const bus = makeBus();
  const notifier = createNotifier({ bus, getInstanceStates: async () => [snapshot({ state: 'failed' })], clock });
  const c = collector(notifier);

  // 首条立即发（D-46）。
  bus.emit(instanceEvent('failed'));
  assert.ok(await until(() => c.seen.length >= 1));
  assert.equal(c.seen[0].mergedCount, 1);
  assert.ok(await until(() => clock.pendingCount() >= 1));

  // 59999ms 处仍在窗口内：并入并立即重发更新意图（mc 2）。
  clock.advance(59_999);
  bus.emit(instanceEvent('failed'));
  assert.ok(await until(() => c.seen.length >= 2));
  assert.equal(c.seen[1].mergedCount, 2);
  assert.equal(
    c.seen[1].body,
    '实例 INST-001 · 升级 — · 节点 — · 第 — 轮 · 失败，共 2 次',
  );

  // 60_000ms：窗口回调到期，count > 1 发定型。
  clock.advance(1);
  assert.equal(clock.fireDue(), 1);
  assert.ok(await until(() => c.seen.length >= 3));
  assert.equal(c.seen[2].mergedCount, 2);
  assert.equal(c.seen[2].body, c.seen[1].body);

  // 60001ms 处的新异常开启新组：首条即发（mc 1），60s 定型时 count === 1 不发。
  clock.advance(1);
  bus.emit(instanceEvent('failed'));
  assert.ok(await until(() => c.seen.length >= 4));
  assert.equal(c.seen[3].mergedCount, 1);
  assert.equal(
    c.seen[3].body,
    '实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 失败，需关注',
  );
  await settle();
  assert.equal(clock.pendingCount(), 1, '新组挂着一个窗口回调');
  clock.advance(60_000);
  clock.fireDue();
  await settle();
  assert.equal(c.seen.length, 4, '单异常新组定型时不补发');

  await notifier.dispose();
  await c.task;
});

// ---------------------------------------------------------------- AC-07

test('AC-07: 状态投影读失败不阻断后续意图（3 条不同升级逐条产生）', async () => {
  const clock = makeClock();
  const bus = makeBus();
  let calls = 0;
  // 三条升级在状态里都在 pending（真实流程：落盘先于广播）。
  const states = [
    snapshot(),
    snapshot({
      instanceId: 'INST-002',
      escalations: [
        { escalationId: 'ESC-002', state: 'pending', nodeId: 'T-001', round: 1, reasonDetail: '执行失败：命令超时' },
      ],
    }),
    snapshot({
      instanceId: 'INST-003',
      escalations: [
        { escalationId: 'ESC-003', state: 'pending', nodeId: 'T-001', round: 1, reasonDetail: '执行失败：核对未过' },
      ],
    }),
  ];
  const notifier = createNotifier({
    bus,
    getInstanceStates: async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('状态不可读');
      return states;
    },
    clock,
  });
  const c = collector(notifier);

  bus.emit(escalationEvent('ESC-001'));
  await settle();
  assert.equal(c.seen.length, 0, '状态读失败时该条意图丢弃但不崩溃');

  bus.emit(escalationEvent('ESC-002'));
  bus.emit(escalationEvent('ESC-003'));
  await settle();
  assert.ok(await until(() => c.seen.length >= 2), '后续升级意图照常产生');
  assert.deepEqual(c.seen.map((i) => i.ids[0]), ['ESC-002', 'ESC-003']);

  await notifier.dispose();
  await c.task;
});

test('AC-07: 偏好读取抛错按全开缺省处理，不阻断意图', async () => {
  const clock = makeClock();
  const bus = makeBus();
  const notifier = createNotifier({
    bus,
    getInstanceStates: async () => [snapshot()],
    clock,
    prefsRead: async () => {
      throw new TypeError('偏好不可读');
    },
  });
  const c = collector(notifier);

  bus.emit(escalationEvent());
  assert.ok(await until(() => c.seen.length >= 1));

  await notifier.dispose();
  await c.task;
});

test('AC-07: 由新升级引起的异常信号被抑制，避免与升级意图重复', async () => {
  const clock = makeClock();
  const bus = makeBus();
  const states = [snapshot({ state: 'running', health: { level: 'attention' } })];
  const notifier = createNotifier({ bus, getInstanceStates: async () => states, clock });
  const c = collector(notifier);

  // 升级创建（真实流程中健康度会因待处理升级转「需关注」）。
  bus.emit(escalationEvent());
  assert.ok(await until(() => c.seen.length >= 1));

  // 紧随其后的健康度刷新不应重复产生异常意图。
  clock.advance(1_000);
  bus.emit(healthEvent());
  await settle();
  clock.advance(60_000);
  clock.fireDue();
  await settle();
  assert.equal(c.seen.length, 1, '升级窗口内的异常信号不产生第二条意图');

  // 升级窗口之外的新异常按新事实正常发出（首条即发，D-46）。
  clock.advance(11_000);
  bus.emit(healthEvent());
  assert.ok(await until(() => c.seen.length >= 2));
  assert.equal(c.seen[1].kind, 'anomaly');

  // 定型：count === 1 只清组不发，不产生第三条。
  await settle();
  clock.advance(60_000);
  clock.fireDue();
  await settle();
  assert.equal(c.seen.length, 2);

  await notifier.dispose();
  await c.task;
});

// ---------------------------------------------------------------- 生命周期

test('dispose 后事件不再产生意图，窗口回调被取消', async () => {
  const clock = makeClock();
  const bus = makeBus();
  const notifier = createNotifier({ bus, getInstanceStates: async () => [snapshot({ state: 'failed' })], clock });
  const c = collector(notifier);

  // 首条即发（D-46）。
  bus.emit(instanceEvent('failed'));
  assert.ok(await until(() => c.seen.length >= 1));
  await settle();
  assert.equal(clock.pendingCount(), 1);

  notifier.dispose();
  await c.task;

  clock.advance(60_000);
  clock.fireDue(); // 已取消，且 count === 1 定型本就不发
  await settle();
  assert.equal(c.seen.length, 1);

  bus.emit(escalationEvent());
  await settle();
  assert.equal(c.seen.length, 1);
});

test('intents$ 与真实事件总线兼容：订阅侧记录不含 instanceId', async () => {
  // 内存 store：appendEvent / nextSeq 最小实现。
  const store = {
    async nextSeq() {
      return 1;
    },
    async appendEvent() {
      return { ok: true };
    },
  };
  const bus = createEventBus({ store });
  const clock = makeClock();
  const notifier = createNotifier({ bus, getInstanceStates: async () => [snapshot()], clock });
  const c = collector(notifier);

  // 真实总线广播的记录不含 instanceId：实例号从状态投影取。
  await bus.emit({ instanceId: 'INST-001', ...escalationEvent() });
  assert.ok(await until(() => c.seen.length >= 1), '真实总线广播的升级事件应产生意图');
  assert.equal(c.seen[0].instanceId, 'INST-001');
  assert.equal(c.seen[0].kind, 'escalation');

  await notifier.dispose();
  await c.task;
});

test('升级事件在状态里找不到待处理条目时不发过期意图', async () => {
  const clock = makeClock();
  const bus = makeBus();
  const resolved = snapshot();
  resolved.escalations = [
    { escalationId: 'ESC-001', state: 'resolved', nodeId: 'T-001', round: 1, reasonDetail: 'x' },
  ];
  const notifier = createNotifier({ bus, getInstanceStates: async () => [resolved], clock });
  const c = collector(notifier);

  bus.emit(escalationEvent('ESC-001'));
  await settle();
  assert.equal(c.seen.length, 0);

  await notifier.dispose();
  await c.task;
});

test('未注入 schedule 时异常合并退化为即发 + 窗口抑制', async () => {
  const bus = makeBus();
  const clock = makeClock();
  const notifier = createNotifier({
    bus,
    getInstanceStates: async () => [snapshot({ state: 'failed' })],
    clock: { now: clock.now }, // 无 schedule
  });
  const c = collector(notifier);

  bus.emit(instanceEvent('failed'));
  assert.ok(await until(() => c.seen.length >= 1), '首条异常立即产生意图');
  assert.equal(
    c.seen[0].body,
    '实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 失败，需关注',
  );

  clock.advance(10_000);
  bus.emit(instanceEvent('failed'));
  await settle();
  assert.equal(c.seen.length, 1, '窗口内的后续异常被抑制');

  await notifier.dispose();
  await c.task;
});
