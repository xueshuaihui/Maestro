/**
 * WP-2: `doc-artifact` unit tests (requirement D-8).
 *
 * Covers the five product-name rules, the verbatim echo of a rejected name (AC-23), the
 * one and only versioned reference builder, the per-policy product resolution, the
 * previous-version integrity check and the streaming sha256.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  DOCS_DIR,
  REPORTS_DIR,
  RESEARCH_REF,
  artifactMessage,
  docRef,
  nodeProducts,
  parseProductDeclaration,
  resolveNodeProducts,
  sha256Of,
  verifyPrevious
} from '../../src/core/doc-artifact.js';

function tmpDir(prefix = 'maestro-wp10-artifact-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

test('常量：目录与固定研究笔记引用', () => {
  assert.equal(DOCS_DIR, 'artifacts/docs');
  assert.equal(REPORTS_DIR, 'artifacts/reports');
  assert.equal(RESEARCH_REF, 'artifacts/reports/research-notes.v1.md');
  assert.equal(artifactMessage('missing', 'a/b.md'), '未找到声明的产出 a/b.md');
  assert.equal(artifactMessage('previousModified', 'a/b.md'), '上一版文档被改写 a/b.md');
});

test('产物声明：合法文件名 → name / stem', () => {
  assert.deepEqual(parseProductDeclaration('写一篇发布说明。产物：release-notes.md'), {
    ok: true,
    name: 'release-notes.md',
    stem: 'release-notes'
  });
  // 多行任务里恰好一行声明也可
  assert.deepEqual(parseProductDeclaration('第一行\n产物：notes.md\n第三行'), {
    ok: true,
    name: 'notes.md',
    stem: 'notes'
  });
  // 行尾空格被裁掉，尖括号与中文名不影响
  assert.deepEqual(parseProductDeclaration('产物： 发布说明.md  '), {
    ok: true,
    name: '发布说明.md',
    stem: '发布说明'
  });
});

test('产物声明：缺行 / 半角冒号 / 两行 → PRODUCT_LINE_MISSING_TASK_LOOP', () => {
  const cases = [
    '写一篇发布说明，但没有产物行',
    '写一篇发布说明。产物: release-notes.md', // 半角冒号等于没写（AC-22 第三条）
    '产物：a.md\n产物：b.md', // 恰好一行才成立
    '',
    null,
    undefined
  ];
  for (const task of cases) {
    const parsed = parseProductDeclaration(task);
    assert.equal(parsed.ok, false, `应判缺行: ${JSON.stringify(task)}`);
    assert.equal(parsed.code, 'PRODUCT_LINE_MISSING_TASK_LOOP');
  }
});

test('产物声明：AC-23 的五个非法名逐个逐字回显', () => {
  const names = [
    'docs/release-notes.md',
    '../release-notes.md',
    'C:\\release-notes.md',
    'release-notes.txt',
    'release-notes.v1.md'
  ];
  for (const name of names) {
    const parsed = parseProductDeclaration(`写发布说明。产物：${name}`);
    assert.equal(parsed.ok, false, `应判非法: ${name}`);
    assert.equal(parsed.code, 'PRODUCT_INVALID_TASK_LOOP', `码不对: ${name}`);
    assert.equal(parsed.name, name, `回显必须逐字等于用户写的 ${name}`);
  }
});

test('产物声明：空名 / 控制字符 / 只有 .md / 大写 .MD 边界', () => {
  assert.deepEqual(parseProductDeclaration('产物：   '), {
    ok: false,
    code: 'PRODUCT_INVALID_TASK_LOOP',
    name: ''
  });
  assert.equal(parseProductDeclaration('产物：a\u0000b.md').code, 'PRODUCT_INVALID_TASK_LOOP');
  assert.equal(parseProductDeclaration('产物：.md').code, 'PRODUCT_INVALID_TASK_LOOP');
  // 大小写敏感：只有小写 `.md` 结尾被接受（与「.md 结尾」逐字一致）
  assert.equal(parseProductDeclaration('产物：notes.MD').code, 'PRODUCT_INVALID_TASK_LOOP');
  // `.v1` 只能在末尾才算自带版本号
  assert.equal(parseProductDeclaration('产物：v1-notes.md').ok, true);
});

test('版本引用：唯一拼接点', () => {
  assert.equal(docRef({ stem: 'release-notes', round: 1 }), 'artifacts/docs/release-notes.v1.md');
  assert.equal(docRef({ stem: 'release-notes', round: 2 }), 'artifacts/docs/release-notes.v2.md');
  assert.equal(
    docRef({ artifactDir: 'artifacts/reports', artifactExt: '.txt', stem: 'notes', round: 3 }),
    'artifacts/reports/notes.v3.txt'
  );
  assert.equal(nodeProducts({ stem: 'x', round: 1 }), 'artifacts/docs/x.v1.md');
  assert.equal(docRef({ stem: '', round: 1 }), null);
  assert.equal(docRef({ stem: 'x', round: 0 }), null);
  assert.equal(docRef({ stem: 'x', round: 1.5 }), null);
});

test('resolveNodeProducts：fixed-workspace 原样取图节点产物', () => {
  const def = { artifactPolicy: 'fixed-workspace', products: [RESEARCH_REF] };
  const result = resolveNodeProducts(def, { workspaceDir: 'D:/w', productPolicy: 'doc-single' });
  assert.equal(result.ok, true);
  assert.equal(result.policy, 'fixed-workspace');
  assert.equal(result.baseDir, 'D:/w');
  assert.deepEqual(result.products, [RESEARCH_REF]);
  // 缺工作区直接失败，不静默退成 cwd
  assert.equal(resolveNodeProducts(def, {}).code, 'WORKSPACE_MISSING');
});

test('resolveNodeProducts：versioned-doc 按轮次算 v<n>', () => {
  const def = { artifactPolicy: 'versioned-doc', artifactDir: DOCS_DIR, artifactExt: '.md' };
  const first = resolveNodeProducts(def, {
    node: { round: 1 },
    state: { artifactStem: 'release-notes' },
    workspaceDir: 'D:/w',
    productPolicy: 'doc-single'
  });
  assert.deepEqual(first.products, ['artifacts/docs/release-notes.v1.md']);
  const second = resolveNodeProducts(def, {
    node: { round: 2 },
    state: { artifactStem: 'release-notes' },
    workspaceDir: 'D:/w',
    productPolicy: 'doc-single'
  });
  assert.deepEqual(second.products, ['artifacts/docs/release-notes.v2.md']);
  // 缺 stem / 轮次为 0
  assert.equal(
    resolveNodeProducts(def, { node: { round: 1 }, state: {}, workspaceDir: 'D:/w' }).code,
    'ARTIFACT_STEM_MISSING'
  );
  assert.equal(
    resolveNodeProducts(def, {
      node: { round: 0 },
      state: { artifactStem: 'x' },
      workspaceDir: 'D:/w'
    }).code,
    'ROUND_INVALID'
  );
});

test('resolveNodeProducts：review 节点不解析产物', () => {
  const result = resolveNodeProducts(
    { artifactPolicy: 'review', reviewPath: 'out/review.json' },
    { node: { round: 1 }, workspaceDir: 'D:/w', productPolicy: 'doc-single' }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'NO_PRODUCTS');
  assert.equal(result.detail, 'out/review.json');
});

test('resolveNodeProducts：doc-single 下 declared 不回退任务行', () => {
  const def = { artifactPolicy: 'declared', products: [] };
  const state = { task: '写发布说明。产物：release-notes.md', artifactStem: 'release-notes' };
  // doc-single：禁止回退到任务里的裸文件名（风险 R3）
  const blocked = resolveNodeProducts(def, { node: { round: 1 }, state, cwd: 'D:/cwd', productPolicy: 'doc-single' });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'NO_PRODUCTS');
  // declared 图（code-loop）行为不变
  const declared = resolveNodeProducts(def, { node: { round: 1 }, state, cwd: 'D:/cwd' });
  assert.equal(declared.ok, true);
  assert.deepEqual(declared.products, []);
  assert.equal(declared.policy, 'heuristic');
  // 显式声明的产物优先
  const explicit = resolveNodeProducts(
    { artifactPolicy: 'declared', products: ['out/a.js'] },
    { cwd: 'D:/cwd' }
  );
  assert.deepEqual(explicit.products, ['out/a.js']);
  assert.equal(explicit.policy, 'declared');
});

test('sha256Of：与一次性哈希一致、缺文件返回 READ_FAILED', async () => {
  const dir = tmpDir();
  try {
    const abs = writeFile(path.join(dir, 'a.md'), '# 标题\n正文\n');
    const expected = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
    const result = await sha256Of(abs);
    assert.equal(result.ok, true);
    assert.equal(result.sha256, expected);
    assert.equal(result.bytes, fs.statSync(abs).size);

    const missing = await sha256Of(path.join(dir, 'nope.md'));
    assert.deepEqual(missing, { ok: false, code: 'READ_FAILED' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('verifyPrevious：存在且指纹一致 → ok', async () => {
  const dir = tmpDir();
  try {
    const abs = writeFile(path.join(dir, 'artifacts/docs/n.v1.md'), 'v1\n');
    const digest = (await sha256Of(abs)).sha256;
    const result = await verifyPrevious({ baseDir: dir, ref: 'artifacts/docs/n.v1.md', sha256: digest });
    assert.deepEqual(result, { ok: true });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('verifyPrevious：被删除 / 被改写分别报两种原因', async () => {
  const dir = tmpDir();
  try {
    const missing = await verifyPrevious({ baseDir: dir, ref: 'artifacts/docs/n.v1.md', sha256: 'abc' });
    assert.deepEqual(missing, {
      ok: false,
      code: 'artifact_previous_missing',
      ref: 'artifacts/docs/n.v1.md'
    });

    const abs = writeFile(path.join(dir, 'artifacts/docs/n.v1.md'), 'v1\n');
    const digest = (await sha256Of(abs)).sha256;
    fs.appendFileSync(abs, '- 改动（夹具注入）\n', 'utf8');
    const modified = await verifyPrevious({ baseDir: dir, ref: 'artifacts/docs/n.v1.md', sha256: digest });
    assert.deepEqual(modified, {
      ok: false,
      code: 'artifact_previous_modified',
      ref: 'artifacts/docs/n.v1.md'
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('NFR-06：工作区三个路径由 paths.js 唯一计算', async () => {
  const paths = await import('../../src/persistence/paths.js');
  const root = path.join('D:', 'proj');
  const expected = path.join(root, '.orch', 'instances', 'INST-001', 'workspace');
  assert.equal(paths.instanceWorkspaceDir(root, 'INST-001'), expected);
  assert.equal(paths.instanceDocsDir(root, 'INST-001'), path.join(expected, 'artifacts', 'docs'));
  assert.equal(paths.instanceReportsDir(root, 'INST-001'), path.join(expected, 'artifacts', 'reports'));
  // 与相对引用的目录名保持一致（否则提示词里的写入路径与核对根会错位）
  assert.equal(paths.instanceDocsDir(root, 'INST-001').endsWith(path.join(...DOCS_DIR.split('/'))), true);
  assert.equal(paths.instanceReportsDir(root, 'INST-001').endsWith(path.join(...REPORTS_DIR.split('/'))), true);
});
