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
import { loadRegistry } from '../registry/index.js';
import { ARTIFACT_TYPES, GROUPS, SIDE_EFFECTS } from '../registry/role-schema.js';
import { getGraph } from '../templates/index.js';
import {
  GROUP_LABEL,
  ROLE_CLI_TEXT,
  ROLE_USAGE_TEXT,
  SKILL_CLI_TEXT,
  WORKFLOW_CLI_TEXT,
} from './labels.js';
import * as render from './render.js';
import { firstRegistryDetail, roleCommand } from './roles.js';

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
  // I1.5 C-10：注册表不合法也属于「开始前失败」，退出 3，且不连核心
  'REGISTRY_INVALID',
]);

/**
 * 连接层失败：核心断开 / 帧坏 / 连接超时。这些不是宿主错误，不能渲染成"未知错误"。
 * 出现时按"实例已中断"收尾（C-3）。
 */
const CONNECTION_LOST_CODES = new Set(['IPC_CLOSED', 'IPC_TIMEOUT', 'IPC_BAD_FRAME', 'CORE_NOT_RUNNING']);

const COMMANDS = new Set(['run', 'status', 'cancel', 'core', 'role', 'skill', 'workflow']);
const BOOLEAN_FLAGS = new Set(['events', 'force']);
const VALUE_FLAGS = new Set([
  'cwd',
  'task',
  'instance',
  'project',
  'generation',
  'template',
  'host',
  'group',
  'format',
  // I1.6 asset families (D-6). Family-scoped: outside `role`/`skill`/`workflow`
  // they are still rejected as unknown parameters, never silently dropped.
  'from',
  'name',
  'artifact-type',
  'side-effect',
  'summary',
  'skills',
  'tools',
  'wake-allow',
  'max-concurrent',
  'set',
  'unset',
  'out',
  'against',
  'body-file',
  'applies-to',
  'commands'
]);
/** `--set` / `--unset` may repeat (D-6); each occurrence is appended into an array. */
const REPEATABLE_FLAGS = new Set(['set', 'unset']);

/**
 * The three asset families (`role` / `skill` / `workflow`, I1.6). Everything else
 * keeps its I1.5 result shape: no `sub` for run/status/cancel, no `positional`.
 */
const FAMILY_SUBS = Object.freeze({
  role: new Set(['list', 'show', 'validate', 'create', 'edit', 'export', 'import', 'diff']),
  skill: new Set(['list', 'show', 'create', 'validate', 'export', 'import']),
  workflow: new Set(['list', 'show', 'create', 'validate', 'diff', 'dry-run'])
});

/**
 * D-6: the 18-row per-subcommand flag whitelist. A flag known to the parser but
 * absent here is `--<key> 不适用于 <族> <子命令>`; an unknown word is still
 * `未知参数：--<key>` (two different sentences, checked after parsing).
 */
const FAMILY_FLAGS = Object.freeze({
  role: Object.freeze({
    list: new Set(['group', 'instance', 'format']),
    show: new Set(['instance', 'format']),
    validate: new Set(['format']),
    create: new Set(['from', 'name', 'group', 'artifact-type', 'side-effect', 'summary', 'skills', 'tools', 'wake-allow', 'max-concurrent', 'force']),
    edit: new Set(['set', 'unset']),
    export: new Set(['out']),
    import: new Set(['force']),
    diff: new Set(['against', 'format'])
  }),
  skill: Object.freeze({
    list: new Set(['group', 'format']),
    show: new Set(['format']),
    create: new Set(['name', 'summary', 'applies-to', 'commands', 'body-file', 'force']),
    validate: new Set(['format']),
    export: new Set(['out']),
    import: new Set(['force'])
  }),
  workflow: Object.freeze({
    list: new Set(['format']),
    show: new Set(['format']),
    create: new Set(['name', 'from', 'force']),
    validate: new Set(['format']),
    diff: new Set(['against', 'format']),
    'dry-run': new Set(['task', 'format'])
  })
});

/** Positional argument rules per D-6: required / optional; anything else rejects it. */
const REQUIRED_POSITIONAL = Object.freeze({
  role: new Set(['show', 'create', 'edit', 'export', 'import', 'diff']),
  skill: new Set(['show', 'create', 'export', 'import']),
  workflow: new Set(['show', 'create', 'diff', 'dry-run'])
});
const OPTIONAL_POSITIONAL = Object.freeze({
  role: new Set(['validate']),
  skill: new Set(['validate']),
  workflow: new Set(['validate'])
});

/**
 * Family-scoped flags (M-9 direction preserved from I1.5): outside the three asset
 * families they stay `未知参数：--<key>` (e.g. `status --group`), so old commands
 * never silently accept a family flag just because the shared vocabulary grew.
 */
const FAMILY_ONLY_FLAGS = new Set([
  'group',
  'format',
  'force',
  'from',
  'name',
  'artifact-type',
  'side-effect',
  'summary',
  'skills',
  'tools',
  'wake-allow',
  'max-concurrent',
  'set',
  'unset',
  'out',
  'against',
  'body-file',
  'applies-to',
  'commands'
]);

/** `role create` two-tier required order (D-6 / AC-02): first missing one wins. */
const ROLE_CREATE_REQUIRED = ['name', 'group', 'artifact-type', 'side-effect'];

/** Dynamic-import wiring for the two families whose modules land in WP-7 / WP-8. */
const FAMILY_MODULES = Object.freeze({
  skill: { specifier: './skills.js', exportName: 'skillCommand', notImplemented: SKILL_CLI_TEXT.notImplemented },
  workflow: { specifier: './workflows.js', exportName: 'workflowCommand', notImplemented: WORKFLOW_CLI_TEXT.notImplemented }
});

// ---------------------------------------------------------------- 参数解析

/**
 * Pure parsing, no IO — usage-error paths are directly unit-testable.
 *
 * @param {string[]} argv without node and the script path
 * @returns {{ok:true, command:string, sub:string|null, flags:object} | {ok:false, code:'USAGE', message:string}}
 *   Family commands (`role`/`skill`/`workflow`) additionally carry `positional`
 *   (string|null); the four original commands keep their exact I1.5 key set.
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
  const isFamily = command === 'role' || command === 'skill' || command === 'workflow';

  let sub = null;
  let positional = null;
  if (command === 'core') {
    sub = tokens.shift() ?? null;
    if (sub === null || sub.startsWith('--')) {
      return usage('core 需要子命令：stop');
    }
  }
  if (isFamily) {
    sub = tokens.shift() ?? null;
    if (sub === null || sub.startsWith('--') || !FAMILY_SUBS[command].has(sub)) {
      return usage(fillTemplate(unknownSubTemplate(command), { sub: sub ?? '' }));
    }
  }

  /** @type {Record<string, string|boolean|string[]>} */
  const flags = {};
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (typeof token !== 'string' || !token.startsWith('--')) {
      // Family commands take one optional positional (role id / skill id / file ...);
      // every other command still accepts none.
      if (isFamily && positional === null && typeof token === 'string' && token.length > 0) {
        positional = token;
        continue;
      }
      return usage(`多余的参数：${token}`);
    }

    const eq = token.indexOf('=');
    const key = eq >= 0 ? token.slice(2, eq) : token.slice(2);
    const inline = eq >= 0 ? token.slice(eq + 1) : undefined;

    if (key.length === 0) return usage(`无法识别的参数：${token}`);

    // Family-scoped vocabulary check first (M-9): `--force` and friends must stay
    // unknown parameters outside the three families, even though `force` is also
    // a boolean word the parser recognises.
    if (FAMILY_ONLY_FLAGS.has(key) && !isFamily) {
      return usage(`未知参数：--${key}`);
    }

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
    if (REPEATABLE_FLAGS.has(key)) {
      // D-6: `--set` / `--unset` accumulate into arrays.
      const list = Array.isArray(flags[key]) ? flags[key] : [];
      list.push(value);
      flags[key] = list;
    } else {
      flags[key] = value;
    }
  }

  if (command === 'run') {
    if (typeof flags.cwd !== 'string') return usage('run 需要 --cwd <目录>');
    if (typeof flags.task !== 'string') return usage('run 需要 --task <说明>');
  }
  if (command === 'cancel' && typeof flags.instance !== 'string') {
    return usage('cancel 需要 --instance <实例号>');
  }
  if (command === 'core' && sub !== 'stop') {
    return usage(`未知的 core 子命令：${sub}`);
  }
  if (isFamily) {
    // Positional rules come first, then the per-subcommand whitelist, then format
    // values, then the create-time required/value checks (D-6 order).
    if (REQUIRED_POSITIONAL[command].has(sub) && positional === null) {
      return usage(missingPositionalMessage(command, sub));
    }
    if (
      positional !== null &&
      !REQUIRED_POSITIONAL[command].has(sub) &&
      !OPTIONAL_POSITIONAL[command].has(sub)
    ) {
      // D-6: only the listed subs accept a positional; `list` rejects it outright.
      return usage(`多余的参数：${positional}`);
    }
    const allowed = FAMILY_FLAGS[command][sub];
    for (const key of Object.keys(flags)) {
      if (allowed.has(key)) continue;
      return usage(fillTemplate(flagNotApplicableTemplate(command), { key, sub }));
    }
    if (flags.format !== undefined && flags.format !== 'text' && flags.format !== 'json') {
      return usage(badFormatMessage(command));
    }
    const createError = createUsageError(command, sub, flags);
    if (createError !== null) return usage(createError);
  }

  // `positional` appears on the three families only: the original four commands
  // keep their exact result key set.
  const result = { ok: true, command, sub, flags };
  if (isFamily) result.positional = positional;
  return result;
}

function unknownSubTemplate(command) {
  if (command === 'skill') return SKILL_CLI_TEXT.usageReason.unknownSub;
  if (command === 'workflow') return WORKFLOW_CLI_TEXT.usageReason.unknownSub;
  return ROLE_CLI_TEXT.usageReason.unknownRoleSub;
}

function flagNotApplicableTemplate(command) {
  if (command === 'skill') return SKILL_CLI_TEXT.usageReason.flagNotApplicable;
  if (command === 'workflow') return WORKFLOW_CLI_TEXT.usageReason.flagNotApplicable;
  return ROLE_CLI_TEXT.usageReason.flagNotApplicable;
}

function badFormatMessage(command) {
  if (command === 'skill') return SKILL_CLI_TEXT.usageReason.badFormat;
  if (command === 'workflow') return WORKFLOW_CLI_TEXT.usageReason.badFormat;
  return ROLE_CLI_TEXT.usageReason.badFormat;
}

function missingPositionalMessage(command, sub) {
  if (command === 'skill') return SKILL_CLI_TEXT.usageReason.missingId[sub] ?? '';
  if (command === 'workflow') return WORKFLOW_CLI_TEXT.usageReason.missingId[sub] ?? '';
  if (sub === 'show') return ROLE_CLI_TEXT.usageReason.missingRoleId;
  return ROLE_USAGE_TEXT.missingId[sub] ?? '';
}

/**
 * Create-time usage checks (D-6 / AC-02 / AC-54). Pure argv level, so they live in
 * `parseArgs` and run before any family module is dispatched:
 * - `role create` without `--from`: `--name → --group → --artifact-type → --side-effect`
 *   all required, first missing one reported; with `--from` the four are skippable.
 *   Value legality (`--group` / `--artifact-type` / `--side-effect`) is checked in
 *   both tiers whenever the flag is given.
 * - `skill create`: `--name → --summary` (AC-59 pins the latter sentence verbatim).
 * - `workflow create`: `--name`.
 * The `skill create --applies-to` value check stays with WP-7 (`skills.js`).
 *
 * @returns {string|null} the usage reason, or null when everything is fine
 */
function createUsageError(command, sub, flags) {
  if (command === 'role' && sub === 'create') {
    if (flags.from === undefined) {
      for (const key of ROLE_CREATE_REQUIRED) {
        if (flags[key] === undefined) {
          return fillTemplate(ROLE_USAGE_TEXT.requiresFlag, { key });
        }
      }
    }
    if (flags.group !== undefined && !GROUPS.includes(flags.group)) {
      return fillTemplate(ROLE_USAGE_TEXT.badGroup, { values: Object.values(GROUP_LABEL).join('/') });
    }
    if (flags['artifact-type'] !== undefined && !ARTIFACT_TYPES.includes(flags['artifact-type'])) {
      return fillTemplate(ROLE_USAGE_TEXT.badArtifactType, { values: ARTIFACT_TYPES.join('/') });
    }
    if (flags['side-effect'] !== undefined && !SIDE_EFFECTS.includes(flags['side-effect'])) {
      return fillTemplate(ROLE_USAGE_TEXT.badSideEffect, { values: SIDE_EFFECTS.join('/') });
    }
  }
  if (command === 'skill' && sub === 'create') {
    if (flags.name === undefined) return SKILL_CLI_TEXT.usageReason.requiresName;
    if (flags.summary === undefined) return SKILL_CLI_TEXT.usageReason.requiresSummary;
  }
  if (command === 'workflow' && sub === 'create') {
    if (flags.name === undefined) return WORKFLOW_CLI_TEXT.usageReason.requiresName;
  }
  return null;
}

/** 占位符替换（`{name}`）。只有 role 的用法文案需要它。 */
function fillTemplate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars?.[key];
    return value === undefined || value === null ? '' : String(value);
  });
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
  };

  let code;
  try {
    if (parsed.command === 'run') code = await runCommand(parsed.flags, ctx);
    else if (parsed.command === 'status') code = await statusCommand(parsed.flags, ctx);
    else if (parsed.command === 'cancel') code = await cancelCommand(parsed.flags, ctx);
    else if (parsed.command === 'role') code = await roleCommand(parsed, ctx);
    else if (parsed.command === 'skill') code = await assetFamilyCommand('skill', parsed, ctx);
    else if (parsed.command === 'workflow') code = await assetFamilyCommand('workflow', parsed, ctx);
    else code = await coreCommand(parsed.sub, ctx);
  } catch (error) {
    // 渲染层与 IPC 都不应该抛；真抛了也不能吞成“成功”。
    ctx.out(render.renderError({ code: 'UNKNOWN_ERROR', params: { raw: error?.message ?? String(error) } }));
    code = EXIT_FAILED;
  }

  await flushStdout();
  return code;
}

/**
 * Dispatch one asset-family command through a dynamic import (I1.6). `skills.js`
 * (WP-7) and `workflows.js` (WP-8) do not exist yet, so a valid parse that reaches
 * here falls back to a usage-style "not implemented yet" notice (exit 2) — the
 * `role` family and all four original commands are unaffected (AC-44 / AC-48).
 * A missing module is the only tolerated failure; any other import error (e.g. a
 * syntax bug in a landed module) propagates to `main`'s catch as UNKNOWN_ERROR.
 */
async function assetFamilyCommand(family, parsed, ctx) {
  const spec = FAMILY_MODULES[family];
  let mod;
  try {
    mod = await import(spec.specifier);
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') {
      ctx.out(render.renderUsage(spec.notImplemented));
      return EXIT_USAGE;
    }
    throw error;
  }
  return mod[spec.exportName](parsed, ctx);
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

// ---------------------------------------------------------------- run

async function runCommand(flags, ctx) {
  const out = ctx.out;

  // C-10：两步预检都在 `createClient` 之前 —— 先建 client 就已经把核心拉起来了，
  // 「不启动核心」的验收（AC-10）用「一调 createClient 就 assert.fail」的桩来验。
  // ① 模板名（沿用既有 `getGraph` 判定与 `TEMPLATE_UNKNOWN` 文案）
  if (typeof flags.template === 'string' && getGraph(flags.template) === null) {
    out(render.renderError({ code: 'TEMPLATE_UNKNOWN', params: { name: flags.template } }));
    return exitCodeFor('TEMPLATE_UNKNOWN');
  }
  // ② 注册表（明细由 `roles.js` 的同一函数组装，与 A-4 一行同版式、不带 `- `）
  const registry = loadRegistry({ root: ctx.cwd });
  if (!registry.ok) {
    out(render.renderRegistryInvalid(firstRegistryDetail(registry.errors)));
    return EXIT_PREFLIGHT;
  }

  const client = ctx.createClient(ctx.cwd);

  let timer = null;
  let unsubscribe = () => {};
  let ticking = false;
  let lastKey = null;
  let lastLine = null;
  let lastPrintedAt = 0;

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
    const template = typeof snapshot?.template === 'string' ? snapshot.template : 'single';

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
