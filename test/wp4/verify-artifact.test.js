import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  extractDeclaredArtifacts,
  extractProductLines,
  normalizeDeclaredPath,
  normalizeProductRef,
  verifyArtifacts,
  verifyProducts
} from '../../src/core/verify-artifact.js';
import { readVerdict } from '../../src/core/verdict.js';

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

/* -------------------- code-loop: fixed `产物：` branch -------------------- */

function write(cwd, rel, content) {
  const abs = path.join(cwd, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return abs;
}

function futureIso(ms = 60_000) {
  return new Date(Date.now() + ms).toISOString();
}

test('extractProductLines：全角「产物：」命中', () => {
  const result = extractProductLines('给 calc.js 补 div 函数\n产物：out/calc.js');
  assert.deepEqual(result, { ok: true, refs: ['out/calc.js'] });
});

test('extractProductLines：半角冒号视为未声明（PRODUCT_LINE_MISSING）', () => {
  assert.deepEqual(extractProductLines('给 calc.js 补 div\n产物:out/calc.js'), {
    ok: false,
    code: 'PRODUCT_LINE_MISSING'
  });
  assert.deepEqual(extractProductLines('随便聊聊'), {
    ok: false,
    code: 'PRODUCT_LINE_MISSING'
  });
});

test('extractProductLines：一行两个产物；./ 等价；反斜杠规范化', () => {
  assert.deepEqual(extractProductLines('产物：./calc.js out\\util.js').refs, [
    'calc.js',
    'out/util.js'
  ]);
  assert.deepEqual(extractProductLines('产物：calc.js').refs, ['calc.js']);
  assert.equal(normalizeProductRef('./calc.js'), 'calc.js');
  assert.equal(normalizeProductRef('out\\calc.js'), 'out/calc.js');
  assert.equal(normalizeProductRef('../calc.js'), null);
  assert.equal(normalizeProductRef('/etc/passwd'), null);
});

test('verifyProducts：声明产物存在且非空 → ok', async () => {
  const cwd = tmpDir();
  try {
    write(cwd, 'out/calc.js', 'export const div = (a, b) => a / b;\n');
    const result = await verifyProducts({
      cwd,
      products: ['./out/calc.js'],
      roundStartedAt: new Date(Date.now() - 60_000).toISOString()
    });
    assert.equal(result.ok, true);
    assert.equal(result.refs.length, 1);
    assert.equal(result.refs[0].ref, 'out/calc.js');
    assert.equal(result.refs[0].exists, true);
    assert.ok(result.refs[0].bytes > 0);
    assert.equal(typeof result.refs[0].mtime, 'string');
    assert.equal(typeof result.refs[0].verifiedAt, 'string');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('verifyProducts：缺失 / 为空 / 陈旧 三种失败文案逐字', async () => {
  const cwd = tmpDir();
  try {
    const missing = await verifyProducts({ cwd, products: ['out/calc.js'] });
    assert.equal(missing.ok, false);
    assert.equal(missing.code, 'MISSING');
    assert.equal(missing.ref, 'out/calc.js');
    assert.equal(missing.message, '未找到声明的产出 out/calc.js');

    write(cwd, 'out/calc.js', '');
    const empty = await verifyProducts({ cwd, products: ['out/calc.js'] });
    assert.equal(empty.code, 'EMPTY');
    assert.equal(empty.message, '产出为空 out/calc.js');

    write(cwd, 'out/calc.js', 'x');
    const stale = await verifyProducts({
      cwd,
      products: ['out/calc.js'],
      roundStartedAt: futureIso()
    });
    assert.equal(stale.code, 'STALE');
    assert.equal(stale.message, '产出不是本轮新写 out/calc.js');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

/* ------------------------------ readVerdict ------------------------------ */

test('readVerdict：合法判定 → ok', async () => {
  const cwd = tmpDir();
  try {
    write(cwd, 'out/verdict.json', '{"verdict":"pass","defects":[]}');
    const result = await readVerdict({ cwd });
    assert.equal(result.ok, true);
    assert.equal(result.verdict.result, 'pass');
    assert.equal(result.verdict.value, 'pass');
    assert.equal(result.verdict.defectCount, 0);
    assert.equal(result.verdict.verdictPath, 'out/verdict.json');
    assert.equal(typeof result.verdict.readAt, 'string');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('readVerdict ①：文件不存在 → VERDICT_MISSING', async () => {
  const cwd = tmpDir();
  try {
    const result = await readVerdict({ cwd });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'VERDICT_MISSING');
    assert.equal(result.reasonCode, 'verdict_missing');
    assert.equal(result.stage, 'missing');
    assert.equal(result.reasonDetail, '核对失败：未找到判定文件 out/verdict.json');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('readVerdict ②：不是本轮新写 → VERDICT_STALE', async () => {
  const cwd = tmpDir();
  try {
    write(cwd, 'out/verdict.json', '{"verdict":"pass","defects":[]}');
    const result = await readVerdict({ cwd, roundStartedAt: futureIso() });
    assert.equal(result.code, 'VERDICT_STALE');
    assert.equal(result.reasonCode, 'verdict_stale');
    assert.equal(result.stage, 'stale');
    assert.equal(result.reasonDetail, '核对失败：判定文件不是本轮新写 out/verdict.json');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('readVerdict ③：JSON 坏 → VERDICT_UNPARSABLE', async () => {
  const cwd = tmpDir();
  try {
    write(cwd, 'out/verdict.json', '{"verdict":"pass"');
    const result = await readVerdict({ cwd });
    assert.equal(result.code, 'VERDICT_UNPARSABLE');
    assert.equal(result.reasonCode, 'verdict_invalid');
    assert.equal(result.stage, 'unparsable');
    assert.equal(result.reasonDetail, '核对失败：判定文件不可解析');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('readVerdict ④：缺 result / 取值非法 → VERDICT_SCHEMA_INVALID', async () => {
  const cwd = tmpDir();
  try {
    write(cwd, 'out/verdict.json', '{"defects":[]}');
    const missingField = await readVerdict({ cwd });
    assert.equal(missingField.code, 'VERDICT_SCHEMA_INVALID');
    assert.equal(missingField.reasonCode, 'verdict_invalid');

    write(cwd, 'out/verdict.json', '{"verdict":"maybe","defects":[]}');
    const badValue = await readVerdict({ cwd });
    assert.equal(badValue.code, 'VERDICT_SCHEMA_INVALID');
    assert.equal(badValue.stage, 'schema');

    write(cwd, 'out/verdict.json', '{"verdict":"pass","defects":[{"summary":"x","evidence":"y"}]}');
    const passWithDefects = await readVerdict({ cwd });
    assert.equal(passWithDefects.code, 'VERDICT_SCHEMA_INVALID');
    assert.equal(passWithDefects.stage, 'pass_with_defects');
    assert.equal(passWithDefects.reasonDetail, '核对失败：判定为通过，但缺陷清单非空');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('readVerdict ⑤：fail 但缺陷清单为空 → VERDICT_NO_DEFECTS', async () => {
  const cwd = tmpDir();
  try {
    write(cwd, 'out/verdict.json', '{"verdict":"fail","defects":[]}');
    const result = await readVerdict({ cwd });
    assert.equal(result.code, 'VERDICT_NO_DEFECTS');
    assert.equal(result.reasonCode, 'verdict_invalid');
    assert.equal(result.stage, 'no_defects');
    assert.equal(result.reasonDetail, '核对失败：判定为不通过，但没有缺陷清单');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('readVerdict ⑥：证据打不开 → VERDICT_EVIDENCE_UNREADABLE', async () => {
  const cwd = tmpDir();
  try {
    write(
      cwd,
      'out/verdict.json',
      '{"verdict":"fail","defects":[{"summary":"未处理除零","evidence":"out/missing-log.txt"}]}'
    );
    const result = await readVerdict({ cwd });
    assert.equal(result.code, 'VERDICT_EVIDENCE_UNREADABLE');
    assert.equal(result.reasonCode, 'verdict_invalid');
    assert.equal(result.stage, 'evidence_unreadable');
    assert.equal(result.reasonDetail, '核对失败：缺陷证据不可解析');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('readVerdict：fail + 缺陷 + 可读证据 → ok 并带证据绝对路径', async () => {
  const cwd = tmpDir();
  try {
    write(cwd, 'out/test-log.txt', 'AssertionError: div(1,0)\n');
    write(
      cwd,
      'out/verdict.json',
      '{"verdict":"fail","defects":[{"summary":"除零未处理","evidence":"out/test-log.txt"}]}'
    );
    const result = await readVerdict({ cwd });
    assert.equal(result.ok, true);
    assert.equal(result.verdict.result, 'fail');
    assert.equal(result.verdict.defectCount, 1);
    assert.equal(result.verdict.defects[0].summary, '除零未处理');
    assert.equal(result.verdict.defects[0].evidence, 'out/test-log.txt');
    assert.equal(result.verdict.defects[0].absPath, path.join(cwd, 'out', 'test-log.txt'));
    assert.ok(result.verdict.defects[0].bytes > 0);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
