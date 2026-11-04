/**
 * HTTP/SSE transport（真实 ACP HTTP 形状，见 dsh-acp-server lib/http-transport.js）
 *
 * 与 mock 形状的关键差异（这正是 VP-1 要证明「差异只在 transport 层」的地方）：
 *   - 响应不走 POST body，而是经 SSE 通道回来；POST 只回 202
 *   - 初始化后要用 `acp-connection-id` 头做连接亲和
 *   - agent -> client 的请求也从 SSE 来，client 的响应通过 POST 回灌
 *
 * 接口与 stdio transport 完全一致，因此核心与编排循环零改动。
 */
import { TransportBase, AcpError } from './base.mjs';

export class AcpHttpStreamTransport extends TransportBase {
  constructor(config, { recorder, defaultTimeoutMs = 60_000 } = {}) {
    super();
    this.config = config;
    this.recorder = recorder;
    this.defaultTimeoutMs = defaultTimeoutMs;
    this.seq = 0;
    this.connectionId = null;
    this.abort = null;
    this.pending = new Map();
    this.closed = false;
  }

  get kind() {
    return 'acp-http-stream';
  }

  get #base() {
    return this.config.baseUrl.replace(/\/$/, '');
  }

  get #headers() {
    const h = { 'content-type': 'application/json' };
    if (this.config.token) h.authorization = `Bearer ${this.config.token}`;
    if (this.connectionId) h['acp-connection-id'] = this.connectionId;
    return h;
  }

  async connect() {
    // 真实形状下连接在 initialize 的 POST 里建立，这里只做就绪探测
    const res = await fetch(`${this.#base}/acp/healthz`).catch((e) => {
      throw new AcpError(-1, `health check failed: ${e.message}`);
    });
    if (!res.ok) throw new AcpError(res.status, `health check failed: ${res.status}`);
  }

  async #post(frame, extraHeaders = {}) {
    this.recorder?.record('out', frame);
    const res = await fetch(`${this.#base}/acp`, {
      method: 'POST',
      headers: { ...this.#headers, ...extraHeaders },
      body: JSON.stringify(frame),
    });
    return res;
  }

  async #openStream() {
    this.abort = new AbortController();
    const res = await fetch(`${this.#base}/acp/stream`, {
      headers: { accept: 'text/event-stream', ...this.#headers },
      signal: this.abort.signal,
    });
    if (!res.ok) throw new AcpError(res.status, `stream open failed: ${res.status}`);
    this.#pump(res.body);
  }

  async #pump(body) {
    const decoder = new TextDecoder();
    let buf = '';
    try {
      for await (const chunk of body) {
        buf += decoder.decode(chunk, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const data = block
            .split('\n')
            .filter((l) => l.startsWith('data: '))
            .map((l) => l.slice(6))
            .join('');
          if (!data) continue;
          let msg;
          try {
            msg = JSON.parse(data);
          } catch {
            continue;
          }
          this.#onMessage(msg);
        }
      }
    } catch (err) {
      if (!this.closed) this.recorder?.record('err', `stream error: ${err.message}`);
    }
  }

  #onMessage(msg) {
    this.recorder?.record('in', msg);
    if (msg.id !== undefined && msg.method === undefined) {
      const p = this.pending.get(String(msg.id));
      if (!p) return;
      this.pending.delete(String(msg.id));
      msg.error ? p.reject(new AcpError(msg.error.code, msg.error.message, msg.error.data)) : p.resolve(msg.result ?? {});
      return;
    }
    if (msg.method && msg.id !== undefined) {
      this._dispatchRequest(msg.method, msg.params ?? {})
        .then((result) => this.#respond(msg.id, { result }))
        .catch((err) => this.#respond(msg.id, { error: { code: err.code ?? -32603, message: err.message } }));
      return;
    }
    if (msg.method) this._dispatchNotification(msg.method, msg.params ?? {});
  }

  async #respond(id, payload) {
    await this.#post({ jsonrpc: '2.0', id, ...payload });
  }

  async request(method, params, { timeoutMs = this.defaultTimeoutMs } = {}) {
    const id = ++this.seq;
    const frame = { jsonrpc: '2.0', id, method, params };

    // initialize 是唯一走同步响应的请求，并据此拿到 connection id
    if (method === 'initialize') {
      const res = await this.#post(frame);
      if (!res.ok) throw new AcpError(res.status, `initialize failed: ${res.status}`);
      this.connectionId = res.headers.get('acp-connection-id') ?? res.headers.get('x-acp-connection-id');
      if (!this.connectionId) throw new AcpError(-1, 'initialize response missing acp-connection-id');
      const body = await res.json();
      this.recorder?.record('in', body);
      await this.#openStream();
      if (body.error) throw new AcpError(body.error.code, body.error.message);
      return body.result ?? {};
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(String(id));
        reject(new AcpError(-32000, `request timeout: ${method} (${timeoutMs}ms)`));
      }, timeoutMs);
      this.pending.set(String(id), {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.#post(frame).then(
        (res) => {
          // 真实形状：202 Accepted，结果走 SSE。非 2xx 也要把错误回抛，避免悬挂。
          if (res.status >= 400) {
            this.pending.delete(String(id));
            clearTimeout(timer);
            reject(new AcpError(res.status, `post rejected: ${res.status}`));
          }
        },
        (err) => {
          this.pending.delete(String(id));
          clearTimeout(timer);
          reject(new AcpError(-1, `post failed: ${err.message}`));
        },
      );
    });
  }

  async notify(method, params) {
    const res = await this.#post({ jsonrpc: '2.0', method, params });
    if (res.status >= 400) throw new AcpError(res.status, `notify rejected: ${res.status}`);
  }

  async close() {
    this.closed = true;
    try {
      await fetch(`${this.#base}/acp`, { method: 'DELETE', headers: this.#headers });
    } catch {
      /* ignore */
    }
    this.abort?.abort();
  }
}
