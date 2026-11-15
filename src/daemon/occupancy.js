/**
 * 全局角色占用投影：跨实例按角色聚合运行时占用（I1.11 WP-4 / 拆分文档 §2.5 /
 * 需求附录 D-5 / D-07 / U-3）。
 *
 * - 数据源是每个实例自己的角色实例投影（U-3：无全局索引）：对调用方传入的每份
 *   实例快照（`state.json` 形态，D-40）调用既有 `buildRoleInstances` —— 与实例
 *   流程图（`src/daemon/graph.js`）同一份投影，两处不各算一套（AC-28 同源锚点）。
 * - 全局口径（U-3 / D-07）= 本机守护进程所辖、本项目根下的全部实例，由调用方以
 *   `instances` 传入；本模块不自行枚举实例、不落盘、不缓存跨请求、不发事件。
 * - 聚合规则（D-5）：按 roleId 合并 —— 参与实例计数、活跃会话求和、服务节点
 *   并集、宿主并集（D-48 第 8 字段）、状态取「最忙」（服务中 > 可用 > 冷却中 >
 *   不可用 > 未参与）。
 * - 注册表只补中文名与分组；注册表为空时沿用既有投影口径（known by
 *   declaration，同 `src/daemon/graph.js` 的空表替换），绝不把角色判成不可用
 *   （D-5）；此时中文名与分组渲染数据为 null，界面用 id 兜底。
 * - 有实例在场时，注册表里没有运行时记录的角色也给出「未参与」行（参与 0 实例、
 *   0 会话、无服务节点，A-6 逐字基线）；完全没有实例时返回空行集（A-6「角色
 *   占用 无」）。
 * - 实例状态不可读 → 跳过并计数（`skipped`），不出现在聚合里，不抛错。
 * - 中文文案集中在 OCCUPANCY_LABELS / OCCUPANCY_STATUS_ORDER，供 WP-7 搬运进
 *   labels.js、WP-8 直接消费；模块内不散落硬编码，不产生新状态词（只透传既有
 *   投影的六态经既有词表映射后的占用五词）。
 *
 * 零第三方依赖；纯只读。
 */

import { buildRoleInstances } from '../registry/role-instances.js';
import { loadRegistry } from '../registry/index.js';
import { ROLE_INSTANCE_STATUS_LABEL } from '../cli/labels.js';
import { getGraph } from '../templates/index.js';

/** 占用侧中文文案基线（附录 A-6 逐字；{n} 由界面以 skipped.length 替换）。 */
export const OCCUPANCY_LABELS = Object.freeze({
  EMPTY: '角色占用 无',
  SKIPPED: '{n} 个实例状态不可读，已跳过',
});

/**
 * 占用状态词闭环与「最忙」排序基线（A-6 排序注记：服务中在前，同档按角色名
 * 升序）。五个词全部来自既有词表 `ROLE_INSTANCE_STATUS_LABEL`，不自造。
 */
export const OCCUPANCY_STATUS_ORDER = Object.freeze([
  '服务中',
  '可用',
  '冷却中',
  '不可用',
  '未参与',
]);

const FALLBACK_WORD = ROLE_INSTANCE_STATUS_LABEL.inactive;

/**
 * 既有投影六态 → 占用五词。终态实例的专属档（已关闭）按 A-9 视觉令牌口径并入
 * 「未参与」档（同 `src/daemon/graph.js` 的 STATUS_TOKENS：retired → inactive）；
 * 未知取值同样落到档位末尾，不产生新词。
 */
function statusWordOf(status) {
  const label = ROLE_INSTANCE_STATUS_LABEL[status];
  if (status === 'retired' || typeof label !== 'string' || !OCCUPANCY_STATUS_ORDER.includes(label)) {
    return FALLBACK_WORD;
  }
  return label;
}

function rankOf(word) {
  const index = OCCUPANCY_STATUS_ORDER.indexOf(word);
  return index < 0 ? OCCUPANCY_STATUS_ORDER.length : index;
}

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * 单实例投影用的注册表。注册表非空时原样传入（未登记角色由既有投影按
 * unknown-role 处理，占用层只透传该状态）；注册表为空时按既有流程图投影口径
 * 构造「按声明即已知」的替代表（D-5：空表不得把角色判成不可用）。
 */
function effectiveRegistryFor(snapshot, graph, realMap) {
  if (realMap.size > 0) return realMap;
  const roleIds = [];
  const seen = new Set();
  for (const roleId of [...asArray(graph?.roles), ...asArray(snapshot?.nodes).map((node) => node?.roleId)]) {
    if (typeof roleId !== 'string' || roleId.length === 0 || seen.has(roleId)) continue;
    seen.add(roleId);
    roleIds.push(roleId);
  }
  return new Map(roleIds.map((id) => [id, { id, name: id, group: null }]));
}

/** 聚合桶：一个 roleId 的跨实例累计值。 */
function bucketOf(roleId) {
  return {
    roleId,
    instances: 0,
    activeSessions: 0,
    servingNodes: [],
    hosts: [],
    bestWord: FALLBACK_WORD,
    bestRank: OCCUPANCY_STATUS_ORDER.length,
  };
}

/**
 * 注册表入参归一：接受加载结果（带 roleMap）、Map 或「roleId → {name, group}」
 * 普通对象。null / undefined 时按项目根加载注册表（只读）。
 */
function normalizeRegistry(registry, root) {
  if (registry === null || registry === undefined) {
    return loadRegistry({ root }).roleMap ?? new Map();
  }
  if (registry instanceof Map) return registry;
  if (registry instanceof Object && registry.roleMap instanceof Map) return registry.roleMap;
  if (registry instanceof Object) return new Map(Object.entries(registry));
  return new Map();
}

/**
 * 跨实例按角色聚合的全局占用投影（只读）。
 *
 * @param {string} root 项目根（注册表项目层资产的加载根）。
 * @param {{instances?: Array, registry?: (Map|object|null)}} options
 *   `instances`：调用方收集的本机全部实例快照（`state.json` 形态，含
 *   instanceId / template / nodes / sessions / state）；元素带
 *   `unreadable: true` 时按不可读跳过并计数（reason 透传调用方给定的原因码）。
 *   `registry`：可选注入（测试或调用方已有加载结果时用），缺省按 root 加载。
 * @returns {{rows: Array<{roleId, roleName, group, instances, activeSessions,
 *            servingNodes, status, hosts}>, skipped: Array<{instanceId, reason}>,
 *            disconnected?: boolean}}
 *   `instances` 不是数组（实例清单取不到）时返回断线位（rows / skipped 为空），
 *   形态与 `buildQueue` 一致；完全没有可读实例时 rows 为空（A-6「角色占用 无」
 *   由界面按 OCCUPANCY_LABELS.EMPTY 渲染）。
 */
export function buildOccupancy(root, { instances = [], registry = null } = {}) {
  if (!Array.isArray(instances)) {
    return { rows: [], skipped: [], disconnected: true };
  }

  const realMap = normalizeRegistry(registry, root);
  const merge = new Map();
  const skipped = [];
  let sawReadable = false;

  for (const entry of instances) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      skipped.push({ instanceId: null, reason: null });
      continue;
    }
    if (entry.unreadable === true) {
      skipped.push({
        instanceId: typeof entry.instanceId === 'string' ? entry.instanceId : null,
        reason: typeof entry.reason === 'string' && entry.reason.length > 0 ? entry.reason : null,
      });
      continue;
    }
    sawReadable = true;

    const graph = getGraph(entry?.template);
    // 参与实例数按「绑定到至少一个节点」计（BR-16 的运行时事实口径）：仅被模板
    // 声明而未绑定节点的角色不累计参与实例（AC-26：测试在第二实例仅被声明）。
    const boundRoleIds = new Set(
      asArray(entry?.nodes)
        .map((item) => item?.roleId)
        .filter((roleId) => typeof roleId === 'string' && roleId.length > 0),
    );
    // 宿主并集（D-48 第 8 字段）：同一实例快照的会话宿主（既有投影已读的同一
    // 字段），按参与实例归并 —— 参与行透出运行时宿主；仅声明未绑定的行无运行
    // 时记录，保持空数组（A-6 宿主段口径：未参与渲染占位符）。
    const sessionHosts = [];
    for (const item of asArray(entry?.sessions)) {
      const host = item?.hostId;
      if (typeof host === 'string' && host.length > 0 && !sessionHosts.includes(host)) {
        sessionHosts.push(host);
      }
    }
    const built = buildRoleInstances({
      state: entry,
      graph,
      roles: effectiveRegistryFor(entry, graph, realMap),
    });

    for (const view of built.roles) {
      const word = statusWordOf(view.status);
      const rank = rankOf(word);
      let bucket = merge.get(view.roleId);
      if (bucket === undefined) {
        bucket = bucketOf(view.roleId);
        merge.set(view.roleId, bucket);
      }
      if (boundRoleIds.has(view.roleId)) {
        bucket.instances += 1;
        for (const host of sessionHosts) {
          if (!bucket.hosts.includes(host)) bucket.hosts.push(host);
        }
      }
      bucket.activeSessions += asArray(view.activeSessions).length;
      for (const nodeId of asArray(view.servingNodes)) {
        if (!bucket.servingNodes.includes(nodeId)) bucket.servingNodes.push(nodeId);
      }
      if (rank < bucket.bestRank) {
        bucket.bestRank = rank;
        bucket.bestWord = word;
      }
    }
  }

  // 有实例在场时，注册表里未见运行时记录的角色补「未参与」行（A-6 第四行形态；
  // 运行时数值恒为零，不充数）。一个可读实例都没有 → 无行集（空态）。
  if (sawReadable) {
    for (const [roleId] of realMap) {
      if (!merge.has(roleId)) merge.set(roleId, bucketOf(roleId));
    }
  }

  const rows = [];
  for (const bucket of merge.values()) {
    const role = realMap.get(bucket.roleId);
    const roleName = typeof role?.name === 'string' && role.name.length > 0 ? role.name : null;
    const group = typeof role?.group === 'string' && role.group.length > 0 ? role.group : null;
    rows.push({
      roleId: bucket.roleId,
      roleName,
      group,
      instances: bucket.instances,
      activeSessions: bucket.activeSessions,
      servingNodes: bucket.servingNodes.slice().sort(compareText),
      status: bucket.bestWord,
      hosts: bucket.hosts.slice().sort(compareText),
    });
  }

  // 排序（A-6）：状态取「最忙」在前；同档按 roleId 升序。中文角色名的字节序
  // 会与 A-6 的逐字行序冲突（拼音靠前的名字可能字节更大），故同档排序键取
  // roleId：确定性纯比较，注册表空时中文名为 null 本就以 id 兜底，id 序与
  // A-6 的三行相对顺序一致。
  rows.sort((a, b) => {
    const delta = rankOf(a.status) - rankOf(b.status);
    if (delta !== 0) return delta;
    return compareText(a.roleId, b.roleId);
  });

  return { rows, skipped };
}
