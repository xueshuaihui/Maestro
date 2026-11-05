/**
 * `.orch` 目录布局与本地通信端点名的唯一计算点（拆分文档 §2.1）。
 *
 * 约定：任何其他模块都不得自行拼接这些路径，否则布局一旦变化就会散落多处。
 * 所有路径一律经 `node:path` 生成，避免手拼分隔符在 Windows 上出错。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const isWindows = process.platform === 'win32';

// 管道名只取 sha256 十六进制摘要的前 16 位，长度稳定且足够区分不同项目。
const PIPE_HASH_LEN = 16;

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

export function eventsPath(root, id) {
  return path.join(instanceDir(root, id), 'events.jsonl');
}

/** 损坏备份：是 `state.json` 的**副本**，原文件保留原字节（AC-13）。 */
export function corruptPath(root, id) {
  return path.join(instanceDir(root, id), 'state.json.corrupt');
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
 * - 其他：`<root>/.orch/core.sock`（仅开发/CI 兜底，不作验收面）
 *
 * Windows 路径大小写不敏感，哈希前先 `toLowerCase()`，否则 `D:\WWW` 与 `d:\www`
 * 会算出两个管道名，导致同一项目被当成两个核心。
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
  return path.join(resolveForHash(root), '.orch', 'core.sock');
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
