/**
 * 偏好读写契约测试（I1.11 WP-1，需求 §2.2 / §3.1 / D-42）。
 *
 * 覆盖点：
 * - 缺文件 / 缺目录 / JSON 损坏 / 非对象 → 全 true 缺省，不抛错；
 * - 缺键 → true；键值非法（非布尔）→ 按 true；false 如实保留；
 * - 多余键在读侧忽略；
 * - writePrefs 合并写入、原子落盘（tmp+rename，无残留 tmp 文件）、
 *   未知键 / 非布尔值 / 非对象 patch → throw；文件内容恰为四键；
 * - 只读写 `<root>/.orch/desktop/prefs.json`，不触碰实例状态目录。
 *
 * 夹具一律在 os.tmpdir() 下建独立根，测试自清理，不放仓库内。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PREFS_KEYS, prefsPath, readPrefs, writePrefs } from '../../src/daemon/prefs.js';

function makeRoot(prefix = 'maestro-i11-prefs-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    root,
    file: path.join(root, '.orch', 'desktop', 'prefs.json'),
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

const ALL_TRUE = { enabled: true, escalate: true, completed: true, anomaly: true };

// ---------------------------------------------------------------- readPrefs

test('缺文件 / 缺目录 → 全 true 缺省，不抛错', async () => {
  const fx = makeRoot();
  try {
    assert.deepEqual(await readPrefs(fx.root), ALL_TRUE);
    // 连 .orch 都不存在同样缺省（新项目首次启动的常态）。
    assert.equal(fs.existsSync(path.join(fx.root, '.orch')), false);
  } finally {
    fx.cleanup();
  }
});

test('文件损坏 / 非对象内容 → 全 true 缺省，不抛错', async () => {
  const fx = makeRoot();
  try {
    fs.mkdirSync(path.dirname(fx.file), { recursive: true });
    fs.writeFileSync(fx.file, '{not-json', 'utf8');
    assert.deepEqual(await readPrefs(fx.root), ALL_TRUE);

    fs.writeFileSync(fx.file, '"just-a-string"', 'utf8');
    assert.deepEqual(await readPrefs(fx.root), ALL_TRUE);

    fs.writeFileSync(fx.file, '[1,2,3]', 'utf8');
    assert.deepEqual(await readPrefs(fx.root), ALL_TRUE);

    fs.writeFileSync(fx.file, 'null', 'utf8');
    assert.deepEqual(await readPrefs(fx.root), ALL_TRUE);
  } finally {
    fx.cleanup();
  }
});

test('缺键 → true；非法值 → 按 true；false 如实保留；多余键读侧忽略', async () => {
  const fx = makeRoot();
  try {
    fs.mkdirSync(path.dirname(fx.file), { recursive: true });
    fs.writeFileSync(
      fx.file,
      JSON.stringify({
        enabled: false,
        escalate: 'no', // 非法值 → 按 true
        // completed 缺键 → true
        anomaly: 0, // 非法值 → 按 true
        unexpected: 'ignored', // 多余键读侧忽略
      }),
      'utf8',
    );
    assert.deepEqual(await readPrefs(fx.root), {
      enabled: false,
      escalate: true,
      completed: true,
      anomaly: true,
    });
  } finally {
    fx.cleanup();
  }
});

test('readPrefs 的 root 缺失直接抛 TypeError', async () => {
  await assert.rejects(() => readPrefs(''), TypeError);
  await assert.rejects(() => readPrefs(undefined), TypeError);
});

// ---------------------------------------------------------------- writePrefs

test('合并写入：只传改动键，其余键保持既有值；文件恰为四键', async () => {
  const fx = makeRoot();
  try {
    const merged = await writePrefs(fx.root, { completed: false });
    assert.deepEqual(merged, { enabled: true, escalate: true, completed: false, anomaly: true });

    const raw = JSON.parse(fs.readFileSync(fx.file, 'utf8'));
    assert.deepEqual(raw, { enabled: true, escalate: true, completed: false, anomaly: true });
    assert.deepEqual(Object.keys(raw).sort(), [...PREFS_KEYS].sort());

    // 再改另一键，先前的改动不丢。
    const second = await writePrefs(fx.root, { enabled: false });
    assert.deepEqual(second, { enabled: false, escalate: true, completed: false, anomaly: true });
    assert.deepEqual(JSON.parse(fs.readFileSync(fx.file, 'utf8')), second);
  } finally {
    fx.cleanup();
  }
});

test('首次写入自动建目录；内容可被 readPrefs 原样读回', async () => {
  const fx = makeRoot();
  try {
    await writePrefs(fx.root, { enabled: false, anomaly: false });
    assert.equal(fs.existsSync(fx.file), true);
    assert.deepEqual(await readPrefs(fx.root), {
      enabled: false,
      escalate: true,
      completed: true,
      anomaly: false,
    });
  } finally {
    fx.cleanup();
  }
});

test('多余键 / 非布尔值 / 非对象 patch → throw，且不落盘', async () => {
  const fx = makeRoot();
  try {
    await assert.rejects(() => writePrefs(fx.root, { unknown: true }), TypeError);
    await assert.rejects(() => writePrefs(fx.root, { enabled: 'yes' }), TypeError);
    await assert.rejects(() => writePrefs(fx.root, { escalate: 1 }), TypeError);
    await assert.rejects(() => writePrefs(fx.root, null), TypeError);
    await assert.rejects(() => writePrefs(fx.root, [true]), TypeError);

    // 全部拒绝后，目标文件不应被创建。
    assert.equal(fs.existsSync(fx.file), false);
  } finally {
    fx.cleanup();
  }
});

test('原子写：无残留 tmp 文件，损坏的旧文件被整体替换', async () => {
  const fx = makeRoot();
  try {
    fs.mkdirSync(path.dirname(fx.file), { recursive: true });
    fs.writeFileSync(fx.file, '{corrupted', 'utf8');

    await writePrefs(fx.root, { enabled: false });

    const dir = path.dirname(fx.file);
    const leftovers = fs.readdirSync(dir).filter((name) => name !== 'prefs.json');
    assert.deepEqual(leftovers, [], '原子写不应留下临时文件');
    assert.deepEqual(await readPrefs(fx.root), { ...ALL_TRUE, enabled: false });
  } finally {
    fx.cleanup();
  }
});

test('写入只触碰 prefs.json：不产生其它文件、不改实例状态目录', async () => {
  const fx = makeRoot();
  try {
    // 预置一个实例目录与事件文件，验证写入后逐字节不变。
    const instDir = path.join(fx.root, '.orch', 'instances', 'INST-001');
    fs.mkdirSync(instDir, { recursive: true });
    const stateFile = path.join(instDir, 'state.json');
    fs.writeFileSync(stateFile, '{"instanceId":"INST-001"}', 'utf8');

    await writePrefs(fx.root, { escalate: false });

    assert.equal(fs.readFileSync(stateFile, 'utf8'), '{"instanceId":"INST-001"}');
    const orchChildren = fs
      .readdirSync(path.join(fx.root, '.orch'))
      .filter((name) => name !== 'instances' && name !== 'desktop');
    assert.deepEqual(orchChildren, [], '.orch 下不得出现其它新目录');
  } finally {
    fx.cleanup();
  }
});

test('prefsPath 与 PREFS_KEYS 的形状契约', () => {
  assert.deepEqual([...PREFS_KEYS], ['enabled', 'escalate', 'completed', 'anomaly']);
  assert.equal(
    prefsPath('/tmp/demo'),
    path.join('/tmp/demo', '.orch', 'desktop', 'prefs.json'),
  );
});
