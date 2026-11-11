/**
 * WP-9 / I1.9 回归守护（跨批次汇合点，纯断言、不做产品改动）。
 *
 * 覆盖：
 * - AC-03：`single` / `code-loop` / `task-loop` 三条主链运行期输出不出现任何新增可见词，
 *   且归一化后与 I1.7 收口基线逐字一致、前缀分组与顺序不变（D-17 ⑥：不得只跑单次）；
 * - AC-19：`instance status` 原有各行逐字不变、只在实例状态行后多一行健康度；
 *   `instance graph` 文本 / JSON 与冻结快照逐字（深）相等且不含健康度字段；
 * - AC-20：零依赖 / `USAGE_LINES` 25 行 / 31 词纯净扫描 exit 0 / `src/daemon` 无宿主分支；
 * - AC-24：`src/core/orchestrator.js` 的 `object: 'session'` ≤ 13，
 *   会话级新增事件类型只有 `execution.summary`（每会话恰 1 条）；
 * - AC-01/AC-02：事件链 `seq` / `ts` / `prev_event_hash` 逐条可续，首条 64 个 0；
 * - AC-05：`traces.jsonl` 每行恰 7 字段、不存 `handoff_ids`、实例目录内无完整日志副本。
 *
 * 基线来源（详见回执）：
 * - 三主链：`docs/iterations/iteration-9/review-wp7-r2.md` §2.2/§2.3（D-17 ⑤ 冻结的
 *   「基线 `322fb5e` vs 当前」交替对照，A-0 归一化后 diff 为 0）与
 *   `docs/iterations/iteration-1/evidence/NFR-03.output.json`（`single` 原始 stdout）；
 * - `instance status` / `instance graph`：I1.7 收口后的 `render.js` 既有输出，
 *   本文件用冻结快照（固定本地时刻）逐字固化，健康度行是唯一新增；
 * - 事件链：`src/persistence/instance-store.js:53-66` 的 `canonicalize` + SHA-256 同口径。
 *
 * 夹具统一：项目根一律 `os.tmpdir()` 下独立 `mkdtemp`、`NODE_ENV=test`、
 * `.orch/hosts/mock.json` 指向仓库内 `test/fixtures/mock-acp-agent.js`；
 * 核心由真实 CLI 拉起，`t.after` 里 `core stop` 后清理。无网络、无 DSH 依赖。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
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

const HEX64 = /^[0-9a-f]{64}$/;
const ZERO_HASH = '0'.repeat(64);

/** AC-03 / AC-19 的运行期禁用词：三条主链的渲染路径不该碰到这三层。 */
const FORBIDDEN_RUNTIME_WORDS = ['健康度', '追踪', '执行摘要', '已跳过'];

function envFor() {
  return { ...process.env, NODE_ENV: 'test' };
}

function syncSleep(ms) {
  // 只用于进程退出后的目录清理重试，不参与任何时序断言（不用 sleep 凑时序）。
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function makeProject(t, tag, switches = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `maestro-i19-reg-${tag}-`));
  writeMockConfig(root, switches);
  t.after(() => {
    stopCore(root);
    removeProject(root);
  });
  return root;
}

function writeMockConfig(root, switches = []) {
  const dir = path.join(root, '.orch', 'hosts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'mock.json'), JSON.stringify({
    transport: 'stdio',
    launch: { command: process.execPath, args: [MOCK, ...switches] },
    limits: { ...LIMITS },
  }, null, 2), 'utf8');
}

function stopCore(root) {
  spawnSync(process.execPath, [BIN, 'core', 'stop'], {
    cwd: root,
    env: envFor(),
    timeout: 20_000,
    windowsHide: true,
  });
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

/** 先起核心再写快照：避免启动对账把写进去的 `running` 判成 `interrupted`（§3.3）。 */
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

function sha256File(file) {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** 本地时刻构造 ISO：`formatClock` 用本地时区，固定本地时钟才能逐字断言。 */
function localIso(h, m, s) {
  return new Date(2026, 10, 11, h, m, s).toISOString();
}

// ---------------------------------------------------------------- 三主链基线

/**
 * A-0 归一化（与 D-17 ⑤ 的 `/tmp/r2-normalize.mjs` 同口径）：只替换可变值，
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

/** 六类前缀分组；`任务已投递` 无前缀，归入 `other`（也必须逐字一致）。 */
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

/** 会话行的稳定标签（去掉可变后缀），用于白名单 / 顺序断言。 */
function sessionLabel(line) {
  if (line.startsWith('会话已创建')) return '会话已创建';
  for (const label of ['会话 执行中', '会话 等待下游', '会话 空闲', '会话 已升级']) {
    if (line.startsWith(label)) return label;
  }
  return null;
}

// ---------------------------------------------------------------- AC-03

test('三主链：无新增可见词，且归一化后与 I1.7 收口基线逐字一致（AC-03）', async (t) => {
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
          `${template} 运行期输出出现新增可见词「${word}」（AC-03 红线）：\n${res.stdout}`,
        );
      }
    }

    const baseline = spec.baseline;
    const baselineGroups = groupLines(baseline);
    const baselineLabels = baselineGroups.会话.map(sessionLabel);

    // 整份归一化逐字命中次数：`single` / `code-loop` 的基线在 2/2 对 + 21 次比对中
    // 100% 稳定（`review-wp7-r2` §2），因此**每次运行都必须整份命中**；只有 `task-loop`
    // 的 `会话 已升级` 在基线本身 flaky（D-17 ⑥），才允许「N 次中至少 1 次」。
    const exact = runs.filter((res) => {
      const normalized = res.lines.map(normalizeLine);
      return normalized.length === baseline.length && normalized.every((line, i) => line === baseline[i]);
    });
    const requiredExactRuns = template === 'task-loop' ? 1 : spec.runs;

    for (const res of runs) {
      const normalized = res.lines.map(normalizeLine);
      const groups = groupLines(normalized);

      // ① 无前缀行（只有 `任务已投递`）逐字一致。
      assert.deepEqual(groups.other, ['任务已投递'], `${template} 出现未归类输出行：\n${res.stdout}`);

      // ② 确定性前缀组：整组逐字 + 顺序相等（等价于「每组行数与基线一致」）。
      for (const prefix of ['实例', '节点', '交接包', '升级', '下一步']) {
        assert.deepEqual(
          groups[prefix],
          baselineGroups[prefix],
          `${template} 的「${prefix}」分组与基线不一致：\n${res.stdout}`,
        );
      }

      // ③ 会话组：白名单 + 顺序（基线序的子序列）+ 不得重复多出。
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

      // ④ D-17 ⑥：`会话 已升级` 命中时必须位于 `会话 空闲` 之后、`实例 · 已挂起` 之前。
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

    // task-loop 的 `会话 已升级` 基线出现率约 9/10（D-17 ⑥ 实测 flaky），
    // 因此只要求多次运行中至少命中一次，并已在上面做位置断言。
    if (template === 'task-loop') {
      const hits = runs.filter((res) => res.lines.some((line) => line === '会话 已升级')).length;
      assert.ok(hits >= 1, `task-loop 连续 ${spec.runs} 次均缺「会话 已升级」，低于基线分布：\n${runs.map((r) => r.stdout).join('\n---\n')}`);
    }
  }
});

// ---------------------------------------------------------------- AC-19

/** 冻结快照：`code-loop` 已挂起、T-001 完成、T-002 升级、HO-001 已消费（时刻固定）。 */
function frozenSuspendedSnapshot() {
  return {
    schemaVersion: 2,
    instanceId: 'INST-001',
    coreGeneration: 'gen-i19-regression',
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

test('instance status：只在实例状态行后多一行健康度，删掉后与基线逐字相等（AC-19）', async (t) => {
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
  assert.deepEqual(withoutHealth, STATUS_BASELINE, `删掉健康度行后必须与 I1.7 基线逐字相等：\n${res.stdout}`);
});

test('instance graph：文本与 JSON 均与基线逐字相等且不含健康度（AC-19）', async (t) => {
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

// ---------------------------------------------------------------- AC-20 / AC-24 静态门禁

function readText(relPath) {
  return fs.readFileSync(path.join(REPO, relPath), 'utf8');
}

function countOccurrences(text, needle) {
  let count = 0;
  let index = 0;
  for (;;) {
    const found = text.indexOf(needle, index);
    if (found === -1) return count;
    count += 1;
    index = found + needle.length;
  }
}

test('零依赖与 USAGE_LINES 冻结基线（AC-20）', () => {
  const pkg = JSON.parse(readText('package.json'));
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, 'dependencies 必须为空（零依赖红线）');

  assert.equal(USAGE_LINES.length, 25, 'USAGE_LINES 必须恰 25 行（冻结基线）');
  assert.deepEqual(USAGE_LINES.slice(0, 8), [
    '用法：orch run|status|cancel|core',
    '  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]',
    '  orch status [--instance <实例号>] [--events]',
    '  orch cancel --instance <实例号>',
    '  orch core stop',
    '  orch role list [--group <组>] [--instance <实例号>] [--format text|json]',
    '  orch role show <角色> [--instance <实例号>] [--format text|json]',
    '  orch role validate [<角色>] [--format json]',
  ], 'USAGE_LINES 前 8 行必须逐字不变');
  assert.equal(
    USAGE_LINES[24],
    '  orch workflow dry-run <工作流> [--task <说明>] [--format text|json]',
    'USAGE_LINES 末行必须逐字不变',
  );
});

test('31 词纯净扫描：新增 core 文件纳入同一扫描且 exit 0（AC-20）', () => {
  const words = [
    'task-loop', 'researcher', 'writer', 'reviewer', '研究员', '撰写者', '审核者',
    'code-loop', 'developer', 'tester', 'coordinator', 'arbiter', 'planner',
    'summarizer', 'worker', 'data-analyst', 'fact-checker', 'editor', 'code-reviewer',
    'compliance-reviewer', 'requirement-clarifier', 'research-brief', 'fact-check',
    'data-analysis', 'doc-draft', 'doc-review', 'code-change', 'test-run', 'code-review',
    'coordination', 'compliance-check',
  ];
  assert.equal(words.length, 31, '禁词表必须恰 31 个（D-6 登记表，不得增删）');

  const res = spawnSync(process.execPath, [
    PURITY, '--dirs', 'src/core,src/daemon', '--forbid', words.join(','),
  ], { cwd: REPO, env: envFor(), encoding: 'utf8', timeout: 60_000 });
  assert.equal(res.status, 0, `纯净扫描必须 exit 0：\n${res.stdout}\n${res.stderr}`);
  assert.ok(!res.stderr.includes('命中'), res.stderr);
});

test('无宿主分支：src/daemon 不出现 if host == / switch (host)（AC-20）', () => {
  const dir = path.join(REPO, 'src', 'daemon');
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.js'));
  assert.ok(files.length > 0, 'src/daemon 必须有源文件');

  for (const file of files) {
    const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
    lines.forEach((line, index) => {
      assert.ok(
        !/switch\s*\(\s*host/i.test(line),
        `src/daemon/${file}:${index + 1} 出现 switch (host) 宿主分支`,
      );
      // 排除 `typeof xxx.hostId === 'string'` 这类类型守卫：它不是按宿主身份走分支。
      const isHostBranch =
        /\bif\s*\(/.test(line) &&
        !/typeof/.test(line) &&
        /\bhost[A-Za-z]*\s*(===?|!==?)/.test(line);
      assert.ok(!isHostBranch, `src/daemon/${file}:${index + 1} 出现 if (host …) 宿主分支`);
    });
  }
});

test('会话级事件类型只有 execution.summary 一种新增（AC-24）', () => {
  const orchestrator = readText(path.join('src', 'core', 'orchestrator.js'));
  const lines = orchestrator.split('\n');

  const needle = "object: 'session'";
  const sites = [];
  lines.forEach((line, index) => {
    if (line.includes(needle)) sites.push(index);
  });

  // AC-24 冻结口径（D-16 ⑤ 实测）：`grep -c "object: 'session'" src/core/orchestrator.js` ≤ 13。
  assert.ok(sites.length <= 13, `orchestrator.js 的会话发射点 ${sites.length} 处，超过冻结上限 13（AC-24）`);
  assert.ok(sites.length >= 1, 'orchestrator.js 必须仍有会话事件发射点');

  // 会话级 reason 白名单 = 12 处既有发射点 + 1 处 execution.summary（D-1 U-7 / AC-24）。
  const allowedReasons = new Set([
    'execution.summary',
    'permission.requested',
    'permission.allowed',
    'permission.denied',
    'session.state',
    'output.submitted',
    'run.completed',
    'run.cancelled',
    'state.change',
  ]);

  const literalReasons = new Set();
  for (const start of sites) {
    const window = lines.slice(start, start + 9).join('\n');
    const match = window.match(/reason:\s*([^\n]+)/);
    if (!match) continue; // 走变量 reason 的通用发射点（既有，不新增字面量）
    const raw = match[1].trim();
    // 三元式 `cond === 'allow' ? 'permission.allowed' : 'permission.denied'`：
    // 只取 `?` 之后的取值分支，避免把判断操作数当成 reason。
    const valuePart = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : raw;
    for (const quoted of valuePart.matchAll(/'([^']+)'/g)) literalReasons.add(quoted[1]);
  }

  const unknownReasons = [...literalReasons].filter((reason) => !allowedReasons.has(reason));
  assert.deepEqual(
    unknownReasons,
    [],
    `会话级事件出现白名单外的新 reason：${unknownReasons.join(', ')}`,
  );
  assert.ok(literalReasons.has('execution.summary'), 'execution.summary 必须仍走会话发射点');
  // 只允许新增 `execution.summary` 这一种：写入点恰 1 处，且不得新增第二类逐条会话事件。
  assert.equal(
    countOccurrences(orchestrator, "reason: 'execution.summary'"),
    1,
    'execution.summary 写入点必须恰 1 处（AC-24）',
  );

  // daemon 侧不得新增会话事件发射点。
  const daemonDir = path.join(REPO, 'src', 'daemon');
  for (const file of fs.readdirSync(daemonDir).filter((name) => name.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(daemonDir, file), 'utf8');
    assert.equal(
      countOccurrences(text, needle),
      0,
      `src/daemon/${file} 不得新增会话事件发射点（AC-24）`,
    );
  }

  // 其他 core 文件只允许既有的 escalation.js 一处（I1.3 存量，AC-24 冻结命令只数 orchestrator.js）。
  const coreDir = path.join(REPO, 'src', 'core');
  const otherSites = fs.readdirSync(coreDir)
    .filter((name) => name.endsWith('.js') && name !== 'orchestrator.js')
    .map((name) => ({ name, count: countOccurrences(fs.readFileSync(path.join(coreDir, name), 'utf8'), needle) }))
    .filter((row) => row.count > 0);
  assert.deepEqual(
    otherSites,
    [{ name: 'escalation.js', count: 1 }],
    'src/core 除 orchestrator.js 外只允许既有 escalation.js 的 1 处会话发射点',
  );
});

// ---------------------------------------------------------------- AC-01 / AC-02 / AC-05

/** 测试侧独立实现的规范化序列化 + SHA-256（与 instance-store.js:53-66 同口径）。 */
function canonicalize(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(',')}}`;
}

function chainHash(record) {
  return crypto.createHash('sha256').update(canonicalize(record), 'utf8').digest('hex');
}

function readJsonLines(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line));
}

test('事件链逐条可续、每会话恰 1 条 execution.summary、traces 恰 7 字段（AC-01/02/05/24）', async (t) => {
  const root = makeProject(t, 'chain');
  const run = runCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '写一段流程说明']);
  assert.equal(run.code, 0, run.stdout + run.stderr);

  const dir = instanceDir(root);
  const records = readJsonLines(path.join(dir, 'events.jsonl'));
  assert.ok(records.length > 0, '事件日志不得为空');

  for (const [index, record] of records.entries()) {
    assert.equal(Number.isInteger(record.seq), true, `第 ${index + 1} 条缺 seq`);
    assert.equal(typeof record.ts, 'string', `第 ${index + 1} 条缺 ts`);
    assert.match(record.prev_event_hash, HEX64, `第 ${index + 1} 条的 prev_event_hash 不是 64 位十六进制`);
    assert.equal(record.seq, index + 1, `第 ${index + 1} 条 seq 必须连续递增`);
    if (index === 0) {
      assert.equal(record.prev_event_hash, ZERO_HASH, '首条 prev_event_hash 必须是 64 个 0');
    } else {
      assert.equal(
        record.prev_event_hash,
        chainHash(records[index - 1]),
        `第 ${index + 1} 条的 prev_event_hash 必须等于第 ${index} 条记录的规范化 SHA-256`,
      );
    }
  }

  const summaries = records.filter((record) => record.object === 'session' && record.reason === 'execution.summary');
  assert.ok(summaries.length > 0, '成功结束的实例也必须留下执行摘要');
  const bySession = new Map();
  for (const record of summaries) {
    bySession.set(record.objectId, (bySession.get(record.objectId) ?? 0) + 1);
  }
  for (const [sessionId, count] of bySession) {
    assert.equal(count, 1, `会话 ${sessionId} 的 execution.summary 必须恰 1 条，实际 ${count}`);
  }
  assert.equal(
    summaries.length,
    bySession.size,
    '全文摘要数必须等于会话数（AC-27 同口径）',
  );

  // 会话级事件除既有 12 类 + execution.summary 外不得出现第三类。
  const sessionReasons = new Set(
    records.filter((record) => record.object === 'session').map((record) => record.reason),
  );
  for (const reason of sessionReasons) {
    assert.ok(
      ['execution.summary', 'session.state', 'output.submitted', 'run.completed', 'run.cancelled',
        'permission.requested', 'permission.allowed', 'permission.denied', 'state.change'].includes(reason),
      `出现新增会话级事件类型：${reason}`,
    );
  }

  // traces.jsonl：每行恰 7 字段、不存 handoff_ids（由快照推导）。
  const tracesFile = path.join(dir, 'state', 'traces.jsonl');
  assert.ok(fs.existsSync(tracesFile), 'traces.jsonl 必须落在实例的 state/ 子目录');
  const spans = readJsonLines(tracesFile);
  assert.ok(spans.length > 0, '跑完的实例至少一条跨度');
  const fields = ['trace_id', 'instance_id', 'node_id', 'round', 'start_time', 'end_time', 'status'];
  for (const span of spans) {
    assert.deepEqual(Object.keys(span).sort(), [...fields].sort(), `跨度字段必须恰 7 个：${JSON.stringify(span)}`);
    assert.equal(Object.hasOwn(span, 'handoff_ids'), false, 'traces.jsonl 不得存 handoff_ids');
  }

  // AC-05：实例目录内不得出现宿主完整日志副本（只允许摘要与引用）。
  const strayLogs = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.log')) strayLogs.push(path.relative(dir, full));
    }
  };
  walk(dir);
  assert.deepEqual(strayLogs, [], `实例目录不得复制宿主完整日志：${strayLogs.join(', ')}`);
  assert.equal(fs.existsSync(path.join(dir, 'host-logs')), false, '实例目录不得存在 host-logs 副本');
});
