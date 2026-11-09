/**
 * WP-3 / D-3 / C-07: 交接包校验顺序、8 个失败码、证据解析基准。
 *
 * 断言一律锁定具体码，不用「返回 falsy」草草了事。真实文件系统用例落在
 * 临时目录，不碰任何产品代码与夹具；注入 fs 的用例完全不写盘。
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  CODES,
  validateHandoff,
  validateHandoffFields,
  validateHandoffEvidence,
  evidenceRefsOf,
  resolveEvidenceRef,
  stripLineSuffix
} from '../../src/core/handoff-schema.js';
import { handoffInvalidDetail } from '../../src/core/status-text.js';

const tempDirs = [];

async function makeDirs() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-wp11-schema-'));
  const ws = path.join(base, 'workspace');
  const task = path.join(base, 'task');
  await fs.mkdir(ws, { recursive: true });
  await fs.mkdir(task, { recursive: true });
  tempDirs.push(base);
  return { base, ws, task };
}

async function put(dir, name, content = 'hello') {
  const target = path.join(dir, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
  return target;
}

function baseHandoff(overrides = {}) {
  return {
    handoffId: 'HO-002',
    instanceId: 'INST-001',
    round: 1,
    fromNodeId: 'T-001',
    toNodeId: 'T-002',
    edge: { from: 'T-001', to: 'T-002', kind: 'forward' },
    createdAt: '2026-11-08T10:30:02.000Z',
    artifactRefs: { input: ['calc.js'], output: null, previous: null },
    ...overrides
  };
}

function backflowHandoff(overrides = {}) {
  return baseHandoff({
    edge: { from: 'T-002', to: 'T-001', kind: 'backflow' },
    fromNodeId: 'T-002',
    toNodeId: 'T-001',
    round: 2,
    artifactRefs: { input: [], output: null, previous: null },
    defects: [{ summary: 'missing boundary', evidence: 'calc.js#L12-L20' }],
    revisionRequirement: 'fix boundary',
    retestRequirement: null,
    ...overrides
  });
}

async function validFixture(overrides = {}) {
  const { base, ws, task } = await makeDirs();
  await put(task, 'calc.js', 'export const x = 1;\n');
  const opts = {
    workspaceDir: ws,
    cwd: task,
    sourceNode: { artifactPolicy: 'declared' },
    graph: null
  };
  return { base, ws, task, opts, handoff: baseHandoff(overrides) };
}

after(async () => {
  for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
});

// ---- 正向 / 跳过 ----------------------------------------------------------

test('合法 forward 包通过校验（ok:true）', async () => {
  const { opts, handoff } = await validFixture();
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, true);
});

test('edge === null 直接跳过校验（single 引导包）', async () => {
  const { opts, handoff } = await validFixture({ edge: null, artifactRefs: { input: [] } });
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
});

// ---- 8 个失败码逐一 ------------------------------------------------------

test('HANDOFF_FIELD_MISSING：缺 toNodeId', async () => {
  const { opts, handoff } = await validFixture();
  delete handoff.toNodeId;
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, false);
  assert.equal(result.code, CODES.HANDOFF_FIELD_MISSING);
  assert.equal(result.params.field, 'toNodeId');
});

test('HANDOFF_EDGE_INVALID：edge.kind 非法', async () => {
  const { opts, handoff } = await validFixture();
  handoff.edge.kind = 'sideways';
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, false);
  assert.equal(result.code, CODES.HANDOFF_EDGE_INVALID);
});

test('HANDOFF_EDGE_INVALID：fromNodeId 与 edge.from 不一致', async () => {
  const { opts, handoff } = await validFixture();
  handoff.fromNodeId = 'T-009';
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.code, CODES.HANDOFF_EDGE_INVALID);
});

test('HANDOFF_EVIDENCE_MISSING：证据集合为空', async () => {
  const { opts, handoff } = await validFixture();
  handoff.artifactRefs.input = [];
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, false);
  assert.equal(result.code, CODES.HANDOFF_EVIDENCE_MISSING);
  assert.equal(result.params.field, 'evidence');
  assert.ok(result.detail.includes('缺少证据引用'));
});

test('HANDOFF_EVIDENCE_UNREADABLE：证据文件不存在', async () => {
  const { opts, handoff, task } = await validFixture();
  await fs.rm(path.join(task, 'calc.js'));
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, false);
  assert.equal(result.code, CODES.HANDOFF_EVIDENCE_UNREADABLE);
});

test('HANDOFF_EVIDENCE_EMPTY：0 字节证据', async () => {
  const { opts, handoff, task } = await validFixture();
  await fs.writeFile(path.join(task, 'calc.js'), '');
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, false);
  assert.equal(result.code, CODES.HANDOFF_EVIDENCE_EMPTY);
});

test('HANDOFF_EVIDENCE_UNREADABLE：目录当证据（非普通文件）', async () => {
  const { opts, handoff, task } = await validFixture();
  await fs.mkdir(path.join(task, 'a-dir'), { recursive: true });
  handoff.artifactRefs.input = ['a-dir'];
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, false);
  assert.equal(result.code, CODES.HANDOFF_EVIDENCE_UNREADABLE);
});

test('HANDOFF_EVIDENCE_ESCAPE：../ 越界（外部文件真实存在仍拒绝）', async () => {
  const { opts, handoff, base } = await validFixture();
  await put(base, 'secret.txt', 'top secret');
  handoff.artifactRefs.input = ['../secret.txt'];
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, false);
  assert.equal(result.code, CODES.HANDOFF_EVIDENCE_ESCAPE);
});

test('HANDOFF_EVIDENCE_ESCAPE：绝对路径逃逸', async () => {
  const { opts, handoff, base } = await validFixture();
  const outside = await put(base, 'outside.js', 'x');
  handoff.artifactRefs.input = [outside];
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, false);
  assert.equal(result.code, CODES.HANDOFF_EVIDENCE_ESCAPE);
});

test('HANDOFF_EVIDENCE_ESCAPE：符号链接绕过', async () => {
  const { opts, handoff, base, task } = await validFixture();
  const outside = await put(base, 'outside-real.js', 'secret');
  await fs.symlink(outside, path.join(task, 'link.js'));
  handoff.artifactRefs.input = ['link.js'];
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, false);
  assert.equal(result.code, CODES.HANDOFF_EVIDENCE_ESCAPE);
});

test('HANDOFF_HASH_MISMATCH：previous.sha256 与文件不符', async () => {
  const { opts, handoff, task } = await validFixture();
  await put(task, 'prev.md', 'version 1');
  handoff.artifactRefs.input = [];
  handoff.artifactRefs.previous = { ref: 'prev.md', sha256: 'deadbeef' };
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, false);
  assert.equal(result.code, CODES.HANDOFF_HASH_MISMATCH);
});

test('HANDOFF_BACKFLOW_INCOMPLETE：回流 defects 为空（证据集合非空才走到第 6 步）', async () => {
  const { opts } = await validFixture();
  const handoff = backflowHandoff({ defects: [] });
  handoff.artifactRefs.input = ['calc.js'];
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, false);
  assert.equal(result.code, CODES.HANDOFF_BACKFLOW_INCOMPLETE);
});

test('HANDOFF_BACKFLOW_INCOMPLETE：修改/复测要求皆空', async () => {
  const { opts } = await validFixture();
  const result = await validateHandoff(
    backflowHandoff({ revisionRequirement: null, retestRequirement: null }),
    opts
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, CODES.HANDOFF_BACKFLOW_INCOMPLETE);
});

// ---- 校验顺序 ------------------------------------------------------------

test('顺序：缺字段 + 缺证据 -> 先报 HANDOFF_FIELD_MISSING', async () => {
  const { opts, handoff } = await validFixture();
  delete handoff.instanceId;
  handoff.artifactRefs.input = [];
  const fields = validateHandoffFields(handoff, opts);
  assert.equal(fields.code, CODES.HANDOFF_FIELD_MISSING);
  assert.equal(fields.params.field, 'instanceId');
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.code, CODES.HANDOFF_FIELD_MISSING);
});

test('顺序：边非法 + 缺证据 -> 先报 HANDOFF_EDGE_INVALID', async () => {
  const { opts, handoff } = await validFixture();
  handoff.edge.kind = 'sideways';
  handoff.artifactRefs.input = [];
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.code, CODES.HANDOFF_EDGE_INVALID);
});

test('顺序：证据越界 + 回流不完整 -> 先报证据越界', async () => {
  const { opts, base } = await validFixture();
  await put(base, 'secret.txt', 'x');
  const handoff = backflowHandoff({ defects: [] });
  handoff.artifactRefs.input = ['../secret.txt'];
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.code, CODES.HANDOFF_EVIDENCE_ESCAPE);
});

test('顺序：回流 defects 空且无证据 -> 先报 HANDOFF_EVIDENCE_MISSING', async () => {
  const { opts } = await validFixture();
  const result = await validateHandoff(backflowHandoff({ defects: [] }), opts);
  assert.equal(result.code, CODES.HANDOFF_EVIDENCE_MISSING);
});

// ---- C-07 解析规则 -------------------------------------------------------

test('stripLineSuffix 剥离 #L<n> 与 #L<n>-L<m>', () => {
  assert.equal(stripLineSuffix('a.md#L12'), 'a.md');
  assert.equal(stripLineSuffix('a.md#L12-L20'), 'a.md');
  assert.equal(stripLineSuffix('a.md'), 'a.md');
  assert.equal(stripLineSuffix('a.md#L5-L9'), 'a.md');
});

test('缺陷证据 #L12-L20 先剥离再解析 -> 合法回流包通过', async () => {
  const { opts } = await validFixture();
  const result = await validateHandoff(backflowHandoff(), opts);
  assert.equal(result.ok, true);
});

test('input 引用不剥离 #L 后缀（找不到带后缀文件 -> UNREADABLE）', async () => {
  const { opts, handoff } = await validFixture();
  handoff.artifactRefs.input = ['calc.js#L5'];
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.code, CODES.HANDOFF_EVIDENCE_UNREADABLE);
});

test('previous.ref 不剥离 #L 后缀', async () => {
  const { opts, handoff, task } = await validFixture();
  await put(task, 'prev.md', 'version 1');
  handoff.artifactRefs.input = [];
  handoff.artifactRefs.previous = { ref: 'prev.md#L3' };
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.code, CODES.HANDOFF_EVIDENCE_UNREADABLE);
});

test('previous.sha256 一致 -> 通过', async () => {
  const { opts, handoff, task } = await validFixture();
  const content = 'version 1';
  await put(task, 'prev.md', content);
  const digest = crypto.createHash('sha256').update(content).digest('hex');
  handoff.artifactRefs.input = [];
  handoff.artifactRefs.previous = { ref: 'prev.md', sha256: digest };
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, true);
});

test('previous.sha256 缺省 -> 跳过哈希校验，通过', async () => {
  const { opts, handoff, task } = await validFixture();
  await put(task, 'prev.md', 'version 1');
  handoff.artifactRefs.input = [];
  handoff.artifactRefs.previous = { ref: 'prev.md' };
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, true);
});

test('artifacts/ 前缀按工作区相对解析', async () => {
  const { opts, handoff, ws } = await validFixture();
  await put(ws, 'artifacts/docs/x.md', 'doc');
  handoff.artifactRefs.input = ['artifacts/docs/x.md'];
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, true);
});

test('工作区内的绝对路径 -> 通过', async () => {
  const { opts, handoff, ws } = await validFixture();
  const inside = await put(ws, 'inside.js', 'x');
  handoff.artifactRefs.input = [inside];
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, true);
});

test('基准分支 A：versioned-doc 来源节点 -> 工作区基准', async () => {
  const { ws, task, handoff } = await validFixture();
  await put(ws, 'only-in-ws.md', 'in workspace');
  const opts = {
    workspaceDir: ws,
    cwd: task,
    sourceNode: { artifactPolicy: 'versioned-doc' },
    graph: null
  };
  handoff.artifactRefs.input = ['only-in-ws.md'];
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, true);
});

test('基准分支 B：declared 来源节点 -> 任务目录基准（同名文件只在 ws -> UNREADABLE）', async () => {
  const { ws, task, handoff } = await validFixture();
  await put(ws, 'only-in-ws.md', 'in workspace');
  const opts = {
    workspaceDir: ws,
    cwd: task,
    sourceNode: { artifactPolicy: 'declared' },
    graph: null
  };
  handoff.artifactRefs.input = ['only-in-ws.md'];
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.code, CODES.HANDOFF_EVIDENCE_UNREADABLE);
});

test('基准按 graph 节点的 artifactPolicy 选（sourceNode 为 nodeId，不按模板名/角色名）', async () => {
  const { ws, task, handoff } = await validFixture();
  await put(ws, 'notes.md', 'x');
  const graph = {
    nodes: [
      { id: 'T-001', artifactPolicy: 'fixed-workspace', title: 'N1' },
      { id: 'T-002', artifactPolicy: 'declared', title: 'N2' }
    ]
  };
  handoff.artifactRefs.input = ['notes.md'];
  const optsA = { workspaceDir: ws, cwd: task, sourceNode: 'T-001', graph };
  assert.equal((await validateHandoff(handoff, optsA)).ok, true);
  const optsB = { workspaceDir: ws, cwd: task, sourceNode: 'T-002', graph };
  assert.equal(
    (await validateHandoff(handoff, optsB)).code,
    CODES.HANDOFF_EVIDENCE_UNREADABLE
  );
});

// ---- 纯函数 / 注入 IO / 文案单源 -----------------------------------------

test('resolveEvidenceRef 纯路径判定（越界 / artifacts / policy）', () => {
  const ws = '/ws';
  const task = '/task';
  assert.equal(resolveEvidenceRef('../x', { workspaceDir: ws, cwd: task }).ok, false);
  assert.equal(resolveEvidenceRef('/etc/passwd', { workspaceDir: ws, cwd: task }).ok, false);
  assert.equal(
    resolveEvidenceRef('artifacts/a.md', { workspaceDir: ws, cwd: task }).path,
    path.join(ws, 'artifacts/a.md')
  );
  assert.equal(
    resolveEvidenceRef('a.md', { workspaceDir: ws, cwd: task }).path,
    path.join(task, 'a.md')
  );
  assert.equal(
    resolveEvidenceRef('a.md', {
      workspaceDir: ws,
      cwd: task,
      sourceNode: { artifactPolicy: 'versioned-doc' }
    }).path,
    path.join(ws, 'a.md')
  );
});

test('evidenceRefsOf 提取 input / previous / defect 且不剥离后缀', () => {
  const handoff = baseHandoff({
    artifactRefs: { input: ['a.js'], output: null, previous: { ref: 'b.js', sha256: 'x' } },
    defects: [{ summary: 's', evidence: 'c.js#L3-L9' }]
  });
  const refs = evidenceRefsOf(handoff);
  assert.deepEqual(
    refs.map((r) => [r.source, r.ref]),
    [['input', 'a.js'], ['previous', 'b.js'], ['defect', 'c.js#L3-L9']]
  );
  assert.equal(refs[1].sha256, 'x');
});

test('可注入 fs：stat 结果决定通过，且不产生任何写', async () => {
  const calls = [];
  const injectedFs = {
    stat: async (p) => {
      calls.push(p);
      return { isFile: () => true, size: 10 };
    },
    realpath: async (p) => p,
    readFile: async () => Buffer.from('x')
  };
  const opts = { workspaceDir: '/ws', cwd: '/task', fs: injectedFs };
  const result = await validateHandoffEvidence(baseHandoff(), opts);
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], path.join('/task', 'calc.js'));
});

test('失败返回含机读码 + 可展示 detail（复用 handoffInvalidDetail）', async () => {
  const { opts, handoff } = await validFixture();
  delete handoff.toNodeId;
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.detail, '交接包 HO-002 内容不合规：缺少字段 toNodeId');
  assert.ok(result.detail.includes('内容不合规'));
});

// ---- 字面量锚定失败码值（与实现常量解耦，防拼写错误 / 两码同值） --------

test('字面量锚定：顺序首码 HANDOFF_FIELD_MISSING 的码值', async () => {
  const { opts, handoff } = await validFixture();
  delete handoff.toNodeId;
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HANDOFF_FIELD_MISSING');
});

test('字面量锚定：证据首码 HANDOFF_EVIDENCE_MISSING 的码值', async () => {
  const { opts, handoff } = await validFixture();
  handoff.artifactRefs.input = [];
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HANDOFF_EVIDENCE_MISSING');
});

test('字面量锚定：哈希码 HANDOFF_HASH_MISMATCH 的码值', async () => {
  const { opts, handoff, task } = await validFixture();
  await put(task, 'prev.md', 'version 1');
  handoff.artifactRefs.input = [];
  handoff.artifactRefs.previous = { ref: 'prev.md', sha256: 'deadbeef' };
  const result = await validateHandoff(handoff, opts);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HANDOFF_HASH_MISMATCH');
});
