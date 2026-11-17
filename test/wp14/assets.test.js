/**
 * I1.11 WP-3 契约测试：资产库投影（src/daemon/assets-view.js）。
 *
 * 覆盖：AC-19（三类列表的来源 / 分组 / 校验状态与计数自洽）、AC-20（角色详情
 * 契约要点 + 技能引用缺失标注 + 校验原因与 CLI 原文一致）、AC-21（技能列表与
 * 详情、正文摘要行数上限）、AC-22（工作流列表 7 节点 8 边、详情节点清单与
 * 回流数）、AC-23（校验不通过可浏览并标原因）、AC-24（目录不可读 + 引用缺失
 * 降级）、AC-25（只读：调用前后资产目录哈希不变）、AC-46（单资产不可解析
 * 那一行标不可读、其余照常）。
 *
 * 夹具：$TMPDIR 独立根（短前缀，受 macOS socket 路径上限约束）+ 仓库真实
 * 内置资产 + 手写项目级资产；「校验不通过」现场按 D-45 口径手写坏 YAML 构造
 * （缺技能引用 / 空正文 / 悬空边 / 无法解析）。全部走只读投影，无核、无实例。
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

import {
  ASSETS_LABELS,
  BODY_PREVIEW_LINES,
  listAssets,
  showAsset,
} from '../../src/daemon/assets-view.js';
import { detailOf } from '../../src/cli/roles.js';

// ------------------------------------------------------------------ 临时目录

const tempDirs = [];
const chmodDirs = [];

function makeRoot(tag) {
  // 前缀必须短：<root>/.orch/core.sock 受 macOS 104 字节路径上限约束。
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `wp14a-${tag}-`));
  tempDirs.push(dir);
  return dir;
}

after(() => {
  for (const dir of chmodDirs) {
    try {
      fs.chmodSync(dir, 0o755);
    } catch {
      // 已随父目录清理
    }
  }
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------------------------------ 夹具

function writeRole(root, id, yaml) {
  const dir = path.join(root, '.orch', 'roles');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.yaml`), yaml, 'utf8');
}

function writeSkill(root, id, text) {
  const dir = path.join(root, '.orch', 'skills', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), text, 'utf8');
}

function writeWorkflow(root, id, yaml) {
  const dir = path.join(root, '.orch', 'workflows');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.yaml`), yaml, 'utf8');
}

const roleYaml = (over = {}) => {
  const fields = {
    schema: 'role/v1',
    id: 'proj-coder',
    name: '项目开发',
    group: 'coding',
    summary: '项目角色样例',
    artifact_type: 'code',
    side_effect: 'write',
    skills: ['code-change'],
    tools: ['read', 'write', 'bash'],
    wake_allow: ['tester'],
    max_concurrent_sessions: 1,
    ...over,
  };
  return [
    `schema: ${fields.schema}`,
    `id: ${fields.id}`,
    `name: ${fields.name}`,
    `group: ${fields.group}`,
    `summary: ${fields.summary}`,
    `artifact_type: ${fields.artifact_type}`,
    `side_effect: ${fields.side_effect}`,
    ...(Array.isArray(fields.skills) && fields.skills.length > 0
      ? ['skills:', ...fields.skills.map((s) => `  - ${s}`)]
      : ['skills: []']),
    'tools:',
    ...fields.tools.map((t) => `  - ${t}`),
    ...(Array.isArray(fields.wake_allow) && fields.wake_allow.length > 0
      ? ['wake_allow:', ...fields.wake_allow.map((w) => `  - ${w}`)]
      : ['wake_allow: []']),
    `max_concurrent_sessions: ${fields.max_concurrent_sessions}`,
    '',
  ].join('\n');
};

/** AC-22 / A-5 的同一份 release-flow：7 节点（5 角色 + 1 人工 + 1 子工作流）、8 边（正向 6 + 回流 2）。 */
const RELEASE_FLOW = [
  'schema: workflow/v1',
  'id: release-flow',
  'name: 发布流程',
  'summary: 样例发布流程',
  'entry: T-001',
  'terminal: T-003',
  'nodes:',
  '  - id: T-001',
  '    node_type: role',
  '    role: developer',
  '    title: 实现',
  '    wake_allow: [tester, reviewer]',
  '    max_rounds: 3',
  '  - id: T-002',
  '    node_type: role',
  '    role: tester',
  '    title: 验证',
  '    max_rounds: 3',
  '  - id: T-003',
  '    node_type: role',
  '    role: reviewer',
  '    title: 复核',
  '  - id: H-001',
  '    node_type: human',
  '    title: 人工确认',
  '  - id: S-001',
  '    node_type: subworkflow',
  '    workflow: sub-flow',
  '    title: 子流程',
  '  - id: T-004',
  '    node_type: role',
  '    role: code-reviewer',
  '    title: 评审',
  '    wake_allow: [writer]',
  '  - id: T-005',
  '    node_type: role',
  '    role: writer',
  '    title: 修订',
  'edges:',
  '  - from: T-001',
  '    to: T-002',
  '    kind: forward',
  '  - from: T-001',
  '    to: T-003',
  '    kind: forward',
  '  - from: T-002',
  '    to: H-001',
  '    kind: forward',
  '  - from: H-001',
  '    to: S-001',
  '    kind: forward',
  '    when: human_approved',
  '  - from: S-001',
  '    to: T-004',
  '    kind: forward',
  '  - from: T-004',
  '    to: T-005',
  '    kind: forward',
  '  - from: T-005',
  '    to: T-002',
  '    kind: backflow',
  '  - from: T-004',
  '    to: T-001',
  '    kind: backflow',
  '',
].join('\n');

const SUB_FLOW = [
  'schema: workflow/v1',
  'id: sub-flow',
  'name: 子流程样例',
  'entry: T-001',
  'terminal: T-001',
  'nodes:',
  '  - id: T-001',
  '    node_type: role',
  '    role: developer',
  '    title: 子步骤',
  'edges: []',
  '',
].join('\n');

/** 最小合法项目工作流：单人工节点，入口即终点。 */
const MINI_FLOW = [
  'schema: workflow/v1',
  'id: proj-flow',
  'name: 项目流程',
  'entry: T-001',
  'terminal: T-001',
  'nodes:',
  '  - id: T-001',
  '    node_type: human',
  '    title: 人工节点',
  'edges: []',
  '',
].join('\n');

/** 悬空边工作流（AC-23）：结构可解析、边指向不存在的节点。 */
const DANGLING_FLOW = [
  'schema: workflow/v1',
  'id: broken-flow',
  'name: 悬空边样例',
  'entry: T-001',
  'terminal: T-001',
  'nodes:',
  '  - id: T-001',
  '    node_type: human',
  '    title: 人工节点',
  'edges:',
  '  - from: T-001',
  '    to: T-009',
  '    kind: forward',
  '',
].join('\n');

const skillText = (id, name, bodyLines) => {
  const lines = ['---', `schema: skill/v1`, `id: ${id}`, `name: ${name}`, `summary: ${name}的工作方法`, 'applies_to: [writing]', 'commands: [orch-note]', '---'];
  for (let i = 1; i <= bodyLines; i += 1) lines.push(`第 ${String(i).padStart(2, '0')} 行正文`);
  lines.push('');
  return lines.join('\n');
};

/** 只读断言用：目录树内全部文件的字节哈希（路径 → sha256）。 */
function hashTree(base, rel) {
  const out = {};
  const walk = (dir, prefix) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs, key);
      else if (entry.isFile()) {
        out[key] = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
      }
    }
  };
  walk(path.join(base, rel), '');
  return out;
}

const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

// ------------------------------------------------------------------ AC-19

test('AC-19 三类列表：来源、分组、校验状态与计数自洽', async () => {
  const root = makeRoot('ac19');
  writeRole(root, 'proj-coder', roleYaml());
  writeRole(root, 'proj-gap', roleYaml({ id: 'proj-gap', name: '项目缺口', skills: ['missing-skill'] }));
  writeSkill(root, 'proj-note', skillText('proj-note', '项目笔记', 12));
  writeWorkflow(root, 'proj-flow', MINI_FLOW);

  const roles = await listAssets(root, 'roles');
  assert.equal(roles.dirUnreadable, false);
  assert.deepEqual(roles.unreadable, []);
  assert.equal(roles.counts.total, roles.counts.builtin + roles.counts.project);
  assert.equal(roles.counts.project, 2);
  assert.ok(roles.counts.builtin > 0);
  const coder = roles.items.find((row) => row.id === 'proj-coder');
  assert.deepEqual(
    { id: coder.id, name: coder.name, source: coder.source, group: coder.group, validation: coder.validation },
    { id: 'proj-coder', name: '项目开发', source: '项目', group: '编码工程', validation: '通过' }
  );
  const gap = roles.items.find((row) => row.id === 'proj-gap');
  assert.equal(gap.validation, '不通过');
  assert.equal(gap.source, '项目');
  const builtinRows = roles.items.filter((row) => row.source === ASSETS_LABELS.SOURCE_BUILTIN);
  assert.equal(builtinRows.length, roles.counts.builtin);
  for (const row of roles.items) {
    assert.ok(['内置', '项目'].includes(row.source));
    assert.ok(['通过', '不通过', '未校验', '不可读'].includes(row.validation));
    assert.equal(typeof row.id, 'string');
    assert.equal(typeof row.name, 'string');
  }

  const skills = await listAssets(root, 'skills');
  assert.equal(skills.counts.total, skills.counts.builtin + skills.counts.project);
  assert.equal(skills.counts.project, 1);
  const note = skills.items.find((row) => row.id === 'proj-note');
  assert.equal(note.source, '项目');
  assert.equal(note.group, '内容创作');
  assert.equal(note.commands, 1);
  assert.equal(note.validation, '通过');
  assert.ok(skills.items.some((row) => row.source === '内置'));

  const flows = await listAssets(root, 'workflows');
  assert.equal(flows.counts.total, flows.counts.builtin + flows.counts.project);
  assert.equal(flows.counts.project, 1);
  const flow = flows.items.find((row) => row.id === 'proj-flow');
  assert.equal(flow.source, '项目');
  assert.equal(flow.validation, '通过');
  assert.equal(flow.nodeCount, 1);
  assert.equal(flow.edgeCount, 0);
  assert.equal(flow.group, null);
});

// ------------------------------------------------------------------ AC-20

test('AC-20 角色详情：契约要点透传、缺失技能标注、原因与 CLI 原文一致', async () => {
  const root = makeRoot('ac20');
  writeRole(root, 'proj-review', roleYaml({
    id: 'proj-review',
    name: '项目复核',
    skills: ['code-change', 'missing-skill'],
    wake_allow: ['tester', 'reviewer'],
    max_concurrent_sessions: 2,
  }));

  const detail = await showAsset(root, 'roles', 'proj-review');
  assert.equal(detail.found, true);
  assert.equal(detail.validation, '不通过');
  assert.equal(detail.name, '项目复核');
  assert.equal(detail.source, '项目');
  assert.equal(detail.file, '.orch/roles/proj-review.yaml');
  assert.equal(detail.group, 'coding');
  assert.equal(detail.groupLabel, '编码工程');
  assert.equal(detail.artifactType, 'code');
  assert.equal(detail.sideEffect, 'write');
  assert.equal(detail.maxConcurrentSessions, 2);
  assert.deepEqual(detail.tools, ['read', 'write', 'bash']);
  assert.equal(detail.skills.length, 2);
  assert.deepEqual(detail.skills[0], { id: 'code-change', missing: false });
  assert.deepEqual(detail.skills[1], { id: 'missing-skill', missing: true });
  assert.equal(detail.wakeAllow.length, 2);
  assert.deepEqual(detail.wakeAllow, [
    { id: 'tester', missing: false },
    { id: 'reviewer', missing: false },
  ]);
  // 与 CLI `orch role validate` 行明细同一组装函数（src/cli/roles.js detailOf）。
  assert.equal(detail.reason, '引用的技能不存在：missing-skill');
  assert.deepEqual(detail.reasons, [
    detailOf({ code: 'ROLE_SKILL_NOT_FOUND', file: 'roles/proj-review.yaml', scope: 'role', field: 'skills', line: null, params: { skill: 'missing-skill' } }),
  ]);
});

// ------------------------------------------------------------------ AC-21

test('AC-21 技能列表与详情：正文摘要按上限截断', async () => {
  const root = makeRoot('ac21');
  writeSkill(root, 'proj-note', skillText('proj-note', '项目笔记', 40));

  assert.equal(BODY_PREVIEW_LINES, 20);
  const skills = await listAssets(root, 'skills');
  assert.equal(skills.counts.total, skills.counts.builtin + skills.counts.project);
  const note = skills.items.find((row) => row.id === 'proj-note');
  assert.equal(note.source, '项目');
  assert.equal(note.validation, '通过');
  const builtin = skills.items.find((row) => row.source === '内置');
  assert.ok(builtin);

  const detail = await showAsset(root, 'skills', 'proj-note');
  assert.equal(detail.found, true);
  assert.equal(detail.validation, '通过');
  assert.equal(detail.name, '项目笔记');
  assert.deepEqual(detail.appliesToLabels, ['内容创作']);
  assert.deepEqual(detail.commands, ['orch-note']);
  assert.equal(detail.summary, '项目笔记的工作方法');
  assert.equal(detail.bodyPreviewLines, 20);
  assert.ok(detail.bodyPreviewLines <= BODY_PREVIEW_LINES);
  assert.equal(detail.bodyPreview.length, 20);
  assert.equal(detail.bodyPreview[0], '第 01 行正文');
  assert.equal(detail.bodyPreview[19], '第 20 行正文');
  assert.ok(!JSON.stringify(detail).includes('第 40 行正文'));
});

// ------------------------------------------------------------------ AC-22

test('AC-22 工作流列表与详情：7 节点 8 边、节点清单同序、回流 2 条', async () => {
  const root = makeRoot('ac22');
  writeWorkflow(root, 'release-flow', RELEASE_FLOW);
  writeWorkflow(root, 'sub-flow', SUB_FLOW);

  const flows = await listAssets(root, 'workflows');
  assert.equal(flows.counts.total, flows.counts.builtin + flows.counts.project);
  assert.equal(flows.counts.project, 2);
  assert.equal(flows.counts.builtin, 3);
  const row = flows.items.find((item) => item.id === 'release-flow');
  assert.equal(row.source, '项目');
  assert.equal(row.nodeCount, 7);
  assert.equal(row.edgeCount, 8);
  assert.equal(row.group, null);
  assert.equal(row.validation, '通过');

  const detail = await showAsset(root, 'workflows', 'release-flow');
  assert.equal(detail.found, true);
  assert.equal(detail.validation, '通过');
  assert.equal(detail.nodeCount, 7);
  assert.equal(detail.edgeCount, 8);
  assert.equal(detail.backflowCount, 2);
  assert.deepEqual(
    detail.nodes.map((node) => node.id),
    ['T-001', 'T-002', 'T-003', 'H-001', 'S-001', 'T-004', 'T-005']
  );
  assert.deepEqual(
    detail.nodes.map((node) => node.typeLabel),
    ['角色节点', '角色节点', '角色节点', '人工节点', '子工作流', '角色节点', '角色节点']
  );
  const byType = Object.fromEntries(detail.nodeTypeCounts.map((item) => [item.type, item.count]));
  assert.equal(byType.role, 5);
  assert.equal(byType.human, 1);
  assert.equal(byType.subworkflow, 1);
});

// ------------------------------------------------------------------ AC-23

test('AC-23 校验不通过的资产照常出现在列表并标注原因（与 CLI 原文逐字）', async () => {
  const root = makeRoot('ac23');
  writeRole(root, 'proj-gap', roleYaml({ id: 'proj-gap', name: '项目缺口', skills: ['missing-skill'] }));
  writeSkill(root, 'empty-skill', '---\nschema: skill/v1\nid: empty-skill\nname: 空正文技能\nsummary: 正文为空的样例\n---\n');
  writeWorkflow(root, 'broken-flow', DANGLING_FLOW);

  const roles = await listAssets(root, 'roles');
  const gapRow = roles.items.find((row) => row.id === 'proj-gap');
  assert.ok(gapRow);
  assert.equal(gapRow.validation, '不通过');
  assert.equal(roles.counts.total, roles.counts.builtin + roles.counts.project);
  assert.equal(roles.counts.project, 1);

  const skills = await listAssets(root, 'skills');
  const emptyRow = skills.items.find((row) => row.id === 'empty-skill');
  assert.ok(emptyRow);
  assert.equal(emptyRow.validation, '不通过');

  const flows = await listAssets(root, 'workflows');
  const flowRow = flows.items.find((row) => row.id === 'broken-flow');
  assert.ok(flowRow);
  assert.equal(flowRow.validation, '不通过');
  assert.equal(flowRow.nodeCount, 1);
  assert.equal(flowRow.edgeCount, 1);

  const roleDetail = await showAsset(root, 'roles', 'proj-gap');
  assert.equal(roleDetail.validation, '不通过');
  assert.equal(roleDetail.reason, '引用的技能不存在：missing-skill');

  const skillDetail = await showAsset(root, 'skills', 'empty-skill');
  assert.equal(skillDetail.validation, '不通过');
  assert.equal(skillDetail.reason, '技能正文为空：empty-skill');
  assert.equal(skillDetail.bodyPreviewLines, 0);
  assert.deepEqual(skillDetail.bodyPreview, []);

  const flowDetail = await showAsset(root, 'workflows', 'broken-flow');
  assert.equal(flowDetail.validation, '不通过');
  assert.equal(flowDetail.reason, '边不合法：endpoint: T-001->T-009');
  assert.deepEqual(flowDetail.reasons, ['边不合法：endpoint: T-001->T-009']);
});

// ------------------------------------------------------------------ AC-24

test('AC-24 现场一：角色目录不可读整页降级，其它分页照常', { skip: isRoot }, async () => {
  const root = makeRoot('ac24a');
  const rolesDir = path.join(root, '.orch', 'roles');
  fs.mkdirSync(rolesDir, { recursive: true });
  fs.writeFileSync(path.join(rolesDir, 'proj-coder.yaml'), roleYaml(), 'utf8');
  writeSkill(root, 'proj-note', skillText('proj-note', '项目笔记', 5));

  fs.chmodSync(rolesDir, 0o000);
  chmodDirs.push(rolesDir);
  try {
    const roles = await listAssets(root, 'roles');
    assert.equal(roles.dirUnreadable, true);
    assert.deepEqual(roles.items, []);
    assert.deepEqual(roles.unreadable, []);
    assert.deepEqual(roles.counts, { total: 0, builtin: 0, project: 0 });

    const skills = await listAssets(root, 'skills');
    assert.equal(skills.dirUnreadable, false);
    assert.equal(skills.counts.project, 1);
    assert.ok(skills.items.some((row) => row.id === 'proj-note'));
  } finally {
    fs.chmodSync(rolesDir, 0o755);
  }
  const restored = await listAssets(root, 'roles');
  assert.equal(restored.dirUnreadable, false);
  assert.equal(restored.counts.project, 1);
});

test('AC-24 现场二：引用缺失的技能标缺失，其余字段照常', async () => {
  const root = makeRoot('ac24b');
  writeRole(root, 'proj-gap', roleYaml({ id: 'proj-gap', name: '项目缺口', skills: ['missing-skill'] }));

  const detail = await showAsset(root, 'roles', 'proj-gap');
  assert.equal(detail.found, true);
  const missing = detail.skills.find((item) => item.id === 'missing-skill');
  assert.ok(missing);
  assert.equal(missing.missing, true);
  assert.equal(detail.tools.length, 3);
  assert.equal(detail.maxConcurrentSessions, 1);
  assert.equal(typeof detail.name, 'string');

  const roles = await listAssets(root, 'roles');
  assert.equal(roles.dirUnreadable, false);
  assert.equal(roles.counts.project, 1);
});

// ------------------------------------------------------------------ AC-25

test('AC-25 库浏览只读：调用前后三个资产目录的哈希不变', async () => {
  const root = makeRoot('ac25');
  writeRole(root, 'proj-coder', roleYaml());
  writeRole(root, 'proj-gap', roleYaml({ id: 'proj-gap', name: '项目缺口', skills: ['missing-skill'] }));
  writeSkill(root, 'proj-note', skillText('proj-note', '项目笔记', 10));
  writeWorkflow(root, 'release-flow', RELEASE_FLOW);
  writeWorkflow(root, 'sub-flow', SUB_FLOW);
  writeWorkflow(root, 'broken-flow', DANGLING_FLOW);

  const before = {
    roles: hashTree(root, '.orch/roles'),
    skills: hashTree(root, '.orch/skills'),
    workflows: hashTree(root, '.orch/workflows'),
  };
  assert.ok(Object.keys(before.roles).length >= 2);
  assert.ok(Object.keys(before.workflows).length >= 3);

  for (const kind of ['roles', 'skills', 'workflows']) {
    await listAssets(root, kind);
  }
  await showAsset(root, 'roles', 'proj-coder');
  await showAsset(root, 'roles', 'proj-gap');
  await showAsset(root, 'skills', 'proj-note');
  await showAsset(root, 'workflows', 'release-flow');
  await showAsset(root, 'workflows', 'broken-flow');

  const after = {
    roles: hashTree(root, '.orch/roles'),
    skills: hashTree(root, '.orch/skills'),
    workflows: hashTree(root, '.orch/workflows'),
  };
  assert.deepEqual(after, before);
});

// ------------------------------------------------------------------ AC-46

test('AC-46 单个资产不可解析：那一行标不可读，其余照常', async () => {
  const root = makeRoot('ac46');
  writeRole(root, 'good-one', roleYaml({ id: 'good-one', name: '合法一', skills: [] }));
  writeRole(root, 'good-two', roleYaml({ id: 'good-two', name: '合法二', skills: [] }));
  writeRole(root, 'broken-role', '{{{{\n');

  // 隔离内置资产根，使计数行只含项目角色（AC-46 的 total === 3 口径）。
  const emptyBuiltin = makeRoot('ac46-builtin');
  const roles = await listAssets(root, 'roles', { builtinRoot: emptyBuiltin });
  assert.equal(roles.dirUnreadable, false);
  assert.equal(roles.counts.total, 3);
  assert.equal(roles.unreadable.length, 1);
  assert.deepEqual(roles.unreadable, ['broken-role']);
  const broken = roles.items.find((row) => row.id === 'broken-role');
  assert.ok(broken);
  assert.deepEqual(
    { id: broken.id, name: broken.name, source: broken.source, validation: broken.validation },
    { id: 'broken-role', name: 'broken-role', source: '项目', validation: '不可读' }
  );
  assert.equal(broken.group, null);
  const others = roles.items.filter((row) => row.id !== 'broken-role');
  assert.equal(others.length, 2);
  for (const row of others) {
    assert.ok(['通过', '不通过'].includes(row.validation));
    assert.equal(row.source, '项目');
  }

  const detail = await showAsset(root, 'roles', 'broken-role');
  assert.equal(detail.found, true);
  assert.equal(detail.validation, '不可读');
  assert.ok(typeof detail.reason === 'string' && detail.reason.length > 0);
  assert.equal(detail.reason, '第 1 行无法解析：不支持的语法：{{{{');
});

// ------------------------------------------------------------------ 补充

test('未知 kind 与未知 id 按找不到处理，不抛错', async () => {
  const root = makeRoot('edge');
  const badKind = await listAssets(root, 'nope');
  assert.deepEqual(badKind.items, []);
  assert.deepEqual(badKind.counts, { total: 0, builtin: 0, project: 0 });
  assert.equal(badKind.dirUnreadable, false);
  const missing = await showAsset(root, 'roles', 'no-such-role');
  assert.deepEqual(missing, { found: false, kind: 'roles', id: 'no-such-role' });
  const emptyId = await showAsset(root, 'skills', '');
  assert.equal(emptyId.found, false);
});
