import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  extractDeclaredArtifacts,
  normalizeDeclaredPath,
  verifyArtifacts,
} from '../../src/core/verify-artifact.js';

function tmpDir(prefix = 'maestro-wp4-verify-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('extractDeclaredArtifacts：中文引导词后的相对路径', () => {
  assert.deepEqual(
    extractDeclaredArtifacts('写一段 200 字的产品说明，保存到 out/intro.md'),
    ['out/intro.md'],
  );
});

test('extractDeclaredArtifacts：一条任务里两个产出（带目录 + 裸扩展名）', () => {
  assert.deepEqual(
    extractDeclaredArtifacts('把结果写入 reports/summary.md 和 notes.txt'),
    ['reports/summary.md', 'notes.txt'],
  );
});

test('extractDeclaredArtifacts：没有产出路径时返回空', () => {
  assert.deepEqual(extractDeclaredArtifacts('随便聊聊'), []);
});

test('extractDeclaredArtifacts：绝对路径与 .. 越界一律拒绝', () => {
  assert.deepEqual(extractDeclaredArtifacts('保存到 ../../etc/passwd'), []);
  assert.deepEqual(extractDeclaredArtifacts('保存到 /etc/passwd'), []);
  assert.deepEqual(extractDeclaredArtifacts('保存到 C:\\Windows\\win.ini'), []);
  assert.equal(normalizeDeclaredPath('200'), null);
  assert.equal(normalizeDeclaredPath('v1.2'), null);
});

test('verifyArtifacts：文件存在且非空 → ok', async () => {
  const cwd = tmpDir();
  try {
    fs.mkdirSync(path.join(cwd, 'out'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'out', 'intro.md'), '# intro\n', 'utf8');
    const result = await verifyArtifacts({ cwd, declared: ['out/intro.md'] });
    assert.equal(result.ok, true);
    assert.equal(result.refs.length, 1);
    assert.equal(result.refs[0].declared, true);
    assert.equal(result.refs[0].exists, true);
    assert.ok(result.refs[0].bytes > 0);
    assert.equal(result.refs[0].sha256, null);
    assert.equal(result.failure, undefined);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('verifyArtifacts：缺文件 → MISSING 且文案逐字一致', async () => {
  const cwd = tmpDir();
  try {
    const result = await verifyArtifacts({ cwd, declared: ['out/intro.md'] });
    assert.equal(result.ok, false);
    assert.equal(result.failure.code, 'MISSING');
    assert.equal(result.failure.ref, 'out/intro.md');
    assert.equal(result.failure.message, '未找到声明的产出 out/intro.md');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('verifyArtifacts：空文件 → EMPTY', async () => {
  const cwd = tmpDir();
  try {
    fs.mkdirSync(path.join(cwd, 'out'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'out', 'intro.md'), '', 'utf8');
    const result = await verifyArtifacts({ cwd, declared: ['out/intro.md'] });
    assert.equal(result.ok, false);
    assert.equal(result.failure.code, 'EMPTY');
    assert.equal(result.failure.ref, 'out/intro.md');
    assert.ok(result.failure.message.includes('out/intro.md'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('verifyArtifacts：未声明 → NO_DECLARATION 且 ok', async () => {
  const cwd = tmpDir();
  try {
    const result = await verifyArtifacts({ cwd, declared: [] });
    assert.equal(result.ok, true);
    assert.equal(result.note, 'NO_DECLARATION');
    assert.deepEqual(result.refs, []);
    assert.equal(result.failure, undefined);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('verifyArtifacts：observedRefs 只入列不参与判定', async () => {
  const cwd = tmpDir();
  try {
    const observed = path.join(cwd, 'out', 'intro.md');
    fs.mkdirSync(path.dirname(observed), { recursive: true });
    fs.writeFileSync(observed, 'x', 'utf8');
    const result = await verifyArtifacts({ cwd, declared: [], observedRefs: [observed] });
    assert.equal(result.ok, true);
    assert.equal(result.note, 'NO_DECLARATION');
    assert.equal(result.refs[0].declared, false);
    assert.equal(result.refs[0].ref, 'out/intro.md');
    assert.equal(result.refs[0].exists, true);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
