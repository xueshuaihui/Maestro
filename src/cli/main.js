/**
 * `orch` 命令面（§2.14）：解析参数 → 连核心 → 调方法 → 把结果交给 render。
 *
 * 纪律：
 * 1. 本文件不拼中文、不碰 `state.json`：文案全在 `render.js` / `labels.js`，
 *    状态一律经 `client` 从核心读（单一写者原则，也保证 `已中断` 判定口径一致）。
 * 2. 输出必须流式：每条都立刻写 stdout，绝不攒到最后；返回前等一次 flush，
 *    否则 `bin/orch.js` 的 `process.exit` 在管道上会截断未写出的字节。
 * 3. 核心是独立进程（`client` 的 detached + unref + stdio:ignore），CLI 退出不带它。
 *
 * 项目根口径：**当前 shell 目录**（`process.cwd()`）。`--cwd` 是任务工作目录，
 * 不参与管道名计算 —— 这样 `orch run --cwd ./demo` 之后直接 `orch status` 就能查到。
 */
import path from 'node:path';

import { createClient as createDefaultClient } from '../daemon/client.js';
import { corruptPath } from '../persistence/paths.js';
import { getGraph } from '../templates/index.js';
import * as render from './render.js';

/** 会话行刷新间隔（AC-03：时长递增；NFR-02：状态变化 1s 内反映）。 */
const POLL_INTERVAL_MS = 1000;
/** 状态不变时，含“已运行 Ns”的行最多 5s 重打一次，避免刷屏又不失递增感。 */
const SESSION_REFRESH_MS = 5000;
/** `run.wait` 的上限：turn 可能很长（宿主侧 prompt 超时按 30min 计），不能拿 30s 截断。 */
const RUN_WAIT_MS = 30 * 60 * 1000;
const CONNECT_HANDSHAKE_TIMEOUT_MS = 60_000;

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;
const EXIT_PREFLIGHT = 3;
/** 实例因待处理升级挂起，不是失败（需求 M-9 / B-18）。 */
const EXIT_SUSPENDED = 4;
/** 升级写入失败、实例已停止推进，也不是失败（需求 M-9 / AC-38）。 */
const EXIT_HALTED = 5;

const PREFLIGHT_CODES = new Set([
  'DSH_SPAWN_FAILED',
  'CWD_NOT_WRITABLE',
  'CORE_START_FAILED',
  // 需求 M-9 / C-01：工作区建不起来属于「开始前失败」，与 DSH 起不来同类（退出码 3）
  'WORKSPACE_INIT_FAILED',
]);

/**
 * 连接层失败：核心断开 / 帧坏 / 连接超时。这些不是宿主错误，不能渲染成"未知错误"。
 * 出现时按"实例已中断"收尾（C-3）。
 */
const CONNECTION_LOST_CODES = new Set(['IPC_CLOSED', 'IPC_TIMEOUT', 'IPC_BAD_FRAME', 'CORE_NOT_RUNNING']);

/** 顶层命令表（M-9）：旧四条 + 六组新命令。 */
const COMMANDS = new Set([
  'run', 'status', 'cancel', 'core',
  'instance', 'attach', 'escalate', 'approve', 'handoff', 'workflow',
]);
/** 两层命令表：第一层命令 → 合法子命令（§1.7）。 */
const SUBS = Object.freeze({
  core: ['stop'],
  instance: ['status', 'log', 'graph'],
  escalate: ['list', 'resolve'],
  handoff: ['list', 'show'],
  workflow: ['pause', 'resume', 'abort'],
});
const BOOLEAN_FLAGS = new Set(['events', 'all']);
const VALUE_FLAGS = new Set([
  'cwd', 'task', 'instance', 'project', 'generation', 'template', 'host',
  'format', 'approval', 'decision',
]);

/** 取值白名单（AC-64）：校验在解析层完成，非法值退出 2 且不连核心、不写状态。 */
const FORMAT_VALUES = Object.freeze(['text', 'json']);
const APPROVAL_VALUES = Object.freeze(['allow', 'reject', 'hold']);
const ESCALATE_DECISION_VALUES = Object.freeze(['pass', 'fail', 'retry']);
const APPROVE_DECISION_VALUES = Object.freeze(['allow', 'deny']);

// ---------------------------------------------------------------- 参数解析

/**
 * 纯解析，不碰 IO —— 用法错误路径可以直接单测。
 *
 * @param {string[]} argv 不含 node 与脚本路径
 * @returns {{ok:true, command:string, sub:string|null, positionals:string[], flags:object} | {ok:false, code:'USAGE', message:string}}
 */
export function parseArgs(argv) {
  const tokens = Array.isArray(argv) ? [...argv] : [];
  const command = tokens.shift();
  if (typeof command !== 'string' || command.length === 0) {
    return usage('缺少命令');
  }
  if (!COMMANDS.has(command)) {
    return usage(`未知命令：${command}`);
  }

  /** @type {string[]} */
  const positionals = [];
  /** @type {Record<string, string|boolean>} */
  const flags = {};
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (typeof token !== 'string') {
      return usage(`多余的参数：${token}`);
    }
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const eq = token.indexOf('=');
    const key = eq >= 0 ? token.slice(2, eq) : token.slice(2);
    const inline = eq >= 0 ? token.slice(eq + 1) : undefined;

    if (key.length === 0) return usage(`无法识别的参数：${token}`);

    if (BOOLEAN_FLAGS.has(key)) {
      if (inline !== undefined) return usage(`--${key} 不接受取值`);
      flags[key] = true;
      continue;
    }
    if (!VALUE_FLAGS.has(key)) {
      return usage(`未知参数：--${key}`);
    }

    const value = inline !== undefined ? inline : tokens[i + 1];
    if (inline === undefined) {
      if (value === undefined || (typeof value === 'string' && value.startsWith('--'))) {
        return usage(`--${key} 需要一个值`);
      }
      i += 1;
    }
    if (typeof value !== 'string' || value.length === 0) {
      return usage(`--${key} 需要一个值`);
    }
    flags[key] = value;
  }

  // 两层命令：第一个位置参数是子命令
  let sub = null;
  if (SUBS[command]) {
    sub = positionals.shift() ?? null;
    if (sub === null || !SUBS[command].includes(sub)) {
      return usage(`${command} 需要子命令：${SUBS[command].join('|')}`);
    }
  }

  // 取值校验（AC-64）：失败即用法错误，退出 2，不连核心、不写状态
  if (typeof flags.format === 'string' && !FORMAT_VALUES.includes(flags.format)) {
    return usage(`无法识别的参数：--format=${flags.format}（${FORMAT_VALUES.join('|')}）`);
  }
  if (typeof flags.approval === 'string' && !APPROVAL_VALUES.includes(flags.approval)) {
    return usage(`无法识别的参数：--approval=${flags.approval}（${APPROVAL_VALUES.join('|')}）`);
  }
  if (typeof flags.decision === 'string') {
    if (command === 'escalate' && !ESCALATE_DECISION_VALUES.includes(flags.decision)) {
      return usage(`无法识别的参数：--decision=${flags.decision}（${ESCALATE_DECISION_VALUES.join('|')}）`);
    }
    if (command === 'approve' && !APPROVE_DECISION_VALUES.includes(flags.decision)) {
      return usage(`无法识别的参数：--decision=${flags.decision}（${APPROVE_DECISION_VALUES.join('|')}）`);
    }
  }

  // 位置参数形态（§1.7）：多余 / 缺失都在解析层挡掉
  const rule = positionalRule(command, sub);
  if (positionals.length > rule.max) return usage(`多余的参数：${positionals[rule.max]}`);
  if (rule.exact !== undefined && positionals.length !== rule.exact) {
    return usage(`${describeCommand(command, sub)} 需要一个值`);
  }
  if (rule.needsId && positionals.length === 0 && typeof flags.instance !== 'string') {
    return usage(`${describeCommand(command, sub)} 需要一个值`);
  }

  if (command === 'run') {
    if (typeof flags.cwd !== 'string') return usage('run 需要 --cwd <目录>');
    if (typeof flags.task !== 'string') return usage('run 需要 --task <说明>');
  }
  if (command === 'cancel' && typeof flags.instance !== 'string') {
    return usage('cancel 需要 --instance <实例号>');
  }

  return { ok: true, command, sub, positionals, flags };
}

/** 各（命令, 子命令）的位置参数规则；`needsId` 允许 `--instance` 作为可替代写法（C-12）。 */
function positionalRule(command, sub) {
  switch (command) {
    case 'attach':
      return { max: 1, exact: 1 };
    case 'approve':
      return { max: 1, exact: 1 };
    case 'instance':
      return { max: 1, needsId: true };
    case 'escalate':
      return sub === 'resolve' ? { max: 1, exact: 1 } : { max: 0 };
    case 'handoff':
      return sub === 'show' ? { max: 1, exact: 1 } : { max: 0 };
    case 'workflow':
      return { max: 1, needsId: true };
    default:
      return { max: 0 };
  }
}

function describeCommand(command, sub) {
  return sub ? `${command} ${sub}` : command;
}

function usage(message) {
  return { ok: false, code: 'USAGE', message };
}

/** 失败码 → 退出码：三类“开始前失败”是 3，其余运行失败是 1。 */
export function exitCodeFor(code) {
  if (PREFLIGHT_CODES.has(code)) return EXIT_PREFLIGHT;
  if (code === 'USAGE') return EXIT_USAGE;
  return EXIT_FAILED;
}

// ---------------------------------------------------------------- 主入口

/**
 * @param {string[]} argv
 * @param {{
 *   cwd?: string,
 *   now?: () => number,
 *   out?: (line: string) => void,
 *   createClient?: (root: string) => object,
 *   waitForDetach?: () => Promise<void>,
 * }} [options]
 * @returns {Promise<number>} 0 成功 / 1 运行失败 / 2 用法错误 / 3 预检失败
 */
export async function main(argv, options = {}) {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    const out = options.out ?? defaultOut;
    out(render.renderUsage(parsed.message));
    await flushStdout();
    return EXIT_USAGE;
  }

  const ctx = {
    cwd: path.resolve(options.cwd ?? process.cwd()),
    now: options.now ?? (() => Date.now()),
    out: options.out ?? defaultOut,
    createClient: options.createClient ?? ((root) => createDefaultClient({ root })),
    waitForDetach: options.waitForDetach,
  };

  let code;
  try {
    if (parsed.command === 'run') code = await runCommand(parsed.flags, ctx);
    else if (parsed.command === 'status') code = await statusCommand(parsed.flags, ctx);
    else if (parsed.command === 'cancel') code = await cancelCommand(parsed.flags, ctx);
    else if (parsed.command === 'core') code = await coreCommand(parsed.sub, ctx);
    else if (parsed.command === 'instance') code = await instanceCommand(parsed, ctx);
    else if (parsed.command === 'attach') code = await attachCommand(parsed, ctx);
    else if (parsed.command === 'escalate') code = await escalateCommand(parsed, ctx);
    else if (parsed.command === 'approve') code = await approveCommand(parsed, ctx);
    else if (parsed.command === 'handoff') code = await handoffCommand(parsed, ctx);
    else code = await workflowCommand(parsed, ctx);
  } catch (error) {
    // 渲染层与 IPC 都不应该抛；真抛了也不能吞成“成功”。
    ctx.out(render.renderError({ code: 'UNKNOWN_ERROR', params: { raw: error?.message ?? String(error) } }));
    code = EXIT_FAILED;
  }

  await flushStdout();
  return code;
}

function defaultOut(line) {
  process.stdout.write(`${line}\n`);
}

/** 等 stdout 排空，避免 `process.exit` 截断管道上的尾部输出。 */
async function flushStdout() {
  if (!process.stdout.writableLength) return;
  await new Promise((resolve) => {
    process.stdout.write('', () => resolve());
  });
}

// ---------------------------------------------------------------- 公共读取工具

/** 连接（与旧命令一致使用 `ensure:true`）；失败渲染错误并返回退出码，成功返回 null。 */
async function connectOrError(client, out) {
  const connected = await client.connect({ ensure: true });
  if (!connected.ok) {
    out(render.renderError({ code: connected.code, params: connected.params }));
    return exitCodeFor(connected.code);
  }
  return null;
}

/** 命令级错误：文案全部取自 `COMMAND_ERROR`，退出码经 `exitCodeFor`。 */
function commandError(out, code, params = {}) {
  out(render.renderCommandError(code, params));
  return exitCodeFor(code);
}

/** 只读：跨实例收集某类条目，并给每条打上 instanceId；同时带回实例快照供渲染查角色。 */
async function collectEntries(client, field) {
  const listed = await client.request('instance.list', {});
  if (!listed.ok) return { ok: false, res: listed };
  const items = listed.result?.items ?? [];
  const snapshots = new Map();
  const entries = [];
  for (const item of items) {
    if (!item?.readable) continue;
    const res = await client.request('instance.get', { instanceId: item.instanceId }, { timeoutMs: 5000 });
    if (!res.ok) continue;
    snapshots.set(item.instanceId, res.result);
    const list = Array.isArray(res.result?.[field]) ? res.result[field] : [];
    for (const entry of list) {
      entries.push({ ...entry, instanceId: entry?.instanceId ?? item.instanceId });
    }
  }
  return { ok: true, snapshots, entries };
}

function renderCollectError(out, collected) {
  out(render.renderError({ code: collected.res.code, params: collected.res.params ?? {} }));
  return exitCodeFor(collected.res.code);
}

/** 稳定排序：先实例号、再编号（BR-43）。 */
function byInstanceThenId(idKey) {
  return (a, b) => {
    const ia = String(a?.instanceId ?? '');
    const ib = String(b?.instanceId ?? '');
    if (ia !== ib) return ia < ib ? -1 : 1;
    const ka = String(a?.[idKey] ?? '');
    const kb = String(b?.[idKey] ?? '');
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  };
}

/** 写类动作成功后统一回读一次完整快照，保证渲染字段齐全。 */
async function fetchSnapshot(client, instanceId) {
  const res = await client.request('instance.get', { instanceId }, { timeoutMs: 10_000 });
  return res.ok ? res.result : null;
}

function templateOf(snapshot) {
  return typeof snapshot?.template === 'string' && snapshot.template.length > 0 ? snapshot.template : 'single';
}

// ---------------------------------------------------------------- run

async function runCommand(flags, ctx) {
  const out = ctx.out;
  const client = ctx.createClient(ctx.cwd);

  let timer = null;
  let unsubscribe = () => {};
  let ticking = false;
  let lastKey = null;
  let lastLine = null;
  let lastPrintedAt = 0;
  const printedApprovals = new Set();

  const stopWatching = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
    unsubscribe();
    unsubscribe = () => {};
  };

  try {
    // ① 连核心（热 / 冷启动都走同一条 ensure 路径；冷启动耗时由 client 负责）
    const connected = await client.connect({ ensure: true });
    if (!connected.ok) {
      out(render.renderError({ code: connected.code, params: connected.params }));
      return exitCodeFor(connected.code);
    }

    // `--cwd` 相对当前 shell 目录解析，不相对仓库根
    const taskCwd = path.resolve(ctx.cwd, flags.cwd);
    /** 缺省不传 `template`（核心按 `single` 处理）；仅在显式给了 `--template` 时透传。 */
    const templateHint = typeof flags.template === 'string' ? flags.template : 'single';

    // ② 发起（`run.start` 是早返回：会话建立后立刻回包）
    const started = await client.request(
      'run.start',
      {
        cwd: taskCwd,
        task: flags.task,
        ...(typeof flags.instance === 'string' ? { instanceId: flags.instance } : {}),
        ...(typeof flags.template === 'string' ? { template: flags.template } : {}),
        // `--host` 仅验收夹具注入用（附录 B-20），不进用户任务样例。
        ...(typeof flags.host === 'string' ? { hostId: flags.host } : {}),
        // `--approval` 透传为发起策略（D-5.2 / run.start 白名单）。
        ...(typeof flags.approval === 'string' ? { approvalPolicy: flags.approval } : {}),
      },
      { timeoutMs: CONNECT_HANDSHAKE_TIMEOUT_MS },
    );

    if (!started.ok) {
      // NODE_BUSY 在这里就返回：不订阅、不打三行、不新建会话（AC-07）
      out(render.renderError({ code: started.code, params: started.params ?? {} }));
      return exitCodeFor(started.code);
    }

    const instanceId = started.result?.instanceId ?? flags.instance ?? null;
    const sessionId = started.result?.sessionId ?? null;

    // 首派就失败时（AC-42）核心已经把实例收成挂起/停止推进，`run.start` 直接带回终局快照。
    // 这时再打「发起后先看到什么」那三行只会打出与事实相反的状态，按 A-3 直接收尾。
    const stoppedSnapshot = started.result?.snapshot ?? null;
    if (stoppedSnapshot && (stoppedSnapshot.state === 'suspended' || stoppedSnapshot.halted === true)) {
      const stoppedTemplate = typeof stoppedSnapshot.template === 'string'
        ? stoppedSnapshot.template
        : templateHint;
      for (const line of render.renderRunTail(
        { ...stoppedSnapshot, template: stoppedTemplate },
        { template: stoppedTemplate },
      )) {
        out(line);
      }
      return stoppedSnapshot.state === 'suspended' ? EXIT_SUSPENDED : EXIT_HALTED;
    }

    // ③ 立刻打前三行（不能等 turn 结束，AC-01 要求热启动 5s 内看到）
    const first = await client.request('instance.get', { instanceId }, { timeoutMs: 5000 });
    const snapshot0 = first.ok
      ? first.result
      : { instanceId, state: 'running', session: sessionId ? { sessionId, state: 'thinking' } : null };
    out(
      render.renderInstanceLine({
        ...snapshot0,
        template: typeof snapshot0?.template === 'string' ? snapshot0.template : templateHint,
      }),
    );
    // 首派就失败时没有会话（AC-42：sessions 为空），这一行不该打成「会话已创建 ?」
    if (typeof sessionId === 'string' && sessionId.length > 0) {
      out(render.renderSessionCreated(sessionId));
    }
    out(render.renderTaskSubmitted());

    const printSnapshot = (snapshot) => {
      if (!snapshot) return;
      // 等待期间新产生的待处理审批立即跟进一行（AC-37 / A-2 #2）；无审批旧流程逐字不变。
      for (const approval of Array.isArray(snapshot.approvals) ? snapshot.approvals : []) {
        if (approval?.state !== 'pending') continue;
        const id = approval?.approvalId ?? '?';
        if (printedApprovals.has(id)) continue;
        printedApprovals.add(id);
        out(render.renderApprovalLine(approval, snapshot));
      }

      const nowMs = ctx.now();
      const stalled = snapshot.sessionStalled === true;
      const waiting = snapshot.session?.state === 'waiting_dependency';

      let line = stalled
        ? render.renderSessionStall(snapshot, nowMs)
        : render.renderSessionLine(snapshot, nowMs);
      if (!line) return;
      if (waiting) line = render.renderSessionSubmitted(snapshot, nowMs) ?? line;

      // “已运行 Ns”只在时长上变，不应每秒刷一行；状态/工具名变化立即打。
      const key = line.replace(/ · 已运行 [^·]+(?= · |$)/, '');
      const changed = key !== lastKey;
      const dueForRefresh = !waiting && !stalled && nowMs - lastPrintedAt >= SESSION_REFRESH_MS;
      if (!changed && !dueForRefresh) return;
      if (line === lastLine) return; // 同一条文案不重复打

      out(line);
      lastKey = key;
      lastLine = line;
      lastPrintedAt = nowMs;
    };

    const tick = async () => {
      if (ticking) return;
      ticking = true;
      try {
        const res = await client.request('instance.get', { instanceId }, { timeoutMs: 5000 });
        if (res.ok) printSnapshot(res.result);
      } finally {
        ticking = false;
      }
    };

    // ④ 订阅事件（变化即刷新）+ 每 1s 拉一次快照（时长递增）
    unsubscribe = client.subscribe(instanceId, () => {
      void tick();
    });
    timer = setInterval(() => {
      void tick();
    }, POLL_INTERVAL_MS);
    if (typeof timer.unref === 'function') timer.unref();

    await tick();

    // ⑤⑥⑦ 等终态；期间的会话行由 tick 流出（含“调用工具 / 等待审批 / 等待下游”）
    const waited = await client.request(
      'run.wait',
      { instanceId, timeoutMs: RUN_WAIT_MS },
      { timeoutMs: RUN_WAIT_MS + 15_000 },
    );

    stopWatching();

    if (!waited.ok) {
      if (waited.code === 'NOT_FOUND') {
        out(render.renderInstanceMissing(instanceId));
        return EXIT_FAILED;
      }
      // 核心被 `core stop` 停掉时，run.wait 只会看到 IPC 断开。这里不能报"未知错误"：
      // 只重连（ensure:false，绝不拉起新核心），用快照确认是否已中断（C-3）。
      if (CONNECTION_LOST_CODES.has(waited.code)) {
        return recoverAfterDisconnect(client, instanceId, ctx);
      }
      out(render.renderError({ code: waited.code, params: waited.params ?? {} }));
      return exitCodeFor(waited.code);
    }

    const snapshot = waited.result;
    const template = typeof snapshot?.template === 'string' ? snapshot.template : templateHint;

    // 前台 `orch run` 遇暂停（D-7.9 / A-2 #6）：只打实例行 + 恢复提示，退出 0。
    if (snapshot?.state === 'running' && snapshot?.paused === true && snapshot?.halted !== true) {
      for (const line of render.renderRunTail({ ...snapshot, template }, { template })) out(line);
      return EXIT_OK;
    }

    // ⑦ 挂起 / 停止推进：按附录 A-4 立即收尾（不打印节点表其余行、交接包行与等待行，B-18）
    if (snapshot?.state === 'suspended' || snapshot?.halted === true) {
      for (const line of render.renderRunTail({ ...snapshot, template }, { template })) out(line);
      return snapshot?.state === 'suspended' ? EXIT_SUSPENDED : EXIT_HALTED;
    }

    // ⑧ 成功结束时补一次终态节点行（B-19：运行期间只流式打印会话行）
    for (const line of render.renderNodeLines(snapshot, { template })) out(line);

    // ⑨ 交接包逐包多状态行（仍未终态时补“等待目标响应”）
    for (const line of render.renderHandoffLines(snapshot, { template })) out(line);
    const wait = render.renderHandoffWait(snapshot, ctx.now());
    if (wait) out(wait);

    // ⑩ 升级块：`single` 不打印；`code-loop` 无升级时打印 `升级 —`
    for (const line of render.renderEscalationBlock(snapshot, { template })) out(line);

    // ⑪ 退出码
    if (snapshot?.state === 'completed') return EXIT_OK;
    if (snapshot?.state === 'interrupted') {
      out(render.renderInterruptedNote(snapshot));
      return EXIT_FAILED;
    }
    const failure = render.renderNodeFailure(snapshot);
    if (failure) out(failure);
    return EXIT_FAILED;
  } finally {
    stopWatching();
    await client.close?.();
  }
}

// ---------------------------------------------------------------- 断连收尾

/**
 * `run.wait` 撞上连接层错误（多半是核心被 `core stop`）时的收尾。
 *
 * 只重连、不拉起新核心（`ensure:false`）——否则会把已中断的实例"救活"成又在跑。
 * 连上且确认 `interrupted` → 打带停点的 note；否则退化为"核心已停止"一行。
 */
async function recoverAfterDisconnect(client, instanceId, ctx) {
  const out = ctx.out;
  const reconnected = await client.connect({ ensure: false });
  if (reconnected.ok) {
    const res = await client.request('instance.get', { instanceId }, { timeoutMs: 5000 });
    if (res.ok && res.result?.state === 'interrupted') {
      out(render.renderInterruptedNote(res.result));
      return EXIT_FAILED;
    }
  }
  out(render.renderCoreGoneNote(instanceId));
  return EXIT_FAILED;
}

// ---------------------------------------------------------------- status

async function statusCommand(flags, ctx) {
  const out = ctx.out;
  const client = ctx.createClient(ctx.cwd);

  try {
    // 核心没在跑时**允许拉起**：AC-12 要求 `core stop` 之后 `orch status` 仍能读，
    // 而“已中断”判定发生在核心启动对账里。
    const connected = await client.connect({ ensure: true });
    if (!connected.ok) {
      out(render.renderError({ code: connected.code, params: connected.params }));
      return exitCodeFor(connected.code);
    }

    if (typeof flags.instance !== 'string') {
      const listed = await client.request('instance.list', {});
      if (!listed.ok) {
        out(render.renderError({ code: listed.code, params: listed.params ?? {} }));
        return exitCodeFor(listed.code);
      }
      const items = listed.result?.items ?? [];
      if (items.length === 0) {
        out(render.renderNoInstances());
        return EXIT_OK;
      }

      // 列表项不带耗时，逐个取快照补全（本地 IPC，毫秒级）
      const rows = await Promise.all(
        items.map(async (item) => {
          if (!item?.readable) return render.renderInstanceUnreadable(item);
          const snap = await client.request('instance.get', { instanceId: item.instanceId }, { timeoutMs: 5000 });
          return render.renderInstanceListRow(item, snap.ok ? snap.result : null);
        }),
      );
      for (const row of rows) out(row);
      return EXIT_OK;
    }

    const instanceId = flags.instance;
    const res = await client.request('instance.get', { instanceId }, { timeoutMs: 10_000 });
    if (!res.ok) {
      if (res.code === 'STATE_CORRUPT') {
        out(
          render.renderError({
            code: 'STATE_CORRUPT',
            params: { ...(res.params ?? {}), backupPath: res.params?.backupPath ?? corruptPath(ctx.cwd, instanceId) },
          }),
        );
        return EXIT_FAILED;
      }
      if (res.code === 'NOT_FOUND') {
        out(render.renderInstanceMissing(instanceId));
        return EXIT_FAILED;
      }
      out(render.renderError({ code: res.code, params: res.params ?? {} }));
      return exitCodeFor(res.code);
    }

    const snapshot = res.result;
    const template = templateOf(snapshot);

    // interrupted 时只打带停点的那一行（它已含实例号与状态），不重复实例行（C-7）。
    if (snapshot?.state === 'interrupted') {
      out(render.renderInterruptedNote(snapshot));
    } else {
      out(render.renderInstanceLine(snapshot));
    }
    // 节点表：`single` 1 行（I1.1）、`code-loop` 按 T-001/002 逐行（A-2 第 3 段）
    for (const line of render.renderNodeLines(snapshot, { template })) out(line);
    // 与 `orch run` 同口径：先试"无新事件"，没有静默再回落到普通会话行（AC-23）。
    const sessionLine =
      render.renderSessionStall(snapshot, ctx.now()) ?? render.renderSessionLine(snapshot, ctx.now(), { template });
    if (sessionLine) out(sessionLine);
    for (const line of render.renderHandoffLines(snapshot, { template })) out(line);
    const wait = render.renderHandoffWait(snapshot, ctx.now());
    if (wait) out(wait);
    for (const line of render.renderEscalationBlock(snapshot, { template })) out(line);
    // 审批行在升级块之后按审批号逐条列出；无审批记录的旧流程逐字不变（A-2 #2 / AC-36）。
    for (const line of render.renderApprovalLines(snapshot, { template })) out(line);

    if (flags.events === true) {
      const events = await client.request('instance.events', { instanceId }, { timeoutMs: 10_000 });
      if (!events.ok) {
        out(render.renderError({ code: events.code, params: events.params ?? {} }));
        return exitCodeFor(events.code);
      }
      const list = [...(events.result?.events ?? [])].sort((a, b) => (a?.seq ?? 0) - (b?.seq ?? 0));
      for (const event of list) {
        // C-10：模板上下文必须显式传入；`rejected` 两模板都走 I1.1 版式。
        for (const line of render.renderEventLines(event, { template })) out(line);
      }
    }

    return EXIT_OK;
  } finally {
    await client.close?.();
  }
}

// ---------------------------------------------------------------- cancel

async function cancelCommand(flags, ctx) {
  const out = ctx.out;
  const client = ctx.createClient(ctx.cwd);

  try {
    const connected = await client.connect({ ensure: true });
    if (!connected.ok) {
      out(render.renderError({ code: connected.code, params: connected.params }));
      return exitCodeFor(connected.code);
    }

    const res = await client.request('instance.cancel', { instanceId: flags.instance }, { timeoutMs: 15_000 });
    if (!res.ok) {
      if (res.code === 'NOT_FOUND') {
        out(render.renderInstanceMissing(flags.instance));
        return EXIT_FAILED;
      }
      // 已终态走 CANCEL_NOT_NEEDED 文案（含中文状态名），退出码 1
      out(render.renderError({ code: res.code, params: res.params ?? {} }));
      return exitCodeFor(res.code);
    }

    for (const line of render.renderCancelLines(res.result ?? {})) out(line);
    return EXIT_OK;
  } finally {
    await client.close?.();
  }
}

// ---------------------------------------------------------------- core stop

async function coreCommand(sub, ctx) {
  const out = ctx.out;
  if (sub !== 'stop') {
    out(render.renderUsage());
    return EXIT_USAGE;
  }

  const client = ctx.createClient(ctx.cwd);

  try {
    // 核心没在跑就不要拉起（`ensure:false`）
    const connected = await client.connect({ ensure: false });
    if (!connected.ok) {
      out(render.renderCoreNotRunning());
      return EXIT_OK;
    }

    const pong = await client.request('core.ping', {}, { timeoutMs: 3000 });
    const pid = (pong.ok ? pong.result?.pid : null) ?? connected.pid ?? null;
    const startedAt = pong.ok ? pong.result?.startedAt ?? null : null;

    await client.request('core.stop', {}, { timeoutMs: 5000 });
    const closed = await client.waitForClose(5000);

    if (!closed.ok) {
      out(render.renderCoreStopTimeout(pid));
      return EXIT_FAILED;
    }
    out(render.renderCoreStopped({ pid, startedAt }, ctx.now()));
    return EXIT_OK;
  } finally {
    await client.close?.();
  }
}

// ---------------------------------------------------------------- instance status|log|graph

async function instanceCommand(parsed, ctx) {
  const { sub, positionals, flags } = parsed;

  // `instance status` 与 `orch status --instance` 逐字一致（AC-38）：直接复用同一 handler。
  if (sub === 'status') {
    return statusCommand({ instance: positionals[0] ?? flags.instance }, ctx);
  }

  const out = ctx.out;
  const client = ctx.createClient(ctx.cwd);
  try {
    const connectErr = await connectOrError(client, out);
    if (connectErr !== null) return connectErr;

    const instanceId = positionals[0] ?? flags.instance;
    const res = await client.request('instance.get', { instanceId }, { timeoutMs: 10_000 });
    if (!res.ok) {
      if (res.code === 'NOT_FOUND') {
        out(render.renderInstanceMissing(instanceId));
        return EXIT_FAILED;
      }
      out(render.renderError({ code: res.code, params: res.params ?? {} }));
      return exitCodeFor(res.code);
    }
    const snapshot = res.result;
    const template = templateOf(snapshot);

    if (sub === 'log') {
      const eventsRes = await client.request('instance.events', { instanceId }, { timeoutMs: 10_000 });
      if (!eventsRes.ok) {
        out(render.renderError({ code: eventsRes.code, params: eventsRes.params ?? {} }));
        return exitCodeFor(eventsRes.code);
      }
      const list = [...(eventsRes.result?.events ?? [])].sort((a, b) => (a?.seq ?? 0) - (b?.seq ?? 0));
      if (flags.format === 'json') {
        out(render.renderLogJson(list));
      } else if (list.length === 0) {
        out(render.renderEmptyLine('event'));
      } else {
        for (const event of list) {
          for (const line of render.renderEventLines(event, { template })) out(line);
        }
      }
      return EXIT_OK;
    }

    // graph：`instance.get` + 模板定义在 CLI 侧组装（§1.9）；不写状态、不输出 rev/generatedAt。
    const graph = getGraph(template) ?? { nodes: [], edges: [] };
    if (flags.format === 'json') {
      out(render.renderGraphJson(snapshot, graph));
    } else {
      for (const line of render.renderGraphText(snapshot, graph)) out(line);
    }
    return EXIT_OK;
  } finally {
    await client.close?.();
  }
}

// ---------------------------------------------------------------- attach

/**
 * `orch attach <会话号>`（§1.8 / A-3）：订阅 + 增量轮询双通道，严格只读。
 * 首屏打印该会话最近 20 条事件与待审批行；跟随期间只走 instance.events；
 * Ctrl-C（或注入的 waitForDetach）清定时器、退订、打印脱离行，退出 0，不调任何写 RPC。
 */
async function attachCommand(parsed, ctx) {
  const out = ctx.out;
  const sessionId = parsed.positionals[0];
  const client = ctx.createClient(ctx.cwd);
  let timer = null;
  let unsubscribe = () => {};

  try {
    const connectErr = await connectOrError(client, out);
    if (connectErr !== null) return connectErr;

    const located = await client.request('session.locate', { sessionId }, { timeoutMs: 10_000 });
    if (!located.ok) {
      if (located.code === 'NOT_FOUND' || located.code === 'SESSION_NOT_FOUND') {
        return commandError(out, 'SESSION_NOT_FOUND', { id: sessionId });
      }
      return commandError(out, located.code, { id: sessionId, ...(located.params ?? {}) });
    }

    const { instanceId, nodeId } = located.result ?? {};
    const snap = await client.request('instance.get', { instanceId }, { timeoutMs: 10_000 });
    const snapshot = snap.ok ? snap.result : null;
    const template = templateOf(snapshot);
    out(render.renderAttachHeader({ sessionId, instanceId, nodeId }, snapshot));

    // 待审批（AC-44）：紧跟一行审批信息
    const approvals = await client.request('approval.list', { sessionId }, { timeoutMs: 10_000 });
    if (approvals.ok) {
      const list = Array.isArray(approvals.result?.approvals) ? approvals.result.approvals : [];
      for (const approval of list) {
        if (approval?.state === 'pending') out(render.renderApprovalLine(approval, snapshot, { template }));
      }
    }

    let lastSeq = 0;
    const printEvent = (event) => {
      if (!event || event.objectId !== sessionId) return;
      if (Number.isInteger(event.seq) && event.seq <= lastSeq) return;
      for (const line of render.renderEventLines(event, { template })) out(line);
      if (Number.isInteger(event.seq)) lastSeq = Math.max(lastSeq, event.seq);
    };

    // 首屏：该会话最近 20 条事件，版式与 `instance log` 共用 renderEventLines / formatClock。
    const eventsRes = await client.request('instance.events', { instanceId }, { timeoutMs: 10_000 });
    if (eventsRes.ok) {
      const all = [...(eventsRes.result?.events ?? [])].sort((a, b) => (a?.seq ?? 0) - (b?.seq ?? 0));
      const recent = all.filter((event) => event?.objectId === sessionId).slice(-20);
      for (const event of recent) printEvent(event);
      for (const event of all) {
        if (Number.isInteger(event?.seq)) lastSeq = Math.max(lastSeq, event.seq);
      }
    }

    // 跟随：订阅负责即时，500ms 轮询负责断线重连后的续读，二者都用同一去重口径。
    unsubscribe = client.subscribe(instanceId, printEvent);
    timer = setInterval(() => {
      void (async () => {
        const res = await client.request('instance.events', { instanceId, sinceSeq: lastSeq }, { timeoutMs: 5000 });
        if (!res.ok) return;
        const list = [...(res.result?.events ?? [])].sort((a, b) => (a?.seq ?? 0) - (b?.seq ?? 0));
        for (const event of list) printEvent(event);
      })();
    }, 500);
    if (typeof timer.unref === 'function') timer.unref();

    const wait = typeof ctx.waitForDetach === 'function'
      ? ctx.waitForDetach
      : () => new Promise((resolve) => {
        const onSigint = () => {
          process.off('SIGINT', onSigint);
          resolve();
        };
        process.on('SIGINT', onSigint);
      });
    await wait();
    out(render.renderDetached(sessionId));
    return EXIT_OK;
  } finally {
    if (timer !== null) clearInterval(timer);
    unsubscribe();
    await client.close?.();
  }
}

// ---------------------------------------------------------------- escalate list|resolve

async function escalateCommand(parsed, ctx) {
  const out = ctx.out;
  const { sub, positionals, flags } = parsed;
  const client = ctx.createClient(ctx.cwd);

  try {
    const connectErr = await connectOrError(client, out);
    if (connectErr !== null) return connectErr;

    const collected = await collectEntries(client, 'escalations');
    if (!collected.ok) return renderCollectError(out, collected);

    if (sub === 'list') {
      // 默认待处理；--instance 先按实例过滤，--all 再放开状态范围（AC-21/22）。
      const onlyInstance = typeof flags.instance === 'string' ? flags.instance : null;
      const rows = collected.entries
        .filter((entry) => {
          if (onlyInstance && entry.instanceId !== onlyInstance) return false;
          if (!flags.all && entry?.state !== 'pending') return false;
          return true;
        })
        .sort(byInstanceThenId('escalationId'));
      if (rows.length === 0) {
        out(render.renderEmptyLine('escalation'));
      } else {
        for (const row of rows) {
          out(render.renderEscalationListRow(row, collected.snapshots.get(row.instanceId)));
        }
      }
      return EXIT_OK;
    }

    // resolve：先在只读快照里定位唯一实例，再把裁决交给核心 RPC。
    const escalationId = positionals[0];
    let matches = collected.entries.filter((entry) => entry?.escalationId === escalationId);
    if (typeof flags.instance === 'string') {
      matches = matches.filter((entry) => entry.instanceId === flags.instance);
    }
    if (matches.length === 0) return commandError(out, 'ESCALATION_NOT_FOUND', { id: escalationId });
    if (new Set(matches.map((entry) => entry.instanceId)).size > 1) {
      return commandError(out, 'ESCALATION_AMBIGUOUS', { id: escalationId });
    }
    const instanceId = matches[0].instanceId;

    const res = await client.request(
      'escalation.resolve',
      { instanceId, escalationId, decision: flags.decision },
      { timeoutMs: 15_000 },
    );
    if (!res.ok) {
      // A-5 / AC-29(3)：INSTANCE_NOT_SUSPENDED 文案的 {id} 是实例号（其余错误是升级号）。
      return commandError(out, res.code, {
        id: res.code === 'INSTANCE_NOT_SUSPENDED' ? instanceId : escalationId,
        decision: flags.decision,
        ...(res.params ?? {}),
      });
    }
    const snapshot = await fetchSnapshot(client, instanceId);
    const template = templateOf(snapshot);
    for (const line of render.renderEscalationResult(escalationId, flags.decision, snapshot, { template })) out(line);
    if (snapshot?.state === 'suspended') return EXIT_SUSPENDED;
    if (snapshot?.halted === true) return EXIT_HALTED;
    return EXIT_OK;
  } finally {
    await client.close?.();
  }
}

// ---------------------------------------------------------------- approve

async function approveCommand(parsed, ctx) {
  const out = ctx.out;
  const { positionals, flags } = parsed;
  const approvalId = positionals[0];
  const client = ctx.createClient(ctx.cwd);

  try {
    const connectErr = await connectOrError(client, out);
    if (connectErr !== null) return connectErr;

    const collected = await collectEntries(client, 'approvals');
    if (!collected.ok) return renderCollectError(out, collected);

    let matches = collected.entries.filter((entry) => entry?.approvalId === approvalId);
    if (typeof flags.instance === 'string') {
      matches = matches.filter((entry) => entry.instanceId === flags.instance);
    }
    if (matches.length === 0) return commandError(out, 'APPROVAL_NOT_FOUND', { id: approvalId });
    if (new Set(matches.map((entry) => entry.instanceId)).size > 1) {
      return commandError(out, 'APPROVAL_AMBIGUOUS', { id: approvalId });
    }
    const instanceId = matches[0].instanceId;
    const action = matches[0].action;

    const res = await client.request(
      'approval.resolve',
      { instanceId, approvalId, decision: flags.decision },
      { timeoutMs: 15_000 },
    );
    if (!res.ok) {
      return commandError(out, res.code, { id: approvalId, decision: flags.decision, ...(res.params ?? {}) });
    }
    const state = flags.decision === 'deny' ? 'denied' : 'approved';
    out(render.renderApprovalResult({ approvalId, state, action }));
    return EXIT_OK;
  } finally {
    await client.close?.();
  }
}

// ---------------------------------------------------------------- handoff list|show

async function handoffCommand(parsed, ctx) {
  const out = ctx.out;
  const { sub, positionals, flags } = parsed;
  const client = ctx.createClient(ctx.cwd);

  try {
    const connectErr = await connectOrError(client, out);
    if (connectErr !== null) return connectErr;

    const collected = await collectEntries(client, 'handoffs');
    if (!collected.ok) return renderCollectError(out, collected);
    const onlyInstance = typeof flags.instance === 'string' ? flags.instance : null;

    if (sub === 'list') {
      const rows = collected.entries
        .filter((entry) => !onlyInstance || entry.instanceId === onlyInstance)
        .sort(byInstanceThenId('handoffId'));
      if (rows.length === 0) {
        out(render.renderEmptyLine('handoff'));
      } else {
        for (const row of rows) {
          out(render.renderHandoffListRow(row, collected.snapshots.get(row.instanceId)));
        }
      }
      return EXIT_OK;
    }

    // show：编号唯一时可省略 --instance（AC-70）；重复且未指定则要求 --instance（AC-48）。
    const handoffId = positionals[0];
    let matches = collected.entries.filter((entry) => entry?.handoffId === handoffId);
    if (onlyInstance) matches = matches.filter((entry) => entry.instanceId === onlyInstance);
    if (matches.length === 0) return commandError(out, 'HANDOFF_NOT_FOUND', { id: handoffId });
    if (new Set(matches.map((entry) => entry.instanceId)).size > 1) {
      return commandError(out, 'HANDOFF_AMBIGUOUS', { id: handoffId });
    }
    const row = matches[0];
    for (const line of render.renderHandoffShow(row, collected.snapshots.get(row.instanceId))) out(line);
    return EXIT_OK;
  } finally {
    await client.close?.();
  }
}

// ---------------------------------------------------------------- workflow pause|resume|abort

async function workflowCommand(parsed, ctx) {
  const out = ctx.out;
  const { sub, positionals, flags } = parsed;
  const instanceId = positionals[0] ?? flags.instance;
  const client = ctx.createClient(ctx.cwd);

  try {
    const connectErr = await connectOrError(client, out);
    if (connectErr !== null) return connectErr;

    if (sub === 'abort') {
      // 等同取消（BR-27 / AC-52）：沿用取消的结果行。
      const res = await client.request('workflow.abort', { instanceId }, { timeoutMs: 15_000 });
      if (!res.ok) {
        if (res.code === 'NOT_FOUND') {
          out(render.renderInstanceMissing(instanceId));
          return EXIT_FAILED;
        }
        return commandError(out, res.code, { id: instanceId, ...(res.params ?? {}) });
      }
      for (const line of render.renderCancelLines(res.result ?? {})) out(line);
      return EXIT_OK;
    }

    const method = sub === 'pause' ? 'workflow.pause' : 'workflow.resume';
    const res = await client.request(method, { instanceId }, { timeoutMs: 15_000 });
    if (!res.ok) {
      if (res.code === 'NOT_FOUND') {
        out(render.renderInstanceMissing(instanceId));
        return EXIT_FAILED;
      }
      return commandError(out, res.code, { id: instanceId, ...(res.params ?? {}) });
    }
    const snapshot = await fetchSnapshot(client, instanceId);
    out(render.renderInstanceLine(snapshot));
    return EXIT_OK;
  } finally {
    await client.close?.();
  }
}
