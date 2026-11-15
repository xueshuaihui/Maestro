/**
 * 工作流画布投影：定义态角色图（I1.11 WP-5；拆分文档 §2.6；需求 D-6 / B-1 / BR-19）。
 *
 * - 输入是 `.orch/workflows/<id>.yaml` 的解析结果；输出
 *   `{ title, readable, valid, nodes, edges }`（有原因时追加 `problems`）。
 *   节点只带定义态字段（id / nodeType / roleId / label），不含任何运行时状态
 *   （AC-30 数据侧：与 src/daemon/graph.js 的实例运行时图严格区分）。
 * - readable / valid 三态（B-1，两者正交）：
 *   ① 整体解析成功（含 `nodes: []` 的零节点，以及文件不存在 / 无读权限 /
 *      内容为空这类「取不到输入」）→ readable=true；零节点显示「定义 空」。
 *   ② 部分可解析（节点条目里有解析不出的项，但仍有可画节点）→ readable=false
 *      且 nodes.length>0，只输出可解析部分（未知 / 缺失 node_type 的条目按
 *      角色节点渲染并保留原 id：nodeType='role'、roleId=原 id，即未知标记），
 *      界面按 `readable===false && nodes.length>0` 自行判断不显示「定义不可读」。
 *   ③ 整体不可解析 → readable=false 且 nodes.length===0，problems 首条即
 *      「定义不可读」原因（与 CLI validate 原文逐字一致）。
 *   readable 只由节点条目的可解析性决定；坏边条目（非映射 / 缺端点）不改变
 *   readable，只过滤掉画不出的边，并经 valid 侧的校验原因体现。
 * - valid 复用既有 loadWorkflows 全量校验（同一批 labels 常量组装，与 CLI
 *   validate 行明细逐字一致；CLI 侧组装函数未导出，本模块按同一段落自足组装，
 *   待其导出后可收敛回一处）。nodes 为空数组的合法语法文件同样参与校验，
 *   因此 valid 可为 false（与 CLI 口径一致），显示上叠加「校验不通过」。
 * - 内置模板没有项目文件：id 命中内置图时按内置投影（只读复用
 *   projectBuiltinWorkflows）出定义态画布——工作流库的内置行同样有
 *   「查看画布」入口；未命中才是「定义 空」。
 * - 只读：对 `.orch/workflows` 只 stat / read，没有任何写调用。
 *
 * 零第三方依赖；中文文案集中在 CANVAS_LABELS 与既有 labels 常量。
 */

import fs from 'node:fs';
import path from 'node:path';

import { loadRegistry } from '../registry/index.js';
import { loadWorkflows, projectBuiltinWorkflows } from '../registry/workflows.js';
import { EDGE_KINDS, NODE_TYPES } from '../registry/workflow-schema.js';
import { parseYaml } from '../registry/yaml-lite.js';
import { GRAPHS } from '../templates/index.js';
import {
  NODE_TYPE_LABEL,
  REGISTRY_ERROR,
  TEMPLATE_LABEL,
  WORKFLOW_REASON_TEXT,
  WORKFLOW_TRANSITION_TEXT,
  YAML_DETAIL,
} from '../cli/labels.js';

/**
 * 画布侧中文文案基线（附录 A-7 逐字）：
 * - TITLE_TEMPLATE / VALIDATION_BADGE 供 WP-8 拼标题行与标题旁标注；
 * - EMPTY_TEXT / UNREADABLE_TEXT 是两条降级文案（分工按 BR-19 固定）；
 * - SUBFLOW_ROW / SUBFLOW_UNKNOWN 与实例流程图同一套层名前缀
 *   （同 src/daemon/http/labels.js 的 DESKTOP_SUBFLOW_ROW / _UNKNOWN 逐字）。
 */
export const CANVAS_LABELS = Object.freeze({
  TITLE_TEMPLATE: '工作流 {name} · 定义态 · {n} 节点 · {m} 条边',
  VALIDATION_BADGE: '校验不通过',
  EMPTY_TEXT: '定义 空',
  UNREADABLE_TEXT: '定义不可读 · 仅显示可解析部分',
  SUBFLOW_ROW: '子工作流：{title} · {n} 角色',
  SUBFLOW_UNKNOWN: '子工作流 {id} · 角色数未知',
});

/** 与 workflows.js 的 fileOf 同字：内置资产的文件前缀（错误作用域用）。 */
const BUILTIN_FILE_PREFIX = '内置 ';

const TRANSITION_DETAIL_KEY = Object.freeze({
  entryBackflow: 'entryBackflow',
  escalateForward: 'escalateOutbound',
  humanCondition: 'humanEdgeCondition',
  backflowTarget: 'backflowTarget',
});

/** 与 CLI 各命令一致的 `{name}` 占位替换；缺值成空串，不出现 undefined。 */
function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars?.[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 一条加载器 / 形状错误 → 人话原因（与 src/cli/workflows.js 的同段组装逐字
 * 一致；文字全部来自 labels.js 的同一批常量）。
 */
function problemText(err) {
  const code = err?.code;
  const params = { ...(err?.params ?? {}) };
  if (code === 'YAML_PARSE_FAILED') {
    params.detail = fill(YAML_DETAIL[params.detailKey] ?? '', params.detailParams ?? {});
    if (params.line === undefined || params.line === null) params.line = err?.line ?? null;
    return fill(REGISTRY_ERROR.YAML_PARSE_FAILED, params);
  }
  if (code === 'WORKFLOW_TRANSITION_ILLEGAL') {
    const slot = TRANSITION_DETAIL_KEY[params.reason] ?? params.reason;
    params.detail = fill(WORKFLOW_TRANSITION_TEXT[slot] ?? '', params);
  }
  if (code === 'WORKFLOW_SUB_CYCLE' && Array.isArray(params.chain)) {
    const chain = params.chain;
    const open = chain.length > 1 && chain[0] === chain[chain.length - 1] ? chain.slice(0, -1) : chain;
    params.chain = open.join(' → ');
  }
  if (code === 'WORKFLOW_EDGE_INVALID') {
    if (params.value !== undefined) params.detail = `${params.detail}: ${params.value}`;
    else if (params.edge !== undefined) params.detail = `${params.detail}: ${params.edge}`;
  }
  const template = WORKFLOW_REASON_TEXT[code];
  return template === undefined ? String(code ?? '') : fill(template, params);
}

/** 子工作流节点的成员角色数：取子定义里去重后的角色引用数；子定义取不到 → null。 */
function subflowMemberCount(workflowMap, ref) {
  if (ref === null) return null;
  const child = workflowMap.get(ref);
  if (child === undefined || !Array.isArray(child.nodes)) return null;
  const seen = new Set();
  for (const node of child.nodes) {
    if (node?.node_type !== 'role') continue;
    if (typeof node.role === 'string' && node.role.length > 0) seen.add(node.role);
  }
  return seen.size;
}

/** 单个定义节点 → 画布节点（只带四个定义态字段）。`fallback` 标记未知类型。 */
function canvasNode(obj, nodeId, nodeType, fallback, workflowMap) {
  const nodeTitle = typeof obj.title === 'string' && obj.title.length > 0 ? obj.title : null;
  if (nodeType === 'human' || nodeType === 'escalate') {
    return {
      id: nodeId,
      nodeType,
      roleId: null,
      label: `${NODE_TYPE_LABEL[nodeType]} ${nodeTitle ?? nodeId}`,
    };
  }
  if (nodeType === 'subworkflow') {
    const ref = typeof obj.workflow === 'string' && obj.workflow.length > 0 ? obj.workflow : null;
    const count = subflowMemberCount(workflowMap, ref);
    const label =
      count === null
        ? fill(CANVAS_LABELS.SUBFLOW_UNKNOWN, { id: nodeId })
        : fill(CANVAS_LABELS.SUBFLOW_ROW, { title: nodeTitle ?? ref ?? nodeId, n: count });
    return { id: nodeId, nodeType, roleId: null, label };
  }
  // 角色节点（含未知类型的降级渲染）：未知标记 = nodeType 落回 'role' 且
  // 无角色引用时 roleId 保留原节点 id（与实例图「保留定义 id」同一口径）。
  const roleId = typeof obj.role === 'string' && obj.role.length > 0 ? obj.role : null;
  const effRoleId = fallback && roleId === null ? nodeId : roleId;
  return {
    id: nodeId,
    nodeType: 'role',
    roleId: effRoleId,
    label: nodeTitle ?? effRoleId ?? nodeId,
  };
}

/** 已解析的顶层映射 → 画布主体（nodes / edges 的可解析部分）。 */
function projectCanvas(value, title, valid, problems, workflowMap) {
  const rawNodes = Array.isArray(value?.nodes) ? value.nodes : null;
  if (rawNodes === null) {
    // 节点列表缺失：没有任何可解析节点 → 整体不可解析（B-1 态 ③）。
    return problems.length > 0
      ? { title, readable: false, valid, nodes: [], edges: [], problems }
      : { title, readable: false, valid, nodes: [], edges: [] };
  }
  const nodes = [];
  const seen = new Set();
  let partial = false;
  for (const entry of rawNodes) {
    const obj = isPlainObject(entry) ? entry : null;
    const nodeId =
      obj !== null && typeof obj.id === 'string' && obj.id.length > 0 ? obj.id : null;
    if (nodeId === null) {
      partial = true; // 解析不出 id 的条目画不了，只计入部分可解析
      continue;
    }
    const rawType =
      typeof obj.node_type === 'string' && obj.node_type.length > 0 ? obj.node_type : null;
    const declared = rawType !== null && NODE_TYPES.includes(rawType);
    if (!declared) partial = true; // 未知 / 缺失类型：按角色节点渲染并保留 id
    if (seen.has(nodeId)) continue; // 重复 id 只画首个；校验原因由 valid 侧承载
    seen.add(nodeId);
    nodes.push(canvasNode(obj, nodeId, declared ? rawType : 'role', !declared, workflowMap));
  }
  const rawEdges = Array.isArray(value?.edges) ? value.edges : [];
  const edges = [];
  for (const entry of rawEdges) {
    if (!isPlainObject(entry)) continue;
    if (typeof entry.from !== 'string' || entry.from.length === 0) continue;
    if (typeof entry.to !== 'string' || entry.to.length === 0) continue;
    edges.push({
      from: entry.from,
      to: entry.to,
      kind: EDGE_KINDS.includes(entry.kind) ? entry.kind : 'forward',
    });
  }
  const body = { title, readable: !partial, valid, nodes, edges };
  return problems.length > 0 ? { ...body, problems } : body;
}

/** 项目文件取不到时：id 命中内置图 → 内置投影画布；未命中 → 「定义 空」。 */
function builtinCanvas(id, result) {
  const defs = projectBuiltinWorkflows(GRAPHS, { names: TEMPLATE_LABEL });
  const def = defs.find((item) => item.id === id) ?? null;
  if (def === null) {
    return { title: id, readable: true, valid: true, nodes: [], edges: [] };
  }
  const scoped = result.errors.filter((err) => err.file === `${BUILTIN_FILE_PREFIX}${id}`);
  const problems = scoped.map(problemText);
  const nodes = (Array.isArray(def.nodes) ? def.nodes : []).map((node) => {
    const nodeTitle = typeof node.title === 'string' && node.title.length > 0 ? node.title : null;
    const roleId = typeof node.role === 'string' && node.role.length > 0 ? node.role : null;
    return { id: node.id, nodeType: 'role', roleId, label: nodeTitle ?? roleId ?? node.id };
  });
  const edges = (Array.isArray(def.edges) ? def.edges : []).map((edge) => ({
    from: edge.from,
    to: edge.to,
    kind: EDGE_KINDS.includes(edge.kind) ? edge.kind : 'forward',
  }));
  const body = {
    title: typeof def.name === 'string' && def.name.length > 0 ? def.name : id,
    readable: true,
    valid: scoped.length === 0,
    nodes,
    edges,
  };
  return problems.length > 0 ? { ...body, problems } : body;
}

/**
 * 定义态画布投影（只读，同步）。
 *
 * @param {string} root 项目根
 * @param {string} workflowId 工作流 id（即 `.orch/workflows/<id>.yaml` 文件名）
 * @returns {{title: string, readable: boolean, valid: boolean,
 *            nodes: Array<{id, nodeType, roleId, label}>,
 *            edges: Array<{from, to, kind}>, problems?: string[]}}
 */
export function buildCanvas(root, workflowId) {
  const base = typeof root === 'string' && root.length > 0 ? root : process.cwd();
  const id = typeof workflowId === 'string' ? workflowId : '';
  const file = path.join(base, '.orch', 'workflows', `${id}.yaml`);

  const registry = loadRegistry({ root: base });
  const result = loadWorkflows({
    root: base,
    builtinGraphs: GRAPHS,
    roles: registry.roles,
    builtinNames: TEMPLATE_LABEL,
  });

  let text = null;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    text = null; // 文件不存在 / 无读权限：按「取不到输入」处理
  }
  if (text === null) return builtinCanvas(id, result);

  const scoped = result.errors.filter((err) => err.file === `workflows/${id}.yaml`);
  const problems = scoped.map(problemText);
  const valid = scoped.length === 0;
  const withProblems = (body) => (problems.length > 0 ? { ...body, problems } : body);

  // 内容为空：没有可解析输入 → 等价「成功但零节点」（B-1 / BR-19）。
  if (text.trim() === '') {
    return withProblems({ title: id, readable: true, valid, nodes: [], edges: [] });
  }

  const parsed = parseYaml(text);
  if (!parsed.ok) {
    // 整体不可解析（B-1 态 ③）：首条原因即「定义不可读」的文案来源。
    const reason =
      problems.length > 0
        ? problems
        : [
            fill(REGISTRY_ERROR.YAML_PARSE_FAILED, {
              line: parsed.line,
              detail: fill(YAML_DETAIL[parsed.detailKey] ?? '', parsed.detailParams ?? {}),
            }),
          ];
    return { title: id, readable: false, valid: false, nodes: [], edges: [], problems: reason };
  }

  const value = parsed.value;
  const title = typeof value?.name === 'string' && value.name.length > 0 ? value.name : id;
  return projectCanvas(value, title, valid, problems, result.workflowMap);
}
