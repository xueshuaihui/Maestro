import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { copyToBackup, writeJsonAtomic, writeTextAtomic } from '../../src/persistence/atomic-write.js';

const tempDirs = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-wp1-atomic-'));
  tempDirs.push(dir);
  return dir;
}

after(async () => {
  for (const dir of tempDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('writeJsonAtomic 写入可解析的 JSON 并回报字节数', async () => {
  const dir = await makeTempDir();
  const file = path.join(dir, 'state.json');
  const updatedAt = new Date().toISOString();

  const res = await writeJsonAtomic(file, { schemaVersion: 1, instanceId: 'INST-001', updatedAt });

  assert.equal(res.ok, true);
  assert.ok(res.bytes > 0);
  assert.equal(res.updatedAt, updatedAt);

  const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(parsed.instanceId, 'INST-001');
  assert.equal(parsed.updatedAt, updatedAt);

  // 原子写的临时文件必须已清理干净。
  const leftovers = (await fs.readdir(dir)).filter((name) => name.includes('.tmp-'));
  assert.deepEqual(leftovers, []);
});

test('writeJsonAtomic 覆盖旧内容且目录不存在时自建', async () => {
  const dir = await makeTempDir();
  const file = path.join(dir, 'nested', 'deep', 'state.json');

  const first = await writeJsonAtomic(file, { schemaVersion: 1, instanceId: 'INST-001', seq: 1 });
  const second = await writeJsonAtomic(file, { schemaVersion: 1, instanceId: 'INST-001', seq: 2 });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).seq, 2);
});

test('writeJsonAtomic 重命名失败时返回 STORE_WRITE_FAILED 且不留下 tmp', async () => {
  const dir = await makeTempDir();
  // 目标同名位置是目录：rename 必然失败，且不属于可重试的错误码。
  const target = path.join(dir, 'state.json');
  await fs.mkdir(target);

  const res = await writeJsonAtomic(target, { schemaVersion: 1, instanceId: 'INST-001' });

  assert.equal(res.ok, false);
  assert.equal(res.code, 'STORE_WRITE_FAILED');
  assert.equal(typeof res.params.errno, 'string');
  assert.equal(res.params.path, target);

  const leftovers = (await fs.readdir(dir)).filter((name) => name.includes('.tmp-'));
  assert.deepEqual(leftovers, []);
});

test('writeTextAtomic 写入整份文本并回报字节数，且不留下 tmp', async () => {
  const dir = await makeTempDir();
  const file = path.join(dir, 'workspace', 'status.md');
  const text = '# INST-001 编码闭环\n\n- 状态：运行中\n';

  const res = await writeTextAtomic(file, text);

  assert.equal(res.ok, true);
  assert.equal(res.bytes, Buffer.byteLength(text, 'utf8'));
  assert.equal(res.updatedAt, null);
  assert.equal(await fs.readFile(file, 'utf8'), text);

  const leftovers = (await fs.readdir(path.dirname(file))).filter((name) => name.includes('.tmp-'));
  assert.deepEqual(leftovers, []);
});

test('writeTextAtomic 整份覆盖旧内容（status.md 不追加）', async () => {
  const dir = await makeTempDir();
  const file = path.join(dir, 'status.md');

  await writeTextAtomic(file, 'first\nsecond\n');
  const second = await writeTextAtomic(file, 'only\n');

  assert.equal(second.ok, true);
  assert.equal(await fs.readFile(file, 'utf8'), 'only\n');
});

test('writeTextAtomic 重命名失败时返回 STORE_WRITE_FAILED 且不留下 tmp', async () => {
  const dir = await makeTempDir();
  const target = path.join(dir, 'status.md');
  await fs.mkdir(target);

  const res = await writeTextAtomic(target, '# x\n');

  assert.equal(res.ok, false);
  assert.equal(res.code, 'STORE_WRITE_FAILED');
  assert.equal(res.params.path, target);

  const leftovers = (await fs.readdir(dir)).filter((name) => name.includes('.tmp-'));
  assert.deepEqual(leftovers, []);
});

test('copyToBackup 是复制而不是重命名：原文件原字节仍在', async () => {
  const dir = await makeTempDir();
  const src = path.join(dir, 'state.json');
  const dst = path.join(dir, 'state.json.corrupt');
  const broken = '{"broken';

  await fs.writeFile(src, broken, 'utf8');
  const res = await copyToBackup(src, dst);

  assert.equal(res.ok, true);
  assert.equal(res.copiedBytes, Buffer.byteLength(broken));
  assert.equal(await fs.readFile(src, 'utf8'), broken);
  assert.equal(await fs.readFile(dst, 'utf8'), broken);
});

test('copyToBackup 源文件不存在时返回失败码', async () => {
  const dir = await makeTempDir();
  const res = await copyToBackup(path.join(dir, 'missing.json'), path.join(dir, 'missing.json.corrupt'));

  assert.equal(res.ok, false);
  assert.equal(res.code, 'STORE_BACKUP_FAILED');
  assert.equal(res.params.errno, 'ENOENT');
});
