/**
 * transport 工厂 —— 全仓库唯一出现「按 transport 分支」的文件。
 *
 * 设计约束（VP-1 判定口径）：核心与编排循环不得出现分支；所有差异来自 hosts/<host>.json。
 * 新增宿主 = 新增一份配置（必要时新增一个 transport 实现），不改核心。
 */
import { spawn } from 'node:child_process';
import { StdioTransport } from './transport/stdio.mjs';
import { HttpSseTransport } from './transport/http-sse.mjs';
import { AcpHttpStreamTransport } from './transport/http-sse-real.mjs';

const spawned = new Set();

export function resolveVars(value, vars) {
  if (typeof value === 'string') return value.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? `\${${k}}`);
  if (Array.isArray(value)) return value.map((v) => resolveVars(v, vars));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveVars(v, vars)]));
  return value;
}

export function loadHostConfig(raw, vars) {
  return resolveVars(raw, vars);
}

async function startServer(cfg) {
  const child = spawn(cfg.command, cfg.args ?? [], {
    cwd: cfg.cwd,
    env: { ...process.env, ...(cfg.env ?? {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  spawned.add(child);

  const port = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('server start timeout')), 10_000);
    child.stdout.on('data', (d) => {
      buf += d.toString();
      const line = buf.split('\n')[0];
      if (!line) return;
      try {
        const info = JSON.parse(line);
        if (info.port) {
          clearTimeout(timer);
          resolve(info.port);
        }
      } catch {
        /* 等待完整一行 */
      }
    });
    child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited early: ${code}`));
    });
  });
  return { child, port };
}

/**
 * @returns {{ transport: object, host: object, stop: () => Promise<void> }}
 */
export async function createTransport(hostConfig, { recorder } = {}) {
  const host = { ...hostConfig };

  if (host.kind === 'stdio') {
    const transport = new StdioTransport({ command: host.command, args: host.args, cwd: host.cwd, env: host.env }, { recorder });
    return { transport, host, stop: () => transport.close() };
  }

  if (host.kind === 'http-sse') {    let baseUrl = host.baseUrl ?? null;
    let child = null;
    if (!baseUrl) {
      const started = await startServer(host.spawn);
      child = started.child;
      baseUrl = `http://127.0.0.1:${started.port}`;
    }
    // 临时密码只从环境变量读取，不落盘、不进日志
    const token = host.tokenEnv ? process.env[host.tokenEnv] : undefined;
    const transport = new HttpSseTransport({ baseUrl, token }, { recorder });
    return {
      transport,
      host: { ...host, baseUrl },
      stop: async () => {
        await transport.close();
        if (child && !child.killed) child.kill();
      },
    };
  }

  // 真实 ACP over HTTP+SSE（dsh-acp-server serve）：响应走 SSE，POST 只回 202
  if (host.kind === 'acp-http-stream') {
    let child = null;
    if (host.spawn) {
      child = spawn(host.spawn.command, host.spawn.args ?? [], {
        cwd: host.spawn.cwd,
        env: { ...process.env, ...(host.spawn.env ?? {}) },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });
      spawned.add(child);
      child.stderr.on('data', (d) => {
        if (process.env.SPIKE_VERBOSE) process.stderr.write(`[server] ${d}`);
      });
    }
    await waitHealth(`${host.baseUrl.replace(/\/$/, '')}/acp/healthz`, 30_000);
    const transport = new AcpHttpStreamTransport({ baseUrl: host.baseUrl, token: host.token }, { recorder });
    return {
      transport,
      host,
      stop: async () => {
        await transport.close();
        if (child && !child.killed) child.kill();
      },
    };
  }

  throw new Error(`unsupported transport kind: ${host.kind}`);
}

export async function stopAllServers() {
  for (const child of spawned) if (!child.killed) child.kill();
  spawned.clear();
}

async function waitHealth(url, timeoutMs) {
  const started = Date.now();
  let lastErr = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastErr = new Error(`health ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`server not healthy at ${url}: ${lastErr?.message ?? 'timeout'}`);
}
