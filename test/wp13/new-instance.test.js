/**
 * I1.10a WP-3：新建实例契约测试（`test/wp13/new-instance.test.js`）。
 *
 * 承担（拆分文档 §4 WP-3 + 需求判定口径）：
 * - 模块层：`validateNewInstance` 两条校验逐字（A-5「请选择工作流」「请填写
 *   任务说明」）、`buildStartRequest` 只含 `{template, task}`、
 *   `renderStartFailure` 经 `ERROR_TEMPLATE_*` 平铺键 + `DESKTOP_NEW_START_FAILED`
 *   包裹（AC-06 架构检查：错误文案只从 labels 取，界面层不硬编码中文）。
 * - AC-05（e2e）：`serve-entry --desktop` 起核 → `GET /workflows` 恰三个内置
 *   模板 → `POST /instances`（编码闭环带产物行）成功回 `{instanceId}` →
 *   `instances.changed` 推送 2 秒内触发 refetch，列表行六项齐全（阶段「运行中」、
 *   工作流「编码闭环」）→ 与 CLI `orch instance status` 的状态词/健康度词逐词
 *   相等 → 同参数再次启动被既有 `DIR_BUSY` 原文拒绝，实例数不变（只新增一例）。
 * - AC-06（e2e）：坏宿主现场（`launch.command` 指向不存在的解释器）→
 *   `启动失败 · <既有错误原文>`、列表实例数不变、无堆栈输出、重复失败也不产生实例。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { labelKeysPayload } from '../../src/daemon/http/labels.js';
import { TEMPLATE_LABEL } from '../../src/cli/labels.js';
import {
  buildStartRequest,
  renderStartFailure,
  validateNewInstance,
} from '../../desktop/ui/list/new-instance.js';
import { renderListRow } from '../../desktop/ui/list/list.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SERVE_ENTRY = path.join(REPO, 'src', 'daemon', 'serve-entry.js');
const BIN = path.join(REPO, 'bin', 'orch.js');
const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');

const LABELS = labelKeysPayload().keys;

function envFor(extra = {}) {
  const env = { ...process.env, NODE_ENV: 'test', ...extra };
  for (const key of ['MAESTRO_DSH_EXE', 'MAESTRO_DSH_BIN', 'MAESTRO_DSH_ARGS', 'MAESTRO_PERMISSION_POLICY']) {
    delete env[key];
  }
  return env;
}

function tmpRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(makeValue, timeoutMs = 20_000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await makeValue();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await sleep(intervalMs);
  }
}

function startDesktopDaemon(root) {
  const child = spawn(process.execPath, [SERVE_ENTRY, '--project', root, '--desktop'], {
    env: envFor(),
    stdio: 'ignore',
  });
  const ready = waitFor(() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'desktop.json'), 'utf8'));
    } catch {
      return null;
    }
  }, 30_000);
  return { child, ready };
}

async function stopDaemon(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await waitFor(() => child.exitCode !== null || child.signalCode !== null, 10_000);
}

function channel(meta) {
  const base = `http://127.0.0.1:${meta.port}`;
  const headers = { Authorization: `Bearer ${meta.token}`, 'Content-Type': 'application/json' };
  return {
    base,
    headers,
    async get(pathname) {
      const res = await fetch(`${base}${pathname}`, { headers });
      return { status: res.status, body: await res.json() };
    },
    async post(pathname, payload) {
      const res = await fetch(`${base}${pathname}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload ?? {}),
      });
      return { status: res.status, body: await res.json() };
    },
  };
}

function writeHostConfig(root, config) {
  const dir = path.join(root, '.orch', 'hosts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'dsh.json'), JSON.stringify(config, null, 2), 'utf8');
}

function mockHostConfig(root) {
  // accept-delay 60s 长于宿主等待预算：实例在测试窗口内保持「运行中」。
  return {
    transport: 'stdio',
    launch: { command: process.execPath, args: [MOCK, '--accept-delay-ms', '60000'] },
    limits: {
      initializeTimeoutMs: 15_000,
      requestTimeoutMs: 15_000,
      promptTimeoutMs: 120_000,
      quietIdleMs: 30,
      quietCapMs: 200,
    },
  };
}

// ---------------------------------------------------------------------------
// 模块层：校验 / 请求体 / 失败渲染
// ---------------------------------------------------------------------------

test('AC-06：两条面板校验逐字（A-5），面板不发起、不关闭由消费方保持 open', () => {
  assert.deepEqual(validateNewInstance({}, LABELS), {
    ok: false,
    message: '请选择工作流',
  });
  assert.deepEqual(validateNewInstance({ template: 'single', task: '   ' }, LABELS), {
    ok: false,
    message: '请填写任务说明',
  });
  assert.deepEqual(validateNewInstance({ template: 'single', task: '写一份说明' }, LABELS), {
    ok: true,
  });
});

test('AC-05：buildStartRequest 只含 {template, task} 两个字段', () => {
  assert.deepEqual(buildStartRequest({ template: 'single', task: '写一份说明' }), {
    template: 'single',
    task: '写一份说明',
  });
});

test('AC-06：失败渲染经 ERROR_TEMPLATE 平铺键 + DESKTOP_NEW_START_FAILED 包裹（逐字）', () => {
  // 缺产物行：既有原文逐字（A-5）。
  assert.equal(
    renderStartFailure({ code: 'PRODUCT_LINE_MISSING', params: {} }, LABELS),
    '启动失败 · 编码闭环需要在任务里写「产物：<路径>」一行（全角冒号，例如 产物：calc.js）',
  );
  // 空任务：既有原文逐字。
  assert.equal(
    renderStartFailure({ code: 'TASK_EMPTY', params: {} }, LABELS),
    '启动失败 · 任务描述不能为空',
  );
  // 缺参占位符保留 {xx}（占位符只字面替换）。
  assert.equal(
    renderStartFailure({ code: 'NODE_BUSY', params: {} }, LABELS),
    '启动失败 · 该节点正在执行，本次未发起',
  );
  assert.equal(
    renderStartFailure({ code: 'VERIFY_FAILED', params: {} }, LABELS),
    '启动失败 · 核对失败：{reason}',
  );
});

// ---------------------------------------------------------------------------
// AC-05：成功路径（e2e，真核 + mock 宿主）
// ---------------------------------------------------------------------------

test('AC-05：GET /workflows 三模板、POST 成功回 instanceId、2 秒入列表且与 CLI 逐词同构', async () => {
  const root = tmpRoot('maestro-i10a-new-');
  const { child, ready } = startDesktopDaemon(root);
  try {
    const meta = await ready;
    assert.ok(meta, 'desktop.json missing');
    writeHostConfig(root, mockHostConfig(root));
    const api = channel(meta);

    // 可选工作流：恰三个内置模板，顺序与标题逐字。
    const workflows = await api.get('/workflows');
    assert.equal(workflows.status, 200);
    assert.deepEqual(workflows.body.items, [
      { id: 'single', title: '单节点' },
      { id: 'code-loop', title: '编码闭环' },
      { id: 'task-loop', title: '通用任务闭环' },
    ]);
    assert.deepEqual(
      workflows.body.items.map((item) => item.id),
      Object.keys(TEMPLATE_LABEL),
    );

    // 启动前基线：空列表。
    const before = await api.get('/instances');
    assert.equal(before.body.items.length, 0);

    // POST /instances：编码闭环，任务两行（第二行产物声明），与 CLI 同参。
    const started = await api.post('/instances', {
      template: 'code-loop',
      task: '实现 calc.js\n产物：calc.js',
    });
    assert.equal(started.status, 200, `start failed: ${JSON.stringify(started.body)}`);
    assert.equal(typeof started.body.instanceId, 'string');
    const instanceId = started.body.instanceId;
    assert.ok(!('stack' in started.body));

    // 2 秒内入列表（等核心把实例落盘并推进到运行态）。
    const listed = await waitFor(async () => {
      const res = await api.get('/instances');
      return res.body.items.find((item) => item.instanceId === instanceId) ?? null;
    }, 2_000);
    assert.ok(listed, 'new instance did not appear within 2s');
    assert.equal(listed.phase, 'running');
    assert.equal(listed.template, 'code-loop');
    const row = renderListRow(listed, LABELS);
    assert.match(row, / · 编码闭环 · 运行中 · /);
    assert.equal(row.split(' · ').length, 6);

    // 与 CLI 同参启动的实例逐词同构：状态词与健康度词分别相等。
    const cli = spawnSync(process.execPath, [BIN, 'instance', 'status', '--instance', instanceId], {
      cwd: root,
      env: envFor(),
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(cli.status, 0, `orch instance status failed:\n${cli.stdout}\n${cli.stderr}`);
    const cliLines = cli.stdout.split('\n').filter((line) => line.length > 0);
    const cliInstanceLine = cliLines.find((line) => line.startsWith(`实例 ${instanceId}`));
    assert.ok(cliInstanceLine, `CLI instance line missing:\n${cli.stdout}`);
    const cliHealthLine = cliLines.find((line) => line.startsWith('健康度 '));
    assert.ok(cliHealthLine, `CLI health line missing:\n${cli.stdout}`);
    const rowFields = row.split(' · ');
    const cliFields = cliInstanceLine.split(' · ');
    // CLI 实例行不带工作流名：字段为 实例 <id> · <状态词> · ...，
    // 与列表行字段 [2]（状态词）对位比较。
    assert.equal(rowFields[2], cliFields[1], 'state word must match the CLI wording');
    assert.equal(rowFields[5], cliHealthLine.split(' ')[1], 'health word must match the CLI wording');

    // 同参数再次启动：既有 DIR_BUSY 原文拒绝，实例数不变（只新增一例、无重复）。
    const busy = await api.post('/instances', {
      template: 'code-loop',
      task: '实现 calc.js\n产物：calc.js',
    });
    assert.equal(busy.status, 422);
    assert.equal(busy.body.error, 'DIR_BUSY');
    assert.ok(!('stack' in busy.body));
    const after = await api.get('/instances');
    assert.deepEqual(
      after.body.items.map((item) => item.instanceId).sort(),
      [instanceId].sort(),
    );
    assert.equal(
      renderStartFailure(busy.body, LABELS),
      `启动失败 · 该目录已有未结束的实例 ${instanceId}，本次未发起`,
    );
  } finally {
    await stopDaemon(child);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// AC-06：失败现场（e2e，坏宿主 launch.command）
// ---------------------------------------------------------------------------

test('AC-06：宿主启动失败现场显示「启动失败 · <既有错误原文>」，列表实例数不变', async () => {
  const root = tmpRoot('maestro-i10a-new-fail-');
  const { child, ready } = startDesktopDaemon(root);
  try {
    const meta = await ready;
    assert.ok(meta, 'desktop.json missing');
    // 坏现场：launch.command 指向不存在的解释器，等价宿主拉起失败。
    writeHostConfig(root, {
      transport: 'stdio',
      launch: { command: '/nonexistent/maestro-no-such-interpreter', args: [] },
      limits: {
        initializeTimeoutMs: 15_000,
        requestTimeoutMs: 15_000,
        promptTimeoutMs: 30_000,
        quietIdleMs: 30,
        quietCapMs: 200,
      },
    });
    const api = channel(meta);

    const failed = await api.post('/instances', { template: 'single', task: '写一份说明' });
    assert.equal(failed.status, 422);
    assert.equal(failed.body.error, 'DSH_SPAWN_FAILED');
    assert.ok(!('stack' in failed.body), 'no stack traces in failure payloads');
    assert.match(failed.body.message, /^无法启动 DSH：/);
    assert.equal(
      renderStartFailure(failed.body, LABELS),
      `启动失败 · ${failed.body.message}`,
    );

    // 列表实例数不变；再失败一次仍不产生实例。
    const after1 = await api.get('/instances');
    assert.deepEqual(after1.body.items, []);
    const failed2 = await api.post('/instances', { template: 'single', task: '写一份说明' });
    assert.equal(failed2.status, 422);
    assert.equal(failed2.body.error, 'DSH_SPAWN_FAILED');
    const after2 = await api.get('/instances');
    assert.deepEqual(after2.body.items, []);
  } finally {
    await stopDaemon(child);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
