/**
 * 桌面通知开关的本机偏好读写（I1.11 §2.2 / D-42）。
 *
 * 本模块是 `.orch/desktop/prefs.json` 的唯一写入方：只读写四个开关键
 * （总开关 + 升级 / 完成 / 异常三类分项），不触碰实例状态、资产与事件日志。
 *
 * 异常态口径（需求 §3.1）：
 * - 缺文件 / 缺目录 / JSON 损坏 / 缺键 → 按「全 true」缺省处理，不抛错；
 * - 键值非法（非布尔）→ 按 true 处理；
 * - 多余键在读侧忽略；在写侧拒绝（throw），避免偏好文件被悄悄扩容。
 *
 * 写入走 tmp+rename 原子内核（复用 persistence 的 writeJsonAtomic），目标只有
 * 一个文件；写入前先与现有偏好合并，调用方可以只传需要改动的那部分键。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { writeJsonAtomic } from '../persistence/atomic-write.js';

/** 四个开关键与全 true 缺省（§2.2）。顺序即键序，落盘内容稳定。 */
export const PREFS_KEYS = Object.freeze(['enabled', 'escalate', 'completed', 'anomaly']);

const DEFAULT_PREFS = Object.freeze({
  enabled: true,
  escalate: true,
  completed: true,
  anomaly: true,
});

/** 偏好文件唯一落点：<root>/.orch/desktop/prefs.json。 */
export function prefsPath(root) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new TypeError('prefsPath: root 必填');
  }
  return path.join(root, '.orch', 'desktop', 'prefs.json');
}

/**
 * 读偏好。任何异常态（缺文件 / 损坏 / 缺键 / 非法值）都降级为缺省或 true，
 * 不抛错——开关读取失败不应拖垮通知与队列。
 *
 * @returns {Promise<{enabled:boolean, escalate:boolean, completed:boolean, anomaly:boolean}>}
 */
export async function readPrefs(root) {
  const file = prefsPath(root);
  let raw = null;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    return { ...DEFAULT_PREFS };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_PREFS };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ...DEFAULT_PREFS };
  }
  const out = {};
  for (const key of PREFS_KEYS) {
    out[key] = parsed[key] === false ? false : true;
  }
  return out;
}

/**
 * 写偏好（合并语义）。`patch` 只允许四键的子集，键值必须是布尔；
 * 未知键或非法值一律 throw，绝不静默丢弃——多余键是调用方的 bug，
 * 沉默会把数据布局越写越脏（D-42 / §3.1）。
 *
 * @param {string} root 项目根
 * @param {Partial<{enabled:boolean, escalate:boolean, completed:boolean, anomaly:boolean}>} patch
 * @returns {Promise<{enabled:boolean, escalate:boolean, completed:boolean, anomaly:boolean}>}
 *   合并后落盘的完整偏好。
 */
export async function writePrefs(root, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new TypeError('writePrefs: patch 必须是四键子集的对象');
  }
  for (const key of Object.keys(patch)) {
    if (!PREFS_KEYS.includes(key)) {
      throw new TypeError(`writePrefs: 未知键 ${key}（只允许 ${PREFS_KEYS.join(', ')}）`);
    }
    if (typeof patch[key] !== 'boolean') {
      throw new TypeError(`writePrefs: ${key} 的值必须是布尔`);
    }
  }
  const current = await readPrefs(root);
  const merged = { ...current, ...patch };
  const written = await writeJsonAtomic(prefsPath(root), merged);
  if (!written || written.ok !== true) {
    const err = new Error(`writePrefs: 偏好写入失败（${written?.code ?? 'UNKNOWN'}）`);
    err.code = written?.code ?? 'STORE_WRITE_FAILED';
    err.params = written?.params;
    throw err;
  }
  return merged;
}
