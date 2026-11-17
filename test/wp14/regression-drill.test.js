/**
 * I1.10b WP-6 · AC-34 回归门禁 + AC-30 静态面的测试侧支撑（批次 4，DAG 汇合点）。
 *
 * 主责 AC-34：三条主链逐字 / `instance status`+`instance graph` 两种格式逐字 /
 * `USAGE_LINES === 25` / 命令表与两层子命令表不变；另提供「全量四步判定」的测试侧
 * 支撑：tests ≥ 1425、失败集合 ⊆ 允许集合（win32 16 ∪ 历史 8 ∪ 已登记 AC-04 /
 * HANDOFF_EVIDENCE_ESCAPE / 已留帧 flake）、新红复核（逐文件或隔离帧）。
 *
 * AC-30（与 WP-1 协作）：31 词双目录 purity 扫描（完整 --forbid 词表写进本文件）+
 * 零依赖断言。桌面层 CJK 零命中由 WP-1 的 `labels-drill.test.js` 主责，本文件不重复。
 *
 * 判定口径（裁决 G，禁止硬编码单次失败条数）：用
 *   `fail = 0 && pass === tests && tests >= 基线` 的「等价语义」——
 *   clean 形态是全绿；本机不要求全绿，等价语义 = 差集判定：
 *   `tests >= 基线 && 计数自洽 && (failNames ∖ allowedSet) === [] && fail 全部具名`。
 *   本文件**不递归跑全量**（会自递归），只校验口径函数与允许集合结构；
 *   真实全量由门禁第 2 步单独执行，差集结论写在回执里。
 *
 * 夹具纪律：%TEMP%（os.tmpdir）独立根；NODE_ENV=test；mock 宿主；主链每条 ≤3 次运行。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { USAGE_LINES } from '../../src/cli/labels.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BIN = path.join(REPO, 'bin', 'orch.js');
const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');
const PURITY = path.join(REPO, 'test', 'fixtures', 'purity-check.mjs');

/** 全量判定基线（条数只增不减；这是基线常量，不是当前运行条数）。 */
const TESTS_BASELINE = 1425;

/** 31 禁词全表（顺序与 requirement 附录 D-8 一致；两份 --forbid 都写全字面）。 */
const WORDS_31 = [
  'task-loop', 'researcher', 'writer', 'reviewer', '研究员', '撰写者', '审核者',
  'code-loop', 'developer', 'tester', 'coordinator', 'arbiter', 'planner',
  'summarizer', 'worker', 'data-analyst', 'fact-checker', 'editor', 'code-reviewer',
  'compliance-reviewer', 'requirement-clarifier', 'research-brief', 'fact-check',
  'data-analysis', 'doc-draft', 'doc-review', 'code-change', 'test-run', 'code-review',
  'coordination', 'compliance-check',
];

/** 两条已登记环境/时序红的逐字测试名（允许集合成员）。 */
const REGISTERED_ENV_REDS = [
  'AC-04：空态、不可读行不阻断、新实例 2 秒内由推送触发出现；F-18 脉冲后 2 秒内更新',
  'HANDOFF_EVIDENCE_ESCAPE：符号链接绕过',
];

const LIMITS = {
  initializeTimeoutMs: 15_000,
  requestTimeoutMs: 15_000,
  promptTimeoutMs: 30_000,
  quietIdleMs: 30,
  quietCapMs: 200,
};

function envFor() {
  return { ...process.env, NODE_ENV: 'test' };
}

function syncSleep(ms) {
  // 只用于进程退出后的目录清理重试，不参与任何时序断言。
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function makeProject(t, tag) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `maestro-i10b-reg-${tag}-`));
  const dir = path.join(root, '.orch', 'hosts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'mock.json'), JSON.stringify({
    transport: 'stdio',
    launch: { command: process.execPath, args: [MOCK] },
    limits: { ...LIMITS },
  }, null, 2), 'utf8');
  t.after(() => {
    spawnSync(process.execPath, [BIN, 'core', 'stop'], {
      cwd: root, env: envFor(), timeout: 20_000, windowsHide: true,
    });
    removeProject(root);
  });
  return root;
}

function removeProject(root) {
  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      fs.rmSync(root, { recursive: true, force: true });
      return;
    } catch (err) {
      const transient = err?.code === 'ENOTEMPTY' || err?.code === 'EBUSY' || err?.code === 'EPERM';
      if (!transient || Date.now() >= deadline) throw err;
      syncSleep(150);
    }
  }
}

function runCli(root, args, timeout = 90_000) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd: root, env: envFor(), timeout, encoding: 'utf8', windowsHide: true,
  });
  const stdout = result.stdout ?? '';
  return {
    code: result.status,
    stdout,
    stderr: result.stderr ?? '',
    lines: stdout === '' ? [] : stdout.replace(/\n$/, '').split('\n'),
  };
}

function localIso(h, m, s) {
  return new Date(2026, 10, 11, h, m, s).toISOString();
}

/** A-0 归一化（与 `test/wp13/regression.test.js` 同口径）。 */
function normalizeLine(line) {
  return line
    .replace(/mock-sess-\d+-\d+/g, 'mock-sess-PID-SEQ')
    .replace(/INST-\d+/g, 'INST-N')
    .replace(/\d{2}:\d{2}:\d{2}/g, 'TIME')
    .replace(/已运行 \d+s/g, '已运行 Ns')
    .replace(/耗时 \d+s/g, '耗时 Ns');
}

const ESCALATE_NEXT_STEP =
  '下一步：orch escalate list --instance INST-N 查看升级；' +
  'orch escalate resolve ESC-nnn --instance INST-N --decision retry|pass|fail 处理；' +
  '要终止请执行 orch cancel --instance INST-N';

/** 三条主链 I1.7 收口基线（A-0 归一化后的整份 stdout，逐字冻结）。 */
const CHAINS = {
  single: {
    task: '写一段流程说明',
    exit: 0,
    runs: 2,
    baseline: [
      '实例 INST-N · 运行中',
      '会话已创建 mock-sess-PID-SEQ',
      '任务已投递',
      '会话 执行中 · 已运行 Ns',
      '会话 等待下游 · 产出已提交',
      '会话 空闲',
      '节点 已完成 · 耗时 Ns',
      '交接包 HO-001  已构造   TIME',
      '交接包 HO-001  已投递   TIME',
      '交接包 HO-001  已接受   TIME',
      '交接包 HO-001  已完成   TIME',
    ],
  },
  'code-loop': {
    task: '实现一个示例功能\n产物：calc.js',
    exit: 4,
    runs: 2,
    baseline: [
      '实例 INST-N · 运行中 · 模板 编码闭环',
      '会话已创建 mock-sess-PID-SEQ',
      '任务已投递',
      '会话 执行中 · 已运行 Ns',
      '会话 等待下游 · 产出已提交',
      '会话 空闲',
      '会话 已升级',
      '实例 INST-N · 已挂起 · 模板 编码闭环',
      '升级 ESC-001 待处理 · 节点 T-001 开发 · 第 1 轮',
      ESCALATE_NEXT_STEP,
    ],
  },
  'task-loop': {
    task: '整理一份调研纪要\n产物：release-notes.md',
    exit: 4,
    runs: 3,
    baseline: [
      '实例 INST-N · 运行中 · 模板 通用任务闭环',
      '会话已创建 mock-sess-PID-SEQ',
      '任务已投递',
      '会话 执行中 · 已运行 Ns',
      '会话 空闲',
      '会话 已升级',
      '实例 INST-N · 已挂起 · 模板 通用任务闭环',
      '升级 ESC-001 待处理 · 节点 T-001 研究员 · 第 1 轮',
      ESCALATE_NEXT_STEP,
    ],
  },
};

const PREFIXES = ['实例', '会话', '节点', '交接包', '升级', '下一步'];

function groupOf(line) {
  if (line.startsWith('会话已创建') || line.startsWith('会话 ')) return '会话';
  for (const prefix of PREFIXES) {
    if (prefix === '会话') continue;
    if (prefix === '下一步' ? line.startsWith('下一步：') : line.startsWith(`${prefix} `)) return prefix;
  }
  return 'other';
}

function groupLines(lines) {
  const groups = { 实例: [], 会话: [], 节点: [], 交接包: [], 升级: [], 下一步: [], other: [] };
  for (const line of lines) groups[groupOf(line)].push(line);
  return groups;
}

function sessionLabel(line) {
  if (line.startsWith('会话已创建')) return '会话已创建';
  for (const label of ['会话 执行中', '会话 等待下游', '会话 空闲', '会话 已升级']) {
    if (line.startsWith(label)) return label;
  }
  return null;
}

function writeSnapshot(root, state, id = 'INST-001') {
  const dir = path.join(root, '.orch', 'instances', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state, null, 2), 'utf8');
}

function startCoreOnEmptyRoot(root) {
  const res = runCli(root, ['instance', 'status', 'INST-001'], 30_000);
  assert.equal(res.code, 1, res.stdout + res.stderr);
  assert.equal(res.stdout.trim(), '实例 INST-001 · 不存在');
}

function frozenSuspendedSnapshot() {
  return {
    schemaVersion: 2,
    instanceId: 'INST-001',
    coreGeneration: 'gen-i10b-regression',
    createdAt: localIso(10, 0, 0),
    updatedAt: localIso(10, 5, 0),
    state: 'suspended',
    stateSince: localIso(10, 5, 0),
    template: 'code-loop',
    cwd: '.',
    task: 'x',
    halted: false,
    rev: 0,
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', round: 1, state: 'done', startedAt: localIso(10, 0, 0), endedAt: localIso(10, 2, 0) },
      { nodeId: 'T-002', roleId: 'tester', round: 2, state: 'escalated', startedAt: localIso(10, 4, 0) },
    ],
    sessions: [],
    handoffs: [{
      handoffId: 'HO-001',
      edge: { from: 'T-001', to: 'T-002', kind: 'forward' },
      state: 'consumed',
      createdAt: localIso(10, 2, 1),
      deliveredAt: localIso(10, 2, 2),
      acceptedAt: localIso(10, 2, 2),
      consumedAt: localIso(10, 4, 0),
    }],
    escalations: [{
      escalationId: 'ESC-001', nodeId: 'T-001', round: 1, state: 'pending',
      reasonCode: 'rounds_exceeded', reasonDetail: '回流超上限：测试已派发 2 次仍未通过', defects: [],
    }],
    health: { nodeTimeoutMs: 300000 },
  };
}

const STATUS_BASELINE = [
  '实例 INST-001 · 已挂起 · 模板 编码闭环',
  '节点 T-001 开发 已完成 · 第 1 轮 · 耗时 2m',
  '节点 T-002 测试 已升级 · 第 2 轮',
  '交接包 HO-001  开发→测试  已构造   10:02:01',
  '交接包 HO-001  开发→测试  已投递   10:02:02',
  '交接包 HO-001  开发→测试  已接受   10:02:02',
  '交接包 HO-001  开发→测试  已完成   10:04:00',
  '升级 ESC-001 待处理',
  '  原因：回流超上限：测试已派发 2 次仍未通过',
  '  节点：T-001 开发 · 第 1 轮',
  '  下一步：orch escalate list --instance INST-001 查看升级；' +
    'orch escalate resolve ESC-nnn --instance INST-001 --decision retry|pass|fail 处理；' +
    '要终止请执行 orch cancel --instance INST-001',
];

const GRAPH_TEXT_BASELINE = [
  '实例 INST-001 · 编码闭环 · 已挂起',
  'T-001 开发 · 已完成 · 第 1 轮',
  'T-002 测试 · 已升级 · 第 2 轮',
  '边：',
  '  T-001 -> T-002 正向',
  '  T-002 -> T-001 回流',
  '  T-001 -> T-002 复测',
  '升级：ESC-001 T-001 待处理',
].join('\n') + '\n';

const GRAPH_JSON_BASELINE = {
  graphVersion: 1,
  instanceId: 'INST-001',
  template: 'code-loop',
  state: 'suspended',
  paused: false,
  nodes: [
    { nodeId: 'T-001', title: '开发', roleId: 'developer', state: 'done', round: 1 },
    { nodeId: 'T-002', title: '测试', roleId: 'tester', state: 'escalated', round: 2 },
  ],
  edges: [
    { from: 'T-001', to: 'T-002', kind: 'forward' },
    { from: 'T-002', to: 'T-001', kind: 'backflow' },
    { from: 'T-001', to: 'T-002', kind: 'retest' },
  ],
  handoffs: [
    { handoffId: 'HO-001', from: 'T-001', to: 'T-002', kind: 'forward', state: 'consumed', round: 0 },
  ],
  escalations: [{
    escalationId: 'ESC-001', nodeId: 'T-001', round: 1, state: 'pending',
    reasonCode: 'rounds_exceeded', reasonDetail: '回流超上限：测试已派发 2 次仍未通过', defects: [],
  }],
  approvals: [],
  current: null,
};

// ---------------------------------------------------------------------------
// AC-34 · 静态面：USAGE_LINES / 命令表 / 两层子命令表
// ---------------------------------------------------------------------------

test('AC-34：USAGE_LINES === 25，命令表与两层子命令表逐字不变', () => {
  assert.equal(USAGE_LINES.length, 25, 'USAGE_LINES 必须恰 25 行（冻结基线）');
  assert.equal(USAGE_LINES[0], '用法：orch run|status|cancel|core');
  assert.equal(USAGE_LINES[24], '  orch workflow dry-run <工作流> [--task <说明>] [--format text|json]');
  // 两层子命令表逐字（从 USAGE_LINES 派生的用户可见命令面）。
  const text = USAGE_LINES.join('\n');
  for (const line of [
    '  orch role list [--group <组>] [--instance <实例号>] [--format text|json]',
    '  orch skill list [--group <组>] [--format text|json]',
    '  orch workflow list [--format text|json]',
    '  orch status [--instance <实例号>] [--events]',
  ]) {
    assert.ok(text.includes(line), `USAGE_LINES 缺命令面行：${line}`);
  }
  // main.js 顶层命令集与 FAMILY_SUBS 两层子命令表静态哨兵（逐字）。
  const mainJs = fs.readFileSync(path.join(REPO, 'src', 'cli', 'main.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(
    mainJs.includes("const COMMANDS = new Set(['run', 'status', 'cancel', 'core', 'role', 'skill', 'workflow']);"),
    '顶层命令集漂移',
  );
  assert.ok(
    mainJs.includes("role: new Set(['list', 'show', 'validate', 'create', 'edit', 'export', 'import', 'diff'])"),
    'role 子命令表漂移',
  );
  assert.ok(
    mainJs.includes("skill: new Set(['list', 'show', 'create', 'validate', 'export', 'import'])"),
    'skill 子命令表漂移',
  );
  assert.ok(
    mainJs.includes("workflow: new Set(['list', 'show', 'create', 'validate', 'diff', 'dry-run'])"),
    'workflow 子命令表漂移',
  );
});

// ---------------------------------------------------------------------------
// AC-34 · 主链与两种格式逐字（真实 CLI + mock 宿主）
// ---------------------------------------------------------------------------

test('AC-34：single / code-loop / task-loop 三条主链 A-0 归一化后不得低于 I1.7 收口基线', async (t) => {
  for (const [template, spec] of Object.entries(CHAINS)) {
    const runs = [];
    for (let i = 0; i < spec.runs; i += 1) {
      const root = makeProject(t, `${template}-${i}`);
      const res = runCli(root, [
        'run', '--cwd', '.', '--template', template, '--host', 'mock', '--task', spec.task,
      ]);
      assert.equal(res.code, spec.exit, `${template} 退出码漂移：\n${res.stdout}\n${res.stderr}`);
      assert.equal(res.stderr, '', `${template} 不应写 stderr：\n${res.stderr}`);
      runs.push(res);
    }

    const baseline = spec.baseline;
    const baselineGroups = groupLines(baseline);
    const baselineLabels = baselineGroups.会话.map(sessionLabel);
    const exact = runs.filter((res) => {
      const normalized = res.lines.map(normalizeLine);
      return normalized.length === baseline.length && normalized.every((line, i) => line === baseline[i]);
    });
    // single/code-loop 基线稳定，每次整份命中；task-loop 的「会话 已升级」基线本身
    // flaky（D-17 ⑥），N 次中至少 1 次整份命中即可（与回归守护同口径）。
    const requiredExactRuns = template === 'task-loop' ? 1 : spec.runs;

    for (const res of runs) {
      const normalized = res.lines.map(normalizeLine);
      const groups = groupLines(normalized);
      assert.deepEqual(groups.other, ['任务已投递'], `${template} 出现未归类行：\n${res.stdout}`);
      for (const prefix of ['实例', '节点', '交接包', '升级', '下一步']) {
        assert.deepEqual(groups[prefix], baselineGroups[prefix], `${template}「${prefix}」分组漂移：\n${res.stdout}`);
      }
      const labels = groups.会话.map(sessionLabel);
      const unknown = groups.会话.filter((line) => sessionLabel(line) === null);
      assert.deepEqual(unknown, [], `${template} 出现新会话文案：\n${res.stdout}`);
      assert.ok(labels.length > 0 && labels[0] === '会话已创建');
      assert.ok(labels.includes('会话 空闲'));
      assert.ok(labels.length <= baselineLabels.length);
      assert.equal(new Set(labels).size, labels.length);
      let cursor = -1;
      for (const label of labels) {
        const index = baselineLabels.indexOf(label);
        assert.ok(index > cursor, `${template} 会话行顺序漂移（${label}）`);
        cursor = index;
      }
    }
    assert.ok(
      exact.length >= requiredExactRuns,
      `${template} 有运行未命中归一化基线（${exact.length}/${spec.runs}，要求 ≥ ${requiredExactRuns}）：\n` +
        runs.map((res) => res.stdout).join('\n---\n'),
    );
  }
});

test('AC-34：instance status / instance graph 两种格式逐字（删健康度行后基线相等）', (t) => {
  const root = makeProject(t, 'status-graph');
  startCoreOnEmptyRoot(root);
  writeSnapshot(root, frozenSuspendedSnapshot());

  const status = runCli(root, ['instance', 'status', 'INST-001']);
  assert.equal(status.code, 0, status.stdout + status.stderr);
  assert.equal(status.stderr, '');
  const healthLines = status.lines.filter((line) => line.startsWith('健康度'));
  assert.equal(healthLines.length, 1, '健康度行必须恰 1 行');
  assert.equal(status.lines[1], '健康度 需关注 · 有待处理升级');
  assert.deepEqual(status.lines.filter((_, i) => i !== 1), STATUS_BASELINE, 'instance status 格式漂移');

  const text = runCli(root, ['instance', 'graph', 'INST-001']);
  assert.equal(text.code, 0, text.stdout + text.stderr);
  assert.equal(text.stdout, GRAPH_TEXT_BASELINE, 'graph 文本漂移');
  assert.ok(!text.stdout.includes('健康度') && !text.stdout.includes('health'));

  const json = runCli(root, ['instance', 'graph', 'INST-001', '--format', 'json']);
  assert.equal(json.code, 0, json.stdout + json.stderr);
  assert.ok(!json.stdout.includes('健康度') && !json.stdout.includes('health'));
  assert.deepEqual(JSON.parse(json.stdout), GRAPH_JSON_BASELINE, 'graph JSON 漂移');
});

// ---------------------------------------------------------------------------
// AC-30 · 零依赖 + 31 词双目录 purity（完整 --forbid 字面）
// ---------------------------------------------------------------------------

test('AC-30：dependencies === {}（零依赖红线）', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  assert.deepEqual(pkg.dependencies ?? {}, {}, 'dependencies 必须为空对象');
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
});

test('AC-30：31 词双目录 purity 扫描（--forbid 完整 31 词字面）均 exit 0', () => {
  assert.equal(WORDS_31.length, 31, '禁词表必须恰 31 个');
  // 完整字面（不写"同一词表"）：两份 --forbid 各 31 词，顺序与附录 D-8 一致。
  const FORBID_LITERAL =
    'task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,' +
    'code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,' +
    'fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,' +
    'fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check';
  assert.equal(FORBID_LITERAL.split(',').length, 31);
  assert.deepEqual(FORBID_LITERAL.split(','), WORDS_31);
  for (const dirs of ['src/core,src/daemon', 'desktop/ui,desktop/harness']) {
    const res = spawnSync(process.execPath, [
      PURITY, '--dirs', dirs, '--forbid', FORBID_LITERAL,
    ], { cwd: REPO, env: envFor(), encoding: 'utf8', timeout: 60_000 });
    assert.equal(res.status, 0, `purity ${dirs} 必须 exit 0：\n${res.stdout}\n${res.stderr}`);
  }
});

// ---------------------------------------------------------------------------
// AC-34 四步判定的测试侧支撑（差集口径，禁止硬编码当前条数，不递归跑全量）
// ---------------------------------------------------------------------------

/** 允许集合：win32 16 ∪ 历史 8 ∪ 已登记环境/时序红 ∪ 已留帧 flake 名。 */
function loadAllowedFailures() {
  const allowed = new Set();
  const win32File = path.join(REPO, 'docs', 'iterations', 'iteration-10a', 'baseline-failures-win32.txt');
  const win32 = fs.readFileSync(win32File, 'utf8').split(/\r?\n/)
    .map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
  for (const line of win32) allowed.add(line);
  const histFile = path.join(REPO, 'docs', 'iterations', 'iteration-7', 'baseline-failures.txt');
  const hist = fs.readFileSync(histFile, 'utf8').split(/\r?\n/)
    .map((s) => s.trim()).filter(Boolean);
  for (const line of hist) allowed.add(line);
  for (const name of REGISTERED_ENV_REDS) allowed.add(name);
  return { allowed, win32Count: new Set(win32).size, histCount: new Set(hist).size };
}

/**
 * 四步判定的「等价语义」：
 *   clean = fail 0 && pass === tests（本机理想全绿形态）；
 *   等价 = tests >= 基线 && 计数自洽 && fail 全部具名 && (failNames ∖ allowed) === []。
 * 不比较单次 fail 绝对值；不要求本机全绿（裁决 G / F2-01 / F2-02）。
 */
function judgeRun(summary, allowedSet, baseline = TESTS_BASELINE) {
  const failNames = Array.isArray(summary.failNames) ? summary.failNames : [];
  const testsOk = Number.isInteger(summary.tests) && summary.tests >= baseline;
  const countsConsistent =
    Number.isInteger(summary.tests) && Number.isInteger(summary.pass) && Number.isInteger(summary.fail) &&
    summary.pass + summary.fail + (summary.skipped ?? 0) === summary.tests;
  const diff = failNames.filter((name) => !allowedSet.has(name));
  const named = failNames.every((name) => typeof name === 'string' && name.length > 0);
  const allFailuresNamed = summary.fail === failNames.length && named;
  const clean = summary.fail === 0 && summary.pass === summary.tests;
  return {
    testsOk,
    countsConsistent,
    diff,
    pass: Boolean(testsOk && countsConsistent && allFailuresNamed && diff.length === 0 && (clean || failNames.length > 0 || summary.fail === 0)),
  };
}

/** 新红复核：允许集合内的登记红按登记判定；集合外新红必须隔离复跑通过并留帧。 */
function needsIsolatedReview(failName, allowedSet, frames) {
  if (allowedSet.has(failName)) return false;
  const frame = frames.find((f) => f.names.includes(failName));
  return !(frame && frame.isolatedPass === true);
}

test('AC-34 四步判定：允许集合结构 = win32 16 ∪ 历史 8 ∪ 两条已登记环境红', () => {
  const { allowed, win32Count, histCount } = loadAllowedFailures();
  assert.equal(win32Count, 16, 'win32 登记项必须恰 16 条');
  assert.equal(histCount, 8, '历史基线必须恰 8 条');
  for (const name of REGISTERED_ENV_REDS) {
    assert.equal(allowed.has(name), true, `允许集合缺登记项：${name}`);
  }
  assert.ok(allowed.size >= 16 + 8 + 2, '允许集合规模不足');
  assert.ok(TESTS_BASELINE >= 1425, '基线常量不得低于 1425');
});

test('AC-34 四步判定：judgeRun 等价语义（clean 全绿 / flake 子集 / 新红差集 / 欠基线 / 计数不自洽）', () => {
  const { allowed } = loadAllowedFailures();
  const registered = REGISTERED_ENV_REDS[0];

  // clean 形态：fail=0 && pass===tests && tests>=基线 → 通过（ideal 全绿）。
  const clean = judgeRun({ tests: 1468, pass: 1468, fail: 0, skipped: 0, failNames: [] }, allowed);
  assert.equal(clean.pass, true, 'clean 全绿必须判通过');
  assert.deepEqual(clean.diff, []);

  // flake 子集形态：本机不要求全绿，失败全在允许集合内 → 差集 0，判通过。
  const subset = judgeRun({ tests: 1468, pass: 1453, fail: 2, skipped: 13, failNames: [registered, REGISTERED_ENV_REDS[1]] }, allowed);
  assert.equal(subset.pass, true, '失败集合 ⊆ 允许集合必须判通过（不要求本机全绿）');
  assert.deepEqual(subset.diff, []);

  // 新红：差集非空 → 判红。
  const newRed = judgeRun({ tests: 1468, pass: 1454, fail: 1, skipped: 13, failNames: ['TOTALLY_NEW_FAILURE'] }, allowed);
  assert.equal(newRed.pass, false, '差集非空必须判红');
  assert.deepEqual(newRed.diff, ['TOTALLY_NEW_FAILURE']);

  // 欠基线：tests < 1425 → 判红（条数只增不减）。
  assert.equal(judgeRun({ tests: 1424, pass: 1424, fail: 0, skipped: 0, failNames: [] }, allowed).pass, false);

  // 计数不自洽 → 判红。
  assert.equal(judgeRun({ tests: 1468, pass: 1400, fail: 1, skipped: 13, failNames: [] }, allowed).pass, false);
});

test('AC-34 新红复核语义：集合外新红须隔离通过并留帧；两条登记环境红按登记判定', () => {
  const { allowed } = loadAllowedFailures();
  const frameDir = path.join(REPO, 'docs', 'iterations', 'iteration-10b', 'evidence', 'flake-frames');
  assert.equal(fs.existsSync(frameDir), true, 'flake-frames 留帧目录必须存在');
  const frames = fs.readdirSync(frameDir).filter((f) => f.endsWith('.log')).map((f) => ({
    file: f,
    text: fs.readFileSync(path.join(frameDir, f), 'utf8'),
    // 本批两条环境红隔离复跑「仍红」，如实记录：isolatedPass=false；
    // 它们已在允许集合内，按登记判定，不需要翻绿。
    names: REGISTERED_ENV_REDS.filter((name) => fs.readFileSync(path.join(frameDir, f), 'utf8').includes(name)),
    isolatedPass: false,
  }));
  assert.ok(frames.some((f) => f.names.includes(REGISTERED_ENV_REDS[0])), 'AC-04 隔离复跑原始帧缺失');
  assert.ok(frames.some((f) => f.names.includes(REGISTERED_ENV_REDS[1])), 'HANDOFF_EVIDENCE_ESCAPE 隔离复跑原始帧缺失');

  // 允许集合内：不触发新红复核（按登记判定）。
  assert.equal(needsIsolatedReview(REGISTERED_ENV_REDS[0], allowed, frames), false);
  assert.equal(needsIsolatedReview(REGISTERED_ENV_REDS[1], allowed, frames), false);
  // 集合外新红、无隔离通过帧：必须复核（判红），不许一把开关关掉。
  assert.equal(needsIsolatedReview('TOTALLY_NEW_FAILURE', allowed, frames), true);
  // 集合外新红、有隔离通过帧：复核闭合。
  const passedFrame = [{ names: ['FLAKE_A'], isolatedPass: true }];
  assert.equal(needsIsolatedReview('FLAKE_A', allowed, passedFrame), false);
});
