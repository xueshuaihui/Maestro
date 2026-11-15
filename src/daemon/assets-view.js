/**
 * 资产库投影：角色 / 技能 / 工作流三类资产的列表与详情（I1.11 WP-3 / 拆分文档
 * §2.4 / 需求附录 D-4）。
 *
 * - 只读消费既有注册表读取与校验（src/registry/*）：列表行与详情字段只透传，
 *   不重跑 schema 判定、不新增派生结论；校验状态在请求内现算并复用（同一
 *   调用只加载一次注册表），不跨请求缓存。
 * - 校验失败原因与 CLI validate 原文逐字一致：角色与技能直接复用 CLI 侧的
 *   同一组装函数（src/cli/roles.js 导出的 detailOf，即 role validate /
 *   skill validate 行明细的原文来源）；工作流侧的组装函数未从
 *   src/cli/workflows.js 导出，这里用同一批 labels 常量按同一段落组装，
 *   待该函数导出后可收敛回一处（本 WP 无权改 CLI 文件）。
 * - 任何接口不得写 .orch/roles|skills|workflows（AC-25）：本模块对这三个
 *   目录只做 stat / readdir / read，没有任何写调用。
 * - 降级口径（AC-24 / AC-46 / A-5）：项目资产目录存在但不可读 → dirUnreadable
 *   为真、整页返回空列表；单个文件不可解析 → 该行仍在列表并标「不可读」，
 *   其余照常。列表行、计数与 unreadable 同源产出。
 * - 中文文案集中在 ASSETS_LABELS；正文摘要的截断上限由下方具名常量承载
 *   （AC-21：常量落在守护进程侧，界面只消费截断结果）。
 *
 * 零第三方依赖；纯只读。
 */

import fs from 'node:fs';
import path from 'node:path';

import { loadRegistry } from '../registry/index.js';
import { loadWorkflows, projectBuiltinWorkflows } from '../registry/workflows.js';
import { parseYaml } from '../registry/yaml-lite.js';
import { parseSkillFile } from '../registry/skill-file.js';
import { assetsRoot } from '../registry/assets.js';
import { GRAPHS } from '../templates/index.js';
import { detailOf } from '../cli/roles.js';
import {
  GROUP_LABEL,
  NODE_TYPE_LABEL,
  REGISTRY_ERROR,
  TEMPLATE_LABEL,
  WORKFLOW_REASON_TEXT,
  WORKFLOW_TRANSITION_TEXT,
  YAML_DETAIL,
} from '../cli/labels.js';

/** 资产库侧中文文案基线（附录 A-5 逐字），供 WP-7 搬运、WP-8 直接消费。 */
export const ASSETS_LABELS = Object.freeze({
  SOURCE_BUILTIN: '内置',
  SOURCE_PROJECT: '项目',
  VALIDATION_PASS: '通过',
  VALIDATION_FAIL: '不通过',
  VALIDATION_UNKNOWN: '未校验',
  VALIDATION_UNREADABLE: '不可读',
  MISSING: '缺失',
  KIND_ROLES: '角色',
  KIND_SKILLS: '技能',
  KIND_WORKFLOWS: '工作流',
  GROUP_PLACEHOLDER: '—',
  DIR_UNREADABLE_LINE: '资产不可读 · {dir}',
  UNREADABLE_ROW: '{kind} {id} · 不可读',
});

/** 技能详情正文摘要的截断上限（AC-21：恰好定义一处、使用一处）。 */
export const BODY_PREVIEW_LINES = 20;

/** 工作流校验错误里内置资产的文件前缀（与 workflows.js 的 fileOf 同字）。 */
const BUILTIN_FILE_PREFIX = '内置 ';

const KINDS = new Set(['roles', 'skills', 'workflows']);

/** 与 CLI 各命令一致的 `{name}` 占位替换；缺值成空串，不出现 undefined。 */
function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars?.[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function compareText(a, b) {
  const left = typeof a === 'string' ? a : '';
  const right = typeof b === 'string' ? b : '';
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sourceWord(source) {
  return source === 'project' ? ASSETS_LABELS.SOURCE_PROJECT : ASSETS_LABELS.SOURCE_BUILTIN;
}

function wordOfSource(file) {
  return file.startsWith('assets/') ? ASSETS_LABELS.SOURCE_BUILTIN : ASSETS_LABELS.SOURCE_PROJECT;
}

/** CLI 侧同款文件展示前缀：项目资产补 `.orch/`，内置路径原样。 */
function prefixedFile(file) {
  return file.startsWith('assets/') ? file : `.orch/${file}`;
}

/** 注册表相对路径 → 绝对路径（内置在仓库资产树，项目在 `<root>/.orch`）。 */
function assetFileAbs(root, file) {
  return file.startsWith('assets/')
    ? path.join(path.dirname(assetsRoot()), file)
    : path.join(root, '.orch', file);
}

function readTextAt(abs) {
  try {
    return fs.readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
}

/** 解析一个角色 YAML 文件；文件不可读或内容不可解析时返回 null。 */
function parseRoleAt(abs) {
  const text = readTextAt(abs);
  if (text === null) return null;
  const parsed = parseYaml(text);
  if (!parsed.ok) return null;
  const value = parsed.value;
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

/** 解析一个 SKILL.md；文件不可读时返回 { missing: true }，解析失败返回 null。 */
function parseSkillAt(abs) {
  const text = readTextAt(abs);
  if (text === null) return { missing: true };
  const parsed = parseSkillFile(text);
  if (!parsed.ok) return null;
  return {
    missing: false,
    meta: parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {},
    body: typeof parsed.body === 'string' ? parsed.body : '',
  };
}

/** 解析一个工作流 YAML 文件；文件不可读或内容不可解析时返回 null。 */
function parseWorkflowAt(abs) {
  return parseRoleAt(abs);
}

/**
 * 项目资产目录扫描：目录缺失按「无项目资产」处理；目录存在但列不了
 * （权限不足等）→ unreadable，整页降级（AC-24）。
 */
function readProjectDir(root, kind) {
  const dir = path.join(root, '.orch', kind);
  let stat = null;
  try {
    stat = fs.statSync(dir);
  } catch {
    return { unreadable: false, fileIds: [], dirIds: [] };
  }
  let entries = null;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { unreadable: true, fileIds: [], dirIds: [] };
  }
  const fileIds = [];
  const dirIds = [];
  for (const entry of entries) {
    if (entry.isDirectory()) dirIds.push(entry.name);
    else if (entry.isFile() && entry.name.endsWith('.yaml')) {
      fileIds.push(entry.name.slice(0, -'.yaml'.length));
    }
  }
  fileIds.sort(compareText);
  dirIds.sort(compareText);
  return { unreadable: false, fileIds, dirIds };
}

function emptyCounts() {
  return { total: 0, builtin: 0, project: 0 };
}

function countsOfRows(rows) {
  return {
    total: rows.length,
    builtin: rows.filter((row) => row.source === ASSETS_LABELS.SOURCE_BUILTIN).length,
    project: rows.filter((row) => row.source === ASSETS_LABELS.SOURCE_PROJECT).length,
  };
}

/** 技能列表行的分组列：适用分组的中文标签，逗号连接；空取占位符。 */
function appliesGroupText(labels) {
  return labels.length > 0 ? labels.join(', ') : ASSETS_LABELS.GROUP_PLACEHOLDER;
}

function appliesLabelsOf(appliesTo) {
  const list = Array.isArray(appliesTo) ? appliesTo : [];
  return list.map((group) => (typeof group === 'string' ? (GROUP_LABEL[group] ?? group) : String(group)));
}

// ---------------------------------------------------------------- 角色列表

function roleIdOfErrorFile(file) {
  return file.replace(/^.*\//, '').replace(/\.yaml$/, '');
}

function isRoleErrorFile(file) {
  return /^(assets\/)?roles\/[^/]+\.yaml$/.test(file);
}

function collectRoleRows(root, registry, scan) {
  const rows = [];
  const unreadable = [];
  const errorFiles = new Map();
  for (const err of registry.errors) {
    if (err.scope !== 'role' || !isRoleErrorFile(err.file)) continue;
    if (!errorFiles.has(err.file)) errorFiles.set(err.file, []);
    errorFiles.get(err.file).push(err);
  }
  const covered = new Set();
  for (const role of registry.roles) {
    covered.add(role.file);
    rows.push({
      id: role.id,
      name: role.name,
      source: sourceWord(role.source),
      group: GROUP_LABEL[role.group] ?? role.group,
      validation: ASSETS_LABELS.VALIDATION_PASS,
    });
  }
  for (const [file, errs] of errorFiles) {
    if (covered.has(file)) continue;
    const fileId = roleIdOfErrorFile(file);
    const parseFailed = errs.some((err) => err.code === 'YAML_PARSE_FAILED');
    const parsed = parseFailed ? null : parseRoleAt(assetFileAbs(root, file));
    if (parsed === null) {
      rows.push({
        id: fileId,
        name: fileId,
        source: wordOfSource(file),
        group: null,
        validation: ASSETS_LABELS.VALIDATION_UNREADABLE,
      });
      unreadable.push(fileId);
    } else {
      rows.push({
        id: fileId,
        name: typeof parsed.name === 'string' ? parsed.name : fileId,
        source: wordOfSource(file),
        group:
          typeof parsed.group === 'string' ? (GROUP_LABEL[parsed.group] ?? parsed.group) : null,
        validation: ASSETS_LABELS.VALIDATION_FAIL,
      });
    }
  }
  // 交叉补扫：目录里有、但加载器既没给出合法行也没报错的文件（读取失败被
  // 静默跳过），按单文件不可读降级，不让它凭空消失（AC-46 口径）。
  for (const fileId of scan.fileIds) {
    const projectFile = `roles/${fileId}.yaml`;
    if (covered.has(projectFile) || errorFiles.has(projectFile)) continue;
    rows.push({
      id: fileId,
      name: fileId,
      source: ASSETS_LABELS.SOURCE_PROJECT,
      group: null,
      validation: ASSETS_LABELS.VALIDATION_UNREADABLE,
    });
    unreadable.push(fileId);
  }
  rows.sort((a, b) => compareText(a.id, b.id));
  unreadable.sort(compareText);
  return { rows, unreadable };
}

// ---------------------------------------------------------------- 技能列表

function skillDirOfErrorFile(file) {
  return file.split('/')[1] ?? '';
}

function isSkillErrorFile(file) {
  return /^(assets\/)?skills\/[^/]+\/SKILL\.md$/.test(file);
}

function collectSkillRows(root, registry, scan) {
  const rows = [];
  const unreadable = [];
  const errorFiles = new Map();
  for (const err of registry.errors) {
    if (err.scope !== 'skill' || !isSkillErrorFile(err.file)) continue;
    if (!errorFiles.has(err.file)) errorFiles.set(err.file, []);
    errorFiles.get(err.file).push(err);
  }
  const covered = new Set();
  for (const skill of registry.skills) {
    covered.add(skill.file);
    rows.push({
      id: skill.id,
      name: skill.name,
      source: sourceWord(skill.source),
      group: appliesGroupText(appliesLabelsOf(skill.appliesTo)),
      commands: Array.isArray(skill.commands) ? skill.commands.length : 0,
      validation: ASSETS_LABELS.VALIDATION_PASS,
    });
  }
  for (const [file, errs] of errorFiles) {
    if (covered.has(file)) continue;
    const dirId = skillDirOfErrorFile(file);
    const parseFailed = errs.some((err) => err.code === 'YAML_PARSE_FAILED');
    const parsed = parseFailed ? null : parseSkillAt(assetFileAbs(root, file));
    if (parsed !== null && !parsed.missing) {
      const meta = parsed.meta ?? {};
      rows.push({
        id: dirId,
        name: typeof meta.name === 'string' ? meta.name : dirId,
        source: wordOfSource(file),
        group: appliesGroupText(appliesLabelsOf(meta.applies_to)),
        commands: Array.isArray(meta.commands) ? meta.commands.length : 0,
        validation: ASSETS_LABELS.VALIDATION_FAIL,
      });
    } else if (parsed !== null && parsed.missing) {
      // SKILL.md 缺失（或读取失败）是校验失败而非内容不可解析：行照常、标不通过。
      rows.push({
        id: dirId,
        name: dirId,
        source: wordOfSource(file),
        group: null,
        commands: 0,
        validation: ASSETS_LABELS.VALIDATION_FAIL,
      });
    } else {
      rows.push({
        id: dirId,
        name: dirId,
        source: wordOfSource(file),
        group: null,
        commands: 0,
        validation: ASSETS_LABELS.VALIDATION_UNREADABLE,
      });
      unreadable.push(dirId);
    }
  }
  for (const dirId of scan.dirIds) {
    const projectFile = `skills/${dirId}/SKILL.md`;
    if (covered.has(projectFile) || errorFiles.has(projectFile)) continue;
    rows.push({
      id: dirId,
      name: dirId,
      source: ASSETS_LABELS.SOURCE_PROJECT,
      group: null,
      commands: 0,
      validation: ASSETS_LABELS.VALIDATION_UNREADABLE,
    });
    unreadable.push(dirId);
  }
  rows.sort((a, b) => compareText(a.id, b.id));
  unreadable.sort(compareText);
  return { rows, unreadable };
}

// ------------------------------------------------------------ 工作流列表

function workflowIdOfErrorFile(file) {
  return file.replace(/^.*\//, '').replace(/\.yaml$/, '');
}

function nodesOf(value) {
  return value && typeof value === 'object' && Array.isArray(value.nodes) ? value.nodes : [];
}

function edgesOf(value) {
  return value && typeof value === 'object' && Array.isArray(value.edges) ? value.edges : [];
}

function countBackflow(edges) {
  let count = 0;
  for (const edge of edges) {
    if (edge && typeof edge === 'object' && edge.kind === 'backflow') count += 1;
  }
  return count;
}

function collectWorkflowRows(root, registry, result, scan) {
  const rows = [];
  const unreadable = [];
  const errorFiles = new Map();
  for (const err of result.errors) {
    if (!errorFiles.has(err.file)) errorFiles.set(err.file, []);
    errorFiles.get(err.file).push(err);
  }
  const covered = new Set();
  for (const workflow of result.workflows) {
    const file = workflow.source === 'project' ? workflow.file : `${BUILTIN_FILE_PREFIX}${workflow.id}`;
    covered.add(file);
    const nodes = nodesOf(workflow);
    rows.push({
      id: workflow.id,
      name: workflow.name,
      source: sourceWord(workflow.source),
      group: null,
      nodeCount: nodes.length,
      edgeCount: edgesOf(workflow).length,
      validation: ASSETS_LABELS.VALIDATION_PASS,
    });
  }
  for (const [file, errs] of errorFiles) {
    if (covered.has(file)) continue;
    if (file.startsWith(BUILTIN_FILE_PREFIX)) {
      const builtinId = file.slice(BUILTIN_FILE_PREFIX.length);
      const def = projectBuiltinWorkflows(GRAPHS, { names: TEMPLATE_LABEL }).find(
        (item) => item.id === builtinId
      );
      rows.push({
        id: builtinId,
        name: def?.name ?? builtinId,
        source: ASSETS_LABELS.SOURCE_BUILTIN,
        group: null,
        nodeCount: def ? nodesOf(def).length : 0,
        edgeCount: def ? edgesOf(def).length : 0,
        validation: ASSETS_LABELS.VALIDATION_FAIL,
      });
      continue;
    }
    const fileId = workflowIdOfErrorFile(file);
    const parsed = parseWorkflowAt(assetFileAbs(root, file));
    if (parsed === null) {
      rows.push({
        id: fileId,
        name: fileId,
        source: ASSETS_LABELS.SOURCE_PROJECT,
        group: null,
        nodeCount: null,
        edgeCount: null,
        validation: ASSETS_LABELS.VALIDATION_UNREADABLE,
      });
      unreadable.push(fileId);
    } else {
      const nodes = nodesOf(parsed);
      rows.push({
        id: fileId,
        name: typeof parsed.name === 'string' ? parsed.name : fileId,
        source: ASSETS_LABELS.SOURCE_PROJECT,
        group: null,
        nodeCount: nodes.length,
        edgeCount: edgesOf(parsed).length,
        validation: ASSETS_LABELS.VALIDATION_FAIL,
      });
    }
  }
  for (const fileId of scan.fileIds) {
    const projectFile = `workflows/${fileId}.yaml`;
    if (covered.has(projectFile) || errorFiles.has(projectFile)) continue;
    rows.push({
      id: fileId,
      name: fileId,
      source: ASSETS_LABELS.SOURCE_PROJECT,
      group: null,
      nodeCount: null,
      edgeCount: null,
      validation: ASSETS_LABELS.VALIDATION_UNREADABLE,
    });
    unreadable.push(fileId);
  }
  rows.sort((a, b) => compareText(a.id, b.id));
  unreadable.sort(compareText);
  return { rows, unreadable };
}

// ---------------------------------------------------------------- 详情组装

/**
 * 角色与技能详情的字段透传：兼容加载器定义（camelCase）与重读文件
 * （snake_case）两种来源。
 */
function roleFieldsOf(obj) {
  const wake = Array.isArray(obj.wake_allow)
    ? obj.wake_allow
    : Array.isArray(obj.wakeAllow)
      ? obj.wakeAllow
      : [];
  const skills = Array.isArray(obj.skills) ? obj.skills : [];
  const tools = Array.isArray(obj.tools) ? obj.tools : [];
  const strList = (list) => list.filter((item) => typeof item === 'string');
  return {
    name: typeof obj.name === 'string' ? obj.name : null,
    group: typeof obj.group === 'string' ? obj.group : null,
    artifactType: obj.artifact_type ?? obj.artifactType ?? null,
    sideEffect: obj.side_effect ?? obj.sideEffect ?? null,
    maxConcurrentSessions: obj.max_concurrent_sessions ?? obj.maxConcurrentSessions ?? null,
    skills: strList(skills),
    tools: strList(tools),
    wakeAllow: strList(wake),
  };
}

function skillMetaOf(obj) {
  const appliesTo = Array.isArray(obj.applies_to) ? obj.applies_to : Array.isArray(obj.appliesTo) ? obj.appliesTo : [];
  const commands = Array.isArray(obj.commands) ? obj.commands : [];
  const strList = (list) => list.filter((item) => typeof item === 'string');
  return {
    name: typeof obj.name === 'string' ? obj.name : null,
    appliesTo: strList(appliesTo),
    commands: strList(commands),
    summary: typeof obj.summary === 'string' ? obj.summary : null,
  };
}

function splitBodyLines(body) {
  const text = typeof body === 'string' ? body : '';
  if (text.trim() === '') return [];
  const lines = text.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function bodyPreviewOf(body) {
  const lines = splitBodyLines(body);
  const preview = lines.slice(0, BODY_PREVIEW_LINES);
  return { preview, count: preview.length };
}

function baseDetail(kind, id, name, source, file, validation, reasons) {
  return {
    found: true,
    kind,
    id,
    name,
    source,
    file,
    validation,
    reasons,
    reason: reasons.length > 0 ? reasons[0] : null,
  };
}

function showRoleDetail(root, id, registry) {
  const role = registry.roleMap.get(id);
  if (role !== undefined) {
    const fields = roleFieldsOf(role);
    return {
      ...baseDetail('roles', id, fields.name, sourceWord(role.source), prefixedFile(role.file), ASSETS_LABELS.VALIDATION_PASS, []),
      group: fields.group,
      groupLabel: fields.group === null ? null : (GROUP_LABEL[fields.group] ?? fields.group),
      artifactType: fields.artifactType,
      sideEffect: fields.sideEffect,
      maxConcurrentSessions: fields.maxConcurrentSessions,
      skills: fields.skills.map((skillId) => ({
        id: skillId,
        missing: !registry.skillMap.has(skillId),
      })),
      tools: fields.tools.slice(),
      wakeAllow: fields.wakeAllow.map((wakeId) => ({
        id: wakeId,
        missing: !registry.roleMap.has(wakeId),
      })),
    };
  }
  for (const file of [`roles/${id}.yaml`, `assets/roles/${id}.yaml`]) {
    const errs = registry.errors.filter((err) => err.scope === 'role' && err.file === file);
    if (errs.length === 0) continue;
    const parsed = parseRoleAt(assetFileAbs(root, file));
    if (parsed === null) {
      return {
        ...baseDetail('roles', id, id, wordOfSource(file), prefixedFile(file), ASSETS_LABELS.VALIDATION_UNREADABLE, errs.map(detailOf)),
        group: null,
        groupLabel: null,
        artifactType: null,
        sideEffect: null,
        maxConcurrentSessions: null,
        skills: [],
        tools: [],
        wakeAllow: [],
      };
    }
    const fields = roleFieldsOf(parsed);
    return {
      ...baseDetail('roles', id, fields.name, wordOfSource(file), prefixedFile(file), ASSETS_LABELS.VALIDATION_FAIL, errs.map(detailOf)),
      group: fields.group,
      groupLabel: fields.group === null ? null : (GROUP_LABEL[fields.group] ?? fields.group),
      artifactType: fields.artifactType,
      sideEffect: fields.sideEffect,
      maxConcurrentSessions: fields.maxConcurrentSessions,
      skills: fields.skills.map((skillId) => ({
        id: skillId,
        missing: !registry.skillMap.has(skillId),
      })),
      tools: fields.tools.slice(),
      wakeAllow: fields.wakeAllow.map((wakeId) => ({
        id: wakeId,
        missing: !registry.roleMap.has(wakeId),
      })),
    };
  }
  return { found: false, kind: 'roles', id };
}

function showSkillDetail(root, id, registry) {
  const skill = registry.skillMap.get(id);
  if (skill !== undefined) {
    const meta = skillMetaOf(skill);
    const body = bodyPreviewOf(skill.body);
    return {
      ...baseDetail('skills', id, meta.name, sourceWord(skill.source), prefixedFile(skill.file), ASSETS_LABELS.VALIDATION_PASS, []),
      appliesTo: meta.appliesTo.slice(),
      appliesToLabels: appliesLabelsOf(meta.appliesTo),
      commands: meta.commands.slice(),
      summary: meta.summary,
      bodyPreview: body.preview,
      bodyPreviewLines: body.count,
    };
  }
  for (const file of [`skills/${id}/SKILL.md`, `assets/skills/${id}/SKILL.md`]) {
    const errs = registry.errors.filter((err) => err.scope === 'skill' && err.file === file);
    if (errs.length === 0) continue;
    const parsed = parseSkillAt(assetFileAbs(root, file));
    if (parsed !== null && !parsed.missing) {
      const meta = skillMetaOf(parsed.meta ?? {});
      const body = bodyPreviewOf(parsed.body);
      return {
        ...baseDetail('skills', id, meta.name, wordOfSource(file), prefixedFile(file), ASSETS_LABELS.VALIDATION_FAIL, errs.map(detailOf)),
        appliesTo: meta.appliesTo.slice(),
        appliesToLabels: appliesLabelsOf(meta.appliesTo),
        commands: meta.commands.slice(),
        summary: meta.summary,
        bodyPreview: body.preview,
        bodyPreviewLines: body.count,
      };
    }
    if (parsed !== null && parsed.missing) {
      return {
        ...baseDetail('skills', id, id, wordOfSource(file), prefixedFile(file), ASSETS_LABELS.VALIDATION_FAIL, errs.map(detailOf)),
        appliesTo: [],
        appliesToLabels: [],
        commands: [],
        summary: null,
        bodyPreview: [],
        bodyPreviewLines: 0,
      };
    }
    return {
      ...baseDetail('skills', id, id, wordOfSource(file), prefixedFile(file), ASSETS_LABELS.VALIDATION_UNREADABLE, errs.map(detailOf)),
      appliesTo: [],
      appliesToLabels: [],
      commands: [],
      summary: null,
      bodyPreview: [],
      bodyPreviewLines: 0,
    };
  }
  return { found: false, kind: 'skills', id };
}

// 工作流原因码的组装与 CLI 同一段落（workflows.js 的私有函数未导出，本 WP
// 无权改 CLI 文件；文字全部来自 labels.js 的同一批常量，逐字一致）。
const TRANSITION_DETAIL_KEY = Object.freeze({
  entryBackflow: 'entryBackflow',
  escalateForward: 'escalateOutbound',
  humanCondition: 'humanEdgeCondition',
  backflowTarget: 'backflowTarget',
});

function workflowDetailText(err) {
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

function nodeTypeCountsOf(nodes) {
  const order = [];
  const counts = new Map();
  for (const node of nodes) {
    const type =
      node && typeof node === 'object' && typeof node.node_type === 'string' ? node.node_type : '';
    if (!counts.has(type)) {
      counts.set(type, 0);
      order.push(type);
    }
    counts.set(type, counts.get(type) + 1);
  }
  return order.map((type) => ({
    type,
    label: NODE_TYPE_LABEL[type] ?? type,
    count: counts.get(type),
  }));
}

function nodeListOf(nodes) {
  return nodes.map((node) => {
    const type = node && typeof node === 'object' && typeof node.node_type === 'string' ? node.node_type : null;
    return {
      id: node && typeof node === 'object' && typeof node.id === 'string' ? node.id : null,
      nodeType: type,
      typeLabel: type === null ? null : (NODE_TYPE_LABEL[type] ?? type),
    };
  });
}

function workflowGraphFields(value) {
  const nodes = nodesOf(value);
  const edges = edgesOf(value);
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    backflowCount: countBackflow(edges),
    nodeTypeCounts: nodeTypeCountsOf(nodes),
    nodes: nodeListOf(nodes),
    entry: value && typeof value === 'object' && typeof value.entry === 'string' ? value.entry : null,
    terminal: value && typeof value === 'object' && typeof value.terminal === 'string' ? value.terminal : null,
  };
}

function emptyWorkflowGraph() {
  return {
    nodeCount: 0,
    edgeCount: 0,
    backflowCount: 0,
    nodeTypeCounts: [],
    nodes: [],
    entry: null,
    terminal: null,
  };
}

function showWorkflowDetail(root, id, registry, result) {
  const workflow = result.workflowMap.get(id);
  if (workflow !== undefined) {
    return {
      ...baseDetail('workflows', id, workflow.name, sourceWord(workflow.source), workflow.source === 'project' ? prefixedFile(workflow.file) : null, ASSETS_LABELS.VALIDATION_PASS, []),
      ...workflowGraphFields(workflow),
    };
  }
  const projectFile = `workflows/${id}.yaml`;
  const errs = result.errors.filter((err) => err.file === projectFile);
  if (errs.length > 0) {
    const parsed = parseWorkflowAt(assetFileAbs(root, projectFile));
    if (parsed === null) {
      return {
        ...baseDetail('workflows', id, id, ASSETS_LABELS.SOURCE_PROJECT, prefixedFile(projectFile), ASSETS_LABELS.VALIDATION_UNREADABLE, errs.map(workflowDetailText)),
        ...emptyWorkflowGraph(),
      };
    }
    return {
      ...baseDetail('workflows', id, typeof parsed.name === 'string' ? parsed.name : id, ASSETS_LABELS.SOURCE_PROJECT, prefixedFile(projectFile), ASSETS_LABELS.VALIDATION_FAIL, errs.map(workflowDetailText)),
      ...workflowGraphFields(parsed),
    };
  }
  const builtinFile = `${BUILTIN_FILE_PREFIX}${id}`;
  const builtinErrs = result.errors.filter((err) => err.file === builtinFile);
  if (builtinErrs.length > 0) {
    const def = projectBuiltinWorkflows(GRAPHS, { names: TEMPLATE_LABEL }).find((item) => item.id === id);
    return {
      ...baseDetail('workflows', id, def?.name ?? id, ASSETS_LABELS.SOURCE_BUILTIN, null, ASSETS_LABELS.VALIDATION_FAIL, builtinErrs.map(workflowDetailText)),
      ...(def === undefined ? emptyWorkflowGraph() : workflowGraphFields(def)),
    };
  }
  return { found: false, kind: 'workflows', id };
}

// ---------------------------------------------------------------- 导出接口

/**
 * 三类资产的列表投影（只读）。
 *
 * @param {string} root 项目根
 * @param {'roles'|'skills'|'workflows'} kind 资产种类（与 .orch 子目录同名）
 * @param {{builtinRoot?: string|null}} [options] 测试接缝：替换内置资产根，
 *   缺省走仓库资产树（AC-46 的 total 断言用它隔离内置资产）
 * @returns {Promise<{items: Array<{id, name, source, group, validation,
 *   commands?: number, nodeCount?: number|null, edgeCount?: number|null}>,
 *   unreadable: string[], counts: {total, builtin, project}, dirUnreadable: boolean}>}
 *   - 行的 `validation` ∈ 通过 / 不通过 / 未校验 / 不可读（不可读行的 id 同时
 *     出现在 unreadable，A-5 单文件级降级）；工作流行按 BR-14 另给节点数与
 *     边数（group 为 null：定义里没有分组字段，不新造）；技能行按 BR-14 另给
 *     命令数；计数与行同源（AC-19/21/22）。
 */
export async function listAssets(root, kind, options = {}) {
  const base = typeof root === 'string' && root.length > 0 ? root : process.cwd();
  if (!KINDS.has(kind)) {
    return { items: [], unreadable: [], counts: emptyCounts(), dirUnreadable: false };
  }
  const scan = readProjectDir(base, kind);
  if (scan.unreadable) {
    return { items: [], unreadable: [], counts: emptyCounts(), dirUnreadable: true };
  }
  const registry = loadRegistry({
    root: base,
    builtinRoot: typeof options.builtinRoot === 'string' ? options.builtinRoot : null,
  });
  if (kind === 'workflows') {
    const result = loadWorkflows({
      root: base,
      builtinGraphs: GRAPHS,
      roles: registry.roles,
      builtinNames: TEMPLATE_LABEL,
    });
    const { rows, unreadable } = collectWorkflowRows(base, registry, result, scan);
    return { items: rows, unreadable, counts: countsOfRows(rows), dirUnreadable: false };
  }
  const { rows, unreadable } =
    kind === 'roles'
      ? collectRoleRows(base, registry, scan)
      : collectSkillRows(base, registry, scan);
  return { items: rows, unreadable, counts: countsOfRows(rows), dirUnreadable: false };
}

/**
 * 单个资产的详情投影（只读，D-4 字段只透传）。
 *
 * @param {string} root 项目根
 * @param {'roles'|'skills'|'workflows'} kind 资产种类
 * @param {string} id 资产 id（即文件 / 目录名；列表行的 id 可直接回查）
 * @returns {Promise<object>} found=false 表示没有这个资产；校验失败原因
 *   （reason / reasons）与 CLI validate 原文逐字一致；引用缺失项带
 *   `missing: true`（BR-15「找不到的引用标缺失」）。
 */
export async function showAsset(root, kind, id) {
  const base = typeof root === 'string' && root.length > 0 ? root : process.cwd();
  const assetId = typeof id === 'string' ? id : '';
  if (!KINDS.has(kind) || assetId.length === 0) {
    return { found: false, kind, id: assetId };
  }
  const registry = loadRegistry({ root: base });
  if (kind === 'roles') return showRoleDetail(base, assetId, registry);
  if (kind === 'skills') return showSkillDetail(base, assetId, registry);
  const result = loadWorkflows({
    root: base,
    builtinGraphs: GRAPHS,
    roles: registry.roles,
    builtinNames: TEMPLATE_LABEL,
  });
  return showWorkflowDetail(base, assetId, registry, result);
}
