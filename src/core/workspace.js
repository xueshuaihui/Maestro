/**
 * 共享工作区三层可见域 + `status.md`（拆分文档 §2.6 / 需求 M-1、M-2、A-1）。
 *
 * 建出来的形状（判定只看图的结构字段，不看模板名）：
 *   <ws>/shared/                 所有实例
 *   <ws>/stage/<nodeId>/         图节点数 > 1 时，按图节点逐个建
 *   <ws>/artifacts/{docs,reports}  仅 `graph.productPolicy === 'doc-single'`
 *   <ws>/status.md               核心维护的单页交接棒（整份原子替换）
 *
 * 幂等：`mkdir(recursive)` 天然幂等；已有文件不删不改（`status.md` 是核心自己的文件，
 * 按最新状态整份覆盖）。失败统一返回 `code: 'WORKSPACE_INIT_FAILED'`，由调用方转成
 * 用户可见的「无法创建工作区」并在建会话之前退出。
 *
 * 依赖方向：`persistence/paths.js`、`persistence/atomic-write.js`、`core/status-text.js`。
 */
import nodeFs from 'node:fs/promises';
import path from 'node:path';

import {
  instanceDocsDir,
  instanceReportsDir,
  instanceSharedDir,
  instanceStageDir,
  instanceStatusPath,
  instanceWorkspaceDir
} from '../persistence/paths.js';
import { writeTextAtomic } from '../persistence/atomic-write.js';
import { renderStatusDoc } from './status-text.js';

/** 建工作区失败（A-5：退出码 3，`无法创建工作区：{cause}`）。 */
export const WORKSPACE_INIT_FAILED = 'WORKSPACE_INIT_FAILED';
/** 刷新 `status.md` 失败（AC-59：只发事件、不回滚状态）。 */
export const WORKSPACE_STATUS_WRITE_FAILED = 'WORKSPACE_STATUS_WRITE_FAILED';
/** `NODE_ENV=test` 下的故障注入值（D-10）。 */
export const STATUS_WRITE_FAULT = 'workspace_status_write:fail';

function firstLine(error) {
  const message = String(error?.message ?? error ?? '').split('\n')[0];
  return message.length > 0 ? message : 'workspace_init_failed';
}

function initFailed(error, dir) {
  const cause = firstLine(error);
  return { ok: false, code: WORKSPACE_INIT_FAILED, cause, params: { path: dir, cause } };
}

async function exists(file, fs) {
  try {
    await fs.stat(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * 建出本实例的三层可见域，并写入 `status.md` 的初始内容。
 *
 * 幂等：重复调用只补建目录；`state` 缺省且 `status.md` 已存在时**不覆盖**。
 *
 * @param {{root:string, instanceId:string, graph?:object|null, state?:object|null,
 *          fs?:object}} [options]
 * @returns {Promise<{ok:true, workspaceDir:string, sharedDir:string, stageDirs:string[]}
 *   | {ok:false, code:'WORKSPACE_INIT_FAILED', cause:string, params:{path:string, cause:string}}>}
 */
export async function prepareWorkspace({ root, instanceId, graph = null, state = null, fs = nodeFs } = {}) {
  if (typeof instanceId !== 'string' || instanceId.length === 0) {
    return initFailed(new Error('instanceId 缺失'), path.join(String(root), '.orch'));
  }

  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const workspaceDir = instanceWorkspaceDir(root, instanceId);
  const sharedDir = instanceSharedDir(root, instanceId);
  const stageDirs =
    nodes.length > 1
      ? nodes
          .map((node) => node?.id ?? node?.nodeId ?? null)
          .filter((nodeId) => typeof nodeId === 'string' && nodeId.length > 0)
          .map((nodeId) => instanceStageDir(root, instanceId, nodeId))
      : [];

  const dirs = [workspaceDir, sharedDir, ...stageDirs];
  // 文档闭环才会预建两个产物区；其余图按产物需要创建（A-1）。
  if (graph?.productPolicy === 'doc-single') {
    dirs.push(instanceDocsDir(root, instanceId), instanceReportsDir(root, instanceId));
  }

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      return initFailed(error, dir);
    }
  }

  const statusPath = instanceStatusPath(root, instanceId);
  const shouldWrite = state !== null || !(await exists(statusPath, fs));
  if (shouldWrite) {
    const text =
      state !== null
        ? renderStatusDoc(state, graph, { workspaceDir })
        : `# ${instanceId}${typeof graph?.title === 'string' ? ` ${graph.title}` : ''}\n`;
    const written = await writeTextAtomic(statusPath, text);
    if (!written.ok) {
      const cause = written.params?.errno ?? 'STORE_WRITE_FAILED';
      return { ok: false, code: WORKSPACE_INIT_FAILED, cause, params: { path: statusPath, cause } };
    }
  }

  return { ok: true, workspaceDir, sharedDir, stageDirs };
}

/**
 * 把当前快照整份渲染成 `status.md` 并原子替换（不追加、不合并）。
 *
 * @param {{root:string, state:object, graph?:object|null, workspaceDir?:string|null,
 *          fault?:string|null}} options
 * @returns {Promise<{ok:true, path:string}
 *   | {ok:false, code:'WORKSPACE_STATUS_WRITE_FAILED', params:{path:string, cause:string}}>}
 */
export async function writeStatusDoc({ root, state, graph = null, workspaceDir = null, fault = null } = {}) {
  const instanceId = typeof state?.instanceId === 'string' ? state.instanceId : '';
  const statusPath = instanceId.length > 0 ? instanceStatusPath(root, instanceId) : path.join(String(root), 'status.md');
  if (instanceId.length === 0) {
    return {
      ok: false,
      code: WORKSPACE_STATUS_WRITE_FAILED,
      params: { path: statusPath, cause: 'instanceId 缺失' }
    };
  }
  if (fault === STATUS_WRITE_FAULT) {
    return { ok: false, code: WORKSPACE_STATUS_WRITE_FAILED, params: { path: statusPath, cause: fault } };
  }

  const dir = typeof workspaceDir === 'string' && workspaceDir.length > 0
    ? workspaceDir
    : instanceWorkspaceDir(root, instanceId);
  const written = await writeTextAtomic(statusPath, renderStatusDoc(state, graph, { workspaceDir: dir }));
  if (!written.ok) {
    return {
      ok: false,
      code: WORKSPACE_STATUS_WRITE_FAILED,
      params: { path: statusPath, cause: written.params?.errno ?? 'STORE_WRITE_FAILED' }
    };
  }
  return { ok: true, path: statusPath };
}

/**
 * 快照落盘成功后刷新 `status.md`。写失败只发 `workspace.status_write_failed`，
 * **不抛、不回滚**（AC-59）——调用方照常继续。
 *
 * @param {{root:string, state:object, graph?:object|null, emit?:Function|null,
 *          workspaceDir?:string|null, fault?:string|null}} options
 * @returns {Promise<{ok:true, path:string}
 *   | {ok:false, code:'WORKSPACE_STATUS_WRITE_FAILED', params:{path:string, cause:string}}>}
 */
export async function refreshStatusDoc({
  root,
  state,
  graph = null,
  emit = null,
  workspaceDir = null,
  fault = null
} = {}) {
  const result = await writeStatusDoc({ root, state, graph, workspaceDir, fault });
  if (result.ok) return result;

  if (typeof emit === 'function') {
    try {
      await emit({
        object: 'instance',
        objectId: typeof state?.instanceId === 'string' ? state.instanceId : null,
        reason: 'workspace.status_write_failed',
        detail: result.params
      });
    } catch {
      // 事件写失败不能把"状态页写失败"升级成调用失败：AC-59 只要求不回滚、可观测。
    }
  }
  return result;
}
