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

import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

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

function handleRequest(msg) {
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
      void handlePrompt(id, params ?? {});
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
    handleRequest(msg);
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

process.stdin.on('end', () => process.exit(0));
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
