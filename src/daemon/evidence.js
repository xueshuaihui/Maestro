/**
 * 证据投影（I1.11 WP-6 / 拆分文档 §2.7 / 需求附录 D-7 / 附录 A-8）。
 *
 * - `buildEvidence` 是纯只读投影，数据源固定三项（D-7）：
 *   ① 实例快照 `state.nodes[nodeId].artifactRefs`（含 verifiedAt，原值透传）；
 *   ② 事件记录里该节点**最近一次** `execution.summary` 事件的四要素
 *      （command / exitCode / keyOutputLines / logRef，原值透传）；
 *   ③ 节点 `round`（轮次只取节点字段，不取事件里的轮次）。
 * - 只 stat 不读正文：日志与产物引用只做存在性检查（`node:fs/promises` 的
 *   stat），绝不读日志正文，也不读会话消息内容；引用不存在时把该引用值登记
 *   进对应条目的 `unreadable` 数组，其余各项照常返回（BR-21：不隐藏、不崩溃）。
 * - 缺项一律 `null`（界面渲染「未提供」，数据位不省略）；`nodeId` 传 null 时
 *   按节点定义序投影实例全部节点。实例不可读时 items 为空数组，不抛错。
 * - 与 I1.10b 的接口约定：投影自足，将来节点详情可直接复用，调用方不变；
 *   本模块不做任何跳转入口，也不提供导出 / 预览类动作字段。
 * - 中文文案集中在 EVIDENCE_LABELS，供 WP-7 搬运、WP-8 直接消费。
 * - 体积护栏：单值字符串超上限即截断并在 unreadable 登记（截断登记以
 *   `EVIDENCE_LABELS.TRUNCATED` 前缀区分于「引用不可读」）。AC-34 的
 *   「单次渲染 ≤ 64 KB」主体由界面层执行，本护栏保证单个条目的序列化体积
 *   远低于该阈值，界面逐字透传即可恒成立。
 *
 * 零第三方依赖；不写盘、不发事件、不自行判重。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createStore } from '../persistence/instance-store.js';

/** 证据侧中文文案基线（附录 A-8 / BR-21 逐字）。 */
export const EVIDENCE_LABELS = Object.freeze({
  UNPROVIDED: '未提供',
  LOG_ON_HOST: '完整日志留在宿主',
  UNREADABLE: '引用不可读',
  TRUNCATED: '体积超限已截断',
});

/** 单个条目的固定八字段模板（§2.7 契约，顺序即字段序）。 */
const ITEM_KEYS = Object.freeze([
  'nodeId',
  'round',
  'command',
  'exitCode',
  'keyOutputLines',
  'logRef',
  'artifactRefs',
  'unreadable',
]);

const TEXT_MAX_CHARS = 2048; // command / logRef 单值上限（字符）
const REF_MAX_CHARS = 512; // 产物引用单值上限（字符）
const REFS_MAX_ITEMS = 32; // 产物引用条数上限

/** 事件记录里摘要事件的固定标记。 */
const SUMMARY_REASON = 'execution.summary';

/**
 * 截断到上限并回报是否发生截断；非字符串原样返回 null（缺项位）。
 */
function capText(value, max) {
  if (typeof value !== 'string') return { text: null, cut: false };
  if (value.length <= max) return { text: value, cut: false };
  return { text: value.slice(0, max), cut: true };
}

/**
 * 引用存在性检查：只 stat，不读任何字节（BR-21 / D-7）。相对引用以
 * `state.cwd`（缺省退回项目根）为基准解析，绝对引用按原样检查。
 */
function resolveRef(base, ref) {
  if (path.isAbsolute(ref)) return ref;
  return path.resolve(base, ref);
}

async function statReadable(absPath) {
  try {
    await fs.stat(absPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 事件记录 → `nodeId → 最近一次摘要四要素`。按文件顺序遍历，后者覆盖前者
 * （追加序即时间序）；非摘要事件一律跳过，只取四要素，绝不触碰事件正文。
 */
async function latestSummaries(store, instanceId) {
  const map = new Map();
  const res = await store.readEvents(instanceId);
  if (!res?.ok) return map;
  for (const event of res.events ?? []) {
    if (event?.reason !== SUMMARY_REASON) continue;
    const detail = event.detail ?? null;
    const id = typeof detail?.nodeId === 'string' && detail.nodeId.length > 0 ? detail.nodeId : null;
    if (id === null) continue;
    const summary = detail.summary ?? null;
    map.set(id, summary !== null && typeof summary === 'object' ? summary : null);
  }
  return map;
}

function summaryValue(summary, key) {
  if (summary === null) return null;
  const value = summary[key];
  return value === undefined || value === null ? null : value;
}

/**
 * 单节点投影：五项 + 轮次 + 产物引用 + 不可读登记。任何单项取不到都不影响
 * 其余项（BR-21）。
 */
async function projectNode(node, id, summary, base) {
  const unreadable = [];

  const command = capText(summaryValue(summary, 'command'), TEXT_MAX_CHARS);
  if (command.cut) unreadable.push(`${EVIDENCE_LABELS.TRUNCATED}：command`);

  const logRef = capText(summaryValue(summary, 'logRef'), TEXT_MAX_CHARS);
  if (logRef.cut) unreadable.push(`${EVIDENCE_LABELS.TRUNCATED}：logRef`);
  if (logRef.text !== null && !(await statReadable(resolveRef(base, logRef.text)))) {
    unreadable.push(logRef.text);
  }

  const rawRefs = Array.isArray(node.artifactRefs) ? node.artifactRefs : [];
  const overLimit = rawRefs.length > REFS_MAX_ITEMS;
  const artifactRefs = [];
  let refsCut = false;
  for (const raw of rawRefs.slice(0, REFS_MAX_ITEMS)) {
    if (raw === null || typeof raw !== 'object') continue;
    const refText = capText(raw.ref, REF_MAX_CHARS);
    if (refText.text === null) continue;
    if (refText.cut) refsCut = true;
    if (!(await statReadable(resolveRef(base, refText.text)))) {
      unreadable.push(refText.text);
    }
    artifactRefs.push({
      ref: refText.text,
      bytes: Number.isInteger(raw.bytes) ? raw.bytes : null,
      sha256: typeof raw.sha256 === 'string' ? raw.sha256 : null,
      verifiedAt: typeof raw.verifiedAt === 'string' ? raw.verifiedAt : null,
    });
  }
  if (refsCut || overLimit) unreadable.push(`${EVIDENCE_LABELS.TRUNCATED}：artifactRefs`);

  const item = {
    nodeId: id,
    round: Number.isInteger(node.round) ? node.round : null,
    command: command.text,
    exitCode: summaryValue(summary, 'exitCode'),
    keyOutputLines: summaryValue(summary, 'keyOutputLines'),
    logRef: logRef.text,
    artifactRefs: artifactRefs.length > 0 ? artifactRefs : null,
    unreadable,
  };
  return item;
}

/**
 * 证据投影（§2.7 / D-7）。`nodeId` 传 null 时按节点定义序返回实例全部节点；
 * 传具体节点时只返回该节点（不存在则 items 为空）。实例不可读 / 未找到按
 * 空投影降级，绝不抛错（AC-33）。
 */
export async function buildEvidence(root, instanceId, nodeId) {
  const echoId = typeof instanceId === 'string' ? instanceId : null;
  if (typeof root !== 'string' || root.length === 0 || echoId === null || echoId.length === 0) {
    return { instanceId: echoId, items: [] };
  }

  const store = createStore({ root });
  const loaded = await store.load(echoId);
  if (!loaded?.ok || loaded.state === null || typeof loaded.state !== 'object') {
    return { instanceId: echoId, items: [] };
  }

  const state = loaded.state;
  const nodes = Array.isArray(state.nodes) ? state.nodes : [];
  const summaries = await latestSummaries(store, echoId);
  const base = typeof state.cwd === 'string' && state.cwd.length > 0 ? state.cwd : root;

  const wanted = typeof nodeId === 'string' && nodeId.length > 0 ? nodeId : null;
  const items = [];
  for (const node of nodes) {
    if (node === null || typeof node !== 'object') continue;
    const id = typeof node.nodeId === 'string' && node.nodeId.length > 0 ? node.nodeId : null;
    if (id === null) continue;
    if (wanted !== null && id !== wanted) continue;
    items.push(await projectNode(node, id, summaries.get(id) ?? null, base));
  }
  return { instanceId: echoId, items };
}

/** 供调用方自检字段模板（§2.7 契约的固定八字段，顺序即字段序）。 */
export const EVIDENCE_ITEM_KEYS = ITEM_KEYS;
