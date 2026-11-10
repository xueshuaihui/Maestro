/**
 * WP-2 / AC-04、AC-05、AC-59：`status.md` 版式（需求附录 A-1）与工作区布局（M-1）。
 *
 * 断言逐行逐字，因为 `status.md` 是给人看的交接棒：字段顺序、中文状态词、段名
 * （`## 节点` / `## 交接包` / `## 升级` / `## 审批`）都不许漂移。
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getGraph } from '../../src/templates/index.js';
import { CORE_TEXT, renderStatusDoc, handoffInvalidDetail, yesNo } from '../../src/core/status-text.js';
import {
  WORKSPACE_INIT_FAILED,
  WORKSPACE_STATUS_WRITE_FAILED,
  prepareWorkspace,
  refreshStatusDoc,
  writeStatusDoc
} from '../../src/core/workspace.js';
import { instanceStatusPath, instanceWorkspaceDir } from '../../src/persistence/paths.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATUS_TEXT_SRC = path.resolve(HERE, '../../src/core/status-text.js');

const WS = '/abs/path/.orch/instances/INST-001/workspace';
const UPDATED = '2026-11-08T10:30:05.000Z';

const tempDirs = [];

async function makeRoot() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-wp11-status-'));
  tempDirs.push(dir);
  return dir;
}

after(async () => {
  for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
});

function runningState(overrides = {}) {
  return {
    instanceId: 'INST-001',
    state: 'running',
    paused: false,
    task: '实现 calc.js，产物：calc.js',
    updatedAt: UPDATED,
    nodes: [
      { nodeId: 'T-001', state: 'done', round: 1 },
      { nodeId: 'T-002', state: 'running', round: 1 }
    ],
    handoffs: [
      {
        handoffId: 'HO-001',
        state: 'accepted',
        edge: { from: 'T-001', to: 'T-002', kind: 'forward' },
        artifactRefs: { input: ['calc.js'], output: null, previous: null }
      }
    ],
    escalations: [],
    approvals: [],
    ...overrides
  };
}

test('编码闭环 status.md 逐行对齐 A-1', () => {
  const state = runningState({
    approvals: [{ approvalId: 'APR-001', state: 'pending', nodeId: 'T-001', action: 'write' }]
  });
  const text = renderStatusDoc(state, getGraph('code-loop'), { workspaceDir: WS });
  assert.equal(
    text,
    `# INST-001 编码闭环\n\n` +
      '- 状态：运行中\n' +
      '- 健康度：正常\n' +
      '- 暂停：否\n' +
      '- 任务：实现 calc.js，产物：calc.js\n' +
      '- 当前节点：T-002 测试\n' +
      `- 更新：${UPDATED}\n` +
      `- 工作区：${WS}\n\n` +
      '## 节点\n\n' +
      '- T-001 开发：已完成 · 第 1 轮\n' +
      '- T-002 测试：执行中 · 第 1 轮\n\n' +
      '## 交接包\n\n' +
      '- HO-001 开发→测试：已接受 · 输入 calc.js\n\n' +
      '## 升级\n\n' +
      '- 无\n\n' +
      '## 审批\n\n' +
      '- APR-001 待处理 · 节点 T-001 开发 · 动作 write\n'
  );
});

test('single 版式：无 ## 节点 段、无"当前节点"行、交接包只有引导包', () => {
  const state = {
    instanceId: 'INST-001',
    state: 'running',
    paused: false,
    task: '写下说明',
    updatedAt: '2026-11-08T10:31:00.000Z',
    nodes: [{ nodeId: 'T-001', state: 'running', round: 1 }],
    handoffs: [{ handoffId: 'HO-001', state: 'delivered', edge: null }],
    escalations: [],
    approvals: []
  };
  const text = renderStatusDoc(state, getGraph('single'), { workspaceDir: WS });
  assert.equal(
    text,
    `# INST-001 单节点\n\n` +
      '- 状态：运行中\n' +
      '- 健康度：正常\n' +
      '- 暂停：否\n' +
      '- 任务：写下说明\n' +
      `- 更新：2026-11-08T10:31:00.000Z\n` +
      `- 工作区：${WS}\n\n` +
      '## 交接包\n\n' +
      '- HO-001：已投递\n\n' +
      '## 升级\n\n' +
      '- 无\n\n' +
      '## 审批\n\n' +
      '- 无\n'
  );
  assert.equal(text.includes('## 节点'), false);
  assert.equal(text.includes('当前节点'), false);
  assert.equal(text.includes('开发→'), false);
});

test('暂停时 - 暂停：是', () => {
  const text = renderStatusDoc(
    runningState({ paused: true }),
    getGraph('code-loop'),
    { workspaceDir: WS }
  );
  assert.ok(text.includes('\n- 暂停：是\n'));
  assert.equal(yesNo(true), '是');
  assert.equal(yesNo(false), '否');
  assert.equal(CORE_TEXT.doc.paused, '暂停');
});

test('有升级 / 审批时按 A-1 的两行样例', () => {
  const text = renderStatusDoc(
    runningState({
      state: 'suspended',
      nodes: [
        { nodeId: 'T-001', state: 'done', round: 1 },
        { nodeId: 'T-002', state: 'escalated', round: 2 }
      ],
      escalations: [
        {
          escalationId: 'ESC-001',
          state: 'pending',
          nodeId: 'T-002',
          round: 2,
          reasonDetail: '回流超上限：测试已派发 2 次仍未通过'
        }
      ],
      approvals: [{ approvalId: 'APR-001', state: 'pending', nodeId: 'T-001', action: 'write' }]
    }),
    getGraph('code-loop'),
    { workspaceDir: WS }
  );
  assert.ok(
    text.includes('\n- ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮 · 回流超上限：测试已派发 2 次仍未通过\n')
  );
  assert.ok(text.includes('\n- APR-001 待处理 · 节点 T-001 开发 · 动作 write\n'));
  assert.equal(text.includes('- 无'), false);
  assert.ok(text.includes('- 当前节点：T-002 测试\n'));
});

test('同一实例刷新两次：后一次整份覆盖（人工改过的行不留）', async () => {
  const root = await makeRoot();
  const graph = getGraph('code-loop');
  const state = { ...runningState(), instanceId: 'INST-001' };
  const file = instanceStatusPath(root, 'INST-001');

  const first = await writeStatusDoc({ root, state, graph });
  assert.equal(first.ok, true);
  assert.equal(first.path, file);

  // 模拟人工改过：加一行、改状态词。
  await fs.writeFile(file, '# 手写标题\n\n- 状态：我改过了\n', 'utf8');
  assert.ok((await fs.readFile(file, 'utf8')).includes('我改过了'));

  const second = await writeStatusDoc({ root, state, graph });
  assert.equal(second.ok, true);
  const text = await fs.readFile(file, 'utf8');
  assert.equal(text, renderStatusDoc(state, graph, { workspaceDir: instanceWorkspaceDir(root, 'INST-001') }));
  assert.equal(text.includes('我改过了'), false);
  assert.equal(text.includes('手写标题'), false);
  assert.ok(text.endsWith('\n'));
});

test('prepareWorkspace：所有实例建 shared + status.md，多节点按图建 stage', async () => {
  const root = await makeRoot();
  const graph = getGraph('code-loop');
  const result = await prepareWorkspace({ root, instanceId: 'INST-001', graph });
  assert.equal(result.ok, true);
  assert.equal(result.workspaceDir, instanceWorkspaceDir(root, 'INST-001'));
  assert.deepEqual(
    result.stageDirs,
    [path.join(instanceWorkspaceDir(root, 'INST-001'), 'stage', 'T-001'), path.join(instanceWorkspaceDir(root, 'INST-001'), 'stage', 'T-002')]
  );

  const ws = instanceWorkspaceDir(root, 'INST-001');
  for (const dir of ['shared', 'stage/T-001', 'stage/T-002']) {
    const stat = await fs.stat(path.join(ws, dir));
    assert.equal(stat.isDirectory(), true, dir);
  }
  const status = await fs.readFile(instanceStatusPath(root, 'INST-001'), 'utf8');
  assert.equal(status, '# INST-001 编码闭环\n');
  // 编码闭环不预建产物区（A-1）。
  await assert.rejects(fs.stat(path.join(ws, 'artifacts')), (err) => err.code === 'ENOENT');
});

test('prepareWorkspace：single 不建 stage，doc-single 预建 artifacts/{docs,reports}', async () => {
  const singleRoot = await makeRoot();
  const single = await prepareWorkspace({ root: singleRoot, instanceId: 'INST-002', graph: getGraph('single') });
  assert.equal(single.ok, true);
  assert.deepEqual(single.stageDirs, []);
  await assert.rejects(
    fs.stat(path.join(instanceWorkspaceDir(singleRoot, 'INST-002'), 'stage')),
    (err) => err.code === 'ENOENT'
  );
  assert.equal((await fs.stat(path.join(instanceWorkspaceDir(singleRoot, 'INST-002'), 'shared'))).isDirectory(), true);

  const docRoot = await makeRoot();
  const doc = await prepareWorkspace({ root: docRoot, instanceId: 'INST-003', graph: getGraph('task-loop') });
  assert.equal(doc.ok, true);
  assert.equal(doc.stageDirs.length, 3);
  for (const dir of ['artifacts/docs', 'artifacts/reports', 'stage/T-001', 'stage/T-002', 'stage/T-003']) {
    const stat = await fs.stat(path.join(instanceWorkspaceDir(docRoot, 'INST-003'), dir));
    assert.equal(stat.isDirectory(), true, dir);
  }
});

test('prepareWorkspace 幂等：重复调用不报错、不删已有内容', async () => {
  const root = await makeRoot();
  const graph = getGraph('code-loop');
  const first = await prepareWorkspace({ root, instanceId: 'INST-001', graph });
  assert.equal(first.ok, true);

  const note = path.join(instanceWorkspaceDir(root, 'INST-001'), 'shared', 'notes.md');
  await fs.writeFile(note, '人工笔记\n', 'utf8');
  const statusPath = instanceStatusPath(root, 'INST-001');
  await fs.writeFile(statusPath, '# 人工写的状态页\n', 'utf8');

  const second = await prepareWorkspace({ root, instanceId: 'INST-001', graph });
  assert.equal(second.ok, true);
  assert.deepEqual(second.stageDirs, first.stageDirs);
  assert.equal(await fs.readFile(note, 'utf8'), '人工笔记\n');
  // 没有新状态时不覆盖已有 status.md。
  assert.equal(await fs.readFile(statusPath, 'utf8'), '# 人工写的状态页\n');
});

test('prepareWorkspace 失败映射为 WORKSPACE_INIT_FAILED', async () => {
  const root = await makeRoot();
  const failing = {
    mkdir: async () => {
      const err = new Error('EACCES: permission denied');
      err.code = 'EACCES';
      throw err;
    },
    stat: async () => ({ isFile: () => true })
  };
  const result = await prepareWorkspace({ root, instanceId: 'INST-001', graph: getGraph('code-loop'), fs: failing });
  assert.equal(result.ok, false);
  assert.equal(result.code, WORKSPACE_INIT_FAILED);
  assert.equal(result.params.cause, 'EACCES: permission denied');
  assert.equal(typeof result.cause, 'string');
});

test('status.md 写失败：WORKSPACE_STATUS_WRITE_FAILED，refresh 只发事件不回滚', async () => {
  const root = await makeRoot();
  const state = runningState();

  const direct = await writeStatusDoc({
    root,
    state,
    graph: getGraph('code-loop'),
    fault: 'workspace_status_write:fail'
  });
  assert.equal(direct.ok, false);
  assert.equal(direct.code, WORKSPACE_STATUS_WRITE_FAILED);
  assert.equal(direct.params.path, instanceStatusPath(root, 'INST-001'));

  const events = [];
  const refreshed = await refreshStatusDoc({
    root,
    state,
    graph: getGraph('code-loop'),
    emit: async (event) => events.push(event),
    fault: 'workspace_status_write:fail'
  });
  assert.equal(refreshed.ok, false);
  assert.equal(events.length, 1);
  assert.equal(events[0].reason, 'workspace.status_write_failed');
  assert.equal(events[0].object, 'instance');
  assert.equal(events[0].objectId, 'INST-001');
  assert.equal(events[0].detail.path, instanceStatusPath(root, 'INST-001'));
});

test('handoffInvalidDetail：码机读、文案单源', () => {
  assert.equal(
    handoffInvalidDetail('HANDOFF_EVIDENCE_MISSING', { id: 'HO-002', ref: 'calc.js' }),
    '交接包 HO-002 内容不合规：缺少证据引用 calc.js'
  );
  assert.equal(
    handoffInvalidDetail('HANDOFF_FIELD_MISSING', { id: 'HO-002', field: 'toNodeId' }),
    '交接包 HO-002 内容不合规：缺少字段 toNodeId'
  );
  // 未知码不抛，仍带前缀。
  assert.ok(handoffInvalidDetail('HANDOFF_UNKNOWN', { id: 'HO-002' }).startsWith('交接包 HO-002 内容不合规：'));
});

test('status-text.js 不含模板名 / 角色名字面量（含注释）', async () => {
  const source = await fs.readFile(STATUS_TEXT_SRC, 'utf8');
  const forbidden = [
    'code-loop',
    'developer',
    'tester',
    'coordinator',
    'task-loop',
    'researcher',
    'writer',
    'reviewer',
    '研究员',
    '撰写者',
    '审核者'
  ];
  for (const word of forbidden) {
    assert.equal(source.includes(word), false, `status-text.js 命中 ${word}`);
  }
});
