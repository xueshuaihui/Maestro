/**
 * `.orch` 目录布局与本地通信端点名的唯一计算点（拆分文档 §2.1）。
 *
 * 约定：任何其他模块都不得自行拼接这些路径，否则布局一旦变化就会散落多处。
 * 所有路径一律经 `node:path` 生成，避免手拼分隔符在 Windows 上出错。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const isWindows = process.platform === 'win32';

// 管道名只取 sha256 十六进制摘要的前 16 位，长度稳定且足够区分不同项目。
const PIPE_HASH_LEN = 16;

/**
 * POSIX 域套接字地址的可用字节数（不含结尾 NUL）。
 *
 * macOS 的 `sun_path` 是定长 104 字节，Linux 是 108。这里取较小值：宁可早一点
 * 换短端点，也不要靠平台差异碰运气。
 */
const POSIX_SUN_PATH_MAX = 103;

// Windows 命名管道不在文件系统里，只能以 `\\.\pipe\` 命名空间字面量表达；
// 这不是文件路径，故不使用 path.join（path.join 会规范化反斜杠）。
const WINDOWS_PIPE_PREFIX = '\\\\.\\pipe\\maestro-';

/**
 * 项目的真实根路径。
 *
 * 用 `fs.realpathSync.native` 归一化：解析符号链接、短路径（8.3），并返回文件系统
 * 的真实大小写。路径不存在时直接抛 ENOENT —— 绝不静默回退成相对路径，否则管道名
 * 与 `.orch` 布局会随调用方 cwd 漂移。
 */
export function projectRoot(cwdOrRoot) {
  if (typeof cwdOrRoot !== 'string' || cwdOrRoot.length === 0) {
    throw new TypeError('projectRoot: 需要一个非空路径字符串');
  }
  return fs.realpathSync.native(path.resolve(cwdOrRoot));
}

export function orchDir(root) {
  return path.join(root, '.orch');
}

/** 实例目录的父目录（`store.list` 遍历此目录）。 */
export function instancesDir(root) {
  return path.join(orchDir(root), 'instances');
}

export function instanceDir(root, id) {
  return path.join(instancesDir(root), id);
}

export function statePath(root, id) {
  return path.join(instanceDir(root, id), 'state.json');
}

/** 检查点文件：`<instanceDir>/state/checkpoint.json`（新建 state/ 子目录，与 state.json 同级）。 */
export function checkpointPath(root, id) {
  return path.join(instanceDir(root, id), 'state', 'checkpoint.json');
}

export function eventsPath(root, id) {
  return path.join(instanceDir(root, id), 'events.jsonl');
}

/** 损坏备份：是 `state.json` 的**副本**，原文件保留原字节（AC-13）。 */
export function corruptPath(root, id) {
  return path.join(instanceDir(root, id), 'state.json.corrupt');
}

/** Directory holding the per-instance state files (`<instanceDir>/state`). */
export function instanceStateDir(root, id) {
  return path.join(instanceDir(root, id), 'state');
}

/** Append-only trace log for one instance (`<state>/traces.jsonl`). */
export function instanceTracesPath(root, id) {
  return path.join(instanceStateDir(root, id), 'traces.jsonl');
}

/**
 * 实例工作区（I1.3）。`task-loop` 的研究笔记与文档版本都落在这里，
 * 相对引用（`artifacts/docs/x.v1.md`）一律相对它解析。
 */
export function instanceWorkspaceDir(root, id) {
  return path.join(instanceDir(root, id), 'workspace');
}

/** 文档版本区：`<workspace>/artifacts/docs`。 */
export function instanceDocsDir(root, id) {
  return path.join(instanceWorkspaceDir(root, id), 'artifacts', 'docs');
}

/** 研究笔记区：`<workspace>/artifacts/reports`。 */
export function instanceReportsDir(root, id) {
  return path.join(instanceWorkspaceDir(root, id), 'artifacts', 'reports');
}

/** 公共区：`<workspace>/shared`，所有节点只读、核心与人工可写（I1.4 M-1）。 */
export function instanceSharedDir(root, id) {
  return path.join(instanceWorkspaceDir(root, id), 'shared');
}

/** 阶段区根：`<workspace>/stage`，其下每个图节点一个子目录（I1.4 M-1）。 */
export function instanceStageRoot(root, id) {
  return path.join(instanceWorkspaceDir(root, id), 'stage');
}

/** 单个节点的阶段区：`<workspace>/stage/<nodeId>`。 */
export function instanceStageDir(root, id, nodeId) {
  return path.join(instanceStageRoot(root, id), nodeId);
}

/** 核心维护的人类可读交接棒：`<workspace>/status.md`。 */
export function instanceStatusPath(root, id) {
  return path.join(instanceWorkspaceDir(root, id), 'status.md');
}

/** 持久化信箱根：`<root>/.orch/inbox/<id>`（实例目录之外，I1.4 M-5）。 */
export function instanceInboxDir(root, id) {
  return path.join(orchDir(root), 'inbox', id);
}

/** 单张交接包的信箱文件：`<inbox>/<handoffId>.json`。 */
export function inboxFilePath(root, id, handoffId) {
  return path.join(instanceInboxDir(root, id), `${handoffId}.json`);
}

export function coreMetaPath(root) {
  return path.join(orchDir(root), 'core.json');
}

export function coreLogPath(root) {
  return path.join(orchDir(root), 'core.log');
}

/**
 * 本地通信端点名。
 *
 * - win32：`\\.\pipe\maestro-<sha256(realpath(root)).slice(0,16)>`
 * - 其他：`<root>/.orch/core.sock`；路径超出 `sun_path` 上限时退到
 *   `<tmpdir>/maestro-<sha256(realpath(root)).slice(0,16)>.sock`
 *
 * Windows 路径大小写不敏感，哈希前先 `toLowerCase()`，否则 `D:\WWW` 与 `d:\www`
 * 会算出两个管道名，导致同一项目被当成两个核心。
 *
 * POSIX 侧为什么要退短端点：`sun_path` 定长，内核在 `bind()` 时**静默截断**
 * 过长的路径。项目目录一深，核心就把自己绑在 `core.soc` 上，而所有客户端仍去连
 * `core.sock` —— 拿到 ECONNREFUSED，且没有任何一处报错。表现就是「装好的应用
 * 一直显示正在连接」，CLI 侧则是「核心没在跑」。既然两端都由本函数推导端点，
 * 换短端点是对称的，不影响任何调用方。
 */
export function pipeName(root) {
  if (isWindows) {
    const digest = crypto
      .createHash('sha256')
      .update(resolveForHash(root).toLowerCase())
      .digest('hex')
      .slice(0, PIPE_HASH_LEN);
    return `${WINDOWS_PIPE_PREFIX}${digest}`;
  }
  const resolved = resolveForHash(root);
  const natural = path.join(resolved, '.orch', 'core.sock');
  if (Buffer.byteLength(natural) <= POSIX_SUN_PATH_MAX) return natural;
  const digest = crypto
    .createHash('sha256')
    .update(resolved)
    .digest('hex')
    .slice(0, PIPE_HASH_LEN);
  return path.join(os.tmpdir(), `maestro-${digest}.sock`);
}

/** 建出 `.orch/instances/`（幂等）。 */
export async function ensureLayout(root) {
  await fs.promises.mkdir(instancesDir(root), { recursive: true });
}

/**
 * 哈希用的路径归一化：能 realpath 就用真实路径；目录尚未创建时退回到绝对路径。
 * 退回值仍是绝对路径，因此不同 cwd 下调用依然得到同一个结果。
 */
function resolveForHash(root) {
  const absolute = path.resolve(String(root));
  try {
    return fs.realpathSync.native(absolute);
  } catch {
    return absolute;
  }
}

/**
 * Worktree path for a code-role instance node (I1.7).
 *
 * Returns `<workspace>/worktrees/<roleId>`, where `<workspace>` is
 * `instanceWorkspaceDir(root, id)`. The caller only invokes this for roles
 * whose `artifact_type === 'code'`; non-code roles never get a worktree.
 */
export function instanceCodeWorktreeDir(root, id, roleId) {
  return path.join(instanceWorkspaceDir(root, id), 'worktrees', roleId);
}

/**
 * Dataset snapshot area path (I1.7).
 *
 * Returns `<workspace>/artifacts/data`, where `<workspace>` is
 * `instanceWorkspaceDir(root, id)`.
 */
export function instanceDataDir(root, id) {
  return path.join(instanceWorkspaceDir(root, id), 'artifacts', 'data');
}
