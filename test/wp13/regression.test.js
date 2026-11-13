/**
 * I1.10a WP-9 · 回归守护（批次 6，DAG 汇合点；纯断言、零产品改动）。
 *
 * 覆盖拆分文档 §4 WP-9 的 A 组判据：
 * - 三条主链 `single` / `code-loop` / `task-loop` 逐字回归：复用 I1.9
 *   `test/wp9/i19-regression.test.js` 的 A-0 归一化口径（只替换可变值，
 *   不改文字与顺序），每条链多次运行，判「当前不得低于基线」——
 *   不是只跑单次，也不是只查「有没有新词」。
 * - `instance status` / `instance graph`（文本 + JSON）与 I1.7 收口基线逐字。
 * - `USAGE_LINES` 25 行、`dependencies === 0`、31 词两轮扫描
 *   （`src/core`+`src/daemon` 与 `desktop/ui` 各两轮）exit 0、
 *   `desktop/ui` + `desktop/harness` CJK 零命中、`src/core`+`src/daemon`
 *   无 `if host ==` / `switch (host)` 宿主分支。
 * - 全量基线差集不在本文件内跑全量（会自递归）：改断言基线清单存在且
 *   格式正确，主控口径的差集结论写在回执里。
 *
 * 夹具纪律：项目根一律 `os.tmpdir()` 下独立 `mkdtemp`；`NODE_ENV=test`
 * 必注入；宿主一律 `--host mock`（指向仓库内 mock-acp-agent.js）；核心由
 * 真实 CLI 拉起，`t.after` 里 `core stop` 后清理。零 npm 依赖。
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

const LIMITS = {
  initializeTimeoutMs: 15_000,
  requestTimeoutMs: 15_000,
  promptTimeoutMs: 30_000,
  quietIdleMs: 30,
  quietCapMs: 200,
};

const WORDS_31 = [
  'task-loop', 'researcher', 'writer', 'reviewer', '研究员', '撰写者', '审核者',
  'code-loop', 'developer', 'tester', 'coordinator', 'arbiter', 'planner',
  'summarizer', 'worker', 'data-analyst', 'fact-checker', 'editor', 'code-reviewer',
  'compliance-reviewer', 'requirement-clarifier', 'research-brief', 'fact-check',
  'data-analysis', 'doc-draft', 'doc-review', 'code-change', 'test-run', 'code-review',
  'coordination', 'compliance-check',
];

/** 三条主链运行期禁用词：渲染路径不该碰到这三层（与 I1.9 同口径）。 */
const FORBIDDEN_RUNTIME_WORDS = ['健康度', '追踪', '执行摘要', '已跳过'];

function envFor() {
  return { ...process.env, NODE_ENV: 'test' };
}

function syncSleep(ms) {
  // 只用于进程退出后的目录清理重试，不参与任何时序断言。
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function makeProject(t, tag) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `maestro-i10a-reg-${tag}-`));
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

/** 核心是 detached 进程：回包后可能仍在 flush，删目录按瞬态错误重试。 */
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
    cwd: root,
    env: envFor(),
    timeout,
    encoding: 'utf8',
    windowsHide: true,
  });
  const stdout = result.stdout ?? '';
  return {
    code: result.status,
    stdout,
    stderr: result.stderr ?? '',
    lines: stdout === '' ? [] : stdout.replace(/\n$/, '').split('\n'),
  };
}

function instanceDir(root, id = 'INST-001') {
  return path.join(root, '.orch', 'instances', id);
}

/** 先起核心再写快照：避免启动对账把 `running` 判成 `interrupted`（§3.3 铁序）。 */
function startCoreOnEmptyRoot(root) {
  const res = runCli(root, ['instance', 'status', 'INST-001'], 30_000);
  assert.equal(res.code, 1, res.stdout + res.stderr);
  assert.equal(res.stdout.trim(), '实例 INST-001 · 不存在');
}

function writeSnapshot(root, state, id = 'INST-001') {
  const dir = instanceDir(root, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state, null, 2), 'utf8');
}

function localIso(h, m, s) {
  return new Date(2026, 10, 11, h, m, s).toISOString();
}

// ---------------------------------------------------------------------------
// 三条主链基线（A-0 归一化，与 I1.9 收口基线逐字）
// ---------------------------------------------------------------------------

/**
 * A-0 归一化（与 `test/wp9/i19-regression.test.js` 同口径）：只替换可变值，
 * 不改任何文字与顺序。
 */
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

/**
 * 三条主链的 I1.7 收口基线（A-0 归一化后的整份 stdout）。
 * `single` 取自 `docs/iterations/iteration-1/evidence/NFR-03.output.json`；
 * `code-loop` / `task-loop` 取自 `docs/iterations/iteration-9/review-wp7-r2.md`
 * §2.2/§2.3（基线 `322fb5e` 与当前树归一化 diff = 0 的冻结对照）。
 */
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
    if (prefix === '下一步' ? line.startsWith('下一步：') : line.startsWith(`${prefix} `)) {
      return prefix;
    }
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

test('三主链：A-0 归一化后多次运行不得低于 I1.7 收口基线（每条链 ≥2 次）', async (t) => {
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

    for (const res of runs) {
      for (const word of FORBIDDEN_RUNTIME_WORDS) {
        assert.ok(
          !res.stdout.includes(word),
          `${template} 运行期输出出现新增可见词「${word}」：\n${res.stdout}`,
        );
      }
    }

    const baseline = spec.baseline;
    const baselineGroups = groupLines(baseline);
    const baselineLabels = baselineGroups.会话.map(sessionLabel);

    const exact = runs.filter((res) => {
      const normalized = res.lines.map(normalizeLine);
      return normalized.length === baseline.length && normalized.every((line, i) => line === baseline[i]);
    });
    // `single` / `code-loop` 的基线在 I1.9 的 2/2 与 21 次比对中 100% 稳定，
    // 因此每次运行都必须整份命中；`task-loop` 的 `会话 已升级` 在基线本身
    // flaky（D-17 ⑥），只要求 N 次中至少 1 次整份命中并做位置断言。
    const requiredExactRuns = template === 'task-loop' ? 1 : spec.runs;

    for (const res of runs) {
      const normalized = res.lines.map(normalizeLine);
      const groups = groupLines(normalized);

      assert.deepEqual(groups.other, ['任务已投递'], `${template} 出现未归类输出行：\n${res.stdout}`);

      for (const prefix of ['实例', '节点', '交接包', '升级', '下一步']) {
        assert.deepEqual(
          groups[prefix],
          baselineGroups[prefix],
          `${template} 的「${prefix}」分组与基线不一致：\n${res.stdout}`,
        );
      }

      const labels = groups.会话.map(sessionLabel);
      const unknown = groups.会话.filter((line) => sessionLabel(line) === null);
      assert.deepEqual(unknown, [], `${template} 出现新的会话行文案：\n${res.stdout}`);
      assert.ok(labels.length > 0 && labels[0] === '会话已创建', `${template} 首条会话行必须是「会话已创建」`);
      assert.ok(labels.includes('会话 空闲'), `${template} 终态必须打出「会话 空闲」：\n${res.stdout}`);
      assert.ok(labels.length <= baselineLabels.length, `${template} 会话行多于基线：\n${res.stdout}`);
      assert.equal(new Set(labels).size, labels.length, `${template} 会话行重复：\n${res.stdout}`);
      let cursor = -1;
      for (const label of labels) {
        const index = baselineLabels.indexOf(label);
        assert.ok(index > cursor, `${template} 会话行顺序漂移（${label}）：\n${res.stdout}`);
        cursor = index;
      }

      if (labels.includes('会话 已升级')) {
        const upgradeAt = normalized.findIndex((line) => line === '会话 已升级');
        const idleAt = normalized.indexOf('会话 空闲');
        const suspendedAt = normalized.findIndex((line) => line.startsWith('实例 INST-N · 已挂起'));
        assert.ok(upgradeAt > idleAt, `${template} 的「会话 已升级」必须在「会话 空闲」之后：\n${res.stdout}`);
        assert.ok(
          suspendedAt > upgradeAt,
          `${template} 的「会话 已升级」必须在「实例 · 已挂起」之前：\n${res.stdout}`,
        );
      }
    }

    assert.ok(
      exact.length >= requiredExactRuns,
      `${template} 有运行未命中归一化基线（${exact.length}/${spec.runs}，要求 ≥ ${requiredExactRuns}）：\n` +
        runs.map((res) => res.stdout).join('\n---\n'),
    );

    if (template === 'task-loop') {
      const hits = runs.filter((res) => res.lines.some((line) => line === '会话 已升级')).length;
      assert.ok(
        hits >= 1,
        `task-loop 连续 ${spec.runs} 次均缺「会话 已升级」，低于基线分布：\n${runs.map((r) => r.stdout).join('\n---\n')}`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// `instance status` / `instance graph` 逐字基线
// ---------------------------------------------------------------------------

/** 冻结快照：`code-loop` 已挂起、T-001 完成、T-002 升级、HO-001 已消费。 */
function frozenSuspendedSnapshot() {
  return {
    schemaVersion: 2,
    instanceId: 'INST-001',
    coreGeneration: 'gen-i10a-regression',
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
      {
        nodeId: 'T-001',
        roleId: 'developer',
        round: 1,
        state: 'done',
        startedAt: localIso(10, 0, 0),
        endedAt: localIso(10, 2, 0),
      },
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
      escalationId: 'ESC-001',
      nodeId: 'T-001',
      round: 1,
      state: 'pending',
      reasonCode: 'rounds_exceeded',
      reasonDetail: '回流超上限：测试已派发 2 次仍未通过',
      defects: [],
    }],
    health: { nodeTimeoutMs: 300000 },
  };
}

/** I1.7 收口基线：`instance status` 除健康度外的全部行（逐字、含相对顺序）。 */
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

/** I1.7 收口基线：`instance graph` 文本（逐字）。 */
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

/** I1.7 收口基线：`instance graph --format json` 的完整对象（深比较）。 */
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
    escalationId: 'ESC-001',
    nodeId: 'T-001',
    round: 1,
    state: 'pending',
    reasonCode: 'rounds_exceeded',
    reasonDetail: '回流超上限：测试已派发 2 次仍未通过',
    defects: [],
  }],
  approvals: [],
  current: null,
};

test('instance status：删掉唯一健康度行后与 I1.7 基线逐字相等', (t) => {
  const root = makeProject(t, 'status');
  startCoreOnEmptyRoot(root);
  writeSnapshot(root, frozenSuspendedSnapshot());

  const res = runCli(root, ['instance', 'status', 'INST-001']);
  assert.equal(res.code, 0, res.stdout + res.stderr);
  assert.equal(res.stderr, '');

  const healthLines = res.lines.filter((line) => line.startsWith('健康度'));
  assert.equal(healthLines.length, 1, `健康度行必须恰 1 行：\n${res.stdout}`);
  assert.equal(res.lines[1], '健康度 需关注 · 有待处理升级', `健康度行必须紧跟实例状态行：\n${res.stdout}`);

  const withoutHealth = res.lines.filter((_, index) => index !== 1);
  assert.deepEqual(withoutHealth, STATUS_BASELINE, `instance status 格式漂移：\n${res.stdout}`);
});

test('instance graph：文本与 JSON 均与 I1.7 基线逐字相等且不含健康度', (t) => {
  const root = makeProject(t, 'graph');
  startCoreOnEmptyRoot(root);
  writeSnapshot(root, frozenSuspendedSnapshot());

  const text = runCli(root, ['instance', 'graph', 'INST-001']);
  assert.equal(text.code, 0, text.stdout + text.stderr);
  assert.equal(text.stdout, GRAPH_TEXT_BASELINE, `graph 文本漂移：\n${text.stdout}`);
  assert.ok(!text.stdout.includes('健康度'), 'graph 文本不得出现健康度');
  assert.ok(!text.stdout.includes('health'), 'graph 文本不得出现 health 字段');

  const json = runCli(root, ['instance', 'graph', 'INST-001', '--format', 'json']);
  assert.equal(json.code, 0, json.stdout + json.stderr);
  assert.ok(!json.stdout.includes('健康度'), 'graph JSON 不得出现健康度');
  assert.ok(!json.stdout.includes('health'), 'graph JSON 不得出现 health 字段');
  assert.deepEqual(JSON.parse(json.stdout), GRAPH_JSON_BASELINE, `graph JSON 漂移：\n${json.stdout}`);
});

// ---------------------------------------------------------------------------
// AC-28 静态面（零依赖 / 纯净两轮 / CJK / 宿主分支 / 基线清单）
// ---------------------------------------------------------------------------

function readText(relPath) {
  return fs.readFileSync(path.join(REPO, relPath), 'utf8');
}

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'target' || entry.name.startsWith('.')) continue;
      out.push(...listFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.json', '.jsonl', '.svg', '.txt']);

test('零依赖 / USAGE_LINES 25 行（AC-28 冻结基线）', () => {
  const pkg = JSON.parse(readText('package.json'));
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, 'dependencies 必须为空（零依赖红线）');
  assert.equal(USAGE_LINES.length, 25, 'USAGE_LINES 必须恰 25 行（冻结基线）');
  assert.equal(USAGE_LINES[24], '  orch workflow dry-run <工作流> [--task <说明>] [--format text|json]');
});

test('31 词纯净扫描两轮：src/core+src/daemon 与 desktop/ui 均 exit 0（AC-28）', () => {
  assert.equal(WORDS_31.length, 31, '禁词表必须恰 31 个');
  for (const round of [1, 2]) {
    for (const dirs of ['src/core,src/daemon', 'desktop/ui']) {
      const res = spawnSync(process.execPath, [
        PURITY, '--dirs', dirs, '--forbid', WORDS_31.join(','),
      ], { cwd: REPO, env: envFor(), encoding: 'utf8', timeout: 60_000 });
      assert.equal(res.status, 0, `第 ${round} 轮 ${dirs} 纯净扫描必须 exit 0：\n${res.stdout}\n${res.stderr}`);
    }
  }
});

test('desktop/ui + desktop/harness CJK 零命中（AC-28 中文唯一来源）', () => {
  const cjk = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
  const hits = [];
  for (const dir of ['desktop/ui', 'desktop/harness']) {
    for (const file of listFiles(path.join(REPO, dir))) {
      if (!TEXT_EXT.has(path.extname(file).toLowerCase())) continue;
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (cjk.test(line)) hits.push(`${path.relative(REPO, file)}:${index + 1}: ${line.trim()}`);
      });
    }
  }
  assert.deepEqual(hits, [], `桌面层出现中文字面量（必须经 /ui/labels）：\n${hits.join('\n')}`);
});

test('无宿主分支：src/core + src/daemon 不出现 if (host …) / switch (host)（AC-28）', () => {
  const offenders = [];
  for (const dir of ['src/core', 'src/daemon']) {
    for (const file of listFiles(path.join(REPO, dir)).filter((f) => f.endsWith('.js'))) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (/\bswitch\s*\(\s*host\s*\)/.test(line) || /\bif\s*\(\s*host\s*[!=]==?/.test(line)) {
          offenders.push(`${path.relative(REPO, file)}:${index + 1}: ${line.trim()}`);
        }
      });
    }
  }
  assert.deepEqual(offenders, [], `出现按宿主身份走分支：\n${offenders.join('\n')}`);
});

test('全量基线清单存在且格式正确（不在本文件内跑全量，避免自递归）', () => {
  // 需求 v2 §3.3 登记的基线清单是 docs/iterations/iteration-7/baseline-failures.txt；
  // `test/fixtures/` 侧存放的是基线工具（purity-check / mock 宿主）。两者都校验。
  const manifest = path.join(REPO, 'docs', 'iterations', 'iteration-7', 'baseline-failures.txt');
  assert.equal(fs.existsSync(manifest), true, `基线清单缺失：${manifest}`);
  const lines = fs.readFileSync(manifest, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean);
  assert.equal(lines.length, 8, `基线失败集合必须恰 8 条（实际 ${lines.length}）`);
  assert.equal(new Set(lines).size, lines.length, '基线清单不得有重复项');
  for (const line of lines) {
    assert.ok(line.length >= 8, `基线清单存在过短/空行：${JSON.stringify(line)}`);
  }
  assert.ok(lines.some((line) => line.startsWith('NFR-02:')));
  assert.ok(lines.some((line) => line.startsWith('core.stop')));
  assert.ok(lines.some((line) => line.includes('task-loop 审核提示词')));
  for (const rel of ['test/fixtures/purity-check.mjs', 'test/fixtures/mock-acp-agent.js']) {
    assert.equal(fs.existsSync(path.join(REPO, rel)), true, `基线夹具缺失：${rel}`);
  }
});
