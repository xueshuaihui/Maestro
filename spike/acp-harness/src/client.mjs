/**
 * ACP 客户端：把 5 原语包成核心可用的 API。
 *
 * 关键契约（VP-2 判定口径）：
 *   - resumeOrCreate 只返回 `Session { id, cwd, restored }`
 *   - `replayMode` 只写进适配器内部日志（recorder），**不出现在返回值里**
 *   - 恢复方言（resume 不回放 / load 回放 / 回退链）全部在本文件收干，核心不可见
 */
import { AcpError } from './transport/base.mjs';

export class AcpClient {
  constructor(transport, { recorder, logger } = {}) {
    this.transport = transport;
    this.recorder = recorder;
    this.logger = logger ?? (() => {});
    this.subscribers = new Set();
    this.capabilities = null;

    this.transport.onNotification((method, params) => {
      if (method === 'session/update') {
        // receivedAt 由适配器打点，供证据 producedAt 使用（不改协议帧内容）
        const update = { ...params.update, receivedAt: new Date().toISOString() };
        for (const cb of this.subscribers) cb(update, params.sessionId);
      }
      this.logger(`<- notification ${method}`);
    });
    this.transport.onRequest(async (method, params) => {
      this.logger(`<- request ${method}`);
      return this.onClientRequest ? this.onClientRequest(method, params) : {};
    });
    this.onClientRequest = null;
  }

  async initialize(clientInfo = { name: 'maestro-probe', version: '0.1.0' }) {
    const result = await this.transport.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false,
      },
      clientInfo,
    });
    const ac = result.agentCapabilities ?? {};
    this.capabilities = {
      protocolVersion: result.protocolVersion,
      loadSession: !!ac.loadSession,
      resume: !!(ac.sessionCapabilities && ac.sessionCapabilities.resume),
      close: !!(ac.sessionCapabilities && ac.sessionCapabilities.close),
      agentInfo: result.agentInfo ?? null,
    };
    this.recorder?.record('in', { method: 'capabilities.summary', ...this.capabilities });
    return this.capabilities;
  }

  async newSession(cwd, mcpServers = []) {
    const result = await this.transport.request('session/new', { cwd, mcpServers });
    return { id: result.sessionId, cwd, restored: false };
  }

  /**
   * 统一恢复入口：resume → load → new 回退链。
   * sessionId 为空等价 new。
   */
  async resumeOrCreate({ sessionId, cwd, mcpServers = [] }) {
    if (!sessionId) return this.#newAndLog(cwd, mcpServers, 'no-session-id');

    if (this.capabilities?.resume) {
      try {
        await this.transport.request('session/resume', { sessionId, cwd, mcpServers });
        this.#logReplay('resume', 'none');
        return { id: sessionId, cwd, restored: true };
      } catch (err) {
        this.logger(`session/resume 不可用（${err.code} ${err.message}），降级`);
        if (!(err instanceof AcpError) || !(err.isMethodNotFound || err.isResourceNotFound || err.code === -32602)) throw err;
      }
    }

    if (this.capabilities?.loadSession) {
      const replayed = [];
      const off = this.onUpdate((update) => replayed.push(update));
      try {
        await this.transport.request('session/load', { sessionId, cwd, mcpServers });
        // 方言要点：部分 transport（HTTP/SSE）上回放帧走独立事件通道，可能与 load 响应乱序，
        // 必须在此处 drain 到静默，否则回放帧会漏进下一个 turn，污染证据归属。
        await this.#drainQuiet(replayed);
        off();
        this.#logReplay('load', 'full');
        this.logger(`session/load 回放 ${replayed.length} 条 session/update（drain 后计数）`);
        return { id: sessionId, cwd, restored: true };
      } catch (err) {
        off();
        this.logger(`session/load 不可用（${err.code} ${err.message}），降级`);
        if (!(err instanceof AcpError) || !(err.isMethodNotFound || err.isResourceNotFound || err.code === -32602)) throw err;
      }
    }

    return this.#newAndLog(cwd, mcpServers, 'fallback');
  }

  #newAndLog(cwd, mcpServers, reason) {
    this.#logReplay('new', 'none');
    this.logger(`回退到 session/new（原因：${reason}）`);
    return this.newSession(cwd, mcpServers);
  }

  #logReplay(method, replayMode) {
    // 只进日志/录制，不进返回值 —— 这是 VP-2 的核心约束
    this.recorder?.record('in', { method: 'adapter.resolve', resolveMethod: method, replayMode }, { internal: true });
  }

  /** 等待事件通道静默（回放帧可能跨通道迟到） */
  async #drainQuiet(bucket, { idleMs = 40, maxMs = 400 } = {}) {
    const start = Date.now();
    let last = bucket.length;
    while (Date.now() - start < maxMs) {
      await new Promise((r) => setTimeout(r, idleMs));
      if (bucket.length === last) return;
      last = bucket.length;
    }
  }

  async prompt(sessionId, text, { timeoutMs } = {}) {
    const result = await this.transport.request('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text }],
    }, timeoutMs ? { timeoutMs } : undefined);
    return { stopReason: result.stopReason };
  }

  /** 唤醒空闲会话：ACP 规范保证对空闲会话的 prompt 会开启新 turn */
  async wake(sessionId, text) {
    return this.prompt(sessionId, text);
  }

  async cancel(sessionId) {
    await this.transport.notify('session/cancel', { sessionId });
  }

  async closeSession(sessionId) {
    return this.transport.request('session/close', { sessionId });
  }

  async listSessions() {
    return this.transport.request('session/list', {});
  }

  onUpdate(cb) {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  async close() {
    await this.transport.close();
  }
}
