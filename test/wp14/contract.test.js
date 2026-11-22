/**
 * I1.11 WP-11 · 跨域契约一致性（整合验收；零产品改动）。
 *
 * 只断言「层与层之间形状对齐」，不重复各域内部行为测试：
 * - 六个投影模块导出签名 + 返回键形状（拆分文档 §2.1~2.7）；
 * - D-46 端到端数据链：notify 意图 → SSE 帧 → UI replaceIntent → 壳层替换 id；
 * - D-36 界面零计算（desktop/ui 不得重算 pendingEscalations）；
 * - A-11 /ui/labels 249 键含全部 DESKTOP_*（白名单 100%），USAGE_LINES 未混入；
 * - AC-43 不依赖 I1.10b：下钻实现只经装配层接线（beta.2 起允许 shell 层单一适配），open-queue 只展开本条。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEDUP, createNotifier } from '../../src/daemon/notify.js';
import { PREFS_KEYS, readPrefs } from '../../src/daemon/prefs.js';
import { buildQueue } from '../../src/daemon/queue.js';
import { listAssets, showAsset } from '../../src/daemon/assets-view.js';
import { buildOccupancy } from '../../src/daemon/occupancy.js';
import { buildCanvas } from '../../src/daemon/canvas.js';
import { buildEvidence, EVIDENCE_ITEM_KEYS } from '../../src/daemon/evidence.js';
import { labelKeysPayload, I11_DESKTOP_KEYS, UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';
import { USAGE_LINES } from '../../src/cli/labels.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createStore } from '../../src/persistence/instance-store.js';
import { notifyKey, replaceIntent, queueTargetOf } from '../../desktop/ui/notify/notify.js';
import { createApp } from '../../desktop/ui/app.js';

process.env.NODE_ENV = 'test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const readText = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i11-contract-'));
}

// ---------------------------------------------------------------------------
// 六个投影模块：导出签名 + 返回键形状（§2.1~2.7）
// ---------------------------------------------------------------------------

test('§2.1 notify.js：createNotifier 返回 intents$ + dispose，DEDUP 双窗口', () => {
  assert.equal(typeof createNotifier, 'function');
  assert.deepEqual({ ...DEDUP }, { ESCALATION_MS: 10_000, ANOMALY_MS: 60_000 });
  const root = tempRoot();
  try {
    const bus = createEventBus({ store: createStore({ root }) });
    const notifier = createNotifier({
      bus,
      getInstanceStates: async () => [],
      clock: { now: () => 0 },
      prefsRead: async () => ({ enabled: true, escalate: true, completed: true, anomaly: true }),
    });
    assert.deepEqual(Object.keys(notifier).sort(), ['dispose', 'intents$']);
    assert.equal(typeof notifier.dispose, 'function');
    assert.ok(notifier.intents$ && typeof notifier.intents$[Symbol.asyncIterator] === 'function');
    notifier.dispose();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('§2.2 prefs.js：四键读写，缺文件全 true 缺省', async () => {
  assert.equal(typeof readPrefs, 'function');
  assert.deepEqual([...PREFS_KEYS], ['enabled', 'escalate', 'completed', 'anomaly']);
  const root = tempRoot();
  try {
    assert.deepEqual(await readPrefs(root), { enabled: true, escalate: true, completed: true, anomaly: true });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('§2.3 queue.js：buildQueue 返回 items + totals（两计数键）', () => {
  assert.equal(typeof buildQueue, 'function');
  const root = tempRoot();
  try {
    const result = buildQueue(root, { instances: [] });
    assert.deepEqual(Object.keys(result).sort(), ['items', 'totals']);
    assert.ok(Array.isArray(result.items));
    assert.deepEqual(Object.keys(result.totals).sort(), ['pendingApprovals', 'pendingEscalations']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('§2.4 assets-view.js：listAssets/showAsset 导出 + items/unreadable 形状', async () => {
  assert.equal(typeof listAssets, 'function');
  assert.equal(typeof showAsset, 'function');
  const root = tempRoot();
  try {
    const result = await listAssets(root, 'roles');
    assert.ok(Array.isArray(result.items));
    assert.ok(Array.isArray(result.unreadable));
    const detail = await showAsset(root, 'roles', 'definitely-missing');
    assert.equal(typeof detail, 'object');
    assert.equal(Object.hasOwn(detail, 'found'), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('§2.5 occupancy.js：buildOccupancy 返回 rows + skipped', () => {
  assert.equal(typeof buildOccupancy, 'function');
  const root = tempRoot();
  try {
    const result = buildOccupancy(root, { instances: [] });
    assert.deepEqual(Object.keys(result).sort(), ['rows', 'skipped']);
    assert.ok(Array.isArray(result.rows));
    assert.ok(Array.isArray(result.skipped));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('§2.6 canvas.js：buildCanvas 返回 title/readable/valid/nodes/edges', () => {
  assert.equal(typeof buildCanvas, 'function');
  const root = tempRoot();
  try {
    const result = buildCanvas(root, 'definitely-missing');
    for (const key of ['title', 'readable', 'valid', 'nodes', 'edges']) {
      assert.equal(Object.hasOwn(result, key), true, `canvas 缺键 ${key}`);
    }
    assert.ok(Array.isArray(result.nodes) && Array.isArray(result.edges));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('§2.7 evidence.js：buildEvidence 返回 instanceId + items（五项键冻结）', async () => {
  assert.equal(typeof buildEvidence, 'function');
  assert.ok(Array.isArray(EVIDENCE_ITEM_KEYS));
  const root = tempRoot();
  try {
    const result = await buildEvidence(root, 'INST-001', null);
    assert.deepEqual(Object.keys(result).sort(), ['instanceId', 'items']);
    assert.equal(result.instanceId, 'INST-001');
    assert.ok(Array.isArray(result.items));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// D-46 端到端数据链：四层形状对齐（不重复测各层内部）
// ---------------------------------------------------------------------------

/** §2.1 的 NotifyIntent 规范形（A-1 五段正文，7 键）。 */
const INTENT_KEYS = ['kind', 'ids', 'instanceId', 'title', 'body', 'mergedCount', 'at'];
const SAMPLE_INTENT = Object.freeze({
  kind: 'escalation',
  ids: ['ESC-001'],
  instanceId: 'INST-001',
  title: '通知 升级待处理 · INST-001',
  body: '实例 INST-001 · 升级 ESC-001 · 节点 T-001 执行者 · 第 1 轮 · 轮次超限',
  mergedCount: 1,
  at: '2026-11-15T10:30:00Z',
});

test('D-46 ① notify 意图：7 键规范形 + 源端逐键构造', () => {
  assert.deepEqual(Object.keys(SAMPLE_INTENT).sort(), [...INTENT_KEYS].sort());
  const src = readText('src/daemon/notify.js');
  for (const key of INTENT_KEYS) {
    assert.match(src, new RegExp(`\\b${key}\\s*:`), `notify.js 未构造意图字段 ${key}`);
  }
});

test('D-46 ② SSE 帧：event=notify，data 为意图本体（零包装）', () => {
  const routes = readText('src/daemon/http/routes.js');
  assert.match(routes, /encodeSseFrame\(\s*'notify'\s*,\s*intent\s*\)/, 'SSE 帧必须以 notify 事件名透传 intent');
  const stream = readText('src/daemon/http/stream.js');
  assert.match(stream, /event:\s*\$\{/, 'SSE 分帧必须含 event 行');
  assert.match(stream, /data:\s*\$\{/, 'SSE 分帧必须含 data 行');
});

test('D-46 ③ UI replaceIntent：按 (kind, instanceId) 替换，形状与意图一致', () => {
  const key = notifyKey(SAMPLE_INTENT);
  assert.equal(key, 'escalation|INST-001');
  const second = { ...SAMPLE_INTENT, mergedCount: 4, body: '实例 INST-001 · 升级 — · 节点 — · 第 — 轮 · 已中断，共 4 次' };
  const entries = replaceIntent(replaceIntent([], SAMPLE_INTENT), second);
  assert.equal(entries.length, 1, '同一 (kind, instanceId) 必须替换而非追加');
  assert.equal(entries[0].mergedCount, 4);
  const other = { ...SAMPLE_INTENT, instanceId: 'INST-002' };
  assert.equal(replaceIntent(entries, other).length, 2, '不同实例号必须并存');
  const target = queueTargetOf(SAMPLE_INTENT);
  assert.deepEqual(Object.keys(target).sort(), ['ids', 'instanceId', 'kind', 'selectable']);
  assert.equal(target.selectable, true);
});

test('D-46 ④ 壳层替换 id：派生自同一 (kind, instanceId) 键', () => {
  const main = readText('desktop/src-tauri/src/main.rs');
  assert.match(main, /let key = format!\("\{kind\}\|\{instance_id\}"\)/, '壳层必须按 kind|instanceId 派生替换键');
  assert.match(main, /fn notification_id_mac\(key: &str\)/, 'macOS 必须由该键生成稳定通知 id');
  assert.match(main, /get\("mergedCount"\)/, '壳层必须消费 mergedCount（替换判读口径）');
  assert.match(main, /get\("ids"\)/, '壳层点击路径必须消费 ids（AC-04 选中）');
});

test('桌面壳 Windows 无控制台：GUI 子系统 + daemon/taskkill 静默启动', () => {
  const main = readText('desktop/src-tauri/src/main.rs');
  const spawn = readText('desktop/src-tauri/src/spawn.rs');
  assert.match(
    main,
    /windows_subsystem\s*=\s*"windows"/,
    'release 壳必须以 GUI 子系统链接，否则双击快捷方式会弹出控制台窗口',
  );
  assert.match(
    spawn,
    /use std::os::windows::process::CommandExt/,
    'Windows 分支必须引入 CommandExt 才能设置 creation_flags',
  );
  const flags = spawn.match(/creation_flags\(0x0800_0000\)/g) || [];
  assert.ok(
    flags.length >= 2,
    `daemon 与 taskkill 都必须 CREATE_NO_WINDOW，实际只有 ${flags.length} 处`,
  );
});

// ---------------------------------------------------------------------------
// D-36 界面零计算
// ---------------------------------------------------------------------------

test('D-36：desktop/ui 不出现 pendingEscalations 重算（grep 计数 = 0）', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|mjs|cjs|html)$/.test(entry.name)) files.push(full);
    }
  };
  walk(path.join(REPO, 'desktop', 'ui'));
  const hits = [];
  for (const file of files) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, idx) => {
      if (/pendingEscalations/.test(line)) hits.push(`${path.relative(REPO, file)}:${idx + 1}`);
    });
  }
  assert.deepEqual(hits, [], `界面层不得重算/引用 pendingEscalations：${hits.join(', ')}`);
  // 多行感知：filter/reduce + .length 计数表达式也不得出现在界面层。
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(!/escalations\s*\.\s*(filter|reduce)/.test(src), `界面层出现计数表达式：${path.relative(REPO, file)}`);
  }
});

// ---------------------------------------------------------------------------
// A-11 文案下发完整性
// ---------------------------------------------------------------------------

test('A-11：/ui/labels 键全集（I1.10a/I1.10b/I1.11 + beta.2 外壳增量并集）含全部 DESKTOP_* 字符串常量（白名单 100%）', () => {
  const payload = labelKeysPayload().keys;
  assert.equal(Object.keys(payload).length, Object.keys(UI_LABEL_KEYS).length, '下发键数必须与 UI_LABEL_KEYS 全集一致');

  const cli = fs.readFileSync(path.join(REPO, 'src', 'cli', 'labels.js'), 'utf8');
  const stringConsts = [...cli.matchAll(/^export const (DESKTOP_[A-Z0-9_]+)\s*=\s*Object\.freeze\(\s*(['"`])/gm)]
    .map((m) => m[1]);
  assert.ok(stringConsts.length > 0);
  const missing = stringConsts.filter((key) => !(key in payload));
  assert.deepEqual(missing, [], `CLI 顶层 DESKTOP_* 字符串键未全量下发：${missing.join(', ')}`);

  assert.equal(I11_DESKTOP_KEYS.length, 95, 'I1.11 白名单必须 95 键（含五个视图导航键）');
  for (const key of I11_DESKTOP_KEYS) {
    assert.ok(key in payload, `白名单键未下发：${key}`);
    assert.equal(typeof payload[key], 'string', `白名单键必须是字符串模板：${key}`);
    assert.ok(payload[key].length > 0, `白名单键文案为空：${key}`);
  }
  for (const key of ['DESKTOP_VIEW_QUEUE', 'DESKTOP_VIEW_ASSETS', 'DESKTOP_VIEW_OCCUPANCY', 'DESKTOP_VIEW_CANVAS', 'DESKTOP_VIEW_EVIDENCE']) {
    assert.ok(I11_DESKTOP_KEYS.includes(key), `五个新视图导航键缺登记：${key}`);
  }
});

test('A-11：USAGE_LINES 未混入 /ui/labels（键与值都不含用法行）', () => {
  const entries = Object.entries(labelKeysPayload().keys);
  for (const line of USAGE_LINES) {
    if (line.trim() === '') continue;
    assert.ok(!entries.some(([key]) => key === line), `用法行被当作文案键：${line}`);
    assert.ok(!entries.some(([, value]) => value === line), `用法行被当作文案值：${line}`);
  }
});

// ---------------------------------------------------------------------------
// AC-43 不依赖 I1.10b
// ---------------------------------------------------------------------------

function listSourceFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|mjs|cjs)$/.test(entry.name)) out.push(full);
    }
  };
  walk(path.join(REPO, dir));
  return out;
}

/**
 * I1.11 立此断言时，下钻面（I1.10b）尚未合入，所以用「界面层不出现下钻标识」做
 * 前置能力隔离。beta.2 起下钻面成为正式交互，隔离口径随之收紧为**结构约束**：
 *   - 下钻实现模块（`desktop/ui/drill/**`）在界面层只允许装配层 `app.js` 接线；
 *   - 下钻的渲染适配只允许集中在 `shell/drill.js`（及统一出口 `shell/index.js`）；
 *   - I1.10b 内部实现标识（`drilldown` / `jumpHost` / `attachHost`）在全树仍为 0。
 * `desktop/harness/**` 是取证工具，按原状允许直接驱动 drill 投影。
 * 判据不放宽：新增了「谁可以 import drill 实现」这条更硬的检查。
 */
test('AC-43 源码级：desktop/ui + harness 不 import 下钻/节点详情/跳转类模块', () => {
  const ASSEMBLY = path.join('desktop', 'ui', 'app.js');
  const SHELL_ADAPTER = new Set([
    path.join('desktop', 'ui', 'shell', 'drill.js'),
    path.join('desktop', 'ui', 'shell', 'index.js'),
  ]);
  const DRILL_IMPL_IMPORT = /from\s+['"][^'"]*drill\/index\.js['"]/;
  const hits = [];
  for (const file of [...listSourceFiles('desktop/ui'), ...listSourceFiles('desktop/harness')]) {
    const rel = path.relative(REPO, file);
    const mayImportImpl = rel === ASSEMBLY || rel.startsWith(`desktop${path.sep}harness${path.sep}`);
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (/drilldown|jumpHost|attachHost/.test(line)) {
        hits.push(`${rel}: ${line.trim()}`);
      } else if (!SHELL_ADAPTER.has(rel) && /nodeDetail/.test(line)) {
        hits.push(`${rel}: ${line.trim()}`);
      } else if (!mayImportImpl && DRILL_IMPL_IMPORT.test(line)) {
        hits.push(`${rel}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(hits, [], `出现 I1.10b 前置能力引用：\n${hits.join('\n')}`);
});

function makeApp(io = {}) {
  const transport = {
    getInstances: async () => ({ status: 200, body: { items: [] } }),
    getQueue: async () => ({ status: 200, body: { items: [{ id: 'ESC-001' }], totals: {} } }),
    ...io,
  };
  return createApp({ labels: labelKeysPayload().keys, project: { view: 'instances' }, io: transport });
}

test('AC-43 行为级：open-queue 只展开本条、不跳转、不下钻', async () => {
  const app = makeApp();
  const openedGraph = [];
  const openedInstance = [];
  const originalGraph = app.openGraph;
  const originalInstance = app.openInstance;
  app.openGraph = async (...args) => { openedGraph.push(args); return originalGraph.apply(app, args); };
  app.openInstance = async (...args) => { openedInstance.push(args); return originalInstance.apply(app, args); };

  const target = await app.followNotification({ kind: 'escalation', instanceId: 'INST-001', ids: ['ESC-001'] });
  assert.equal(app.state().view, 'queue', '必须停在队列视图');
  assert.equal(app.state().expandedRow, 'ESC-001', '只展开本条');
  assert.deepEqual(app.state().selectedQueueIds, ['ESC-001']);
  assert.deepEqual(target.ids, ['ESC-001']);
  assert.deepEqual(openedGraph, [], '不得打开节点详情/图');
  assert.deepEqual(openedInstance, [], '不得跳转宿主会话');

  const src = readText('desktop/ui/app.js');
  assert.match(src, /action === 'open-queue'/, 'app.js 必须处理 open-queue');
  assert.match(
    src,
    /app\.followNotification\(\{ kind: 'escalation', ids: selected \}\)/,
    'open-queue 必须复用 followNotification（无第二条导航逻辑）',
  );
  assert.ok(!/openGraph\(.*selected/.test(src), 'open-queue 不得联动打开图/节点详情');
});
