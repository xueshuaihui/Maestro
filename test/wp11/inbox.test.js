/**
 * WP-3 / D-4 / C-08: 信箱文件先落盘再投递、原子替换、幂等、稳定顺序列出。
 *
 * 与 status-doc.test.js 同风格：真实临时目录 + 注入 fs 模拟写失败。
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildInboxMessage,
  writeInbox,
  readInbox,
  patchInbox,
  listInbox,
  removeInbox
} from '../../src/core/inbox.js';
import { inboxFilePath, instanceInboxDir } from '../../src/persistence/paths.js';

const tempDirs = [];

async function makeRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-wp11-inbox-'));
  tempDirs.push(root);
  return root;
}

function sampleMessage(overrides = {}) {
  return buildInboxMessage({
    handoffId: 'HO-002',
    instanceId: 'INST-001',
    fromNodeId: 'T-002',
    toNodeId: 'T-001',
    sessionId: 'SES-1',
    promptText: 'full prompt text',
    createdAt: '2026-11-08T10:30:02.000Z',
    deliveryAttempts: 2,
    ...overrides
  });
}

after(async () => {
  for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
});

// ---- 形状 ---------------------------------------------------------------

test('buildInboxMessage：固定 10 键、默认值', () => {
  const message = sampleMessage();
  assert.deepEqual(Object.keys(message), [
    'handoffId',
    'instanceId',
    'fromNodeId',
    'toNodeId',
    'sessionId',
    'promptText',
    'createdAt',
    'deliveryAttempts',
    'deliveredAt',
    'lastError'
  ]);
  assert.equal(message.deliveredAt, null);
  assert.equal(message.lastError, null);
  assert.equal(message.deliveryAttempts, 2);
  assert.equal(buildInboxMessage({}).deliveryAttempts, 1);
});

// ---- 写入 / 原子性 -------------------------------------------------------

test('writeInbox：先落盘再返回可投递，内容与 C-08 一致', async () => {
  const root = await makeRoot();
  const message = sampleMessage();
  const result = await writeInbox({
    root,
    instanceId: 'INST-001',
    handoffId: 'HO-002',
    message
  });
  assert.equal(result.ok, true);
  assert.equal(result.deliverable, true);
  assert.equal(result.path, inboxFilePath(root, 'INST-001', 'HO-002'));
  const raw = await fs.readFile(result.path, 'utf8');
  assert.equal(raw, `${JSON.stringify(message, null, 2)}\n`);
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, message);
  assert.equal(parsed.sessionId, 'SES-1');
  assert.equal(parsed.promptText, 'full prompt text');
  assert.equal(parsed.deliveredAt, null);
  assert.equal(parsed.lastError, null);
});

test('原子替换：注入写失败 -> INBOX_WRITE_FAILED、不可投递、无半文件', async () => {
  const root = await makeRoot();
  const injectedFs = {
    writeJsonAtomic: async () => {
      throw new Error('EIO: simulated');
    },
    readFile: async () => {
      throw new Error('ENOENT');
    },
    readdir: async () => [],
    unlink: async () => {}
  };
  const result = await writeInbox({
    root,
    instanceId: 'INST-001',
    handoffId: 'HO-002',
    message: sampleMessage(),
    fs: injectedFs
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INBOX_WRITE_FAILED');
  assert.equal(result.deliverable, false);
  assert.equal(result.params.path, inboxFilePath(root, 'INST-001', 'HO-002'));
  assert.ok(result.params.cause.includes('EIO'));
  const names = await fs.readdir(instanceInboxDir(root, 'INST-001')).catch(() => []);
  assert.deepEqual(names, []);
});

test('fault=inbox_write:fail：明确失败、不可投递、不写盘', async () => {
  const root = await makeRoot();
  const result = await writeInbox({
    root,
    instanceId: 'INST-001',
    handoffId: 'HO-002',
    message: sampleMessage(),
    fault: 'inbox_write:fail'
  });
  assert.equal(result.ok, false);
  assert.equal(result.deliverable, false);
  assert.equal(result.params.cause, 'inbox_write:fail');
  const names = await fs.readdir(instanceInboxDir(root, 'INST-001')).catch(() => []);
  assert.deepEqual(names, []);
});

test('原子替换：写失败后既有信箱文件保持完整、无 .tmp 残留', async () => {
  const root = await makeRoot();
  const message = sampleMessage();
  await writeInbox({ root, instanceId: 'INST-001', handoffId: 'HO-002', message });
  const failed = await writeInbox({
    root,
    instanceId: 'INST-001',
    handoffId: 'HO-002',
    message: sampleMessage({ promptText: 'broken' }),
    fault: 'inbox_write:fail'
  });
  assert.equal(failed.deliverable, false);
  const raw = await fs.readFile(inboxFilePath(root, 'INST-001', 'HO-002'), 'utf8');
  assert.deepEqual(JSON.parse(raw), message);
  const names = await fs.readdir(instanceInboxDir(root, 'INST-001'));
  assert.deepEqual(names, ['HO-002.json']);
});

// ---- 幂等 / 列出 / 读取 --------------------------------------------------

test('同一 handoffId 重复写幂等（不产生第二份）', async () => {
  const root = await makeRoot();
  const first = await writeInbox({
    root,
    instanceId: 'INST-001',
    handoffId: 'HO-002',
    message: sampleMessage({ promptText: 'v1', deliveryAttempts: 1 })
  });
  assert.equal(first.ok, true);
  const second = await writeInbox({
    root,
    instanceId: 'INST-001',
    handoffId: 'HO-002',
    message: sampleMessage({ promptText: 'v2', deliveryAttempts: 2 })
  });
  assert.equal(second.ok, true);
  assert.equal(second.path, first.path);
  const list = await listInbox({ root, instanceId: 'INST-001' });
  assert.equal(list.entries.length, 1);
  assert.equal(list.entries[0].handoffId, 'HO-002');
  const read = await readInbox({ root, instanceId: 'INST-001', handoffId: 'HO-002' });
  assert.equal(read.message.promptText, 'v2');
  assert.equal(read.message.deliveryAttempts, 2);
});

test('listInbox：按 handoffId 稳定升序', async () => {
  const root = await makeRoot();
  for (const id of ['HO-003', 'HO-001', 'HO-002']) {
    await writeInbox({
      root,
      instanceId: 'INST-001',
      handoffId: id,
      message: sampleMessage({ handoffId: id })
    });
  }
  const list = await listInbox({ root, instanceId: 'INST-001' });
  assert.deepEqual(
    list.entries.map((entry) => entry.handoffId),
    ['HO-001', 'HO-002', 'HO-003']
  );
  assert.equal(list.entries[0].path, inboxFilePath(root, 'INST-001', 'HO-001'));
});

test('listInbox：信箱目录不存在返回空列表', async () => {
  const root = await makeRoot();
  const result = await listInbox({ root, instanceId: 'INST-001' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.entries, []);
});

test('readInbox：不存在返回明确 INBOX_NOT_FOUND', async () => {
  const root = await makeRoot();
  const result = await readInbox({ root, instanceId: 'INST-001', handoffId: 'HO-404' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INBOX_NOT_FOUND');
  assert.equal(result.params.path, inboxFilePath(root, 'INST-001', 'HO-404'));
});

// ---- 损坏 JSON -----------------------------------------------------------

function corruptInboxFixture() {
  const root = fsSync.mkdtempSync(path.join(os.tmpdir(), 'maestro-wp11-inbox-'));
  tempDirs.push(root);
  const filePath = inboxFilePath(root, 'INST-001', 'HO-002');
  fsSync.mkdirSync(path.dirname(filePath), { recursive: true });
  fsSync.writeFileSync(filePath, '{ this is not valid JSON');
  return { root, filePath };
}

test('readInbox：损坏 JSON 返回字面量 INBOX_CORRUPT，params 含 path', async () => {
  const { root, filePath } = corruptInboxFixture();
  const result = await readInbox({ root, instanceId: 'INST-001', handoffId: 'HO-002' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INBOX_CORRUPT');
  assert.equal(result.params.path, filePath);
});

test('patchInbox：损坏 JSON 返回字面量 INBOX_CORRUPT，params 含 path', async () => {
  const { root, filePath } = corruptInboxFixture();
  const result = await patchInbox({
    root,
    instanceId: 'INST-001',
    handoffId: 'HO-002',
    patch: { deliveredAt: 'x' }
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INBOX_CORRUPT');
  assert.equal(result.params.path, filePath);
});

// ---- 标记已投递 / 删除 ---------------------------------------------------

test('patchInbox：标记已投递且 10 键不增不减（丢弃非信箱字段）', async () => {
  const root = await makeRoot();
  await writeInbox({ root, instanceId: 'INST-001', handoffId: 'HO-002', message: sampleMessage() });
  const result = await patchInbox({
    root,
    instanceId: 'INST-001',
    handoffId: 'HO-002',
    patch: {
      deliveredAt: '2026-11-08T10:30:03.000Z',
      lastError: 'mock: prompt failed',
      deliveryAttempts: 3,
      pendingAt: 'SHOULD-BE-DROPPED'
    }
  });
  assert.equal(result.ok, true);
  const read = await readInbox({ root, instanceId: 'INST-001', handoffId: 'HO-002' });
  assert.equal(read.message.deliveredAt, '2026-11-08T10:30:03.000Z');
  assert.equal(read.message.lastError, 'mock: prompt failed');
  assert.equal(read.message.deliveryAttempts, 3);
  assert.equal(Object.keys(read.message).length, 10);
  assert.equal('pendingAt' in read.message, false);
});

test('patchInbox：文件不存在返回 INBOX_NOT_FOUND', async () => {
  const root = await makeRoot();
  const result = await patchInbox({
    root,
    instanceId: 'INST-001',
    handoffId: 'HO-404',
    patch: { deliveredAt: 'x' }
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INBOX_NOT_FOUND');
});

test('removeInbox：删除后读不到、列出为空', async () => {
  const root = await makeRoot();
  await writeInbox({ root, instanceId: 'INST-001', handoffId: 'HO-002', message: sampleMessage() });
  const result = await removeInbox({ root, instanceId: 'INST-001', handoffId: 'HO-002' });
  assert.equal(result.ok, true);
  const read = await readInbox({ root, instanceId: 'INST-001', handoffId: 'HO-002' });
  assert.equal(read.code, 'INBOX_NOT_FOUND');
  const list = await listInbox({ root, instanceId: 'INST-001' });
  assert.equal(list.entries.length, 0);
});
