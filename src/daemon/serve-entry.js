/**
 * 核心进程入口（WP-5 自带的兜底入口）。
 *
 * 调用约定：
 *   node src/daemon/serve-entry.js --project <root> [--generation <gen>]
 *   node bin/orch.js core serve --project <root> [--generation <gen>]   // WP-6 转调本文件
 *
 * 行为：
 * 1. 解析 `--project`（必需）与 `--generation`（可选）；`core serve` 之类的位置参数忽略。
 * 2. 动态 import `../core/orchestrator.js`；模块缺失或构造失败时**降级为桩**，
 *    核心仍能监听、`core.ping` 仍可用 —— 这样 WP-4 未合入时自动拉起路径不被阻塞。
 * 3. 建 store / bus → createServer → listen。
 *
 * 本文件绝不 console.log：核心日志只进 `<root>/.orch/core.log`。
 */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { coreLogPath, ensureLayout, projectRoot } from '../persistence/paths.js';
import { createStore } from '../persistence/instance-store.js';
import { createAdapterFactory } from '../adapter/factory.js';
import { createEventBus } from '../core/event-bus.js';
import { createServer } from './server.js';

const args = parseArgs(process.argv.slice(2));
const projectArg = args.project ?? args.p;

if (typeof projectArg !== 'string' || projectArg.length === 0) {
  await logLine(null, 'error', 'SERVE_ENTRY_BAD_ARGS', { argv: process.argv.slice(2) });
  process.exit(2);
}

let root;
try {
  root = projectRoot(projectArg);
} catch (err) {
  // 项目目录不存在时不能写 core.log，只能以退出码表达（spawn 侧会看到立即退出）。
  process.exit(1);
}

const generation = args.generation ?? `gen-${crypto.randomBytes(8).toString('hex')}`;
const log = (level, message, extra) => logLine(root, level, message, extra);

await ensureLayout(root);

const store = createStore({ root });
const bus = createEventBus({ store, clock: Date.now });

const { orchestrator, mode } = await loadOrchestrator({ store, bus, generation, root });
await log('info', 'SERVE_ENTRY_START', { root, generation, orchestrator: mode, pid: process.pid });

const server = createServer({ root, orchestrator, bus, generation });
const listened = await server.listen();

if (!listened.ok) {
  await log('error', 'SERVE_ENTRY_LISTEN_FAILED', listened);
  // “已有活核心”不是错误：并发自动拉起时第二个进程正常退出即可。
  process.exit(listened.code === 'CORE_ALREADY_RUNNING' ? 0 : 1);
}

// 收到 SIGTERM 时走与 core.stop 相同的收尾路径；超时强制退出。
process.on('SIGTERM', () => {
  server
    .close({ mode: 'sigterm', timeoutMs: 5000 })
    .catch(() => {})
    .finally(() => process.exit(0));
});

/**
 * @returns {Promise<{orchestrator: object, mode: 'real'|'stub'}>}
 */
async function loadOrchestrator({ store: s, bus: b, generation: g, root: projectDir }) {
  try {
    const mod = await import('../core/orchestrator.js');
    const factory = mod?.createOrchestrator ?? mod?.default;
    if (typeof factory !== 'function') throw new Error('orchestrator 模块未导出 createOrchestrator');

    // 宿主配置根 = `--project` 传入的项目根（不是 process.cwd()）：
    // <projectDir>/.orch/hosts/<hostId>.json 才是验收时替换宿主的入口。
    const adapterFactory = createAdapterFactory({ root: projectDir, clock: Date.now });
    const orch = await factory({ store: s, bus: b, adapterFactory, generation: g, clock: Date.now });
    if (!orch || typeof orch.startRun !== 'function') throw new Error('createOrchestrator 返回值缺少 startRun');
    if (typeof orch.waitForRun !== 'function') throw new Error('createOrchestrator 返回值缺少 waitForRun');
    orch.mode = 'real';
    return { orchestrator: orch, mode: 'real' };
  } catch (err) {
    // 只有真的构造失败才降级；日志必须带 code 与 message，不做静默掩盖。
    await log('error', 'SERVE_ENTRY_ORCHESTRATOR_STUB', {
      code: err?.code ?? 'ORCHESTRATOR_CONSTRUCT_FAILED',
      message: err?.message ?? String(err),
      cause: err?.message ?? String(err),
    });
    return { orchestrator: createStubOrchestrator(err?.message ?? String(err)), mode: 'stub' };
  }
}

/**
 * 编排器缺失时的降级桩：只保证 IPC 面可用（ping / list / subscribe / stop），
 * `run.start` 明确报失败而不是假装成功。
 */
function createStubOrchestrator(cause) {
  const reason = `orchestrator 未就绪：${cause}`;
  return {
    isStub: true,
    mode: 'stub',
    async startRun() {
      return { ok: false, code: 'DSH_SPAWN_FAILED', params: { cause: reason } };
    },
    async waitForRun({ instanceId } = {}) {
      return { ok: false, code: 'NOT_RUNNING', params: { instanceId: instanceId ?? null, cause: reason } };
    },
    async cancel() {
      return { ok: false, code: 'NOT_FOUND', params: { cause: reason } };
    },
    async getStatus() {
      return { ok: false, code: 'NOT_FOUND', params: { cause: reason } };
    },
    async listInstances() {
      return { ok: true, items: [] };
    },
    async reconcileOnBoot() {
      return { ok: true, interrupted: [] };
    },
    async interruptAll() {
      return { ok: true, interrupted: [] };
    },
    async dispose() {},
  };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

async function logLine(logRoot, level, message, extra) {
  if (!logRoot) return;
  const line = `${new Date().toISOString()} [${level}] ${message} ${extra === undefined ? '' : safeJson(extra)}\n`;
  await fs.appendFile(coreLogPath(logRoot), line, 'utf8').catch(() => {});
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '"<unserializable>"';
  }
}
