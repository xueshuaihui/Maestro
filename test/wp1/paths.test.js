import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as paths from '../../src/persistence/paths.js';

const tempDirs = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-wp1-paths-'));
  tempDirs.push(dir);
  return dir;
}

after(async () => {
  for (const dir of tempDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('projectRoot 返回 realpath 归一化后的绝对路径', async () => {
  const dir = await makeTempDir();
  const root = paths.projectRoot(dir);
  assert.equal(root, await fs.realpath(dir));
  assert.equal(path.isAbsolute(root), true);
  // 相对路径同样归一化到同一结果（消除 ./demo 与 demo 的差异）。
  assert.equal(paths.projectRoot(path.relative(process.cwd(), dir) || '.'), root);
});

test('projectRoot 对不存在的路径抛 ENOENT，不静默回退', () => {
  const missing = path.join(os.tmpdir(), `maestro-wp1-missing-${Date.now()}`, 'nope');
  assert.throws(
    () => paths.projectRoot(missing),
    (err) => err.code === 'ENOENT',
  );
});

test('布局函数指向 .orch 下的标准位置', async () => {
  const dir = await makeTempDir();
  const root = paths.projectRoot(dir);
  const id = 'INST-001';

  assert.equal(paths.orchDir(root), path.join(root, '.orch'));
  assert.equal(paths.instancesDir(root), path.join(root, '.orch', 'instances'));
  assert.equal(paths.instanceDir(root, id), path.join(root, '.orch', 'instances', id));
  assert.equal(paths.statePath(root, id), path.join(root, '.orch', 'instances', id, 'state.json'));
  assert.equal(paths.eventsPath(root, id), path.join(root, '.orch', 'instances', id, 'events.jsonl'));
  assert.equal(paths.corruptPath(root, id), path.join(root, '.orch', 'instances', id, 'state.json.corrupt'));
  assert.equal(paths.coreMetaPath(root), path.join(root, '.orch', 'core.json'));
  assert.equal(paths.coreLogPath(root), path.join(root, '.orch', 'core.log'));
});

test('工作区三层可见域与信箱路径（I1.4 M-1 / M-5）', async () => {
  const dir = await makeTempDir();
  const root = paths.projectRoot(dir);
  const id = 'INST-001';
  const workspace = path.join(root, '.orch', 'instances', id, 'workspace');

  assert.equal(paths.instanceSharedDir(root, id), path.join(workspace, 'shared'));
  assert.equal(paths.instanceStageRoot(root, id), path.join(workspace, 'stage'));
  assert.equal(paths.instanceStageDir(root, id, 'T-002'), path.join(workspace, 'stage', 'T-002'));
  assert.equal(paths.instanceStatusPath(root, id), path.join(workspace, 'status.md'));
  assert.equal(paths.instanceInboxDir(root, id), path.join(root, '.orch', 'inbox', id));
  assert.equal(
    paths.inboxFilePath(root, id, 'HO-002'),
    path.join(root, '.orch', 'inbox', id, 'HO-002.json'),
  );

  // 信箱在实例目录之外：不得被当成实例目录（store.list 只遍历 .orch/instances）。
  assert.equal(paths.instanceInboxDir(root, id).startsWith(paths.instancesDir(root)), false);
});

test('ensureLayout 幂等创建 .orch/instances', async () => {
  const dir = await makeTempDir();
  const root = paths.projectRoot(dir);

  await paths.ensureLayout(root);
  await paths.ensureLayout(root); // 第二次不应抛错

  const stat = await fs.stat(paths.instancesDir(root));
  assert.equal(stat.isDirectory(), true);
});

test('pipeName 同项目稳定、不同项目必不同', async () => {
  const dirA = await makeTempDir();
  const dirB = await makeTempDir();
  const rootA = paths.projectRoot(dirA);
  const rootB = paths.projectRoot(dirB);

  assert.equal(paths.pipeName(rootA), paths.pipeName(rootA));
  assert.notEqual(paths.pipeName(rootA), paths.pipeName(rootB));

  if (process.platform === 'win32') {
    assert.equal(paths.pipeName(rootA).startsWith('\\\\.\\pipe\\maestro-'), true);
    assert.equal(paths.pipeName(rootA).length, '\\\\.\\pipe\\maestro-'.length + 16);
  } else {
    assert.equal(paths.pipeName(rootA), path.join(rootA, '.orch', 'core.sock'));
  }
});

test('pipeName 对 Windows 路径大小写不敏感', { skip: process.platform !== 'win32' }, async () => {
  const dir = await makeTempDir();
  const root = paths.projectRoot(dir);

  // D:\WWW 与 d:\www 必须落到同一个管道，否则同一项目会被当成两个核心。
  assert.equal(paths.pipeName(root), paths.pipeName(root.toUpperCase()));
  assert.equal(paths.pipeName(root), paths.pipeName(root.toLowerCase()));
  // 多余的尾分隔符 / ./ 不应改变端点名。
  assert.equal(paths.pipeName(`${root}${path.sep}`), paths.pipeName(root));
});

test('pipeName 超长项目路径退到短端点', { skip: process.platform === 'win32' }, async () => {
  // macOS 的 sun_path 是定长 104 字节，超长路径会被内核静默截断：核心绑到
  // `core.soc`，客户端连 `core.sock`，整条 IPC 无声消失（桌面端表现为永远
  // 「正在连接」）。所以长路径必须换到一个装得下的端点。
  const base = await makeTempDir();
  const deep = path.join(base, 'd'.repeat(60));
  await fs.mkdir(deep, { recursive: true });
  const root = paths.projectRoot(deep);

  const natural = path.join(root, '.orch', 'core.sock');
  assert.ok(Buffer.byteLength(natural) > 103, '夹具必须真的超出上限');

  const pipe = paths.pipeName(root);
  assert.notEqual(pipe, natural, '超长路径不得继续使用项目内的端点');
  assert.ok(Buffer.byteLength(pipe) <= 103, `短端点仍过长：${pipe}`);
  // 核心与 CLI 两端都要靠同一条推导连上，必须稳定。
  assert.equal(paths.pipeName(root), pipe);
  assert.notEqual(paths.pipeName(base), pipe, '不同项目不得共用端点');
});
