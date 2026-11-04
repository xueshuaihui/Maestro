/**
 * mock ACP agent 的会话引擎（transport 无关）
 *
 * 目的：在真实宿主（DSH / Cursor / WorkBuddy）不可得时，用一份**协议正确**的实现
 *      驱动 5 原语、单连接多会话、resume/load 双方言、cancel、close、permission。
 *
 * 效力边界（写进 iteration-0 报告）：mock 只能证明「transport 抽象与核心无宿主分支」，
 * 不能证明「真实宿主方言成立」。任何基于 mock 的结论必须标注 来源=mock。
 *
 * dialect 语义：
 *   resume-no-replay  DSH 形态：session/resume 不回放历史，session/load 回放
 *   load-only         WorkBuddy 形态：只有 session/load（追加式回放）
 *   none              都不支持，只能 session/new
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ERR = {
  resourceNotFound: (msg) => ({ code: -32002, message: msg }),
  methodNotFound: (msg) => ({ code: -32601, message: msg }),
  invalidParams: (msg) => ({ code: -32602, message: msg }),
  internal: (msg) => ({ code: -32603, message: msg }),
};

const DIALECTS = {
  'resume-no-replay': { resume: true, load: true },
  'load-only': { resume: false, load: true },
  none: { resume: false, load: false },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export function createEngine(cfg = {}) {
  const config = {
    dialect: cfg.dialect ?? 'resume-no-replay',
    permission: cfg.permission ?? 'auto', // auto | ask | deny
    turnDelayMs: cfg.turnDelayMs ?? 25,
    // 从收到 prompt 到「发出第一条可观测事件」的延迟：模拟模型冷启动/排队，
    // 用于测量「交接已投递」与「交接已被接受」之间的不可观测窗口。
    acceptDelayMs: cfg.acceptDelayMs ?? 0,
    // 会话忙时收到新 prompt：error（立即报错）| queue（排队，投递方 RPC 挂起）
    busyPolicy: cfg.busyPolicy ?? 'error',
    // 复刻真实 DSH 的会话级噪声帧（available_commands_update）：用于测量「噪声被误判为接受」的风险
    noiseOnSessionNew: cfg.noiseOnSessionNew ?? false,
    // 会话创建噪声的到达延迟：模拟「核心刚建会话就投递交接，噪声帧晚于投递到达」的真实竞态
    noiseDelayMs: cfg.noiseDelayMs ?? 0,
    noiseAtTurnEnd: cfg.noiseAtTurnEnd ?? false,
    stateFile: cfg.stateFile ?? null, // 会话状态落盘，模拟 DSH `--session <id>` 跨进程保持
    agentInfo: cfg.agentInfo ?? { name: 'mock-acp-agent', version: '0.1.0' },
    log: cfg.log ?? (() => {}),
  };
  const caps = DIALECTS[config.dialect];
  if (!caps) throw new Error(`unknown dialect: ${config.dialect}`);

  const sessions = new Map();
  const counters = { requests: 0, permissions: 0, cancels: 0, closes: 0, prompts: 0 };

  // ---- 状态持久化（仅用于跨进程恢复实验，非产品逻辑） ----
  function persist() {
    if (!config.stateFile) return;
    const dump = [...sessions.values()].map((s) => ({
      id: s.id,
      cwd: s.cwd,
      mcpServers: s.mcpServers,
      history: s.history,
      createdAt: s.createdAt,
    }));
    fs.mkdirSync(path.dirname(config.stateFile), { recursive: true });
    fs.writeFileSync(config.stateFile, JSON.stringify(dump, null, 2));
  }

  if (config.stateFile && fs.existsSync(config.stateFile)) {
    try {
      for (const s of JSON.parse(fs.readFileSync(config.stateFile, 'utf8'))) {
        sessions.set(s.id, { ...s, turn: null });
      }
    } catch {
      /* 损坏的状态文件按空处理 */
    }
  }

  /** 发 agent -> client 通知 */
  let emit = () => {};
  /** 发 agent -> client 请求，返回 client 的 result */
  let clientRequest = async () => {
    throw ERR.internal('no client request handler bound');
  };

  function mustGetSession(params) {
    const id = params?.sessionId;
    if (!id) throw ERR.invalidParams('sessionId is required');
    const s = sessions.get(id);
    if (!s) throw ERR.resourceNotFound(`session not found: ${id}`);
    return s;
  }

  function push(session, update, record = true) {
    if (record) session.history.push(update);
    emit('session/update', { sessionId: session.id, update });
  }

  /** 可中断的等待：cancel 后尽快返回 false */
  async function waitTurn(turn, ms = config.turnDelayMs) {
    let waited = 0;
    while (waited < ms) {
      if (turn.aborted) return false;
      await sleep(Math.min(10, ms - waited));
      waited += 10;
    }
    return !turn.aborted;
  }

  function planArtifacts(session, text) {
    if (/EVIDENCE/i.test(text)) {
      const dir = path.join(session.cwd, 'artifacts', 'docs');
      return [{ abs: path.join(dir, 'draft.md'), rel: 'artifacts/docs/draft.md', text }];
    }
    return [
      { abs: path.join(session.cwd, `marker-${session.id}.txt`), rel: `marker-${session.id}.txt`, text: session.id },
    ];
  }

  async function maybeAskPermission(session, toolCall) {
    if (config.permission === 'auto') return { allowed: true, via: 'auto' };
    if (config.permission === 'deny') return { allowed: false, via: 'deny' };
    counters.permissions += 1;
    const res = await clientRequest('session/request_permission', {
      sessionId: session.id,
      toolCall: { toolCallId: toolCall.toolCallId, title: toolCall.title, kind: toolCall.kind },
      options: [
        { optionId: 'allow-once', name: 'Allow once', kind: 'allow_once' },
        { optionId: 'reject-once', name: 'Reject', kind: 'reject_once' },
      ],
    });
    const outcome = res?.outcome ?? {};
    if (outcome.outcome === 'selected' && outcome.optionId === 'allow-once') {
      return { allowed: true, via: 'permission:allow-once' };
    }
    return { allowed: false, via: `permission:${outcome.outcome ?? 'unknown'}${outcome.optionId ? `:${outcome.optionId}` : ''}` };
  }

  async function runPrompt(session, text) {
    counters.prompts += 1;
    const turn = { aborted: false, startedAt: new Date().toISOString() };
    session.turn = turn;

    // 接受延迟：此窗口内投递方看不到任何信号，「已投递」与「已接受」不可区分
    if (config.acceptDelayMs > 0) {
      if (!(await waitTurn(turn, config.acceptDelayMs))) return { stopReason: 'cancelled', abortedBy: 'cancel' };
    }

    session.history.push({ sessionUpdate: 'user_message_chunk', content: { type: 'text', text } });
    emit('session/update', {
      sessionId: session.id,
      update: { sessionUpdate: 'user_message_chunk', content: { type: 'text', text } },
    });

    push(session, {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: `[mock] 收到任务，cwd=${session.cwd}` },
    });

    if (!(await waitTurn(turn))) return { stopReason: 'cancelled', abortedBy: 'cancel' };

    // 审核轮：只产出「确认」语义，不写产物
    if (/REVIEW/i.test(text)) {
      const reviewBlock =
        '\n```json\n' +
        JSON.stringify({ review: { confirmedBy: 'mock-reviewer', confirmedAt: new Date().toISOString(), verdict: 'approved' } }, null, 2) +
        '\n```';
      push(session, {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: `[mock] 审核完成，产物符合声明。${reviewBlock}` },
      });
      return { stopReason: 'end_turn', review: true };
    }

    const artifact = planArtifacts(session, text)[0];
    const toolCallId = `call_${session.id}_${counters.prompts}`;
    const toolCall = {
      sessionUpdate: 'tool_call',
      toolCallId,
      title: `写入产物 ${artifact.rel}`,
      name: 'write_file',
      kind: 'edit',
      status: 'pending',
      locations: [{ path: artifact.abs }],
    };
    push(session, toolCall);

    const perm = await maybeAskPermission(session, toolCall);
    if (!perm.allowed) {
      push(session, {
        sessionUpdate: 'tool_call_update',
        toolCallId,
        status: 'failed',
        content: [{ type: 'content', content: { type: 'text', text: `权限未通过：${perm.via}` } }],
      });
      push(session, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: `[mock] 权限未通过，放弃写入（${perm.via}）` } });
      return { stopReason: 'refusal', permission: perm.via };
    }

    push(session, { sessionUpdate: 'tool_call_update', toolCallId, status: 'in_progress' });
    if (!(await waitTurn(turn))) return { stopReason: 'cancelled', abortedBy: 'cancel' };

    fs.mkdirSync(path.dirname(artifact.abs), { recursive: true });
    fs.writeFileSync(artifact.abs, artifact.text, 'utf8');
    const fingerprint = sha256(fs.readFileSync(artifact.abs));

    push(session, {
      sessionUpdate: 'tool_call_update',
      toolCallId,
      status: 'completed',
      content: [{ type: 'diff', path: artifact.abs, oldText: null, newText: artifact.text }],
      rawOutput: { path: artifact.abs, sha256: fingerprint, bytes: Buffer.byteLength(artifact.text) },
    });

    const evidenceBlock = /EVIDENCE/i.test(text)
      ? '\n```json\n' +
        JSON.stringify(
          {
            artifacts: [{ ref: artifact.abs, fingerprint: `sha256:${fingerprint}`, producedAt: new Date().toISOString() }],
            review: { confirmedBy: 'mock-reviewer', confirmedAt: new Date().toISOString(), verdict: 'approved' },
          },
          null,
          2,
        ) +
        '\n```'
      : '';
    push(session, {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: `[mock] 产物已写入 ${artifact.rel}（sha256=${fingerprint.slice(0, 12)}…）${evidenceBlock}` },
    });

    if (!(await waitTurn(turn))) return { stopReason: 'cancelled', abortedBy: 'cancel' };
    if (config.noiseAtTurnEnd) {
      push(session, { sessionUpdate: 'available_commands_update', availableCommands: [{ name: 'compact', description: 'Compact older conversation history' }] });
    }
    return { stopReason: 'end_turn', artifact, fingerprint };
  }

  async function handleRequest(method, params = {}) {
    counters.requests += 1;
    config.log(`<- ${method} ${JSON.stringify(params).slice(0, 240)}`);
    switch (method) {
      case 'initialize':
        return {
          protocolVersion: 1,
          agentCapabilities: {
            loadSession: caps.load,
            promptCapabilities: { image: false, audio: false, embeddedContext: false },
            mcpCapabilities: { http: false, sse: false },
            sessionCapabilities: {
              ...(caps.resume ? { resume: {} } : {}),
              ...(caps.load || caps.resume ? { close: {} } : {}),
            },
          },
          authMethods: [],
          agentInfo: config.agentInfo,
          _meta: { mock: true, dialect: config.dialect },
        };

      case 'session/new': {
        if (!params.cwd || !path.isAbsolute(params.cwd)) throw ERR.invalidParams('cwd must be an absolute path');
        const id = `sess_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        sessions.set(id, {
          id,
          cwd: params.cwd,
          mcpServers: params.mcpServers ?? [],
          history: [],
          turn: null,
          createdAt: Date.now(),
        });
        persist();
        if (config.noiseOnSessionNew) {
          const noise = { sessionUpdate: 'available_commands_update', availableCommands: [{ name: 'compact', description: 'Compact older conversation history' }] };
          if (config.noiseDelayMs > 0) setTimeout(() => emit('session/update', { sessionId: id, update: noise }), config.noiseDelayMs);
          else emit('session/update', { sessionId: id, update: noise });
        }
        return { sessionId: id };
      }

      case 'session/load': {
        if (!caps.load) throw ERR.methodNotFound('session/load not supported');
        const s = mustGetSession(params);
        for (const u of s.history) emit('session/update', { sessionId: s.id, update: u });
        return {};
      }

      case 'session/resume': {
        if (!caps.resume) throw ERR.methodNotFound('session/resume not supported');
        mustGetSession(params);
        return {};
      }

      case 'session/prompt': {
        const s = mustGetSession(params);
        if (s.turn) {
          if (config.busyPolicy === 'error') throw ERR.internal('session already has an active turn');
          // queue：等到当前 turn 结束再开始；投递方 RPC 在此期间挂起、无任何事件
          const waitedFrom = Date.now();
          while (s.turn && Date.now() - waitedFrom < 30000) await sleep(10);
          if (s.turn) throw ERR.internal('queue timeout');
        }
        const text = (params.prompt ?? [])
          .map((b) => (b?.type === 'text' ? b.text : b?.type === 'resource_link' ? `[${b.uri}]` : ''))
          .join('\n');
        try {
          const out = await runPrompt(s, text);
          return { stopReason: out.stopReason };
        } finally {
          s.turn = null;
          persist();
        }
      }

      case 'session/list':
        return { sessions: [...sessions.values()].map((s) => ({ sessionId: s.id, cwd: s.cwd, updatedAt: new Date(s.createdAt).toISOString() })) };

      case 'session/close': {
        const s = mustGetSession(params);
        s.turn && (s.turn.aborted = true);
        sessions.delete(params.sessionId);
        counters.closes += 1;
        persist();
        return {};
      }

      default:
        throw ERR.methodNotFound(`method not found: ${method}`);
    }
  }

  async function handleNotification(method, params = {}) {
    config.log(`<- ${method} (notification) ${JSON.stringify(params).slice(0, 200)}`);
    if (method === 'session/cancel') {
      counters.cancels += 1;
      const s = sessions.get(params?.sessionId);
      if (!s) return; // 通知无响应，未知 session 静默丢弃（与 ACP 一致）
      if (s.turn) s.turn.aborted = true;
      return;
    }
    // 其它通知（如 client 的 elicitation/complete）忽略
  }

  return {
    handleRequest,
    handleNotification,
    setEmitter: (fn) => (emit = fn),
    setClientRequester: (fn) => (clientRequest = fn),
    stats: () => ({
      ...counters,
      activeSessions: sessions.size,
      dialect: config.dialect,
      permission: config.permission,
    }),
    sessionSnapshot: () =>
      [...sessions.values()].map((s) => ({ id: s.id, cwd: s.cwd, historyLen: s.history.length, hasActiveTurn: !!s.turn })),
  };
}

export { ERR };
