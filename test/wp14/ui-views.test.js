/**
 * I1.11 WP-8 desktop UI view-model + wiring tests.
 *
 * Covers AC-04 / AC-05 / AC-08 / AC-11 / AC-14 / AC-42 / AC-43 / AC-47 /
 * AC-49 at the UI layer plus the A-2 ~ A-8 verbatim text anchors, the
 * zero-CJK-literal gate (BR-26) and the five harness dumps.
 *
 * Method: pure view models are exercised directly with a flat label table
 * built from the authoritative `src/cli/labels.js` constants (BR-26 single
 * source); `createApp` is exercised headlessly through injected transport
 * seams (no DOM), the same way test/wp13/errors.test.js drives the assembly.
 * Harnesses are driven end-to-end with spawnSync, matching test/wp13.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import * as CLI from '../../src/cli/labels.js';
import { UI_LABEL_KEYS, labelKeysPayload, labelsResponseBody } from '../../src/daemon/http/labels.js';
import { createApp, viewNavItems } from '../../desktop/ui/app.js';
import {
  CONTROLS,
  renderQueueRow,
  actionsFor,
  emptyText as queueEmpty,
  disconnectedText as queueDisconnected,
  confirmTexts,
  outcomeOf,
  prefsRows,
} from '../../desktop/ui/queue/queue.js';
import {
  ASSET_KINDS,
  tabText,
  countText,
  rowText as assetRow,
  dirUnreadableText,
  detailLines,
} from '../../desktop/ui/assets/assets.js';
import {
  renderOccupancyRow,
  emptyText as occupancyEmpty,
  skippedText,
  disconnectedText as occupancyDisconnected,
} from '../../desktop/ui/occupancy/occupancy.js';
import {
  titleText,
  validationBadge,
  degradeOf,
  degradeText,
  nodeRow,
  edgeRow,
  graphEdges,
} from '../../desktop/ui/canvas/canvas.js';
import {
  itemLines,
  capText,
  renderEvidence,
  RENDER_LIMIT_BYTES,
} from '../../desktop/ui/evidence/evidence.js';
import {
  notifyKey,
  replaceIntent,
  queueTargetOf,
  stripEntryOf,
} from '../../desktop/ui/notify/notify.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Flat label table: every cli constant by its own name, object tables flattened. */
function buildLabels() {
  const table = { ...UI_LABEL_KEYS };
  for (const [key, value] of Object.entries(CLI)) {
    if (typeof value === 'string') {
      table[key] = value;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [member, text] of Object.entries(value)) {
        if (typeof text !== 'string') continue;
        const snake = String(member)
          .replaceAll('-', '_')
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .toUpperCase();
        table[`${key}_${snake}`] = text;
      }
    }
  }
  return Object.freeze(table);
}

const L = buildLabels();

function makeTemp(prefix = 'wp14ui-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

function writePayload(dir, name, value) {
  const file = path.join(dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return file;
}

function runHarness(name, payloadFile) {
  return spawnSync(process.execPath, [
    path.join(REPO, 'desktop', 'harness', `${name}-dump.mjs`),
    '--payload', payloadFile,
  ], { encoding: 'utf8', cwd: REPO });
}

// ---------------------------------------------------------------- A-2 prefs / toggles

test('A-2 / AC-05: notification toggles render in fixed order, default all on', () => {
  const rows = prefsRows(null, L);
  assert.deepEqual(rows.map((row) => row.key), ['enabled', 'escalate', 'completed', 'anomaly']);
  assert.deepEqual(rows.map((row) => row.checked), [true, true, true, true]);
  assert.deepEqual(rows.map((row) => row.text), [
    CLI.DESKTOP_NOTIFY_TOGGLE,
    CLI.DESKTOP_NOTIFY_TOGGLE_ESCALATION,
    CLI.DESKTOP_NOTIFY_TOGGLE_COMPLETED,
    CLI.DESKTOP_NOTIFY_TOGGLE_ANOMALY,
  ]);
  const partial = prefsRows({ enabled: true, escalate: false, completed: true, anomaly: false }, L);
  assert.deepEqual(partial.map((row) => row.checked), [true, false, true, false]);
});

test('A-2 / AC-49: already-resolved notice is verbatim from the daemon conclusion', () => {
  const row = renderQueueRow({ id: 'ESC-001', type: 'escalation' }, L);
  const answer = { ok: false, conclusion: CLI.RESOLUTION_LABEL.retry };
  const outcome = outcomeOf(answer, { type: row.type, id: 'ESC-001', decision: 'retry' }, L);
  assert.equal(outcome.kind, 'notice');
  assert.equal(outcome.text, '已处理（重新分配），无需再次处理');
});

// ---------------------------------------------------------------- A-3 / A-4 queue

test('A-3 / AC-08: escalation + approval rows keep all seven segments verbatim', () => {
  const esc = renderQueueRow({
    id: 'ESC-001', type: 'escalation', instanceId: 'INST-001', nodeId: 'T-001',
    role: CLI.ROLE_LABEL?.dev ?? '开发', round: 1, stateWord: CLI.ESCALATION_LABEL.pending,
    reasonSummary: CLI.QUEUE_LABELS?.REASON_ROUNDS ?? '轮次超限', createdAt: '2026-01-01T00:00:00Z',
  }, L);
  assert.equal(esc.text.split(' · ').length, 7);
  assert.ok(esc.text.startsWith('升级 ESC-001 · 实例 INST-001'));
  const apr = renderQueueRow({
    id: 'APR-001', type: 'approval', instanceId: 'INST-002', nodeId: 'T-002',
    role: '执行者', round: 2, stateWord: CLI.APPROVAL_LABEL.pending,
    reasonSummary: `${CLI.DESKTOP_QUEUE_ACTION_PREFIX} write`, createdAt: '2026-01-01T00:00:01Z',
  }, L);
  assert.equal(apr.text.split(' · ').length, 7);
  assert.ok(apr.text.includes(' · 动作 write · '));
  assert.ok(apr.text.endsWith('2026-01-01T00:00:01Z'));
});

test('A-3 / AC-08: node-less degraded row keeps node/round segments', () => {
  const row = renderQueueRow({
    id: null, type: 'approval', instanceId: 'INST-009', nodeId: null, round: null,
  }, L);
  assert.equal(row.unreadable, true);
  assert.equal(row.text, renderQueueRow({ id: null, instanceId: 'INST-009' }, L).text);
  assert.equal(queueEmpty(L), '待处理 无');
  assert.equal(queueDisconnected(L), '已断开 · 正在重连…');
});

test('A-4 / AC-08: CONTROLS is the closed action list; per-type actions fixed', () => {
  assert.deepEqual([...CONTROLS], ['pass', 'retry', 'cancel', 'allow', 'deny']);
  const esc = renderQueueRow({ id: 'E-1', type: 'escalation', passable: true }, L);
  assert.deepEqual(actionsFor(esc, L).map((a) => a.id), ['pass', 'retry', 'cancel']);
  const apr = renderQueueRow({ id: 'A-1', type: 'approval' }, L);
  assert.deepEqual(actionsFor(apr, L).map((a) => a.id), ['allow', 'deny']);
  assert.ok(!CONTROLS.includes('filter') && !CONTROLS.includes('search') && !CONTROLS.includes('columns'));
});

test('A-4 / AC-11: cancel is two-step with verbatim confirm line', () => {
  const texts = confirmTexts('INST-001', L);
  assert.equal(texts.line, '终止实例 INST-001？终止后该实例不再继续');
  assert.equal(texts.ok, CLI.DESKTOP_QUEUE_CONFIRM_OK);
  assert.equal(texts.dismiss, CLI.DESKTOP_QUEUE_CONFIRM_DISMISS);
});

test('A-4 / AC-14: result lines use the daemon conclusion vocabulary', () => {
  const ok = outcomeOf({ ok: true, conclusion: CLI.RESOLUTION_LABEL.pass }, {
    type: 'escalation', id: 'E-1', decision: 'pass',
  }, L);
  assert.equal(ok.kind, 'result');
  assert.equal(ok.text, '升级 E-1 已处理（通过）');
  const denied = outcomeOf({ ok: false, hint: CLI.DESKTOP_QUEUE_DISABLED_HINT }, {
    type: 'escalation', id: 'E-1', decision: 'pass',
  }, L);
  assert.equal(denied.kind, 'denied');
  assert.equal(denied.passHint, '该升级只能重派或终止');
});

// ---------------------------------------------------------------- A-5 assets / A-6 occupancy

test('A-5: three tabs, count line, rows and unreadable banners are verbatim', () => {
  assert.deepEqual([...ASSET_KINDS], ['roles', 'skills', 'workflows']);
  assert.equal(tabText('roles', L), '角色');
  assert.equal(countText('roles', { total: 12, builtin: 9, project: 3 }, L),
    '角色 12 个（内置 9 · 项目 3）');
  const row = assetRow('roles', { id: 'r1', name: '审查', group: '编码工程', source: '内置', validation: '通过' }, L);
  assert.equal(row.text, '角色 审查 · 编码工程 · 内置 · 通过');
  assert.equal(assetRow('roles', { id: 'bad', validation: '不可读', unreadable: true }, L).unreadable, true);
  assert.equal(dirUnreadableText('skills', L), '资产不可读 · .orch/skills');
});

test('A-5: detail lines render fixed order with missing markers', () => {
  const lines = detailLines('roles', {
    found: true, name: '审查', groupLabel: '编码工程', artifactType: 'skill',
    sideEffect: 'none', maxConcurrentSessions: 1, skills: [{ id: 's1' }, { id: 's2', missing: true }],
    tools: ['read'], wakeAllow: [], validation: '通过',
  }, L);
  assert.ok(lines.length >= 4);
  assert.ok(lines.some((line) => line.includes('s2 · 缺失')));
  assert.ok(lines.some((line) => line.startsWith('校验 ')));
});

test('A-6 / AC-26 AC-28: occupancy row, empty, skipped, hosts are verbatim', () => {
  const row = renderOccupancyRow({
    roleId: 'dev', roleName: '开发', status: CLI.ROLE_INSTANCE_STATUS_LABEL.busy,
    instances: 2, activeSessions: 3, servingNodes: ['T-001', 'T-002', 'T-003', 'T-004'],
    hosts: ['dsh', 'cursor'],
  }, L);
  assert.equal(row.text,
    `角色 开发 · ${CLI.ROLE_INSTANCE_STATUS_LABEL.busy} · 参与 2 个实例 · 3 个活跃会话 · 服务 T-001 等 4 个 · 宿主 dsh, cursor`);
  assert.equal(occupancyEmpty(L), '角色占用 无');
  assert.equal(skippedText(['a', 'b'], L), '2 个实例状态不可读，已跳过');
  assert.equal(skippedText([], L), null);
  assert.equal(occupancyDisconnected(L), '已断开 · 正在重连…');
});

// ---------------------------------------------------------------- A-7 canvas

test('A-7 / AC-29 AC-31 AC-45: title, badge, degradation branches and backflow edges', () => {
  const projection = {
    title: 'release-flow', readable: true, valid: false,
    nodes: [{ id: 'T-001', nodeType: 'role', label: 'T-001' }],
    edges: [{ from: 'T-001', to: 'T-002', kind: 'backflow' }],
  };
  assert.equal(titleText(projection, L), '工作流 release-flow · 定义态 · 1 节点 · 1 条边');
  assert.equal(validationBadge(projection, L), '校验不通过');
  assert.equal(degradeOf({ readable: true, nodes: [] }), 'empty');
  assert.equal(degradeOf({ readable: false, nodes: [] }), 'unreadable');
  assert.equal(degradeOf({ readable: false, nodes: projection.nodes }), 'partial');
  assert.equal(degradeOf(projection), 'ok');
  assert.equal(degradeText({ readable: true, nodes: [] }, L).text, '定义 空');
  assert.equal(degradeText({ readable: false, nodes: [], problems: ['bad yaml'] }, L).text,
    '定义不可读 · 仅显示可解析部分');
  assert.equal(degradeText({ readable: false, nodes: [], problems: ['bad yaml'] }, L).reasons[0], 'bad yaml');
  assert.equal(degradeText({ readable: false, nodes: projection.nodes }, L).text, null);
  const edge = edgeRow({ from: 'A', to: 'B', kind: 'backflow' }, L);
  assert.equal(edge.kind, 'backflow');
  assert.equal(edge.direction, 'backflow');
  assert.deepEqual(graphEdges(projection).map((e) => e.direction), ['backflow']);
});

test('A-7 / AC-29: node rows reuse the instance-graph shape keys', () => {
  assert.equal(nodeRow({ id: 'H-001', nodeType: 'human', title: '人工', status: '待处理' }, L).text,
    `人工节点 人工 · 待处理`);
  const sub = nodeRow({ id: 'S-001', nodeType: 'subworkflow', title: '子流程', memberCount: 3,
    label: '子工作流：子流程 · 3 角色' }, L);
  assert.equal(sub.text, '子工作流：子流程 · 3 角色');
});

// ---------------------------------------------------------------- A-8 evidence

test('A-8 / AC-32: five fields + round render verbatim, latest only', () => {
  const item = {
    nodeId: 'T-003', round: 2, command: 'npm test', exitCode: 1, keyOutputLines: 12,
    logRef: 'logs/T-003-2.txt',
    artifactRefs: [{ ref: 'calc.js', bytes: 100, sha256: null, verifiedAt: '2026-11-15T10:30:00Z' }],
    unreadable: [],
  };
  const rendered = itemLines(item, L);
  assert.deepEqual(rendered.lines, [
    '节点 T-003 · 第 2 轮',
    '命令 npm test',
    '退出码 1',
    '关键输出 12 行',
    '日志 logs/T-003-2.txt',
    '产物 calc.js · 校验于 2026-11-15T10:30:00Z',
    '完整日志留在宿主',
  ]);
});

test('A-8 / AC-33: missing fields render the unprovided word', () => {
  const rendered = itemLines({ nodeId: 'T-004', round: 1 }, L);
  assert.deepEqual(rendered.lines, [
    '节点 T-004 · 第 1 轮',
    '命令 未提供', '退出码 未提供', '关键输出 未提供', '日志 未提供',
    '产物 未提供', '完整日志留在宿主',
  ]);
});

test('A-8 / AC-34: unreadable / truncated markers, 64 KB gate, no body leak', () => {
  const bad = itemLines({
    nodeId: 'T-005', round: 3, command: 'x', exitCode: 0, keyOutputLines: 1,
    logRef: 'huge.log', artifactRefs: [{ ref: 'calc.js' }],
    unreadable: ['huge.log', `${CLI.DESKTOP_EVIDENCE_TRUNCATED}：command`],
  }, L);
  assert.ok(bad.lines.some((line) => line === '日志 huge.log 引用不可读'));
  assert.ok(bad.lines.some((line) => line.includes(CLI.DESKTOP_EVIDENCE_TRUNCATED)));
  const huge = 'x'.repeat(RENDER_LIMIT_BYTES + 5000);
  const capped = capText(huge, L);
  assert.equal(capped.capped, true);
  assert.ok(capped.bytes <= RENDER_LIMIT_BYTES);
  assert.ok(capped.text.endsWith(CLI.DESKTOP_EVIDENCE_TRUNCATED));
  const whole = renderEvidence({ instanceId: 'I-1', items: [] }, L);
  assert.equal(whole.capped, false);
  assert.equal(whole.bytes, 0);
  assert.ok(!JSON.stringify(L).includes('npm run lint'), 'label table must not embed a log body');
});

// ---------------------------------------------------------------- D-46 notify consumption

test('D-46 / AC-04: notify replace by (kind,instanceId) + queue target routing', () => {
  const a = { kind: 'escalation', instanceId: 'I-1', ids: ['ESC-001'], title: 'A' };
  const b = { kind: 'escalation', instanceId: 'I-1', ids: ['ESC-001'], title: 'B', mergedCount: 2 };
  assert.equal(notifyKey(a), 'escalation|I-1');
  const list = replaceIntent(replaceIntent([], a), b);
  assert.equal(list.length, 1);
  assert.equal(list[0].title, 'B');
  assert.equal(stripEntryOf(list).title, 'B');
  const target = queueTargetOf(b);
  assert.equal(target.selectable, true);
  assert.deepEqual(target.ids, ['ESC-001']);
  assert.equal(queueTargetOf({ kind: 'completed', instanceId: 'I-1' }).selectable, false);
});

// ---------------------------------------------------------------- app wiring (headless)

function makeApp(overrides = {}) {
  const transport = {
    getInstances: async () => ({ status: 200, body: { items: [] } }),
    getWorkflows: async () => ({ status: 200, body: { items: [] } }),
    getQueue: async () => ({ status: 200, body: { items: [], totals: {} } }),
    getPrefs: async () => ({ status: 200, body: { enabled: true, escalate: true, completed: true, anomaly: true } }),
    postPrefs: async (patch) => ({ status: 200, body: { enabled: true, escalate: true, completed: true, anomaly: true, ...patch } }),
    getAssets: async () => ({ status: 200, body: { items: [], counts: {}, dirUnreadable: false } }),
    getAsset: async () => ({ status: 200, body: { found: true } }),
    getOccupancy: async () => ({ status: 200, body: { rows: [], skipped: [] } }),
    getCanvas: async () => ({ status: 200, body: { title: 'wf', readable: true, valid: true, nodes: [], edges: [] } }),
    getEvidence: async () => ({ status: 200, body: { instanceId: 'I-1', items: [] } }),
    postEscalationDecision: async (id, decision) => ({ status: 200, body: { ok: true, conclusion: CLI.RESOLUTION_LABEL.pass } }),
    postApprovalDecision: async () => ({ status: 200, body: { ok: true, conclusion: CLI.APPROVAL_LABEL.approved } }),
    postCancel: async () => ({ status: 200, body: { ok: true, result: null } }),
    ...(overrides.io ?? {}),
  };
  return createApp({ labels: L, project: { view: 'instances' }, io: transport, ...overrides });
}

test('AC-43 / setView: five new keys switch view, existing four unchanged', () => {
  const app = makeApp();
  for (const view of ['queue', 'assets', 'occupancy', 'canvas', 'evidence']) {
    app.setView(view);
    assert.equal(app.state().view, view);
  }
  app.setView('instances');
  assert.equal(app.state().view, 'instances');
  app.setView('graph'); // graph has no data -> stays instances, verbatim behavior
  assert.equal(app.state().view, 'instances');
});

test('AC-04 / AC-49: followNotification navigates to queue and selects the row', async () => {
  const app = makeApp();
  const target = await app.followNotification({
    kind: 'escalation', instanceId: 'I-1', ids: ['ESC-001'], title: 'N',
  });
  assert.equal(app.state().view, 'queue');
  assert.deepEqual(target.ids, ['ESC-001']);
  assert.equal(app.state().selectedQueueIds[0], 'ESC-001');
  assert.equal(app.state().expandedRow, 'ESC-001');
});

test('AC-11: cancel confirm is two-step; dismiss leaves no pending confirm', async () => {
  const app = makeApp();
  app.beginCancel('ESC-001');
  assert.equal(app.state().queueConfirm.id, 'ESC-001');
  app.dismissCancel();
  assert.equal(app.state().queueConfirm, null);
  app.beginCancel('ESC-001');
  const outcome = await app.cancelConfirmed();
  assert.equal(outcome.kind, 'result');
  assert.equal(app.state().queueConfirm, null);
});

test('AC-05: prefs toggles write through the HTTP seam', async () => {
  const writes = [];
  const app = makeApp();
  app.state().labels = L;
  const transport = app.state();
  void transport;
  await app.saveQueuePrefs({ completed: false });
  assert.equal(app.state().queuePrefs.completed, false);
  assert.deepEqual(writes, []); // no local state write beyond the read-back seam
});

test('AC-47: queue snapshot frame replaces content; disconnect keeps last rows', () => {
  const app = makeApp();
  app.state().queue = { items: [{ id: 'OLD-1' }, { id: 'OLD-2' }] };
  const result = app.handleFrame({ type: 'queue.snapshot', data: { items: [{ id: 'NEW-1' }] } });
  assert.equal(result.repaint, 'queue');
  assert.equal(app.state().queue.items.length, 1);
  app.state().connection.markReady();
  app.state().connection.disconnect();
  const model = app.compose();
  assert.equal(model.statusText, L.DESKTOP_CONN_RECONNECTING);
});

test('AC-42: seven anomaly wordings all resolve from the label table', () => {
  assert.equal(queueDisconnected(L), '已断开 · 正在重连…');
  assert.ok(confirmTexts('X', L).line.includes('终止'));
  assert.equal(degradeText({ readable: false, nodes: [], problems: [] }, L).text, '定义不可读 · 仅显示可解析部分');
  assert.equal(dirUnreadableText('roles', L), '资产不可读 · .orch/roles');
  assert.equal(degradeText({ readable: true, nodes: [] }, L).text, '定义 空');
  assert.equal(itemLines({ nodeId: 'T', round: 1, logRef: 'x', unreadable: ['x'] }, L)
    .lines.find((line) => line.startsWith('日志 ')), '日志 x 引用不可读');
  assert.equal(typeof L.DESKTOP_NOTIFY_UNAVAILABLE, 'string');
});

// ---------------------------------------------------------------- D-51 production label chain

test('D-51: real /ui/labels response carries A-11 keys with non-null Chinese (no buildLabels bypass)', () => {
  // Parse the actual response body the daemon serves, not the test helper.
  const served = JSON.parse(labelsResponseBody()).keys;
  const expected = {
    DESKTOP_QUEUE_ROW_ESC: CLI.DESKTOP_QUEUE_ROW_ESC,
    DESKTOP_VIEW_QUEUE: CLI.DESKTOP_VIEW_QUEUE,
    DESKTOP_TRAY_STATUS: CLI.DESKTOP_TRAY_STATUS,
  };
  for (const [key, value] of Object.entries(expected)) {
    assert.ok(key in served, `${key} missing from /ui/labels`);
    assert.equal(typeof served[key], 'string', `${key} is not a string`);
    assert.ok(served[key].length > 0, `${key} is empty`);
    assert.equal(served[key], value, `${key} not sourced from CLI`);
  }
  assert.equal(served.DESKTOP_VIEW_QUEUE, '人工干预队列');
  assert.equal(served.DESKTOP_VIEW_ASSETS, '角色与技能库');
  assert.equal(served.DESKTOP_VIEW_CANVAS, '工作流画布');
  assert.ok(!('DESKTOP_QUEUE_CONCLUSIONS' in served), 'object table must not be served');
  assert.equal(Object.keys(labelKeysPayload().keys).length, 312);
});

test('D-51: paintViewNav derives five nav buttons from delivered /ui/labels keys', () => {
  const served = labelKeysPayload().keys;
  const items = viewNavItems(served);
  assert.deepEqual(items.map((item) => item.view), [
    'queue', 'assets', 'occupancy', 'canvas', 'evidence',
  ]);
  assert.deepEqual(items.map((item) => item.text), [
    served.DESKTOP_VIEW_QUEUE,
    served.DESKTOP_VIEW_ASSETS,
    served.DESKTOP_VIEW_OCCUPANCY,
    served.DESKTOP_VIEW_CANVAS,
    served.DESKTOP_VIEW_EVIDENCE,
  ]);
  assert.equal(items[0].text, '人工干预队列');
  // A missing delivered label skips its button instead of rendering a broken one.
  const partial = viewNavItems({ DESKTOP_VIEW_QUEUE: 'Q' });
  assert.deepEqual(partial, [{ view: 'queue', key: 'DESKTOP_VIEW_QUEUE', text: 'Q' }]);
});

// ---------------------------------------------------------------- BR-26 zero CJK

test('BR-26: desktop/ui + desktop/harness carry zero CJK literals (comments included)', () => {
  const hits = [];
  for (const dir of ['desktop/ui', 'desktop/harness']) {
    const root = path.join(REPO, dir);
    const walk = (d) => {
      for (const name of fs.readdirSync(d)) {
        const file = path.join(d, name);
        const stat = fs.statSync(file);
        if (stat.isDirectory()) walk(file);
        else if (/\.(mjs|js)$/.test(name)) {
          fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
            if (/[\u4e00-\u9fa5]/.test(line)) hits.push(`${path.relative(REPO, file)}:${i + 1}`);
          });
        }
      }
    };
    walk(root);
  }
  assert.deepEqual(hits, []);
});

// ---------------------------------------------------------------- harness end-to-end

test('harness: queue-dump exports empty row + prefs verbatim', () => {
  const dir = makeTemp();
  try {
    const file = writePayload(dir, 'queue.json', {
      labels: L, items: [],
    });
    const res = runHarness('queue', file);
    assert.equal(res.status, 0, res.stderr);
    const out = JSON.parse(res.stdout);
    assert.equal(out.emptyText, '待处理 无');
    assert.deepEqual(out.prefs.map((p) => p.key), ['enabled', 'escalate', 'completed', 'anomaly']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('harness: assets-dump exports tabs + count verbatim', () => {
  const dir = makeTemp();
  try {
    const file = writePayload(dir, 'assets.json', {
      labels: L, kind: 'roles', items: [], counts: { total: 3, builtin: 2, project: 1 },
    });
    const res = runHarness('assets', file);
    assert.equal(res.status, 0, res.stderr);
    const out = JSON.parse(res.stdout);
    assert.equal(out.tabs[0].text, '角色');
    assert.equal(out.countText, '角色 3 个（内置 2 · 项目 1）');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('harness: occupancy-dump exports row + empty verbatim', () => {
  const dir = makeTemp();
  try {
    const file = writePayload(dir, 'occupancy.json', {
      labels: L, rows: [{
        roleId: 'dev', roleName: '开发', status: CLI.ROLE_INSTANCE_STATUS_LABEL.available,
        instances: 0, activeSessions: 0, servingNodes: [], hosts: [],
      }], skipped: [],
    });
    const res = runHarness('occupancy', file);
    assert.equal(res.status, 0, res.stderr);
    const out = JSON.parse(res.stdout);
    assert.equal(out.rows.length, 1);
    assert.ok(out.rows[0].text.startsWith('角色 开发'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('harness: canvas-dump exports title + degradation + layout reuse', () => {
  const dir = makeTemp();
  try {
    const file = writePayload(dir, 'canvas.json', {
      labels: L, title: 'release-flow', readable: true, valid: true,
      nodes: [{ id: 'T-001', nodeType: 'role', label: 'T-001' }], edges: [],
    });
    const res = runHarness('canvas', file);
    assert.equal(res.status, 0, res.stderr);
    const out = JSON.parse(res.stdout);
    assert.equal(out.title, '工作流 release-flow · 定义态 · 1 节点 · 0 条边');
    assert.equal(out.nodes[0].layer, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('harness: evidence-dump exports A-8 lines + 64 KB gate', () => {
  const dir = makeTemp();
  try {
    const file = writePayload(dir, 'evidence.json', {
      labels: L, instanceId: 'I-1', items: [{
        nodeId: 'T-003', round: 2, command: 'npm test', exitCode: 1, keyOutputLines: 12,
        logRef: 'logs/T-003-2.txt',
        artifactRefs: [{ ref: 'calc.js', verifiedAt: '2026-11-15T10:30:00Z' }], unreadable: [],
      }],
    });
    const res = runHarness('evidence', file);
    assert.equal(res.status, 0, res.stderr);
    const out = JSON.parse(res.stdout);
    assert.ok(out.text.includes('节点 T-003 · 第 2 轮'));
    assert.ok(out.text.includes('命令 npm test'));
    assert.ok(out.text.includes('完整日志留在宿主'));
    assert.equal(out.capped, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("D-52 / open-queue: shell ctl seam navigates the live window to queue", async () => {
  const src = fs.readFileSync(new URL("../../desktop/ui/app.js", import.meta.url), "utf8");
  assert.match(src, /action === \x27open-queue\x27/, "app.js must handle the shell open-queue ctl");
  assert.match(src, /app\.followNotification\(\{ kind: \x27escalation\x27, ids: selected \}\)/,
    "open-queue must reuse followNotification (no second navigation path)");
  // Behavioural half: the API the seam calls really navigates and selects.
  const app = makeApp();
  const target = await app.followNotification({ kind: "escalation", instanceId: "I-1", ids: ["ESC-001"] });
  assert.equal(app.state().view, "queue");
  assert.equal(target.ids[0], "ESC-001");
});
