/**
 * stdio transport —— NDJSON over 子进程 stdin/stdout。
 * 代表宿主：DSH（dsh-acp-server）、codex-acp、cursor agent acp。
 *
 * 帧录制：out = 写给 agent 的行；in = agent 返回/推送的行。
 */
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { TransportBase, AcpError } from './base.mjs';

export class StdioTransport extends TransportBase {
  constructor(config, { recorder, defaultTimeoutMs = 60_000 } = {}) {
    super();
    this.config = config;
    this.recorder = recorder;
    this.defaultTimeoutMs = defaultTimeoutMs;
    this.pending = new Map();
    this.seq = 0;
    this.child = null;
    this.stderr = [];
  }

  get kind() {
    return 'stdio';
  }

  async connect() {
    const { command, args = [], cwd, env = {} } = this.config;
    this.child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    const rl = readline.createInterface({ input: this.child.stdout, crlfDelay: Infinity });
    rl.on('line', (line) => this.#onLine(line));

    const errRl = readline.createInterface({ input: this.child.stderr, crlfDelay: Infinity });
    errRl.on('line', (line) => {
      this.stderr.push(line);
      if (this.stderr.length > 500) this.stderr.shift();
      this.recorder?.record('err', line);
    });

    await new Promise((resolve, reject) => {
      const onError = (err) => reject(new AcpError(-1, `spawn failed: ${err.message}`));
      this.child.once('error', onError);
      this.child.once('spawn', () => {
        this.child.off('error', onError);
        resolve();
      });
    });
  }

  #onLine(line) {
    const raw = line.trim();
    if (!raw) return;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.recorder?.record('err', `unparsable frame: ${raw.slice(0, 200)}`);
      return;
    }
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
        .then((result) => this.#raw({ jsonrpc: '2.0', id: msg.id, result }))
        .catch((err) =>
          this.#raw({ jsonrpc: '2.0', id: msg.id, error: { code: err.code ?? -32603, message: err.message } }),
        );
      return;
    }

    if (msg.method) this._dispatchNotification(msg.method, msg.params ?? {});
  }

  #raw(frame) {
    this.recorder?.record('out', frame);
    this.child.stdin.write(JSON.stringify(frame) + '\n');
  }

  async request(method, params, { timeoutMs = this.defaultTimeoutMs } = {}) {
    const id = ++this.seq;
    const frame = { jsonrpc: '2.0', id, method, params };
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
      this.#raw(frame);
    });
  }

  async notify(method, params) {
    this.#raw({ jsonrpc: '2.0', method, params });
  }

  async close() {
    if (!this.child || this.child.killed) return;
    this.child.stdin.end();
    await new Promise((resolve) => {
      const t = setTimeout(() => {
        this.child.kill('SIGKILL');
        resolve();
      }, 2000);
      this.child.once('exit', () => {
        clearTimeout(t);
        resolve();
      });
      this.child.kill();
    });
  }
}
