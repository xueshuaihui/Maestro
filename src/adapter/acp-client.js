// ACP 客户端：把 transport 上的 JSON-RPC 流封装成会话原语。
//
// 事实依据（真机实测，docs/iterations/iteration-1/dsh-probe.md）：
// - initialize / session/new / session/prompt / session/close / session/list 是请求；
// - session/cancel 是通知（无 id、无响应）；
// - session/update 是宿主 → 客户端的通知，承载 turn 内全部进展；
// - session/request_permission 是宿主 → 客户端的请求，客户端必须应答；
// - session/prompt 阻塞到 turn 结束，响应只有 {stopReason}；
// - 错误码与原文必须原样保留（-32602 同码双义，由上层按 message 分类）。

import { setTimeout as delay } from 'node:timers/promises';

// Capability negotiation is derived only from the initialize advertisement.
// The two flags follow the frozen formula (D-4 / freeze point 3); no host
// identifier is ever consulted when picking a recovery dialect.
function unwrapInitialize(initialize) {
  let node = initialize;
  if (node && typeof node === 'object' && node.result && typeof node.result === 'object') {
    node = node.result;
  }
  if (node && typeof node === 'object' && node.raw && typeof node.raw === 'object') {
    node = node.raw;
  }
  return node && typeof node === 'object' ? node : {};
}

export function normalizeCapabilities(initialize) {
  const init = unwrapInitialize(initialize);
  if (typeof init.canResume === 'boolean' && typeof init.canLoad === 'boolean') {
    return {
      canResume: init.canResume,
      canLoad: init.canLoad,
      sessionCapabilities: init.sessionCapabilities ?? {},
    };
  }
  const sessionCapabilities = init.agentCapabilities?.sessionCapabilities
    ?? init.sessionCapabilities
    ?? init;
  const canResume = Boolean(sessionCapabilities.resume);
  const canLoad = Boolean(sessionCapabilities.load || init.loadSession === true);
  return { canResume, canLoad, sessionCapabilities };
}

export function canResume(initialize) {
  return normalizeCapabilities(initialize).canResume;
}

export function canLoad(initialize) {
  return normalizeCapabilities(initialize).canLoad;
}

function failureReason(res) {
  const code = res?.error?.code;
  if (code === 'REQUEST_TIMEOUT') return 'timeout';
  if (code === 'DSH_SPAWN_FAILED' || code === 'CLIENT_DISPOSED') return 'transport_error';
  if (typeof code === 'number') return 'host_error';
  return code == null ? 'error' : String(code);
}

const DEFAULT_LIMITS = {
  requestTimeoutMs: 120_000,
  initializeTimeoutMs: 60_000,
  promptTimeoutMs: 1_800_000,
  quietIdleMs: 40,
  quietCapMs: 400,
  permissionPolicy: 'allow-once',
};

const ALLOW_OPTION_ID = 'allow-once';
const REJECT_OPTION_ID = 'reject-once';

function errorFromRpc(error, fallbackCode) {
  const code = error && error.code !== undefined ? error.code : fallbackCode;
  const message = error && error.message !== undefined ? error.message : '未知错误';
  const out = { code, message };
  if (error && error.data !== undefined) out.data = error.data;
  return out;
}

function normalizeBlock(block) {
  if (typeof block === 'string') return { type: 'text', text: block };
  if (block && typeof block === 'object') {
    if (block.type === 'text' && typeof block.text === 'string') return block;
    return block;
  }
  return { type: 'text', text: String(block) };
}

function pickOption(options, policy) {
  if (!Array.isArray(options) || options.length === 0) return null;
  const byId = options.find((o) => o && o.optionId === policy);
  if (byId) return byId;
  const kind = policy === REJECT_OPTION_ID ? 'reject_once' : 'allow_once';
  const byKind = options.find((o) => o && o.kind === kind);
  if (byKind) return byKind;
  return null;
}

function normalizeOutcome(outcome, options, policy) {
  if (!outcome || typeof outcome !== 'object') {
    const picked = pickOption(options, policy);
    return picked
      ? { outcome: { outcome: 'selected', optionId: picked.optionId } }
      : { outcome: { outcome: 'cancelled' } };
  }
  const inner = outcome.outcome && typeof outcome.outcome === 'object' ? outcome.outcome : null;
  if (inner) {
    if (inner.outcome === 'selected') {
      // 允许只给 {outcome:'selected'}，由策略补选项
      const optionId = inner.optionId ?? pickOption(options, policy)?.optionId;
      if (optionId === undefined) return { outcome: { outcome: 'cancelled' } };
      return { outcome: { outcome: 'selected', optionId } };
    }
    return { outcome: { outcome: inner.outcome ?? 'cancelled' } };
  }
  if (outcome.outcome === 'selected') {
    const optionId = outcome.optionId ?? pickOption(options, policy)?.optionId;
    if (optionId === undefined) return { outcome: { outcome: 'cancelled' } };
    return { outcome: { outcome: 'selected', optionId } };
  }
  if (outcome.outcome === 'cancelled' || outcome === 'cancelled') {
    return { outcome: { outcome: 'cancelled' } };
  }
  // 允许直接传 optionId 字符串
  if (typeof outcome.optionId === 'string') {
    return { outcome: { outcome: 'selected', optionId: outcome.optionId } };
  }
  const picked = pickOption(options, policy);
  return picked
    ? { outcome: { outcome: 'selected', optionId: picked.optionId } }
    : { outcome: { outcome: 'cancelled' } };
}

/**
 * @param {{transport: ReturnType<typeof import('./stdio-transport.js').createStdioTransport>, limits?: object, clock?: () => number}} options
 */
export function createAcpClient({ transport, limits = {}, clock = () => Date.now() } = {}) {
  if (!transport) throw new TypeError('createAcpClient: 需要 transport');

  const cfg = { ...DEFAULT_LIMITS, ...limits };
  const pending = new Map();
  const updateHandlers = new Set();
  const permissionHandlers = new Set();

  let nextId = 1;
  let lastFrameAt = clock();
  let frameCount = 0;
  let exited = false;
  let exitInfo = null;
  let capabilities = null;
  let agentInfo = null;
  let lastError = null;
  let disposed = null;
  let lastInitializeResult = null;

  function emit(set, payload) {
    for (const cb of [...set]) {
      try {
        cb(payload);
      } catch {
        // 订阅者异常不影响协议
      }
    }
  }

  function settle(id, value) {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (entry.timer) clearTimeout(entry.timer);
    entry.settle(value);
  }

  function sendRaw(obj) {
    return transport.send(obj);
  }

  function handleAgentRequest(msg) {
    if (msg.method !== 'session/request_permission') {
      sendRaw({
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: -32601, message: `客户端不支持宿主方法：${msg.method}` },
      }).catch(() => {});
      return;
    }

    const params = msg.params ?? {};
    const options = Array.isArray(params.options) ? params.options : [];
    const sessionId = params.sessionId;
    const toolCallId = params.toolCall?.toolCallId;

    let answered = false;
    const respond = (outcome) => {
      if (answered) return;
      answered = true;
      const result = normalizeOutcome(outcome, options, cfg.permissionPolicy);
      sendRaw({ jsonrpc: '2.0', id: msg.id, result }).catch(() => {});
    };

    const ctx = { sessionId, toolCallId, options, respond };
    if (permissionHandlers.size === 0) {
      // 默认策略：allow-once / reject-once，可配置
      respond({ outcome: { outcome: 'selected' } });
      return;
    }
    for (const handler of [...permissionHandlers]) {
      try {
        const ret = handler(ctx);
        if (ret && typeof ret.then === 'function') {
          ret.then(
            (value) => {
              if (value && !answered) respond(value);
            },
            () => {
              if (!answered) respond({ outcome: { outcome: 'cancelled' } });
            },
          );
        } else if (ret && !answered) {
          respond(ret);
        }
        break;
      } catch {
        // 交给下一个/默认策略
      }
    }
  }

  function handleMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    lastFrameAt = clock();
    frameCount += 1;

    if (msg.method !== undefined && msg.id !== undefined) {
      handleAgentRequest(msg);
      return;
    }
    if (msg.method !== undefined) {
      if (msg.method === 'session/update') {
        const params = msg.params ?? {};
        emit(updateHandlers, { sessionId: params.sessionId, update: params.update });
      }
      // 其它通知忽略（不抛、不断连）
      return;
    }
    if (msg.id !== undefined) {
      const entry = pending.get(msg.id);
      if (!entry) return;
      if (msg.error !== undefined) {
        settle(msg.id, { ok: false, error: errorFromRpc(msg.error, 'HOST_ERROR') });
      } else {
        settle(msg.id, { ok: true, result: msg.result ?? {} });
      }
    }
  }

  function handleExit(info) {
    exited = true;
    exitInfo = info;
    const message = `DSH 进程已退出（code=${info?.code ?? 'null'}, signal=${info?.signal ?? 'null'}）`;
    for (const [id, entry] of [...pending]) {
      if (entry.timer) clearTimeout(entry.timer);
      pending.delete(id);
      entry.settle({ ok: false, error: { code: 'DSH_SPAWN_FAILED', message } });
    }
  }

  // transport 订阅：dispose 时统一退订
  const offMessage = transport.onMessage(handleMessage);
  const offExit = transport.onExit(handleExit);

  function request(method, params, timeoutMs) {
    if (exited) {
      return Promise.resolve({
        ok: false,
        error: { code: 'DSH_SPAWN_FAILED', message: '进程已退出' },
      });
    }
    const id = nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({
          ok: false,
          error: {
            code: 'REQUEST_TIMEOUT',
            message: `${method} 请求超时（${timeoutMs}ms）`,
          },
        });
      }, timeoutMs);
      timer.unref?.();
      pending.set(id, { settle: resolve, timer, method });
      sendRaw({ jsonrpc: '2.0', id, method, params }).catch((err) => {
        settle(id, {
          ok: false,
          error: { code: 'DSH_SPAWN_FAILED', message: String(err?.message ?? err) },
        });
      });
    });
  }

  async function initialize() {
    const res = await request(
      'initialize',
      {
        protocolVersion: 1,
        clientCapabilities: {
          fs: { readTextFile: false, writeTextFile: false },
          terminal: false,
        },
        clientInfo: { name: 'maestro', version: '0.1.0' },
      },
      cfg.initializeTimeoutMs,
    );
    if (!res.ok) {
      lastError = res.error;
      return res;
    }
    const result = res.result ?? {};
    lastInitializeResult = result;
    // 真实 DSH 把 sessionCapabilities 放在 agentCapabilities 内（dsh-probe.md §3）；
    // 这里归一化到顶层，同时保留宿主原始 result 供复核。
    capabilities = result.agentCapabilities?.sessionCapabilities ?? result.sessionCapabilities ?? {};
    agentInfo = result.agentInfo ?? null;
    return {
      ok: true,
      result: {
        protocolVersion: result.protocolVersion,
        agentInfo,
        sessionCapabilities: capabilities,
        authMethods: result.authMethods ?? [],
        raw: result,
      },
    };
  }

  async function newSession({ cwd, mcpServers = [] } = {}) {
    if (typeof cwd !== 'string' || !cwd) {
      return { ok: false, error: { code: 'INVALID_ARGUMENT', message: 'newSession 需要绝对路径 cwd' } };
    }
    const res = await request(
      'session/new',
      { cwd, mcpServers: Array.isArray(mcpServers) ? mcpServers : [] },
      cfg.requestTimeoutMs,
    );
    if (!res.ok) {
      lastError = res.error;
      return res;
    }
    // drain-quiet：建会话后宿主可能立刻推噪声帧（available_commands_update），
    // 不等静默就返回会把噪声误当成 turn 进展。
    await quietWindow();
    return {
      ok: true,
      result: {
        sessionId: res.result?.sessionId,
        configOptions: res.result?.configOptions ?? [],
        raw: res.result,
      },
    };
  }

  // Recovery verbs are thin wrappers over the ACP request methods. A quiet
  // window consumes the trailing frames a server may push after a session is
  // attached, notably the replay frames produced by a load.
  async function resumeSession(sessionId, { cwd, mcpServers = [] } = {}) {
    const res = await request(
      'session/resume',
      { sessionId, cwd, mcpServers: Array.isArray(mcpServers) ? mcpServers : [] },
      cfg.requestTimeoutMs,
    );
    if (!res.ok) {
      lastError = res.error;
      return res;
    }
    await quietWindow();
    return { ok: true, result: { sessionId, raw: res.result } };
  }

  async function loadSession(sessionId, { cwd, mcpServers = [] } = {}) {
    const res = await request(
      'session/load',
      { sessionId, cwd, mcpServers: Array.isArray(mcpServers) ? mcpServers : [] },
      cfg.requestTimeoutMs,
    );
    if (!res.ok) {
      lastError = res.error;
      return res;
    }
    await quietWindow();
    return { ok: true, result: { sessionId, raw: res.result } };
  }

  // Fixed rollback chain resume -> load -> new. Capability flags decide which
  // verbs are advertised; the order and the new fallback are never chosen by a
  // host identifier. Each failed step contributes a serializable detail
  // {from, to, reason} so the caller can land a recovery.dialect event.
  async function resumeOrCreate({
    cwd,
    sessionId,
    policy = 'fresh',
    capabilities: capsInput,
    currentPrompt,
  } = {}) {
    const attempts = [];
    const caps = normalizeCapabilities(capsInput ?? lastInitializeResult);

    async function createNew(reprompt) {
      const created = await newSession({ cwd });
      if (!created.ok) {
        attempts.push({
          dialect: 'new',
          ok: false,
          reason: failureReason(created),
          error: created.error,
        });
        return null;
      }
      attempts.push({ dialect: 'new', ok: true });
      // A fresh session only replays the current round once (C-09); completed
      // history is never re-delivered.
      if (reprompt && currentPrompt !== undefined && currentPrompt !== null) {
        await prompt(created.result.sessionId, currentPrompt);
      }
      return { restored: false, dialect: 'new', attempts };
    }

    if (policy !== 'reuse') {
      const created = await createNew(false);
      return created ?? { ok: false, code: 'SESSION_RESTORE_FAILED', attempts };
    }

    const stations = [];
    if (caps.canResume) stations.push('resume');
    if (caps.canLoad) stations.push('load');

    for (let i = 0; i < stations.length; i += 1) {
      const from = stations[i];
      const res = from === 'resume'
        ? await resumeSession(sessionId, { cwd })
        : await loadSession(sessionId, { cwd });
      if (res.ok) {
        attempts.push({ dialect: from, ok: true });
        return { restored: true, dialect: from, attempts };
      }
      const reason = failureReason(res);
      const to = stations[i + 1] ?? 'new';
      attempts.push({
        dialect: from,
        ok: false,
        reason,
        error: res.error,
        detail: { from, to, reason },
      });
    }

    const created = await createNew(true);
    return created ?? { ok: false, code: 'SESSION_RESTORE_FAILED', attempts };
  }

  async function prompt(sessionId, blocks) {
    const list = Array.isArray(blocks) ? blocks : [blocks];
    const promptBlocks = list.filter((b) => b !== undefined && b !== null).map(normalizeBlock);
    const res = await request(
      'session/prompt',
      { sessionId, prompt: promptBlocks },
      cfg.promptTimeoutMs,
    );
    if (!res.ok) {
      lastError = res.error;
      return { ok: false, error: res.error };
    }
    return { ok: true, result: { stopReason: res.result?.stopReason ?? null } };
  }

  async function cancel(sessionId) {
    // 通知帧：无 id、无响应（真机实测 F1）
    try {
      await sendRaw({ jsonrpc: '2.0', method: 'session/cancel', params: { sessionId } });
      return { ok: true };
    } catch (err) {
      const error = { code: 'DSH_SPAWN_FAILED', message: String(err?.message ?? err) };
      lastError = error;
      return { ok: false, error };
    }
  }

  async function closeSession(sessionId) {
    const res = await request('session/close', { sessionId }, cfg.requestTimeoutMs);
    return res.ok ? { ok: true, result: res.result } : { ok: false, error: res.error };
  }

  async function listSessions() {
    const res = await request('session/list', {}, cfg.requestTimeoutMs);
    if (!res.ok) return res;
    const sessions = Array.isArray(res.result?.sessions) ? res.result.sessions : [];
    return {
      ok: true,
      result: {
        sessions: sessions.map((s) => ({
          sessionId: s?.sessionId ?? s?.id ?? null,
          cwd: s?.cwd ?? null,
          raw: s,
        })),
      },
    };
  }

  function onUpdate(cb) {
    if (typeof cb !== 'function') throw new TypeError('onUpdate: callback 必须是函数');
    updateHandlers.add(cb);
    return () => updateHandlers.delete(cb);
  }

  function onPermission(cb) {
    if (typeof cb !== 'function') throw new TypeError('onPermission: callback 必须是函数');
    permissionHandlers.add(cb);
    return () => permissionHandlers.delete(cb);
  }

  // drain-quiet：从“最后一次收到帧”起静默 idleMs，或总时长到 capMs 为止。
  // 任何入站帧（含噪声帧）都会刷新 lastFrameAt。
  async function quietWindow({ idleMs = cfg.quietIdleMs, capMs = cfg.quietCapMs } = {}) {
    const startedAt = clock();
    for (;;) {
      const now = clock();
      const elapsed = now - startedAt;
      if (elapsed >= capMs) break;
      const sinceFrame = now - lastFrameAt;
      if (sinceFrame >= idleMs) break;
      const wait = Math.min(idleMs - sinceFrame, capMs - elapsed);
      await delay(Math.max(1, wait));
    }
    return { waitedMs: clock() - startedAt };
  }

  function dispose() {
    if (disposed) return disposed;
    disposed = (async () => {
      offMessage();
      offExit();
      for (const [id, entry] of [...pending]) {
        if (entry.timer) clearTimeout(entry.timer);
        pending.delete(id);
        entry.settle({
          ok: false,
          error: { code: 'CLIENT_DISPOSED', message: '客户端已关闭' },
        });
      }
      await transport.dispose();
    })();
    return disposed;
  }

  return {
    initialize,
    newSession,
    normalizeCapabilities,
    canResume,
    canLoad,
    resumeSession,
    loadSession,
    resumeOrCreate,
    prompt,
    cancel,
    closeSession,
    listSessions,
    onUpdate,
    onPermission,
    quietWindow,
    dispose,
    get capabilities() {
      return capabilities;
    },
    get agentInfo() {
      return agentInfo;
    },
    get lastError() {
      return lastError;
    },
    get exitInfo() {
      return exitInfo;
    },
    stats: () => ({ frameCount, lastFrameAt, pending: pending.size, exited }),
  };
}
