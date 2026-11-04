/**
 * HTTP/SSE transport —— POST /rpc（请求/通知）+ GET /events（SSE 通知与 agent 请求）。
 * 代表宿主：WorkBuddy（ACP over HTTP+SSE）。
 *
 * 通道形状属「mock 方言」（见 mock-acp-server/http-sse-server.mjs 的说明），
 * 阶段三接入真实 WorkBuddy 时只替换本文件的 URL / 头 / 事件名，核心与编排循环不动。
 */
import { TransportBase, AcpError } from './base.mjs';

export class HttpSseTransport extends TransportBase {
  constructor(config, { recorder, defaultTimeoutMs = 60_000 } = {}) {
    super();
    this.config = config;
    this.recorder = recorder;
    this.defaultTimeoutMs = defaultTimeoutMs;
    this.seq = 0;
    this.connId = `c-${Math.random().toString(36).slice(2, 10)}`;
    this.abort = null;
    this.ready = null;
    this.closed = false;
  }

  get kind() {
    return 'http-sse';
  }

  get #headers() {
    const h = { 'content-type': 'application/json', accept: 'application/json', 'x-acp-conn': this.connId };
    if (this.config.token) h['x-acp-token'] = this.config.token;
    return h;
  }

  async connect() {
    this.abort = new AbortController();
    let resolveReady;
    const ready = new Promise((r) => (resolveReady = r));
    this.ready = ready;

    const res = await fetch(`${this.config.baseUrl}/events`, {
      headers: { accept: 'text/event-stream', 'x-acp-conn': this.connId, ...(this.config.token ? { 'x-acp-token': this.config.token } : {}) },
      signal: this.abort.signal,
    });
    if (!res.ok) throw new AcpError(res.status, `sse connect failed: ${res.status}`);
    this.#pump(res.body, resolveReady);
    await Promise.race([ready, new Promise((_, rej) => setTimeout(() => rej(new AcpError(-32000, 'sse ready timeout')), 10_000))]);
  }

  async #pump(body, resolveReady) {
    const decoder = new TextDecoder();
    let buf = '';
    try {
      for await (const chunk of body) {
        buf += decoder.decode(chunk, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          this.#onEventBlock(block, resolveReady);
        }
      }
    } catch (err) {
      if (!this.closed) this.recorder?.record('err', `sse stream error: ${err.message}`);
    }
  }

  #onEventBlock(block, resolveReady) {
    let event = 'message';
    const dataLines = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7).trim();
      else if (line.startsWith('data: ')) dataLines.push(line.slice(6));
    }
    if (!dataLines.length) return;
    let msg;
    try {
      msg = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }
    if (event === 'ready') return resolveReady?.();

    this.recorder?.record('in', msg, { sseEvent: event });
    if (event === 'request') {
      this._dispatchRequest(msg.method, msg.params ?? {})
        .then((result) => this.#respond(msg.id, { result }))
        .catch((err) => this.#respond(msg.id, { error: { code: err.code ?? -32603, message: err.message } }));
      return;
    }
    if (msg.method) this._dispatchNotification(msg.method, msg.params ?? {});
  }

  async #respond(id, payload) {
    this.recorder?.record('out', { jsonrpc: '2.0', id, ...payload });
    await fetch(`${this.config.baseUrl}/client-response`, {
      method: 'POST',
      headers: this.#headers,
      body: JSON.stringify({ jsonrpc: '2.0', id, ...payload }),
      signal: this.abort?.signal,
    });
  }

  async request(method, params, { timeoutMs = this.defaultTimeoutMs } = {}) {
    const id = ++this.seq;
    const frame = { jsonrpc: '2.0', id, method, params };
    this.recorder?.record('out', frame);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.config.baseUrl}/rpc`, {
        method: 'POST',
        headers: this.#headers,
        body: JSON.stringify(frame),
        signal: ctl.signal,
      });
      const body = await res.json();
      if (body.error) throw new AcpError(body.error.code, body.error.message, body.error.data);
      return body.result ?? {};
    } catch (err) {
      if (err.name === 'AbortError') throw new AcpError(-32000, `request timeout: ${method} (${timeoutMs}ms)`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async notify(method, params) {
    const frame = { jsonrpc: '2.0', method, params };
    this.recorder?.record('out', frame);
    await fetch(`${this.config.baseUrl}/rpc`, {
      method: 'POST',
      headers: this.#headers,
      body: JSON.stringify(frame),
      signal: this.abort?.signal,
    });
  }

  async close() {
    this.closed = true;
    this.abort?.abort();
  }
}
