#!/usr/bin/env node
// code-loop driver：准备夹具现场 + 用产品 CLI 发起 `code-loop` 实例。
//
// 纪律（需求 v15 §3.3 / 拆分 §1.7）：
// 1. 只写 `<root>/.mock/` 与 `<root>/.orch/hosts/`；**绝不**改 `state.json` 造中间态。
// 2. 实例一律由 `bin/orch.js run` 发起，不 import orchestrator，不走旁路。
// 3. 场景表是唯一事实来源：mock-acp-agent.js 从这里 import，避免两份表漂移。
// 4. `--prepare-only` 只准备现场，不启核心、不建实例。
//
// 场景文件（可选覆盖）：`test/fixtures/scenarios/<name>.json`
//   { "steps": [ { write, verdict, summary, message, sessionNew, hostError, hold,
//                  historyMarker, delayMs, nodeId, round, remove, verdictUtimes } ],
//     "stopAfter": <n|null> }
// 文件不存在时用本文件内置的场景表。

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const MOCK_AGENT_PATH = path.join(HERE, 'mock-acp-agent.js');
export const SCENARIOS_DIR = path.join(HERE, 'scenarios');
const ORCH_BIN = path.join(REPO_ROOT, 'bin', 'orch.js');

export const DEFAULT_TASK = [
  '给 calc.js 补一个 div 函数，让 node --test 全绿。',
  '改动写在 calc.js',
  '产物：calc.js',
].join('\n');

const MOCK_STALE_MTIME = '2020-01-01T00:00:00Z';

// ---------------------------------------------------------------- 产物内容

const CALC_ROUND1 = `export function add(a, b) {
  return a + b;
}

export function sub(a, b) {
  return a - b;
}

export function mul(a, b) {
  return a * b;
}

// div：第 1 轮只处理正常输入（不写除零边界）
export function div(a, b) {
  return a / b;
}
`;

const CALC_ROUND2 = `export function add(a, b) {
  return a + b;
}

export function sub(a, b) {
  return a - b;
}

export function mul(a, b) {
  return a * b;
}

// div：第 2 轮按回流缺陷补齐除零边界
export function div(a, b) {
  if (b === 0) throw new Error('division by zero');
  return a / b;
}
`;

const TEST_LOG_1 = [
  'not ok 1 - div(1, 0) 应当抛错',
  '  expected: throw',
  '  actual: Infinity',
].join('\n') + '\n';

const TEST_LOG_2 = [
  'not ok 2 - div(6, 3) 应当等于 2',
  '  expected: 2',
  '  actual: 2.0000000000000004',
].join('\n') + '\n';

const DEFECTS_2 = [
  { summary: 'div 在除数为 0 时返回 Infinity，未抛错', evidence: 'out/test-log.txt' },
  { summary: 'div 在整除场景存在浮点误差', evidence: 'out/test-log-2.txt' },
];
const DEFECTS_1 = [{ summary: 'div 在除数为 0 时返回 Infinity，未抛错', evidence: 'out/test-log.txt' }];

// ---------------------------------------------------------------- step 构造

function devStep(round, extra = {}) {
  return {
    write: [{ path: 'calc.js', content: round === 1 ? CALC_ROUND1 : CALC_ROUND2 }],
    verdict: null,
    message: 'mock: done',
    // 第 1 轮留下会话内标记：后续派发若看见它，说明夹带了上一轮对话（AC-43）。
    historyMarker: round === 1 ? 'DEV-ROUND1' : null,
    ...extra,
  };
}

function testerStep(extra = {}) {
  return {
    write: [],
    verdict: null,
    message: 'mock: done',
    ...extra,
  };
}

function passStep(extra = {}) {
  return testerStep({
    write: [{ path: 'out/verdict.json', content: JSON.stringify({ verdict: 'pass', defects: [] }, null, 2) + '\n' }],
    verdict: { verdict: 'pass', defects: [] },
    ...extra,
  });
}

function failStep(defects, extra = {}) {
  const logs = [
    { path: 'out/test-log.txt', content: TEST_LOG_1 },
    { path: 'out/test-log-2.txt', content: TEST_LOG_2 },
  ].slice(0, Math.max(1, defects.length));
  return testerStep({
    write: logs,
    verdict: { verdict: 'fail', defects },
    ...extra,
  });
}

// ---------------------------------------------------------------- 场景表

function baseBackflow() {
  return [devStep(1), failStep(DEFECTS_2), devStep(2), passStep()];
}

const BUILTIN = {
  // 一轮通过（doc 名 code-pass）
  pass: { steps: [devStep(1), passStep()], stopAfter: null },

  // 第 1 轮不通过 → 回流 → 第 2 轮通过（doc 名 backflow-once）
  backflow: { steps: baseBackflow(), stopAfter: null },

  // 两轮都不通过 → 升级（doc 名 backflow-twice / retest-fail）
  'rounds-exceeded': {
    steps: [devStep(1), failStep(DEFECTS_2), devStep(2), failStep(DEFECTS_1)],
    stopAfter: null,
  },

  'verdict-missing': { steps: [devStep(1), testerStep({ verdict: null })], stopAfter: null },
  'verdict-bad-json': {
    steps: [devStep(1), testerStep({
      write: [{ path: 'out/verdict.json', content: '{ "verdict": "pass", ' }],
      verdict: 'raw:{ "verdict": "pass", ',
    })],
    stopAfter: null,
  },
  // 缺 verdict 字段（doc 名 verdict-no-field 别名到本场景）
  'verdict-schema': {
    steps: [devStep(1), testerStep({
      write: [{ path: 'out/verdict.json', content: '{ "defects": [] }\n' }],
      verdict: { defects: [] },
    })],
    stopAfter: null,
  },
  // verdict 取值不是 pass/fail（doc 名 verdict-maybe）
  'verdict-maybe': {
    steps: [devStep(1), testerStep({
      write: [{ path: 'out/verdict.json', content: '{ "verdict": "maybe", "defects": [] }\n' }],
      verdict: { verdict: 'maybe', defects: [] },
    })],
    stopAfter: null,
  },
  'verdict-no-defects': {
    steps: [devStep(1), testerStep({
      write: [{ path: 'out/verdict.json', content: '{ "verdict": "fail", "defects": [] }\n' }],
      verdict: { verdict: 'fail', defects: [] },
    })],
    stopAfter: null,
  },
  'verdict-evidence-unreadable': {
    steps: [devStep(1), testerStep({
      write: [{ path: 'out/verdict.json', content: '{ "verdict": "fail", "defects": [ { "summary": "除零边界缺失", "evidence": "out/missing-log.txt" } ] }\n' }],
      verdict: { verdict: 'fail', defects: [{ summary: '除零边界缺失', evidence: 'out/missing-log.txt' }] },
    })],
    stopAfter: null,
  },
  'verdict-stale': {
    steps: [devStep(1), passStep({ verdictUtimes: MOCK_STALE_MTIME })],
    stopAfter: null,
  },
  'verdict-stale-retest': {
    steps: [devStep(1), failStep(DEFECTS_2), devStep(2), passStep({ verdictUtimes: MOCK_STALE_MTIME })],
    stopAfter: null,
  },

  // 派发失败：首次（第 1 步）
  'dispatch-fail': { steps: [devStep(1, { sessionNew: 'fail' })], stopAfter: null },
  // 派发失败：复测（第 4 步）
  'dispatch-fail-retest': {
    steps: [devStep(1), failStep(DEFECTS_2), devStep(2), passStep({ sessionNew: 'fail' })],
    stopAfter: null,
  },

  // 测试第 1 轮执行中（会话未建，mock 侧暂停）
  'hold-test': { steps: [devStep(1), testerStep({ hold: { when: 'start' } })], stopAfter: null },
  // 复测第 2 轮执行中（会话已建、可取消）
  'retest-slow': {
    steps: [devStep(1), failStep(DEFECTS_2), devStep(2), passStep({ delayMs: 30_000 })],
    stopAfter: null,
  },

  // 开发产物缺失 / 为空 / 陈旧
  'product-missing': { steps: [devStep(1, { write: [], remove: ['calc.js'] })], stopAfter: null },
  'product-empty': { steps: [devStep(1, { write: [{ path: 'calc.js', content: '' }] })], stopAfter: null },
  'product-stale': {
    steps: [devStep(1, { write: [{ path: 'calc.js', content: CALC_ROUND1, utimes: MOCK_STALE_MTIME }] })],
    stopAfter: null,
  },
};

// 文档（需求 §3.3 / AC）引用的别名 → 内置场景
export const SCENARIO_ALIASES = Object.freeze({
  'code-pass': 'pass',
  'backflow-once': 'backflow',
  'backflow-twice': 'rounds-exceeded',
  'retest-fail': 'rounds-exceeded',
  'artifact-missing': 'product-missing',
  'artifact-empty': 'product-empty',
  'artifact-stale': 'product-stale',
  'dispatch-fail-first': 'dispatch-fail',
  'verdict-no-field': 'verdict-schema',
  'verdict-missing-evidence': 'verdict-evidence-unreadable',
});

// 需要额外组合（不能纯别名）的 doc 场景
const COMPOSED = {
  'backflow-hold': () => {
    const steps = baseBackflow();
    steps[2] = { ...steps[2], hold: { when: 'start' } };
    return { steps, stopAfter: null };
  },
  'retest-hold': () => {
    const steps = baseBackflow();
    steps[3] = { ...steps[3], hold: { when: 'start' } };
    return { steps, stopAfter: null };
  },
  'hold-forever': () => ({ steps: [devStep(1, { hold: { when: 'start' } })], stopAfter: null }),
  'verdict-says-fail': () => ({
    // 说“全部通过”，判定写 fail：应触发回流，第 2 轮修复后完成
    steps: [devStep(1), failStep(DEFECTS_2, { message: '全部通过' }), devStep(2), passStep()],
    stopAfter: null,
  }),
  'verdict-pass-with-defects': () => ({
    steps: [devStep(1), testerStep({
      write: [
        { path: 'out/verdict.json', content: JSON.stringify({ verdict: 'pass', defects: [DEFECTS_1[0]] }, null, 2) + '\n' },
        { path: 'out/test-log.txt', content: TEST_LOG_1 },
      ],
      verdict: { verdict: 'pass', defects: [DEFECTS_1[0]] },
    })],
    stopAfter: null,
  }),
  'dispatch-fail-backflow': () => {
    const steps = baseBackflow();
    steps[2] = { ...steps[2], sessionNew: 'fail' };
    return { steps, stopAfter: null };
  },
};

export const SCENARIOS = Object.freeze({
  ...BUILTIN,
  ...Object.fromEntries(Object.entries(COMPOSED).map(([name, make]) => [name, make()])),
});

/** 场景名归一化：别名 → 内置名；未知名原样返回（交给 getScenario 报错）。 */
export function resolveScenarioName(name) {
  return SCENARIO_ALIASES[name] ?? name;
}

export function scenarioNames() {
  return [...new Set([...Object.keys(SCENARIOS), ...Object.keys(SCENARIO_ALIASES)])].sort();
}

function normalizeStep(step, index) {
  const n = index + 1;
  return {
    write: Array.isArray(step.write) ? step.write.slice() : [],
    verdict: step.verdict === undefined ? null : step.verdict,
    summary: step.summary ?? null,
    message: step.message ?? 'mock: done',
    sessionNew: step.sessionNew === 'fail' ? 'fail' : 'ok',
    hostError: step.hostError ?? null,
    hold: step.hold && step.hold.when === 'start' ? { when: 'start' } : null,
    historyMarker: typeof step.historyMarker === 'string' && step.historyMarker.length > 0 ? step.historyMarker : null,
    delayMs: Math.max(0, Number(step.delayMs) || 0),
    nodeId: step.nodeId ?? (n % 2 === 1 ? 'T-001' : 'T-002'),
    round: Number.isInteger(step.round) && step.round > 0 ? step.round : Math.ceil(n / 2),
    remove: Array.isArray(step.remove) ? step.remove.slice() : [],
    verdictUtimes: step.verdictUtimes ?? null,
  };
}

/**
 * 取场景定义。优先读 `test/fixtures/scenarios/<resolved>.json`，否则用内置表。
 * 返回的每一步都已补齐 nodeId/round 等缺省字段。
 */
export function getScenario(name, { repoRoot = REPO_ROOT } = {}) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('场景名必填');
  }
  const resolved = resolveScenarioName(name);
  let raw = null;
  const filePath = path.join(repoRoot, 'test', 'fixtures', 'scenarios', `${resolved}.json`);
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err?.code !== 'ENOENT') throw new Error(`场景文件不可解析：${filePath}（${err.message}）`);
  }
  if (!raw) raw = SCENARIOS[resolved] ?? SCENARIOS[name] ?? null;
  if (!raw) throw new Error(`未知场景：${name}`);
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
    throw new Error(`场景没有 steps：${name}`);
  }
  const stopAfter = Number.isInteger(raw.stopAfter) && raw.stopAfter > 0 ? raw.stopAfter : null;
  return {
    name,
    resolved,
    stopAfter,
    steps: raw.steps.map(normalizeStep),
  };
}

// ---------------------------------------------------------------- 现场准备

function parseDriverArgv(argv) {
  const opts = {
    root: null,
    scenario: null,
    cwd: null,
    task: null,
    stopAfter: null,
    keep: false,
    reset: false,
    prepareOnly: false,
    help: false,
  };
  const nextValue = (i, inline) => (inline !== undefined ? inline : argv[i + 1]);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`多余的参数：${arg}`);
    const eq = arg.indexOf('=');
    const key = eq >= 0 ? arg.slice(0, eq) : arg;
    const inline = eq >= 0 ? arg.slice(eq + 1) : undefined;
    switch (key) {
      case '--root': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        if (typeof value !== 'string' || value.length === 0) throw new Error('--root 需要一个值');
        opts.root = value;
        break;
      }
      case '--scenario': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        if (typeof value !== 'string' || value.length === 0) throw new Error('--scenario 需要一个值');
        opts.scenario = value;
        break;
      }
      case '--cwd': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        opts.cwd = value ?? null;
        break;
      }
      case '--task': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        opts.task = value ?? null;
        break;
      }
      case '--stop-after': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        const n = Number(value);
        if (!Number.isInteger(n) || n <= 0) throw new Error('--stop-after 需要正整数');
        opts.stopAfter = n;
        break;
      }
      case '--keep':
        opts.keep = true;
        break;
      case '--reset':
        opts.reset = true;
        break;
      case '--prepare-only':
        opts.prepareOnly = true;
        break;
      case '--help':
        opts.help = true;
        break;
      default:
        throw new Error(`未知参数：${key}`);
    }
  }
  return opts;
}

function usage() {
  return [
    '用法：node test/fixtures/code-loop-driver.mjs --root <项目根绝对路径> --scenario <场景名>',
    '        [--cwd <任务目录>] [--task <任务文本>] [--stop-after <n>]',
    '        [--keep] [--reset] [--prepare-only]',
    '',
    `场景：${scenarioNames().join(', ')}`,
  ].join('\n');
}

function hostConfigFor(root, scenario) {
  return {
    id: 'mock',
    transport: 'stdio',
    launch: {
      command: process.execPath,
      args: [MOCK_AGENT_PATH, '--root', root, '--scenario', scenario],
    },
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

/** 准备现场：清 `.mock/`（可选）→ cursor.json → `.orch/hosts/mock.json`。 */
export function prepareScene({ root, scenario, reset = false }) {
  const mockDir = path.join(root, '.mock');
  if (reset) fs.rmSync(mockDir, { recursive: true, force: true });
  fs.mkdirSync(mockDir, { recursive: true });
  fs.mkdirSync(path.join(mockDir, 'prompts'), { recursive: true });
  fs.mkdirSync(path.join(mockDir, 'history'), { recursive: true });

  const cursorPath = path.join(mockDir, 'cursor.json');
  fs.writeFileSync(cursorPath, JSON.stringify({ next: 1 }), 'utf8');

  const hostPath = path.join(root, '.orch', 'hosts', 'mock.json');
  writeJson(hostPath, hostConfigFor(root, scenario));

  return {
    mockDir,
    cursorPath,
    hostPath,
    cursor: { next: 1 },
    host: hostConfigFor(root, scenario),
  };
}

// ---------------------------------------------------------------- 核心驱动

function cleanEnv(extra = {}) {
  const env = { ...process.env };
  // 环境覆盖优先级高于 host 配置；残留会让 mock 静默变回真实 DSH。
  delete env.MAESTRO_DSH_EXE;
  delete env.MAESTRO_DSH_BIN;
  delete env.MAESTRO_DSH_ARGS;
  return { ...env, NODE_ENV: 'test', ...extra };
}

function stopCore(root, env) {
  try {
    spawnSync(process.execPath, [ORCH_BIN, 'core', 'stop'], {
      cwd: root,
      env,
      timeout: 5_000,
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch {
    // best-effort：核心本来就没跑也不影响后面
  }
}

function startRun({ root, cwd, task, env }) {
  const args = [
    ORCH_BIN,
    'run',
    '--cwd', cwd,
    '--task', task,
    '--template', 'code-loop',
    '--host', 'mock',
  ];
  const child = spawn(process.execPath, args, {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    stdout += text;
    process.stderr.write(text);
  });
  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    stderr += text;
    process.stderr.write(text);
  });
  const exited = new Promise((resolve) => {
    child.once('error', (err) => resolve({ code: null, signal: null, error: String(err?.message ?? err) }));
    child.once('exit', (code, signal) => resolve({ code, signal, error: null }));
  });
  return { child, exited, getStdout: () => stdout, getStderr: () => stderr };
}

function readLatestState(root) {
  const dir = path.join(root, '.orch', 'instances');
  let ids = [];
  try {
    ids = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const candidates = [];
  for (const id of ids) {
    const file = path.join(dir, id, 'state.json');
    try {
      const stat = fs.statSync(file);
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      candidates.push({ id, file, mtimeMs: stat.mtimeMs, state: parsed });
    } catch {
      // 半截实例或坏文件：跳过
    }
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0] ?? null;
}

function check(name, ok, detail = null) {
  return { name, ok: Boolean(ok), ...(detail === null ? {} : { detail }) };
}

/** 按场景断言。只读 state.json，不写。 */
export function assertScenario(resolved, snapshot, { paused = false, stopped = false } = {}) {
  const checks = [];
  if (!snapshot) {
    checks.push(check('state.json 存在', false, '实例未落盘'));
    return checks;
  }
  const s = snapshot.state;
  const nodes = Array.isArray(s.nodes) ? s.nodes : [];
  const handoffs = Array.isArray(s.handoffs) ? s.handoffs : [];
  const escalations = Array.isArray(s.escalations) ? s.escalations : [];
  const reason = escalations[0]?.reasonCode ?? null;

  if (resolved === 'pass') {
    checks.push(check('state=completed', s.state === 'completed', s.state));
    checks.push(check('两节点 done', nodes.length === 2 && nodes.every((n) => n.state === 'done')));
    checks.push(check('handoffs=1 forward', handoffs.length === 1 && handoffs[0]?.edge?.kind === 'forward'));
    return checks;
  }
  if (resolved === 'backflow') {
    checks.push(check('state=completed', s.state === 'completed', s.state));
    checks.push(check('两节点 round=2 done', nodes.length === 2 && nodes.every((n) => n.state === 'done' && n.round === 2)));
    checks.push(check('handoffs=3 forward/backflow/retest', handoffs.length === 3
      && handoffs[0]?.edge?.kind === 'forward'
      && handoffs[1]?.edge?.kind === 'backflow'
      && handoffs[2]?.edge?.kind === 'retest'));
    return checks;
  }
  if (resolved === 'rounds-exceeded') {
    checks.push(check('state=suspended', s.state === 'suspended', s.state));
    checks.push(check('nodes[1]=escalated round=2', nodes[1]?.state === 'escalated' && nodes[1]?.round === 2));
    checks.push(check('escalation reason=rounds_exceeded', reason === 'rounds_exceeded', reason));
    return checks;
  }
  if (resolved === 'verdict-says-fail') {
    checks.push(check('state=completed', s.state === 'completed', s.state));
    checks.push(check('存在 backflow 交接包', handoffs.some((h) => h?.edge?.kind === 'backflow')));
    checks.push(check('两节点 round=2', nodes.length === 2 && nodes.every((n) => n.round === 2)));
    return checks;
  }
  if (resolved === 'verdict-pass-with-defects') {
    checks.push(check('state=suspended', s.state === 'suspended', s.state));
    checks.push(check('escalation reason=verdict_invalid', reason === 'verdict_invalid', reason));
    checks.push(check('无 backflow 交接包', !handoffs.some((h) => h?.edge?.kind === 'backflow')));
    return checks;
  }
  if (resolved.startsWith('verdict-')) {
    const expected = resolved === 'verdict-missing'
      ? 'verdict_missing'
      : resolved.startsWith('verdict-stale') ? 'verdict_stale' : 'verdict_invalid';
    checks.push(check('state=suspended', s.state === 'suspended', s.state));
    checks.push(check(`escalation reason=${expected}`, reason === expected, reason));
    checks.push(check('无 backflow 交接包', !handoffs.some((h) => h?.edge?.kind === 'backflow')));
    return checks;
  }
  if (resolved.startsWith('dispatch-fail')) {
    checks.push(check('state=suspended', s.state === 'suspended', s.state));
    checks.push(check('escalation reason=dispatch_failed', reason === 'dispatch_failed', reason));
    return checks;
  }
  if (resolved.startsWith('product-')) {
    checks.push(check('state=suspended', s.state === 'suspended', s.state));
    checks.push(check('存在升级', escalations.length === 1));
    checks.push(check('reason 属于产物核对', typeof reason === 'string' && /^(artifact|product)_/.test(reason), reason));
    return checks;
  }
  // hold 系列：目标就是停在暂停点
  if (resolved === 'hold-test' || resolved === 'retest-slow' || resolved === 'hold-forever'
    || resolved === 'backflow-hold' || resolved === 'retest-hold') {
    checks.push(check('停在暂停/执行点', paused || stopped || s.state === 'running', { paused, stopped, state: s.state }));
    return checks;
  }
  checks.push(check('未知场景：不做断言', true, resolved));
  return checks;
}

function markerOf(mockDir, name) {
  return fs.existsSync(path.join(mockDir, name));
}

/**
 * 等目标：child 退出 / `.mock/paused` / `.mock/stopped-after-<n>`。
 * keep 时无上限；否则 60 秒后返回 timeout。
 */
async function waitForTarget({ childExited, mockDir, stopAfter, keep }) {
  const started = Date.now();
  const limit = keep ? Number.POSITIVE_INFINITY : 60_000;
  for (;;) {
    const exited = childExited.done ? childExited.value : null;
    if (exited) return { kind: 'exit', exit: exited };
    if (stopAfter && markerOf(mockDir, `stopped-after-${stopAfter}`)) return { kind: 'stop' };
    if (markerOf(mockDir, 'paused')) return { kind: 'paused' };
    if (Date.now() - started >= limit) return { kind: 'timeout' };
    await delay(100);
  }
}

/** 带超时的子进程退出等待。 */
function waitExit(childExited, ms) {
  return Promise.race([
    childExited,
    delay(ms).then(() => ({ code: null, signal: null, error: 'WAIT_TIMEOUT' })),
  ]);
}

async function main(argv) {
  let opts;
  try {
    opts = parseDriverArgv(argv);
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${usage()}\n`);
    return 2;
  }
  if (opts.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (!opts.root) {
    process.stderr.write(`--root 必填\n\n${usage()}\n`);
    return 2;
  }
  if (!opts.scenario) {
    process.stderr.write(`--scenario 必填\n\n${usage()}\n`);
    return 2;
  }

  let scenario;
  try {
    scenario = getScenario(opts.scenario);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 2;
  }

  let root;
  try {
    root = fs.realpathSync.native(path.resolve(opts.root));
  } catch {
    root = path.resolve(opts.root);
  }
  fs.mkdirSync(root, { recursive: true });

  const stopAfter = opts.stopAfter ?? scenario.stopAfter;
  const cwd = path.resolve(opts.cwd ?? path.join(root, 'demo-code-pass'));
  const task = opts.task ?? DEFAULT_TASK;

  const prepared = prepareScene({ root, scenario: opts.scenario, reset: opts.reset });

  if (opts.prepareOnly) {
    const summary = {
      ok: true,
      prepareOnly: true,
      root,
      cwd,
      scenario: opts.scenario,
      resolvedScenario: scenario.resolved,
      cursorPath: prepared.cursorPath,
      hostPath: prepared.hostPath,
      cursor: prepared.cursor,
      host: prepared.host,
    };
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    return 0;
  }

  fs.mkdirSync(cwd, { recursive: true });
  const env = cleanEnv({
    ...(stopAfter ? { MAESTRO_TEST_STOP_AFTER: String(stopAfter) } : {}),
  });

  stopCore(root, env);

  const t0 = Date.now();
  const run = startRun({ root, cwd, task, env });
  const childExited = { done: false, value: null };
  const exited = run.exited.then((value) => {
    childExited.done = true;
    childExited.value = value;
    return value;
  });

  const target = await waitForTarget({
    childExited,
    mockDir: prepared.mockDir,
    stopAfter,
    keep: opts.keep,
  });

  let released = false;
  let child = null;
  if (target.kind === 'stop' || target.kind === 'paused') {
    if (!opts.keep) {
      // 规程：最多等 60 秒放行（外部也可以先写 `.mock/release`）。
      const releasePath = path.join(prepared.mockDir, 'release');
      const waitUntil = Date.now() + 60_000;
      while (!fs.existsSync(releasePath) && Date.now() < waitUntil) {
        await delay(100);
      }
      if (!fs.existsSync(releasePath)) fs.writeFileSync(releasePath, '', 'utf8');
      released = true;
      child = await waitExit(exited, 120_000);
    }
  } else if (target.kind === 'timeout') {
    fs.writeFileSync(path.join(prepared.mockDir, 'release'), '', 'utf8');
    released = true;
    child = await waitExit(exited, 60_000);
    if (child?.error === 'WAIT_TIMEOUT') {
      try {
        run.child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }
  } else {
    child = target.exit;
  }

  const snapshot = readLatestState(root);
  const paused = markerOf(prepared.mockDir, 'paused');
  const stopped = Boolean(stopAfter && markerOf(prepared.mockDir, `stopped-after-${stopAfter}`));
  const pausedOrStopped = target.kind === 'stop' || target.kind === 'paused';
  // 停在中间态时不能拿“终态”断言判失败：只要标记与实例可读即算到达目标。
  const checks = pausedOrStopped && (opts.keep || target.kind === 'stop')
    ? [
      check(target.kind === 'stop' ? `stopped-after-${stopAfter}` : '.mock/paused', true),
      check('state.json 可读', Boolean(snapshot)),
    ]
    : assertScenario(scenario.resolved, snapshot, { paused, stopped });

  const summary = {
    ok: target.kind !== 'timeout' && checks.every((c) => c.ok),
    root,
    cwd,
    scenario: opts.scenario,
    resolvedScenario: scenario.resolved,
    stopAfter,
    keep: opts.keep,
    released,
    target: target.kind,
    exitCode: child?.code ?? null,
    instanceId: snapshot?.state?.instanceId ?? snapshot?.id ?? null,
    state: snapshot?.state?.state ?? null,
    nodes: (snapshot?.state?.nodes ?? []).map((n) => ({ nodeId: n.nodeId, round: n.round, state: n.state })),
    handoffs: (snapshot?.state?.handoffs ?? []).length,
    escalations: (snapshot?.state?.escalations ?? []).map((e) => ({ escalationId: e.escalationId, reasonCode: e.reasonCode })),
    paused: markerOf(prepared.mockDir, 'paused'),
    exhausted: markerOf(prepared.mockDir, 'exhausted'),
    historyLeak: markerOf(prepared.mockDir, 'history-leak'),
    durationMs: Date.now() - t0,
    checks,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);

  if (opts.keep) {
    // 保持核心与现场，直到 Ctrl-C（AC 要在另一个终端查 status）。
    await new Promise((resolve) => {
      const finish = () => resolve();
      process.once('SIGINT', finish);
      process.once('SIGTERM', finish);
    });
    stopCore(root, env);
    return 0;
  }

  if (checks.some((c) => c.ok === false) || target.kind === 'timeout') {
    stopCore(root, env);
    return 1;
  }
  stopCore(root, env);
  return 0;
}

function isMain() {
  const entry = process.argv[1];
  if (typeof entry !== 'string' || entry.length === 0) return false;
  try {
    return pathToFileURL(fs.realpathSync.native(path.resolve(entry))).href.toLowerCase()
      === pathToFileURL(fs.realpathSync.native(fileURLToPath(import.meta.url))).href.toLowerCase();
  } catch {
    return path.resolve(entry).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
  }
}

if (isMain()) {
  const code = await main(process.argv.slice(2));
  process.exit(code);
}
