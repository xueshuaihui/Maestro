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

import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { getScenario } from './code-loop-driver.mjs';

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
    root: null,
    scenario: null,
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
].join('\n');

if (opts.help) {
  process.stdout.write(`${MOCK_USAGE}\n`);
  process.exit(0);
}

const scenarioMode = typeof opts.root === 'string' && opts.root.length > 0
  && typeof opts.scenario === 'string' && opts.scenario.length > 0;

if (!scenarioMode && (opts.root || opts.scenario || opts.consumeOnly)) {
  process.stderr.write(`--root 与 --scenario 必须同时给出\n${MOCK_USAGE}\n`);
  process.exit(2);
}

const SCENARIO_ROOT = scenarioMode ? path.resolve(opts.root) : null;
const MOCK_DIR = scenarioMode ? path.join(SCENARIO_ROOT, '.mock') : null;

let scenario = null;
if (scenarioMode) {
  try {
    scenario = getScenario(opts.scenario);
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

/** mock 侧暂停：消费完步、建会话前写 .mock/paused，轮询 .mock/release。 */
async function holdAtStart() {
  const releasePath = mockPath('release');
  if (fs.existsSync(releasePath)) return; // 已放行：不重复停
  fs.writeFileSync(mockPath('paused'), String(process.pid), 'utf8');
  while (!fs.existsSync(releasePath)) {
    await delay(100);
  }
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

async function handlePrompt(id, params) {
  const sessionId = params?.sessionId;
  const session = sessions.get(sessionId);
  if (!session || (opts.sessionMissing && session.closed)) {
    // -32602 双义之一：会话不存在（另一义是 prompt 在飞行，由真实宿主产生）
    replyError(id, -32602, 'unknown session');
    return;
  }

  session.turn += 1;
  session.tokens += 1;
  const token = session.tokens;
  session.cancelled = false;

  // I1.2 场景入口：一次派发 = 一个进程 = 一步
  if (scenarioMode) {
    const claim = await ready;
    await runScenarioStep(id, params, session, claim);
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
