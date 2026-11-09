#!/usr/bin/env node
// mock ACP agent —— 一个真正的宿主进程，不是内存桩。
//
// 形态依据 iteration-1 §1.9：NDJSON over stdio，实现 initialize / session/new /
// session/prompt / session/cancel（通知）/ session/close，可用 10 个开关改变行为。
// 由 host-config 的 launch.command/args 指向本文件即可被适配器当成“另一个 host 命令”
// 拉起，走与真实 DSH 完全相同的 spawn → NDJSON → acp-client 路径。
//
// 硬约束：禁止硬编码 bash；工具名默认 write，落盘语义 {file_path, content}。
//
// 开关：
//   --permission=ask|deny|auto  默认 auto
//   --noise-on-session-new      session/new 返回后立刻推 available_commands_update
//   --noise-on-prompt           收到 prompt 后、首帧前推 usage_update（probe 观察“已投递”）
//   --noise-at-turn-end         turn 结束前后推 usage_update / available_commands_update
//   --session-missing           session/new 返回 id 后立刻标记为已关闭，后续 prompt 回 -32602 unknown session
//   --host-error                返回 -32603 + 固定原文
//   --unknown-error             返回 -32099 + 生僻原文
//   --accept-delay-ms <n>       收到 prompt 后延迟 N ms 才发首个事件
//   --turn-delay-ms <n>         tool_call_update(in_progress) 保持 N ms
//   --hold-session             建会话后不主动做任何事（等 prompt；没 prompt 就安静）
//   --slow-tool <name>          tool_call 的 title
//   --write-ref <相对路径>      tool_call.rawInput.file_path + 真正落盘
//
// 场景入口（I1.2，与上面 12 个开关互不影响；不带 --root/--scenario 时行为完全不变）：
//   --root <项目根绝对路径> --scenario <场景名>
//     启动即原子消费 <root>/.mock/cursor.json 的第 n 步（读→tmp→rename，带文件锁），
//     写 <root>/.mock/prompts/<n>.json = {n, nodeId, round, task}；
//     按场景步执行 write / verdict / message / sessionNew / hostError / hold /
//     historyMarker / delayMs。步骤耗尽 → 写 .mock/exhausted 并非 0 退出。
//   --consume-only   只消费一步并打印 n（并发自测用）
//
// 场景套件（I1.3）：
//   --suite task-loop  走 `test/fixtures/scenarios/task-loop/*.json`，步语义换成
//     artifact / artifactSkip / artifactUtimes / content / review / reviewSkip /
//     reviewDecoy / reviewUtimes / mutatePrevious / remove / delayMs /
//     hold.when='prompt' / hostError / sessionNew / message。
//     `--suite` 缺省（或 `code-loop`）时上面 I1.2 的分支逐字不变。

import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { getScenario } from './code-loop-driver.mjs';
import { getTaskScenario } from './task-loop-driver.mjs';

const MOCK_AGENT_NAME = 'mock-acp-agent';
const MOCK_AGENT_VERSION = '1.0.0';
const MOCK_WRITE_CONTENT = 'mock write: ok\n';
const MOCK_HOST_ERROR_MESSAGE = 'mock-host: upstream model request failed (code 500)';
const MOCK_UNKNOWN_ERROR_MESSAGE = 'mock-host: E_QUASAR_7719 unrecognized failure token';

function parseArgv(argv) {
  const opts = {
    permission: 'auto',
    noiseOnSessionNew: false,
    noiseOnPrompt: false,
    noiseAtTurnEnd: false,
    sessionMissing: false,
    hostError: false,
    unknownError: false,
    acceptDelayMs: 0,
    turnDelayMs: 0,
    holdSession: false,
    slowTool: null,
    writeRef: null,
    promptFailures: 0,
    root: null,
    scenario: null,
    suite: null,
    consumeOnly: false,
    help: false,
  };
  const nextValue = (i, inline) => (inline !== undefined ? inline : argv[i + 1]);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    const key = eq >= 0 ? arg.slice(0, eq) : arg;
    const inline = eq >= 0 ? arg.slice(eq + 1) : undefined;
    switch (key) {
      case '--permission': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        if (['ask', 'deny', 'auto'].includes(value)) opts.permission = value;
        break;
      }
      case '--accept-delay-ms': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        opts.acceptDelayMs = Math.max(0, Number(value) || 0);
        break;
      }
      case '--turn-delay-ms': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        opts.turnDelayMs = Math.max(0, Number(value) || 0);
        break;
      }
      case '--slow-tool': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        opts.slowTool = value ?? null;
        break;
      }
      case '--write-ref': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        opts.writeRef = value ?? null;
        break;
      }
      case '--prompt-failures': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        const n = Number(value);
        opts.promptFailures = Number.isInteger(n) && n > 0 ? n : 0;
        break;
      }
      case '--noise-on-session-new':
        opts.noiseOnSessionNew = true;
        break;
      case '--root': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        opts.root = value ?? null;
        break;
      }
      case '--scenario': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        opts.scenario = value ?? null;
        break;
      }
      case '--suite': {
        const value = nextValue(i, inline);
        if (inline === undefined) i += 1;
        opts.suite = value ?? null;
        break;
      }
      case '--consume-only':
        opts.consumeOnly = true;
        break;
      case '--help':
        opts.help = true;
        break;
      case '--noise-on-prompt':
        opts.noiseOnPrompt = true;
        break;
      case '--noise-at-turn-end':
        opts.noiseAtTurnEnd = true;
        break;
      case '--session-missing':
        opts.sessionMissing = true;
        break;
      case '--host-error':
        opts.hostError = true;
        break;
      case '--unknown-error':
        opts.unknownError = true;
        break;
      case '--hold-session':
        opts.holdSession = true;
        break;
      default:
        break;
    }
  }
  return opts;
}

const opts = parseArgv(process.argv.slice(2));

const MOCK_USAGE = [
  '用法（I1.1 旧开关，行为不变）：node mock-acp-agent.js [--permission=ask|deny|auto] ...',
  '用法（I1.2 场景）：node mock-acp-agent.js --root <项目根绝对路径> --scenario <场景名>',
  '      并发自测：node mock-acp-agent.js --root <根> --scenario <场景名> --consume-only',
  '用法（I1.3 场景）：node mock-acp-agent.js --root <根> --suite task-loop --scenario <场景名>',
  '用法（WP-7 计数）：--prompt-failures=<n> 前 n 次 prompt 回 -32603，每次先写 .mock/prompt-attempts-<sessionId>.json',
].join('\n');

if (opts.help) {
  process.stdout.write(`${MOCK_USAGE}\n`);
  process.exit(0);
}

const SUITE_TASK_LOOP = 'task-loop';
const SUITE = opts.suite === SUITE_TASK_LOOP ? SUITE_TASK_LOOP : null;

if (opts.suite !== null && opts.suite !== SUITE_TASK_LOOP && opts.suite !== 'code-loop') {
  process.stderr.write(`未知 --suite：${opts.suite}\n${MOCK_USAGE}\n`);
  process.exit(2);
}

const scenarioMode = typeof opts.root === 'string' && opts.root.length > 0
  && typeof opts.scenario === 'string' && opts.scenario.length > 0;

if (!scenarioMode && (opts.root || opts.scenario || opts.suite || opts.consumeOnly)) {
  process.stderr.write(`--root 与 --scenario 必须同时给出\n${MOCK_USAGE}\n`);
  process.exit(2);
}

const taskLoopMode = scenarioMode && SUITE === SUITE_TASK_LOOP;

const SCENARIO_ROOT = scenarioMode ? path.resolve(opts.root) : null;
const MOCK_DIR = scenarioMode ? path.join(SCENARIO_ROOT, '.mock') : null;

let scenario = null;
if (scenarioMode) {
  try {
    // 两套场景表互不回落：task-loop 缺文件直接报错，不会退到 code-loop 的内置表。
    scenario = taskLoopMode ? getTaskScenario(opts.scenario) : getScenario(opts.scenario);
  } catch (err) {
    process.stderr.write(`mock-acp-agent: ${err.message}\n`);
    process.exit(2);
  }
}

// ---------------------------------------------------------------- 场景现场

function mockPath(...parts) {
  return path.join(MOCK_DIR, ...parts);
}

function writePromptRecord(n, meta, task) {
  fs.mkdirSync(mockPath('prompts'), { recursive: true });
  const record = { n, nodeId: meta.nodeId, round: meta.round, task };
  fs.writeFileSync(mockPath('prompts', `${n}.json`), JSON.stringify(record, null, 2) + '\n', 'utf8');
}

async function withCursorLock(fn) {
  const lockPath = mockPath('cursor.lock');
  const started = Date.now();
  let fd = null;
  for (;;) {
    try {
      fd = fs.openSync(lockPath, 'wx');
      break;
    } catch (err) {
      if (err?.code !== 'EEXIST') throw err;
      // 崩溃残留的锁：超过 10s 视为陈旧
      try {
        const stat = fs.statSync(lockPath);
        if (Date.now() - stat.mtimeMs > 10_000) fs.unlinkSync(lockPath);
      } catch {
        // 别人刚删掉
      }
      if (Date.now() - started > 5_000) throw new Error('cursor.lock 等待超时');
      await delay(5 + Math.floor(Math.random() * 10));
    }
  }
  try {
    return await fn();
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // ignore
    }
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // ignore
    }
  }
}

/**
 * 原子消费一步：读 next → 写 tmp → rename 回 cursor.json（next+1）。
 * 全程持 `cursor.lock`（open wx 独占创建），并发进程不会拿到同一个 n。
 */
async function consumeStep({ probe = false } = {}) {
  fs.mkdirSync(MOCK_DIR, { recursive: true });
  const n = await withCursorLock(() => {
    const cursorPath = mockPath('cursor.json');
    let next = 1;
    try {
      const cur = JSON.parse(fs.readFileSync(cursorPath, 'utf8'));
      if (Number.isInteger(cur?.next) && cur.next > 0) next = cur.next;
    } catch {
      // 缺失 / 坏文件：按 {"next":1} 处理
    }
    const tmp = `${cursorPath}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ next: next + 1 }), 'utf8');
    fs.renameSync(tmp, cursorPath);
    return next;
  });

  if (n > scenario.steps.length) {
    if (probe) {
      // --consume-only 只验证 cursor 原子性，不要求场景有 20 步。
      return { n, step: scenario.steps[scenario.steps.length - 1] };
    }
    fs.writeFileSync(mockPath('exhausted'), JSON.stringify({ n, steps: scenario.steps.length }), 'utf8');
    process.stderr.write(`mock-acp-agent: 场景步骤耗尽（next=${n}, steps=${scenario.steps.length}）\n`);
    process.exit(3);
  }

  const step = scenario.steps[n - 1];
  fs.mkdirSync(mockPath('prompts'), { recursive: true });
  fs.mkdirSync(mockPath('history'), { recursive: true });
  // 任务原文要等 session/prompt 才拿到；这里先落一个占位，prompt 时覆盖。
  writePromptRecord(n, step, null);
  return { n, step };
}

if (opts.consumeOnly) {
  const claim = await consumeStep({ probe: true });
  process.stdout.write(`${claim.n}\n`);
  process.exit(0);
}

const ready = scenarioMode
  ? consumeStep().catch((err) => {
    process.stderr.write(`mock-acp-agent: 消费 cursor 失败：${err?.message ?? err}\n`);
    process.exit(4);
  })
  : Promise.resolve(null);

/** @type {Map<string, {sessionId:string, cwd:string, cancelled:boolean, turn:number, tokens:number}>} */
const sessions = new Map();

/** @type {Map<number|string, (value:string)=>{}} */
const permissionWaiters = new Map();

let sessionSeq = 0;
let serverRequestId = 1_000_000;
let stdoutBroken = false;

function writeLine(obj) {
  if (stdoutBroken) return;
  try {
    process.stdout.write(JSON.stringify(obj) + '\n');
  } catch {
    stdoutBroken = true;
  }
}

function reply(id, result) {
  writeLine({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  writeLine({ jsonrpc: '2.0', id, error });
}

function notifyUpdate(sessionId, update) {
  writeLine({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update } });
}

function sendUsage(sessionId, used = 1) {
  notifyUpdate(sessionId, { sessionUpdate: 'usage_update', used, size: 32768 });
}

function sendCommands(sessionId) {
  notifyUpdate(sessionId, {
    sessionUpdate: 'available_commands_update',
    availableCommands: [
      { name: 'compact', description: 'Compact older conversation history' },
      { name: 'feedback', description: 'Record feedback about this session' },
    ],
  });
}

async function pause(ms, session, token) {
  const end = Date.now() + Math.max(0, ms);
  while (Date.now() < end) {
    if (session.cancelled || session.tokens !== token) return false;
    const slice = Math.min(25, end - Date.now());
    await delay(Math.max(1, slice));
  }
  return !session.cancelled && session.tokens === token;
}

function newSessionId() {
  sessionSeq += 1;
  return `mock-sess-${process.pid}-${sessionSeq}`;
}

function requestPermission(sessionId, toolCallId, session, token, title) {
  return new Promise((resolve) => {
    if (session.cancelled || session.tokens !== token) {
      resolve('cancelled');
      return;
    }
    const id = serverRequestId++;
    const finish = (value) => {
      if (!permissionWaiters.has(id)) return;
      permissionWaiters.delete(id);
      clearTimeout(timer);
      resolve(value);
    };
    permissionWaiters.set(id, finish);
    const timer = setTimeout(() => finish('cancelled'), 60_000);
    timer.unref?.();
    writeLine({
      jsonrpc: '2.0',
      id,
      method: 'session/request_permission',
      params: {
        sessionId,
        toolCall: { toolCallId, title: title ?? null },
        options: [
          { optionId: 'allow-once', name: 'Allow once', kind: 'allow_once' },
          { optionId: 'reject-once', name: 'Reject once', kind: 'reject_once' },
        ],
      },
    });
  });
}

function writeArtifact(session) {
  if (!opts.writeRef) return { filePath: null, wrote: false };
  const filePath = path.resolve(session.cwd, opts.writeRef);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, MOCK_WRITE_CONTENT, 'utf8');
  return { filePath, wrote: true };
}

// ---------------------------------------------------------------- WP-7 尝试计数
//
// 每次 session/prompt 在「任何成功 / 失败 / --host-error 早返回」之前先落累计计数。
// 基准（§2.19 / D-10）：场景模式 = 场景根 .mock/；非场景模式 = 任务 cwd（session.cwd）/.mock。
// 文件：.mock/prompt-attempts-<sessionId>.json = {attempts}
//       .mock/prompt-failures-<sessionId>.json = {attempts, failures}
// 写盘失败静默，绝不影响既有 I1.1 / I1.2 / I1.3 行为。

function countDirFor(session) {
  return scenarioMode ? MOCK_DIR : path.join(session.cwd, '.mock');
}

function recordAttempt(session) {
  const attempts = (session.promptAttempts ?? 0) + 1;
  session.promptAttempts = attempts;
  try {
    const dir = countDirFor(session);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `prompt-attempts-${session.sessionId}.json`),
      JSON.stringify({ attempts }) + '\n',
      'utf8',
    );
  } catch {
    // 计数写不出来不影响会话本身
  }
  return attempts;
}

function recordFailure(session, attempts) {
  const failures = (session.promptFailureCount ?? 0) + 1;
  session.promptFailureCount = failures;
  try {
    const dir = countDirFor(session);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `prompt-failures-${session.sessionId}.json`),
      JSON.stringify({ attempts, failures }) + '\n',
      'utf8',
    );
  } catch {
    // ignore
  }
}

function shouldFailPrompt(limit, attempts) {
  return Number.isInteger(limit) && limit > 0 && attempts <= limit;
}

// ---------------------------------------------------------------- 场景步执行

function promptText(params) {
  const list = Array.isArray(params?.prompt) ? params.prompt : [];
  return list
    .map((block) => (typeof block === 'string' ? block : block?.text ?? ''))
    .filter(Boolean)
    .join('\n');
}

function readHistoryMarkers(beforeN) {
  const markers = [];
  try {
    for (const name of fs.readdirSync(mockPath('history'))) {
      const matched = /^(\d+)\.txt$/.exec(name);
      if (!matched) continue;
      const step = Number(matched[1]);
      if (step >= beforeN) continue;
      markers.push({ step, text: fs.readFileSync(mockPath('history', name), 'utf8') });
    }
  } catch {
    // 没有历史目录 = 没有上一轮
  }
  return markers;
}

/** mock 侧挂起：写 `.mock/paused`，轮询 `.mock/release`；已放行则不重复停。 */
async function holdUntilRelease() {
  const releasePath = mockPath('release');
  if (fs.existsSync(releasePath)) return; // 已放行：不重复停
  fs.writeFileSync(mockPath('paused'), String(process.pid), 'utf8');
  while (!fs.existsSync(releasePath)) {
    await delay(100);
  }
}

/** mock 侧暂停：消费完步、建会话前写 .mock/paused，轮询 .mock/release。 */
async function holdAtStart() {
  await holdUntilRelease();
}

function applyWrites(cwd, list) {
  for (const item of list) {
    if (!item || typeof item.path !== 'string' || item.path.length === 0) continue;
    const abs = path.resolve(cwd, item.path);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, item.content ?? '', 'utf8');
    if (item.utimes) {
      const stamp = new Date(item.utimes);
      fs.utimesSync(abs, stamp, stamp);
    }
  }
}

function verdictContent(verdict) {
  if (typeof verdict === 'string') {
    return verdict.startsWith('raw:') ? verdict.slice(4) : verdict;
  }
  return JSON.stringify(verdict, null, 2) + '\n';
}

/** 写/删 out/verdict.json（verdict=null → 删除，保证“缺失”可复现）。 */
function applyVerdict(cwd, step) {
  const target = path.resolve(cwd, 'out', 'verdict.json');
  if (step.verdict === null || step.verdict === undefined) {
    try {
      fs.rmSync(target, { force: true });
    } catch {
      // ignore
    }
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, verdictContent(step.verdict), 'utf8');
  if (step.verdictUtimes) {
    const stamp = new Date(step.verdictUtimes);
    fs.utimesSync(target, stamp, stamp);
  }
}

async function runScenarioStep(id, params, session, claim) {
  const { n, step } = claim;
  const taskText = promptText(params);
  writePromptRecord(n, step, taskText);

  // AC-43：每一步收到的任务里若出现更早步骤写过的 marker，说明夹带了上一轮对话。
  const leaked = readHistoryMarkers(n).filter((h) => h.text.trim().length > 0 && taskText.includes(h.text.trim()));
  if (leaked.length > 0) {
    fs.writeFileSync(mockPath('history-leak'), JSON.stringify({ n, leaked: leaked.map((h) => h.step) }), 'utf8');
  }

  const token = session.tokens;
  session.cancelled = false;

  if (step.hostError) {
    replyError(id, -32603, String(step.hostError));
    return;
  }

  // WP-7 步字段 promptFailures：前 n 次 prompt 在 turn 内事件之前确定性失败。
  if (shouldFailPrompt(step.promptFailures, session.promptAttempts)) {
    recordFailure(session, session.promptAttempts);
    replyError(id, -32603, MOCK_HOST_ERROR_MESSAGE);
    return;
  }

  notifyUpdate(session.sessionId, {
    sessionUpdate: 'agent_thought_chunk',
    content: { type: 'text', text: 'mock: thinking about the request' },
  });

  const primary = step.write[0] ?? null;
  const primaryPath = primary?.path ?? (step.verdict !== null ? 'out/verdict.json' : null);
  const primaryContent = primary?.content
    ?? (step.verdict !== null ? verdictContent(step.verdict) : '');
  const toolCallId = `call_mock_${process.pid}_${n}`;
  const toolCall = {
    sessionUpdate: 'tool_call',
    toolCallId,
    title: 'write',
    kind: 'other',
    status: 'in_progress',
  };
  if (primaryPath) {
    toolCall.rawInput = {
      file_path: path.resolve(session.cwd, primaryPath),
      content: primaryContent,
    };
  }
  notifyUpdate(session.sessionId, toolCall);

  // delayMs：先发 tool_call 再等，保证交接包先进入 accepted；取消可提前结束。
  if (step.delayMs > 0) {
    const ok = await pause(step.delayMs, session, token);
    if (!ok) {
      reply(id, { stopReason: 'cancelled' });
      return;
    }
  }

  for (const rel of step.remove) {
    try {
      fs.rmSync(path.resolve(session.cwd, rel), { force: true });
    } catch {
      // ignore
    }
  }
  applyWrites(session.cwd, step.write);
  applyVerdict(session.cwd, step);

  notifyUpdate(session.sessionId, {
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: 'completed',
    content: [{ type: 'content', content: { type: 'text', text: 'Created file' } }],
  });
  notifyUpdate(session.sessionId, {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: step.message },
  });

  reply(id, { stopReason: 'end_turn' });

  if (step.historyMarker) {
    fs.mkdirSync(mockPath('history'), { recursive: true });
    fs.writeFileSync(mockPath('history', `${n}.txt`), step.historyMarker, 'utf8');
  }

  if (leaked.length > 0) {
    // 夹带上轮对话是夹具契约破坏：非 0 退出，让问题暴露而不是静默通过。
    const timer = setTimeout(() => process.exit(5), 50);
    timer.unref?.();
  }
}

// ---------------------------------------------------------------- task-loop 场景步
//
// 与 code-loop 的区别：本轮产物不是 cwd 下的相对路径，而是提示词里
// `写入路径：<workspace 绝对路径>/...` 给出的位置（模板已把 `\` 归一成 `/`）。
// 因此 mock 不拼路径、只按提示词原文写入；拼错路径立刻落 `.mock/bad-write-path`，
// 让 AC 失败在夹具一侧，而不是被产品侧误判成 artifact_missing。

function toPosix(value) {
  return String(value).replaceAll('\\', '/');
}

/** 取提示词里以 `label` 开头的整行，返回 label 之后 trim 的原文；没有该行返回 null。 */
function promptLineOf(text, label) {
  const lines = String(text).split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith(label)) return line.slice(label.length).trim();
  }
  return null;
}

function writeMockMarker(name, payload) {
  try {
    fs.mkdirSync(MOCK_DIR, { recursive: true });
    fs.writeFileSync(mockPath(name), JSON.stringify(payload, null, 2) + '\n', 'utf8');
  } catch {
    // 标记写不出来时不要影响会话本身
  }
}

function absWritePathInfo(taskText) {
  const raw = promptLineOf(taskText, '写入路径：');
  if (!raw) return null;
  return { raw, posix: toPosix(raw), absolute: path.isAbsolute(raw) };
}

/** 绝对路径是否以场景声明的相对产物结尾（分隔符已归一）。 */
function endsWithRef(absPosix, refPosix) {
  const ref = refPosix.replace(/^\.\//, '');
  if (ref.length === 0) return false;
  return absPosix === ref || absPosix.endsWith(`/${ref}`);
}

function defaultTaskLoopContent(artifactRef) {
  return `# ${path.posix.basename(artifactRef)}\n\n（夹具默认正文）\n`;
}

function applyOffsetMtime(absPath, utimes) {
  const offsetMs = Number(utimes?.offsetMs);
  if (!Number.isFinite(offsetMs)) return;
  const stamp = new Date(Date.now() + offsetMs);
  try {
    fs.utimesSync(absPath, stamp, stamp);
  } catch {
    // 文件不在（比如被 reviewSkip 跳过）时静默
  }
}

/** 写本轮产物：路径只在提示词里取，写不进去就留 bad-write-path。 */
function writeTaskLoopArtifact(step, taskText) {
  const ref = toPosix(step.artifact ?? '');
  if (ref.length === 0) return { wrote: false, path: null };
  // artifactSkip：故意不写，用于 artifact_missing
  if (step.artifactSkip === true) return { wrote: false, path: null };

  const info = absWritePathInfo(taskText);
  if (!info || !info.absolute || !endsWithRef(info.posix, ref)) {
    writeMockMarker('bad-write-path', {
      nodeId: step.nodeId ?? null,
      round: step.round ?? null,
      expected: ref,
      found: info?.posix ?? null,
      reason: !info ? '提示词里没有「写入路径：」' : '「写入路径：」不是绝对路径',
    });
    return { wrote: false, path: null };
  }

  const content = step.content === undefined
    ? defaultTaskLoopContent(ref)
    : String(step.content);
  fs.mkdirSync(path.dirname(info.posix), { recursive: true });
  fs.writeFileSync(info.posix, content, 'utf8');
  if (step.artifactUtimes) applyOffsetMtime(info.posix, step.artifactUtimes);
  return { wrote: true, path: info.posix };
}

/** 本轮产物（v<n>）所在的实例工作区：由「写入路径」与相对引用反推，不靠猜。 */
function workspaceForWrite(taskText, step) {
  const info = absWritePathInfo(taskText);
  if (!info || !info.absolute) return null;
  const abs = info.posix;
  const refs = [
    promptLineOf(taskText, '本轮文档引用：'),
    step.artifact ?? null,
  ].filter((item) => typeof item === 'string' && item.length > 0).map(toPosix);
  for (const ref of refs) {
    if (endsWithRef(abs, ref)) {
      return { workspace: abs.slice(0, abs.length - ref.length - 1), docRef: ref };
    }
  }
  return null;
}

/** 上一版路径：优先用提示词的「上一版文档引用：」，否则按本轮 v<n> 推 v<n-1>。 */
function previousVersionPath(taskText, step) {
  const located = workspaceForWrite(taskText, step);
  if (!located) return null;
  const previousRef = promptLineOf(taskText, '上一版文档引用：');
  if (previousRef) return path.join(located.workspace, toPosix(previousRef));
  const matched = /\.v(\d+)\.md$/.exec(located.docRef);
  if (!matched) return null;
  const previousRound = Number(matched[1]) - 1;
  if (!Number.isInteger(previousRound) || previousRound < 1) return null;
  return path.join(located.workspace, located.docRef.replace(/\.v\d+\.md$/, `.v${previousRound}.md`));
}

/**
 * 动上一版：**必须在写本轮 v<n> 之后**调用，否则本轮核对先失败，
 * 得到 artifact_missing 而不是 artifact_previous_*（D-9）。
 */
function applyMutatePrevious(step, taskText) {
  if (!step.mutatePrevious) return;
  const target = previousVersionPath(taskText, step);
  if (!target) {
    writeMockMarker('bad-previous-path', {
      nodeId: step.nodeId ?? null,
      round: step.round ?? null,
      mode: step.mutatePrevious,
      reason: '无法从提示词推出上一版路径',
    });
    return;
  }
  if (step.mutatePrevious === 'remove') {
    try {
      fs.rmSync(target, { force: true });
    } catch {
      writeMockMarker('bad-previous-path', { mode: 'remove', target, reason: '删除失败' });
    }
    return;
  }
  try {
    const text = fs.readFileSync(target, 'utf8');
    const separator = text.endsWith('\n') ? '' : '\n';
    fs.writeFileSync(target, `${text}${separator}- 改动（夹具注入）\n`, 'utf8');
  } catch (err) {
    writeMockMarker('bad-previous-path', {
      mode: step.mutatePrevious,
      target,
      reason: String(err?.code ?? err?.message ?? err),
    });
  }
}

function reviewFileContent(review) {
  if (typeof review === 'string') {
    return review.startsWith('raw:') ? review.slice(4) : review;
  }
  return JSON.stringify(review, null, 2) + '\n';
}

function legalPassReview(taskText) {
  return {
    decision: 'pass',
    artifact: promptLineOf(taskText, '本轮文档引用：') ?? '',
    defects: [],
    revisionRequirement: '',
  };
}

/**
 * 审核文件写到 **任务目录** `<cwd>/out/review.json`（不是工作区）。
 * `reviewDecoy:'workspace'` 只在 `reviewSkip` 为真时生效：往
 * `<提示词的 工作区：>/out/review.json` 放一份合法 pass，用来证明读取根是任务目录。
 */
function writeTaskLoopReview(session, step, taskText) {
  const target = path.join(session.cwd, 'out', 'review.json');

  if (step.reviewSkip === true) {
    // 先把任务目录里的旧文件清掉，保证「缺失」可复现
    try {
      fs.rmSync(target, { force: true });
    } catch {
      // ignore
    }
    if (step.reviewDecoy === 'workspace') writeWorkspaceDecoy(step, taskText);
    return;
  }

  if (step.review === undefined || step.review === null) return;

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, reviewFileContent(step.review), 'utf8');
  if (step.reviewUtimes) applyOffsetMtime(target, step.reviewUtimes);
}

function writeWorkspaceDecoy(step, taskText) {
  const raw = promptLineOf(taskText, '工作区：');
  const posix = raw ? toPosix(raw) : null;
  if (!posix || !path.isAbsolute(raw)) {
    writeMockMarker('bad-decoy-path', {
      nodeId: step.nodeId ?? null,
      round: step.round ?? null,
      found: posix,
      reason: !raw ? '审核提示词里没有「工作区：」' : '「工作区：」不是绝对路径',
    });
    return;
  }
  const decoy = path.join(posix, 'out', 'review.json');
  try {
    fs.mkdirSync(path.dirname(decoy), { recursive: true });
    fs.writeFileSync(decoy, reviewFileContent(legalPassReview(taskText)), 'utf8');
  } catch (err) {
    writeMockMarker('bad-decoy-path', {
      nodeId: step.nodeId ?? null,
      round: step.round ?? null,
      found: posix,
      reason: String(err?.code ?? err?.message ?? err),
    });
  }
}

async function runTaskLoopStep(id, params, session, claim) {
  const { n, step } = claim;
  const taskText = promptText(params);
  writePromptRecord(n, step, taskText);

  // D-9：hold.when='prompt' 在收到 prompt 后、产生任何输出前挂起（不能挂在 session/new）。
  if (step.hold && step.hold.when === 'prompt') await holdUntilRelease();

  if (step.hostError) {
    replyError(id, -32603, String(step.hostError));
    return;
  }

  const token = session.tokens;
  session.cancelled = false;

  // WP-7 步字段 promptFailures：前 n 次 prompt 在 turn 内事件之前确定性失败。
  if (shouldFailPrompt(step.promptFailures, session.promptAttempts)) {
    recordFailure(session, session.promptAttempts);
    replyError(id, -32603, MOCK_HOST_ERROR_MESSAGE);
    return;
  }

  notifyUpdate(session.sessionId, {
    sessionUpdate: 'agent_thought_chunk',
    content: { type: 'text', text: 'mock: thinking about the request' },
  });

  const toolCallId = `call_mock_${process.pid}_${n}`;
  const rawTarget = step.artifact && step.artifactSkip !== true
    ? absWritePathInfo(taskText)?.posix ?? null
    : (step.review !== undefined ? path.join(session.cwd, 'out', 'review.json') : null);
  const toolCall = {
    sessionUpdate: 'tool_call',
    toolCallId,
    title: 'write',
    kind: 'other',
    status: 'in_progress',
  };
  if (rawTarget) toolCall.rawInput = { file_path: rawTarget, content: step.content ?? '' };
  notifyUpdate(session.sessionId, toolCall);

  // delayMs：先发 tool_call 再等，保证交接包先进入 accepted；取消可提前结束。
  if (step.delayMs > 0) {
    const ok = await pause(step.delayMs, session, token);
    if (!ok) {
      reply(id, { stopReason: 'cancelled' });
      return;
    }
  }

  for (const rel of step.remove ?? []) {
    try {
      fs.rmSync(path.resolve(session.cwd, rel), { force: true });
    } catch {
      // ignore
    }
  }

  // 顺序固定：先本轮 v<n>，再动上一版（D-9）。
  writeTaskLoopArtifact(step, taskText);
  applyMutatePrevious(step, taskText);
  writeTaskLoopReview(session, step, taskText);

  notifyUpdate(session.sessionId, {
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: 'completed',
    content: [{ type: 'content', content: { type: 'text', text: 'Created file' } }],
  });
  notifyUpdate(session.sessionId, {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: step.message ?? 'mock: done' },
  });

  reply(id, { stopReason: 'end_turn' });

  if (step.historyMarker) {
    fs.mkdirSync(mockPath('history'), { recursive: true });
    fs.writeFileSync(mockPath('history', `${n}.txt`), step.historyMarker, 'utf8');
  }
}

async function handlePrompt(id, params) {
  const sessionId = params?.sessionId;
  const session = sessions.get(sessionId);
  if (!session || (opts.sessionMissing && session.closed)) {
    // -32602 双义之一：会话不存在（另一义是 prompt 在飞行，由真实宿主产生）
    replyError(id, -32602, 'unknown session');
    return;
  }

  // WP-7：计数必须是本次 prompt 的第一个动作——在 scenarioMode 分支、
  // --host-error / --unknown-error 早返回、以及任何成功/失败之前完成。
  const attempts = recordAttempt(session);
  if (!scenarioMode && shouldFailPrompt(opts.promptFailures, attempts)) {
    recordFailure(session, attempts);
    replyError(id, -32603, MOCK_HOST_ERROR_MESSAGE);
    return;
  }

  session.turn += 1;
  session.tokens += 1;
  const token = session.tokens;
  session.cancelled = false;

  // I1.2 场景入口：一次派发 = 一个进程 = 一步
  if (scenarioMode) {
    const claim = await ready;
    if (taskLoopMode) await runTaskLoopStep(id, params, session, claim);
    else await runScenarioStep(id, params, session, claim);
    return;
  }

  const alive = () => !session.cancelled && session.tokens === token;

  // --hold-session：建会话后挂住 —— 不发任何帧、不推进；只有取消能把它叫醒。
  // 这就是 AC-15 / BR-05 的“已建会话、未接任务”窗口。
  if (opts.holdSession) {
    while (alive()) await delay(50);
    reply(id, { stopReason: 'cancelled' });
    return;
  }

  if (opts.hostError) {
    if (opts.acceptDelayMs > 0 && !(await pause(opts.acceptDelayMs, session, token))) {
      reply(id, { stopReason: 'cancelled' });
      return;
    }
    replyError(id, -32603, MOCK_HOST_ERROR_MESSAGE);
    return;
  }
  if (opts.unknownError) {
    if (opts.acceptDelayMs > 0 && !(await pause(opts.acceptDelayMs, session, token))) {
      reply(id, { stopReason: 'cancelled' });
      return;
    }
    replyError(id, -32099, MOCK_UNKNOWN_ERROR_MESSAGE);
    return;
  }

  if (opts.noiseOnPrompt) sendUsage(sessionId, 1);

  if (opts.acceptDelayMs > 0) {
    const ok = await pause(opts.acceptDelayMs, session, token);
    if (!ok) {
      reply(id, { stopReason: 'cancelled' });
      return;
    }
  }

  notifyUpdate(sessionId, {
    sessionUpdate: 'agent_thought_chunk',
    content: { type: 'text', text: 'mock: thinking about the request' },
  });

  if (!alive()) {
    reply(id, { stopReason: 'cancelled' });
    return;
  }

  const toolName = opts.slowTool || 'write';
  const toolCallId = `call_mock_${process.pid}_${session.turn}`;
  const toolCall = {
    sessionUpdate: 'tool_call',
    toolCallId,
    title: toolName,
    kind: 'other',
    status: 'in_progress',
  };
  if (opts.writeRef) {
    toolCall.rawInput = {
      file_path: path.resolve(session.cwd, opts.writeRef),
      content: MOCK_WRITE_CONTENT,
    };
  }
  notifyUpdate(sessionId, toolCall);

  if (opts.permission === 'ask' || opts.permission === 'deny') {
    const answer = await requestPermission(sessionId, toolCallId, session, token, toolName);
    // deny：宿主确定性拒绝（不管客户端放不放行），但审批请求本身必须先发生。
    const rejected = opts.permission === 'deny' || answer !== 'allow-once';
    if (rejected) {
      notifyUpdate(sessionId, {
        sessionUpdate: 'tool_call_update',
        toolCallId,
        status: 'failed',
        content: [{ type: 'content', content: { type: 'text', text: answer === 'cancelled' ? 'Error: tool call aborted' : 'Rejected by user' } }],
      });
      if (opts.noiseAtTurnEnd) sendUsage(sessionId, 3);
      reply(id, { stopReason: answer === 'cancelled' ? 'cancelled' : 'refusal' });
      return;
    }
  }

  notifyUpdate(sessionId, {
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: 'in_progress',
  });

  if (opts.turnDelayMs > 0) {
    const ok = await pause(opts.turnDelayMs, session, token);
    if (!ok) {
      notifyUpdate(sessionId, {
        sessionUpdate: 'tool_call_update',
        toolCallId,
        status: 'failed',
        content: [{ type: 'content', content: { type: 'text', text: 'Error: tool call aborted' } }],
      });
      reply(id, { stopReason: 'cancelled' });
      return;
    }
  }

  if (!alive()) {
    reply(id, { stopReason: 'cancelled' });
    return;
  }

  // 真正落盘（若指定 write-ref）；权限被拒或取消时不会走到这里
  writeArtifact(session);

  notifyUpdate(sessionId, {
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: 'completed',
    content: [
      {
        type: 'content',
        content: { type: 'text', text: opts.writeRef ? 'Created file' : 'Tool completed' },
      },
    ],
  });

  notifyUpdate(sessionId, {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: 'mock: done' },
  });

  if (opts.noiseAtTurnEnd) sendUsage(sessionId, 4);

  reply(id, { stopReason: 'end_turn' });

  if (opts.noiseAtTurnEnd) sendCommands(sessionId);
}

async function handleRequest(msg) {
  const { id, method, params } = msg;
  switch (method) {
    case 'initialize':
      reply(id, {
        protocolVersion: 1,
        agentInfo: { name: MOCK_AGENT_NAME, version: MOCK_AGENT_VERSION },
        agentCapabilities: {
          mcpCapabilities: { http: false },
          promptCapabilities: { image: false, audio: false, embeddedContext: false },
          sessionCapabilities: { close: {}, list: {}, resume: {} },
        },
        authMethods: [],
      });
      return;
    case 'session/new': {
      const cwd = params?.cwd;
      if (typeof cwd !== 'string' || !path.isAbsolute(cwd)) {
        replyError(id, -32602, 'Invalid params: cwd 必须是绝对路径');
        return;
      }
      if (scenarioMode) {
        const claim = await ready;
        // 消费点在 session/new 之前，所以 sessionNew:'fail' 的步也能被消费（AC-33）。
        if (claim.step.hold?.when === 'start') await holdAtStart();
        if (claim.step.sessionNew === 'fail') {
          fs.mkdirSync(MOCK_DIR, { recursive: true });
          fs.writeFileSync(mockPath(`dispatch-failed-${claim.n}`), '1', 'utf8');
          replyError(id, -32603, 'mock: session unavailable');
          return;
        }
      }
      const sessionId = newSessionId();
      sessions.set(sessionId, {
        sessionId,
        cwd,
        cancelled: false,
        turn: 0,
        tokens: 0,
        // --session-missing：session/new 正常返回 id，但立刻把它标记为已关闭；
        // 之后对该 id 的 prompt 返回 -32602 unknown session（AC-20）。
        closed: Boolean(opts.sessionMissing),
      });
      reply(id, { sessionId, configOptions: [] });
      if (opts.noiseOnSessionNew) sendCommands(sessionId);
      return;
    }
    case 'session/prompt':
      void handlePrompt(id, params ?? {}).catch((err) => {
        process.stderr.write(`mock-acp-agent: prompt error: ${err?.stack ?? err}\n`);
        replyError(id, -32603, 'mock: prompt failed');
      });
      return;
    case 'session/close': {
      const session = sessions.get(params?.sessionId);
      // --session-missing：关闭后真的忘掉，后续 prompt 必得 -32602
      sessions.delete(params?.sessionId);
      reply(id, {});
      if (!session) return;
      return;
    }
    case 'session/list':
      reply(id, {
        sessions: [...sessions.values()].map((s) => ({ sessionId: s.sessionId, cwd: s.cwd })),
      });
      return;
    default:
      replyError(id, -32601, `mock: method not supported: ${method}`);
  }
}

function handleNotification(msg) {
  if (msg.method === 'session/cancel') {
    const session = sessions.get(msg.params?.sessionId);
    if (!session) return;
    session.cancelled = true;
    session.tokens += 1; // 让进行中的 turn 失效
    for (const [id, finish] of [...permissionWaiters]) {
      finish('cancelled');
      permissionWaiters.delete(id);
    }
  }
}

function handleMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  // 客户端对 request_permission 的应答
  if (msg.method === undefined && msg.id !== undefined) {
    const finish = permissionWaiters.get(msg.id);
    if (finish) {
      const outcome = msg.result?.outcome;
      let answer = 'cancelled';
      if (outcome && outcome.outcome === 'selected' && outcome.optionId) answer = outcome.optionId;
      else if (outcome && outcome.outcome === 'cancelled') answer = 'cancelled';
      finish(answer);
    }
    return;
  }
  if (msg.method !== undefined && msg.id !== undefined) {
    void handleRequest(msg).catch((err) => {
      process.stderr.write(`mock-acp-agent: request error: ${err?.stack ?? err}\n`);
    });
    return;
  }
  if (msg.method !== undefined) handleNotification(msg);
}

let buffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk]);
  for (;;) {
    const nl = buffer.indexOf(0x0a);
    if (nl < 0) return;
    const lineBuf = buffer.subarray(0, nl);
    buffer = buffer.subarray(nl + 1);
    const text = lineBuf.toString('utf8').replace(/\r$/, '');
    if (!text.trim()) continue;
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      // 与 SDK 行为一致：解析失败回 protocol error，但连接不断
      writeLine({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      });
      continue;
    }
    try {
      handleMessage(msg);
    } catch (err) {
      process.stderr.write(`mock-acp-agent: handler error: ${err?.stack ?? err}\n`);
    }
  }
});

// 场景模式下必须先让 cursor 消费落盘，再随 stdin 关闭退出（否则并发自测会漏记一步）。
process.stdin.on('end', () => {
  if (!scenarioMode) {
    process.exit(0);
    return;
  }
  ready.finally(() => process.exit(0));
});
process.stdin.on('error', () => process.exit(0));
process.stdout.on('error', () => {
  stdoutBroken = true;
  process.exit(0);
});
process.stdin.resume();

process.on('uncaughtException', (err) => {
  process.stderr.write(`mock-acp-agent: uncaught: ${err?.stack ?? err}\n`);
  process.exit(1);
});
