import test from 'node:test';
import assert from 'node:assert/strict';

import { exitCodeFor, main, parseArgs } from '../../src/cli/main.js';

const silent = () => {};

test('parseArgs：run 需要 --cwd 与 --task', () => {
  const ok = parseArgs(['run', '--cwd', './demo', '--task', '写一段产品说明', '--instance', 'INST-001']);
  assert.equal(ok.ok, true);
  assert.equal(ok.command, 'run');
  assert.deepEqual(ok.flags, { cwd: './demo', task: '写一段产品说明', instance: 'INST-001' });

  assert.equal(parseArgs(['run', '--cwd', './demo']).ok, false);
  assert.equal(parseArgs(['run', '--task', 'x']).ok, false);
  assert.equal(parseArgs(['run']).ok, false);
});

test('parseArgs：status 支持 --instance 与 --events', () => {
  assert.equal(parseArgs(['status']).ok, true);
  const parsed = parseArgs(['status', '--instance', 'INST-001', '--events']);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.flags, { instance: 'INST-001', events: true });
});

test('parseArgs：cancel 需要 --instance；core 只接受 stop', () => {
  assert.equal(parseArgs(['cancel']).ok, false);
  assert.equal(parseArgs(['cancel', '--instance', 'INST-001']).ok, true);

  assert.equal(parseArgs(['core']).ok, false);
  assert.equal(parseArgs(['core', 'stop']).ok, true);
  // `core serve` 由 bin/orch.js 截走，不该走到 main 的命令表
  assert.equal(parseArgs(['core', 'serve', '--project', 'D:/x']).ok, false);
});

test('parseArgs：未知命令 / 未知参数 / 缺值都是用法错误', () => {
  assert.equal(parseArgs([]).ok, false);
  assert.equal(parseArgs(['bogus']).ok, false);
  assert.equal(parseArgs(['status', '--nope']).ok, false);
  assert.equal(parseArgs(['status', '--instance']).ok, false);
  assert.equal(parseArgs(['run', '--cwd']).ok, false);
  assert.equal(parseArgs(['status', 'extra']).ok, false);
});

test('parseArgs：--key=value 形式可用', () => {
  const parsed = parseArgs(['run', '--cwd=./demo', '--task=hello world']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.flags.cwd, './demo');
  assert.equal(parsed.flags.task, 'hello world');
});

test('exitCodeFor：三类开始前失败是 3，其余是 1', () => {
  assert.equal(exitCodeFor('DSH_SPAWN_FAILED'), 3);
  assert.equal(exitCodeFor('CWD_NOT_WRITABLE'), 3);
  assert.equal(exitCodeFor('CORE_START_FAILED'), 3);
  assert.equal(exitCodeFor('NODE_BUSY'), 1);
  assert.equal(exitCodeFor('SESSION_INVALID'), 1);
  assert.equal(exitCodeFor('PERMISSION_DENIED'), 1);
  assert.equal(exitCodeFor('HOST_ERROR'), 1);
  assert.equal(exitCodeFor('VERIFY_FAILED'), 1);
  assert.equal(exitCodeFor('UNKNOWN_ERROR'), 1);
  assert.equal(exitCodeFor('STATE_CORRUPT'), 1);
  assert.equal(exitCodeFor('INSTANCE_TERMINAL'), 1);
});

test('main：用法错误退出码 2，且只打用法摘要（不连核心）', async () => {
  const cases = [[], ['bogus'], ['run', '--cwd', 'x'], ['run'], ['cancel'], ['core'], ['status', '--nope']];
  for (const argv of cases) {
    const lines = [];
    const code = await main(argv, { out: (line) => lines.push(line), createClient: () => assert.fail('用法错误不得连核心') });
    assert.equal(code, 2, `argv=${JSON.stringify(argv)}`);
    assert.ok(lines.some((line) => line.includes('orch run|status|cancel|core')), '应打印用法摘要');
  }
});

test('main：--cwd 相对当前 shell 目录解析，不作为项目根', async () => {
  const calls = [];
  const fake = {
    connect: async () => ({ ok: true, coldStart: false, elapsedMs: 0, pid: 1, generation: 'gen' }),
    request: async (method, params) => {
      calls.push({ method, params });
      if (method === 'run.start') return { ok: false, code: 'NODE_BUSY', params: {} };
      return { ok: true, result: {} };
    },
    subscribe: () => () => {},
    close: async () => {},
  };

  const lines = [];
  const code = await main(['run', '--cwd', 'demo', '--task', 't'], {
    cwd: 'D:/work/demo-project',
    out: (line) => lines.push(line),
    createClient: (root) => {
      assert.equal(root, 'D:\\work\\demo-project');
      return fake;
    },
  });

  assert.equal(code, 1);
  // 命令面只允许出现“该节点正在执行”，绝不能出现“会话已失效”（AC-07）
  assert.deepEqual(lines, ['该节点正在执行，本次未发起']);
  const started = calls.find((call) => call.method === 'run.start');
  assert.equal(started.params.cwd, 'D:\\work\\demo-project\\demo');
  assert.ok(!calls.some((call) => call.method === 'instance.subscribe'));
});

// ================================================================ I1.2 / WP-5

test('parseArgs：--template / --host 是合法的 run 参数（M-8）', () => {
  const parsed = parseArgs([
    'run',
    '--cwd',
    './demo',
    '--task',
    '给 calc.js 补 div；产物：calc.js',
    '--template',
    'code-loop',
    '--host',
    'mock',
  ]);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.flags.template, 'code-loop');
  assert.equal(parsed.flags.host, 'mock');

  // `--template` 不再被当成未知参数（退出码 2）
  assert.equal(parseArgs(['run', '--cwd', '.', '--task', 't', '--template']).ok, false);
});

test('usage：run 行列出 --template / --host', async () => {
  const lines = [];
  const code = await main([], { out: (line) => lines.push(line), createClient: () => assert.fail('用法错误不得连核心') });
  assert.equal(code, 2);
  const usage = lines.join('\n');
  assert.ok(usage.includes('--template <名字>'), usage);
  assert.ok(usage.includes('--host <宿主>'), usage);
});

test('exitCodeFor：新增业务错误码一律 1（D-5）', () => {
  for (const code of [
    'TASK_EMPTY',
    'TEMPLATE_UNKNOWN',
    'PRODUCT_LINE_MISSING',
    'DIR_BUSY',
    'INSTANCE_RUNNING',
    'INSTANCE_SUSPENDED',
    'LEGACY_READ_ONLY',
    'ESCALATION_WRITE_FAILED',
    'CANCEL_NOT_NEEDED',
  ]) {
    assert.equal(exitCodeFor(code), 1, code);
  }
});

/** `orch run` 的假核心：`run.start` 成功，`instance.get` / `run.wait` 返回给定快照。 */
function runClient(snapshot, { startError = null, initial = null } = {}) {
  const calls = [];
  return {
    calls,
    async connect() {
      return { ok: true };
    },
    async request(method, params) {
      calls.push({ method, params });
      if (method === 'run.start') {
        if (startError) return { ok: false, ...startError };
        return { ok: true, result: { instanceId: 'INST-001', sessionId: 'sess-1' } };
      }
      if (method === 'instance.get') return { ok: true, result: initial ?? snapshot };
      if (method === 'run.wait') return { ok: true, result: snapshot };
      return { ok: true, result: {} };
    },
    subscribe() {
      return () => {};
    },
    async close() {},
  };
}

const AT = (h, m, s) => new Date(2026, 10, 4, h, m, s).toISOString();

function loopFinal(overrides = {}) {
  return {
    instanceId: 'INST-001',
    state: 'completed',
    template: 'code-loop',
    elapsedMs: 60_000,
    updatedAt: AT(10, 31, 14),
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', state: 'done', round: 1, startedAt: AT(10, 29, 0), endedAt: AT(10, 30, 12) },
      { nodeId: 'T-002', roleId: 'tester', state: 'done', round: 1, startedAt: AT(10, 30, 3), endedAt: AT(10, 31, 14), verdict: { value: 'pass' } },
    ],
    sessions: [{ sessionId: 'sess-1', state: 'idle' }],
    handoffs: [
      {
        handoffId: 'HO-001',
        state: 'consumed',
        createdAt: AT(10, 30, 2),
        deliveredAt: AT(10, 30, 3),
        acceptedAt: AT(10, 30, 3),
        consumedAt: AT(10, 30, 40),
        edge: { from: 'T-001', to: 'T-002', kind: 'forward' },
      },
    ],
    escalations: [],
    ...overrides,
  };
}

test('main run：把 --template / --host 透传到 run.start（C-05）', async () => {
  const client = runClient(loopFinal());
  const code = await main(['run', '--cwd', '.', '--task', 't', '--template', 'code-loop', '--host', 'mock'], {
    cwd: process.cwd(),
    out: () => {},
    createClient: () => client,
  });
  assert.equal(code, 0);
  const started = client.calls.find((call) => call.method === 'run.start');
  assert.equal(started.params.template, 'code-loop');
  assert.equal(started.params.hostId, 'mock');
});

test('main run：不给 --template 时请求体不带 template（缺省 single，I1.1 行为）', async () => {
  const client = runClient({
    instanceId: 'INST-001',
    state: 'completed',
    elapsedMs: 1000,
    node: { state: 'done', startedAt: AT(10, 30, 2), endedAt: AT(10, 31, 14) },
    session: { state: 'idle' },
    handoff: { handoffId: 'HO-001', state: 'consumed', createdAt: AT(10, 30, 2), consumedAt: AT(10, 31, 14) },
  });
  const code = await main(['run', '--cwd', '.', '--task', 't'], {
    cwd: process.cwd(),
    out: () => {},
    createClient: () => client,
  });
  assert.equal(code, 0);
  const started = client.calls.find((call) => call.method === 'run.start');
  assert.ok(!('template' in started.params));
  assert.ok(!('hostId' in started.params));
});

test('main run：TEMPLATE_UNKNOWN 逐字文案 + 退出码 1', async () => {
  const client = runClient(null, { startError: { code: 'TEMPLATE_UNKNOWN', params: { name: 'code-lop' } } });
  const lines = [];
  const code = await main(['run', '--cwd', '.', '--task', 't', '--template', 'code-lop'], {
    cwd: process.cwd(),
    out: (line) => lines.push(line),
    createClient: () => client,
  });
  assert.equal(code, 1);
  assert.deepEqual(lines, ['未知模板：code-lop']);
});

test('main run：成功结束补一次终态节点行 + 带方向交接包 + 升级 —（A-3）', async () => {
  const final = loopFinal();
  const client = runClient(final, {
    initial: { ...final, state: 'running', sessions: [{ sessionId: 'sess-1', state: 'thinking' }] },
  });
  const lines = [];
  const code = await main(['run', '--cwd', '.', '--task', 't', '--template', 'code-loop'], {
    cwd: process.cwd(),
    out: (line) => lines.push(line),
    createClient: () => client,
  });
  assert.equal(code, 0);
  assert.equal(lines[0], '实例 INST-001 · 运行中 · 模板 编码闭环');
  assert.ok(lines.includes('节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1m12s'), lines.join('\n'));
  assert.ok(lines.includes('节点 T-002 测试 已完成 · 第 1 轮 · 耗时 1m11s · 判定 通过'), lines.join('\n'));
  assert.ok(lines.includes('交接包 HO-001  开发→测试  已构造   10:30:02'), lines.join('\n'));
  assert.equal(lines[lines.length - 1], '升级 —');
});

test('main run：挂起收尾退出码 4，末尾正好三行（A-4）', async () => {
  const snapshot = loopFinal({
    state: 'suspended',
    escalated: true,
    nodes: [{ nodeId: 'T-002', roleId: 'tester', state: 'escalated', round: 2 }],
    escalations: [
      { escalationId: 'ESC-001', nodeId: 'T-002', round: 2, state: 'pending', reasonDetail: '回流超上限' },
    ],
  });
  const client = runClient(snapshot);
  const lines = [];
  const code = await main(['run', '--cwd', '.', '--task', 't', '--template', 'code-loop'], {
    cwd: process.cwd(),
    out: (line) => lines.push(line),
    createClient: () => client,
  });
  assert.equal(code, 4);
  assert.deepEqual(lines.slice(-3), [
    '实例 INST-001 · 已挂起 · 模板 编码闭环',
    '升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮',
    '下一步：查看详情 orch status --instance INST-001 --events；本版本不能继续，要终止请执行 orch cancel --instance INST-001',
  ]);
  // 不打印交接包行与等待行
  assert.ok(!lines.join('\n').includes('交接包'), lines.join('\n'));
});

test('main run：停止推进收尾退出码 5，末尾正好四行（A-4）', async () => {
  const snapshot = loopFinal({
    state: 'running',
    halted: true,
    haltCause: 'state_write_failed',
    nodes: [{ nodeId: 'T-002', roleId: 'tester', state: 'review', round: 2 }],
  });
  const client = runClient(snapshot);
  const lines = [];
  const code = await main(['run', '--cwd', '.', '--task', 't', '--template', 'code-loop'], {
    cwd: process.cwd(),
    out: (line) => lines.push(line),
    createClient: () => client,
  });
  assert.equal(code, 5);
  assert.deepEqual(lines.slice(-4), [
    '无法记录升级：state_write_failed；已停止推进',
    '实例 INST-001 · 运行中 · 已停止推进 · 模板 编码闭环',
    '节点 T-002 测试 待校验（升级未记录） · 第 2 轮',
    '下一步：查看 orch status --instance INST-001 --events；本版本不能继续，只能取消',
  ]);
  assert.ok(!lines.join('\n').includes('未知错误'), lines.join('\n'));
  assert.ok(!lines.join('\n').includes('交接包'), lines.join('\n'));
});

test('main status：code-loop 节点表 / 带方向交接包 / 升级块，--events 带 [#seq] 与中文原因', async () => {
  const snapshot = loopFinal({ state: 'running', halted: false });
  const events = [
    { seq: 18, ts: AT(10, 30, 5), object: 'handoff', objectId: 'HO-001', from: 'delivered', to: 'accepted', result: 'applied', reason: 'turn.first_event' },
    { seq: 19, ts: AT(10, 30, 6), object: 'node', objectId: 'T-002', from: 'pending', to: 'running', result: 'applied', reason: 'node.dispatch', detail: { round: 1 } },
  ];
  const client = {
    async connect() {
      return { ok: true };
    },
    async request(method) {
      if (method === 'instance.get') return { ok: true, result: snapshot };
      if (method === 'instance.events') return { ok: true, result: { events } };
      return { ok: true, result: {} };
    },
    async close() {},
  };
  const lines = [];
  const code = await main(['status', '--instance', 'INST-001', '--events'], {
    cwd: process.cwd(),
    out: (line) => lines.push(line),
    createClient: () => client,
  });
  assert.equal(code, 0);
  const text = lines.join('\n');
  assert.ok(text.includes('实例 INST-001 · 运行中 · 模板 编码闭环'), text);
  assert.ok(text.includes('节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1m12s'), text);
  assert.ok(text.includes('交接包 HO-001  开发→测试  已构造   10:30:02'), text);
  assert.ok(text.includes('升级 —'), text);
  assert.ok(
    lines.includes('[#18] 10:30:05  交接包 HO-001  已投递 → 已接受  原因 首个事件'),
    text,
  );
  assert.ok(lines.includes('[#19] 10:30:06  节点 T-002  派发 → 执行中  原因 派发 · 第 1 轮'), text);
});
