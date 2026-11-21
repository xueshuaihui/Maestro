/**
 * I1.11 WP-5 契约测试：工作流画布投影（src/daemon/canvas.js）。
 *
 * 覆盖：AC-29（定义态节点/边/回流：release-flow 7 节点 8 边 + 真实内置图 +
 * 部分可解析现场）、AC-30 数据侧（只读：调用前后 .orch 哈希不变；投影无
 * 运行时字段）、AC-31（现场一整体不可解析 → 「定义不可读」原因；现场二文件
 * 不存在 / 无读权限 → 「定义 空」；现场三悬空边 → 校验不通过但照常画出）、
 * AC-45（nodes:[] 与 0 字节 → 「定义 空」）、valid 与 readable 三态交叉。
 *
 * 夹具：$TMPDIR 独立根（短前缀 wp14c-）+ 手写 YAML 构造各现场；release-flow
 * 与 AC-22 / A-5 / A-7 是同一份定义（7 节点 = 5 角色 + 1 人工 + 1 子工作流；
 * 8 边 = 正向 6 + 回流 2）。全部走只读投影，无核、无实例。
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

import { buildCanvas, CANVAS_LABELS } from '../../src/daemon/canvas.js';

// ------------------------------------------------------------------ 临时目录

const tempDirs = [];
const chmodFiles = [];

function makeRoot(tag) {
  // 前缀必须短：<root>/.orch/core.sock 受 macOS 104 字节路径上限约束。
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `wp14c-${tag}-`));
  tempDirs.push(dir);
  return dir;
}

after(() => {
  for (const file of chmodFiles) {
    try {
      fs.chmodSync(file, 0o644);
    } catch {
      // 已随父目录清理
    }
  }
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------------------------------ 夹具

function writeWorkflow(root, id, yaml) {
  const dir = path.join(root, '.orch', 'workflows');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.yaml`);
  fs.writeFileSync(file, yaml, 'utf8');
  return file;
}

/** AC-29 / A-5 / A-7 的同一份 release-flow：7 节点（5 角色 + 1 人工 + 1 子工作流）、8 边（正向 6 + 回流 2）。 */
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

/** AC-29 部分可解析现场：4 个节点，其中 1 个 node_type: mystery 不可识别。 */
const PARTIAL_FLOW = [
  'schema: workflow/v1',
  'id: partial-flow',
  'name: 部分可解析样例',
  'entry: T-001',
  'terminal: T-003',
  'nodes:',
  '  - id: T-001',
  '    node_type: role',
  '    role: developer',
  '    title: 实现',
  '  - id: T-002',
  '    node_type: mystery',
  '    title: 未知步骤',
  '  - id: T-003',
  '    node_type: human',
  '    title: 人工确认',
  '  - id: H-001',
  '    node_type: role',
  '    role: tester',
  '    title: 验证',
  'edges:',
  '  - from: T-001',
  '    to: T-002',
  '    kind: forward',
  '  - from: T-002',
  '    to: T-003',
  '    kind: forward',
  '',
].join('\n');

/** AC-31 现场三：结构可解析、边指向不存在的节点。 */
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

/** 子工作流引用不存在：结构可解析、校验失败。 */
const LOST_SUB_FLOW = [
  'schema: workflow/v1',
  'id: lost-sub',
  'name: 悬空子工作流样例',
  'entry: T-001',
  'terminal: T-001',
  'nodes:',
  '  - id: T-001',
  '    node_type: human',
  '    title: 确认',
  '  - id: S-001',
  '    node_type: subworkflow',
  '    workflow: missing-sub',
  '    title: 子流程',
  'edges: []',
  '',
].join('\n');

/** AC-45 现场一：语法合法、零节点零边。 */
const EMPTY_FLOW = [
  'schema: workflow/v1',
  'id: empty-flow',
  'name: 空定义样例',
  'entry: T-001',
  'terminal: T-001',
  'nodes: []',
  'edges: []',
  '',
].join('\n');

/** 顶层缺节点列表：没有任何可解析节点。 */
const HEADLESS_FLOW = [
  'schema: workflow/v1',
  'id: headless',
  'name: 缺节点列表样例',
  'entry: T-001',
  'terminal: T-001',
  'edges: []',
  '',
].join('\n');

/** 节点条目全部缺 id：全部画不了。 */
const NO_ID_FLOW = [
  'schema: workflow/v1',
  'id: no-id-flow',
  'name: 缺节点编号样例',
  'entry: T-001',
  'terminal: T-001',
  'nodes:',
  '  - node_type: role',
  '    role: developer',
  '  - junk',
  '',
].join('\n');

/** 节点 id 重复：全部条目可解析（readable=true），校验不通过，只画首个。 */
const DUP_FLOW = [
  'schema: workflow/v1',
  'id: dup-flow',
  'name: 重复编号样例',
  'entry: T-001',
  'terminal: T-001',
  'nodes:',
  '  - id: T-001',
  '    node_type: human',
  '    title: 确认',
  '  - id: T-001',
  '    node_type: human',
  '    title: 再来一个',
  'edges: []',
  '',
].join('\n');

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
// 「无读权限」前提靠 chmod 构造：root 绕过权限位，Windows 无 POSIX 权限位（chmod 为 no-op）。
// 前提不可构造时按平台能力跳过，断言本身一字不改。
const cannotBuildUnreadable = isRoot || process.platform === 'win32';

// ------------------------------------------------------------------ A-7 逐字基线

test('A-7 画布标签与降级文案逐字', () => {
  assert.deepEqual(CANVAS_LABELS, {
    TITLE_TEMPLATE: '工作流 {name} · 定义态 · {n} 节点 · {m} 条边',
    VALIDATION_BADGE: '校验不通过',
    EMPTY_TEXT: '定义 空',
    UNREADABLE_TEXT: '定义不可读 · 仅显示可解析部分',
    SUBFLOW_ROW: '子工作流：{title} · {n} 角色',
    SUBFLOW_UNKNOWN: '子工作流 {id} · 角色数未知',
  });
});

// ------------------------------------------------------------------ AC-29

test('AC-29 release-flow：7 节点 8 边、2 条回流、定义态字段齐全', () => {
  const root = makeRoot('ac29');
  writeWorkflow(root, 'release-flow', RELEASE_FLOW);
  writeWorkflow(root, 'sub-flow', SUB_FLOW);

  const canvas = buildCanvas(root, 'release-flow');
  assert.equal(canvas.title, '发布流程');
  assert.equal(canvas.readable, true);
  assert.equal(canvas.valid, true);
  assert.ok(!('problems' in canvas));

  assert.equal(canvas.nodes.length, 7);
  assert.deepEqual(
    canvas.nodes.map((node) => node.id),
    ['T-001', 'T-002', 'T-003', 'H-001', 'S-001', 'T-004', 'T-005']
  );
  assert.deepEqual(
    canvas.nodes.map((node) => node.nodeType),
    ['role', 'role', 'role', 'human', 'subworkflow', 'role', 'role']
  );
  assert.deepEqual(
    canvas.nodes.map((node) => node.roleId),
    ['developer', 'tester', 'reviewer', null, null, 'code-reviewer', 'writer']
  );
  assert.deepEqual(
    canvas.nodes.map((node) => node.label),
    ['实现', '验证', '复核', '人工节点 人工确认', '子工作流：子流程 · 1 角色', '评审', '修订']
  );

  assert.equal(canvas.edges.length, 8);
  const kinds = canvas.edges.map((edge) => edge.kind);
  assert.equal(kinds.filter((kind) => kind === 'forward').length, 6);
  assert.equal(kinds.filter((kind) => kind === 'backflow').length, 2);
  const backflows = canvas.edges
    .filter((edge) => edge.kind === 'backflow')
    .map((edge) => `${edge.from}->${edge.to}`);
  assert.deepEqual(backflows, ['T-005->T-002', 'T-004->T-001']);
  assert.deepEqual(
    canvas.edges.map((edge) => `${edge.from}->${edge.to}`),
    [
      'T-001->T-002',
      'T-001->T-003',
      'T-002->H-001',
      'H-001->S-001',
      'S-001->T-004',
      'T-004->T-005',
      'T-005->T-002',
      'T-004->T-001',
    ]
  );

  // 同一份定义两次投影逐值相等（布局纯函数的数据侧前提，AC-29）。
  const again = buildCanvas(root, 'release-flow');
  assert.deepEqual(again, canvas);
});

test('AC-29 真实内置工作流：文件缺失时按内置投影出定义态画布', () => {
  const root = makeRoot('ac29-builtin');

  const canvas = buildCanvas(root, 'task-loop');
  assert.equal(canvas.title, '通用任务闭环');
  assert.equal(canvas.readable, true);
  assert.equal(canvas.valid, true);
  assert.ok(!('problems' in canvas));
  assert.equal(canvas.nodes.length, 3);
  assert.deepEqual(
    canvas.nodes.map((node) => node.nodeType),
    ['role', 'role', 'role']
  );
  assert.deepEqual(
    canvas.nodes.map((node) => node.label),
    ['研究员', '撰写者', '审核者']
  );
  assert.equal(canvas.edges.length, 4);
  assert.deepEqual(
    canvas.edges.map((edge) => edge.kind),
    ['forward', 'forward', 'backflow', 'retest']
  );
  const backflow = canvas.edges.find((edge) => edge.kind === 'backflow');
  assert.deepEqual({ from: backflow.from, to: backflow.to }, { from: 'T-003', to: 'T-002' });
});

test('AC-29 部分可解析：readable=false 且 4 节点照画，未知类型按角色节点渲染并保留 id', () => {
  const root = makeRoot('ac29-partial');
  writeWorkflow(root, 'partial-flow', PARTIAL_FLOW);

  const canvas = buildCanvas(root, 'partial-flow');
  // B-1 态 ②：部分可解析 → 不整块降级成「定义不可读」。
  assert.equal(canvas.readable, false);
  assert.ok(canvas.nodes.length > 0);
  assert.equal(canvas.valid, false);
  assert.equal(canvas.nodes.length, 4);
  assert.deepEqual(
    canvas.nodes.map((node) => node.id),
    ['T-001', 'T-002', 'T-003', 'H-001']
  );
  const unknown = canvas.nodes.find((node) => node.id === 'T-002');
  assert.deepEqual(unknown, {
    id: 'T-002',
    nodeType: 'role',
    roleId: 'T-002',
    label: '未知步骤',
  });
  assert.deepEqual(canvas.problems, [
    '节点类型取值非法：mystery；合法取值：role / human / escalate / subworkflow',
  ]);
});

// ------------------------------------------------------------------ AC-31

test('AC-31 现场一：文件在但整体不可解析 → 定义不可读原因', () => {
  const root = makeRoot('ac31a');
  writeWorkflow(root, 'broken-flow', '{{{{\n');

  const canvas = buildCanvas(root, 'broken-flow');
  assert.equal(canvas.readable, false);
  assert.equal(canvas.nodes.length, 0);
  assert.equal(canvas.edges.length, 0);
  assert.equal(canvas.valid, false);
  assert.deepEqual(canvas.problems, ['第 1 行无法解析：不支持的语法：{{{{']);
  assert.equal(typeof canvas.title, 'string');
});

test('AC-31 现场二：文件不存在 / 无读权限 → 定义 空（readable=true、零节点）', { skip: cannotBuildUnreadable }, () => {
  const root = makeRoot('ac31b');
  writeWorkflow(root, 'locked-flow', RELEASE_FLOW);

  // 文件不存在（未命中内置图）。
  const missing = buildCanvas(root, 'ghost-flow');
  assert.equal(missing.readable, true);
  assert.equal(missing.valid, true);
  assert.equal(missing.nodes.length, 0);
  assert.equal(missing.edges.length, 0);
  assert.equal(missing.title, 'ghost-flow');
  assert.ok(!('problems' in missing));

  // 无读权限：chmod 000 后读取失败，同样按「取不到输入」降级。
  const file = path.join(root, '.orch', 'workflows', 'locked-flow.yaml');
  fs.chmodSync(file, 0o000);
  chmodFiles.push(file);
  const locked = buildCanvas(root, 'locked-flow');
  assert.equal(locked.readable, true);
  assert.equal(locked.nodes.length, 0);
  assert.equal(locked.edges.length, 0);
  assert.ok(!('problems' in locked));

  fs.chmodSync(file, 0o644);
  const restored = buildCanvas(root, 'locked-flow');
  assert.equal(restored.readable, true);
  assert.equal(restored.nodes.length, 7);
});

test('AC-31 现场三：悬空边照常画出，标题旁标校验不通过（原因与 CLI 逐字）', () => {
  const root = makeRoot('ac31c');
  writeWorkflow(root, 'broken-flow', DANGLING_FLOW);

  const canvas = buildCanvas(root, 'broken-flow');
  assert.equal(canvas.readable, true);
  assert.equal(canvas.valid, false);
  assert.equal(canvas.nodes.length, 1);
  assert.equal(canvas.edges.length, 1);
  assert.deepEqual(canvas.problems, ['边不合法：endpoint: T-001->T-009']);
});

// ------------------------------------------------------------------ AC-45

test('AC-45 空定义：nodes:[] 与 0 字节都按「定义 空」投影', () => {
  const root = makeRoot('ac45');
  writeWorkflow(root, 'empty-flow', EMPTY_FLOW);
  writeWorkflow(root, 'blank-flow', '');

  const empty = buildCanvas(root, 'empty-flow');
  assert.equal(empty.readable, true);
  assert.equal(empty.nodes.length, 0);
  assert.equal(empty.edges.length, 0);
  assert.equal(empty.title, '空定义样例');

  const blank = buildCanvas(root, 'blank-flow');
  assert.equal(blank.readable, true);
  assert.equal(blank.nodes.length, 0);
  assert.equal(blank.edges.length, 0);
  assert.equal(blank.title, 'blank-flow');

  // valid 与 readable 正交：空列表 / 空文件在 CLI validate 同样报缺少必填字段，
  // 原因逐字透出，界面在「定义 空」旁叠加「校验不通过」。
  assert.deepEqual(empty.problems, ['缺少必填字段：nodes']);
  assert.equal(empty.valid, false);
  assert.ok(blank.problems.length > 0);
  assert.equal(blank.problems[0], '缺少必填字段：schema');
  assert.equal(blank.valid, false);
});

// ------------------------------------------------------------------ AC-30（数据侧）

test('AC-30 数据侧：投影只读，调用前后 .orch 哈希不变', () => {
  const root = makeRoot('ac30');
  writeWorkflow(root, 'release-flow', RELEASE_FLOW);
  writeWorkflow(root, 'sub-flow', SUB_FLOW);
  writeWorkflow(root, 'broken-flow', DANGLING_FLOW);

  const before = hashTree(root, '.orch');
  assert.ok(Object.keys(before).length >= 3);

  for (const id of ['release-flow', 'broken-flow', 'ghost-flow', 'task-loop']) {
    buildCanvas(root, id);
    buildCanvas(root, id);
  }

  const after = hashTree(root, '.orch');
  assert.deepEqual(after, before);
});

test('AC-30 数据侧：投影无运行时字段，节点/边键集合固定', () => {
  const root = makeRoot('ac30-shape');
  writeWorkflow(root, 'release-flow', RELEASE_FLOW);
  writeWorkflow(root, 'sub-flow', SUB_FLOW);

  const canvas = buildCanvas(root, 'release-flow');
  for (const node of canvas.nodes) {
    assert.deepEqual(Object.keys(node), ['id', 'nodeType', 'roleId', 'label']);
  }
  for (const edge of canvas.edges) {
    assert.deepEqual(Object.keys(edge), ['from', 'to', 'kind']);
  }
  for (const key of Object.keys(canvas)) {
    assert.ok(['title', 'readable', 'valid', 'nodes', 'edges', 'problems'].includes(key));
  }
  const text = JSON.stringify(canvas);
  for (const token of ['"state"', '"round"', '"sessions"', '"status"', 'statusColor', 'abnormal']) {
    assert.ok(!text.includes(token), `不得出现运行时字段 ${token}`);
  }
});

// ------------------------------------------------------------------ valid=false 其余现场

test('未知子工作流：节点照画、标签降级「角色数未知」，原因与 CLI 逐字', () => {
  const root = makeRoot('lost-sub');
  writeWorkflow(root, 'lost-sub', LOST_SUB_FLOW);

  const canvas = buildCanvas(root, 'lost-sub');
  assert.equal(canvas.readable, true);
  assert.equal(canvas.valid, false);
  assert.equal(canvas.nodes.length, 2);
  const sub = canvas.nodes.find((node) => node.id === 'S-001');
  assert.deepEqual(sub, {
    id: 'S-001',
    nodeType: 'subworkflow',
    roleId: null,
    label: '子工作流 S-001 · 角色数未知',
  });
  assert.deepEqual(canvas.problems, ['引用的子工作流不存在：missing-sub']);
});

// ------------------------------------------------------------------ 三态交叉矩阵

test('三态交叉：零节点不可解析、缺 id 全降级、重复 id 只画首个', () => {
  const root = makeRoot('matrix');
  writeWorkflow(root, 'headless', HEADLESS_FLOW);
  writeWorkflow(root, 'no-id-flow', NO_ID_FLOW);
  writeWorkflow(root, 'dup-flow', DUP_FLOW);

  // 节点列表缺失：无可解析节点 → 态 ③（readable=false 且 nodes.length===0）。
  const headless = buildCanvas(root, 'headless');
  assert.equal(headless.readable, false);
  assert.equal(headless.valid, false);
  assert.equal(headless.nodes.length, 0);
  assert.deepEqual(headless.problems, ['缺少必填字段：nodes']);

  // 节点条目全部缺 id：态 ③，原因来自校验侧。
  const noId = buildCanvas(root, 'no-id-flow');
  assert.equal(noId.readable, false);
  assert.equal(noId.valid, false);
  assert.equal(noId.nodes.length, 0);
  assert.ok(noId.problems.length > 0);

  // 重复 id：条目全部可解析（态 ①），只画首个，校验不通过。
  const dup = buildCanvas(root, 'dup-flow');
  assert.equal(dup.readable, true);
  assert.equal(dup.valid, false);
  assert.equal(dup.nodes.length, 1);
  assert.deepEqual(dup.nodes[0].label, '人工节点 确认');
  assert.deepEqual(dup.problems, ['节点 id 重复：T-001']);
});

// ------------------------------------------------------------------ 边界

test('未知 id 与空 id 不抛错，按「定义 空」处理', () => {
  const root = makeRoot('edge');
  const missing = buildCanvas(root, 'no-such-flow');
  assert.equal(missing.readable, true);
  assert.equal(missing.nodes.length, 0);
  assert.equal(missing.valid, true);
  const blank = buildCanvas(root, '');
  assert.equal(blank.readable, true);
  assert.equal(blank.nodes.length, 0);
  const weird = buildCanvas(root, 42);
  assert.equal(weird.readable, true);
  assert.equal(weird.nodes.length, 0);
});
