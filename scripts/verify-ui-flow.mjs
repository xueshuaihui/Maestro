#!/usr/bin/env node
/**
 * Pre-release verification: the core journey MUST be configurable through the
 * real desktop channel, not only through the CLI.
 *
 * `verify-core.mjs` drives `src/studio/*` directly. This script instead boots
 * the actual HTTP transport (`src/daemon/http/server.js`) with NO manual route
 * registration, so the lazy S-02 seam that ships in the product is what
 * answers. Every request below is the exact sequence `desktop/ui/studio/
 * studio.js` issues when a user walks the six wizard steps, and every label is
 * resolved through `GET /studio/labels` the way the page resolves it.
 *
 * What it proves:
 *   1. the static face serves the Studio page and its assets (public, per D-R);
 *   2. every label key the page references literally exists in STUDIO_TEXT;
 *   3. CLI scan -> org seed -> flow -> team -> run -> gates -> tasks -> change
 *      all complete through POST /studio/action with `ok:true`;
 *   4. the projected `/studio/state` contains no raw label key or raw id where
 *      a Chinese sentence is expected (i.e. the page would not render `STAGE_*`);
 *   5. failure paths answer with a code + a resolvable labelKey.
 *
 * Isolated HOME keeps `~/.maestro/projects.json` untouched.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createHttpServer } from '../src/daemon/http/server.js';
import { createEventBus } from '../src/core/event-bus.js';
import { createStore } from '../src/persistence/instance-store.js';
import { STUDIO_TEXT } from '../src/cli/labels.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const steps = [];
function record(name, ok, detail) {
  steps.push({ name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name} — ${detail}`);
}
function assertStep(name, condition, detail) {
  record(name, condition === true, detail);
  return condition === true;
}

async function makeFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-ui-flow-'));
  const home = path.join(root, 'home');
  await fs.mkdir(home, { recursive: true });
  await fs.mkdir(path.join(root, '.orch'), { recursive: true });
  // The transport resolves desktop.json / studio.json under root/.orch, and the
  // studio domain resolves `~/.maestro/projects.json` under HOME. Isolate both.
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  return { root, home };
}

function client({ port, token }) {
  const base = `http://127.0.0.1:${port}`;
  return {
    async get(pathname, { auth = true } = {}) {
      const res = await fetch(base + pathname, {
        headers: auth ? { Authorization: `Bearer ${token}` } : {}
      });
      const text = await res.text();
      let body = null;
      try { body = JSON.parse(text); } catch { body = text; }
      return { status: res.status, body };
    },
    async action(payload) {
      const res = await fetch(base + '/studio/action', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return { status: res.status, body: await res.json() };
    }
  };
}

async function main() {
  const { root, home } = await makeFixture();

  const bus = createEventBus({ store: createStore({ root }) });
  const httpServer = createHttpServer({
    root,
    orchestrator: {
      async start() { return { ok: false, code: 'IPC_BAD_PARAMS' }; },
      async listInstances() { return { ok: true, items: [] }; },
      async getStatus() { return { ok: false, code: 'NOT_FOUND' }; },
      async reconcileOnBoot() { return { ok: true, interrupted: [] }; },
      async interruptAll() { return { ok: true, interrupted: [] }; },
      async dispose() {}
    },
    bus,
    graph: {
      loadState: async (id) => ({ ok: true, state: { instanceId: id } }),
      replayEvents: async () => [],
      readTraces: async () => ({ spans: [] })
    }
  });

  const listened = await httpServer.listen();
  if (!listened.ok) {
    record('启动桌面 HTTP 通道', false, JSON.stringify(listened));
    return finish(root);
  }
  const api = client(httpServer.meta);

  // ---- 1. static face ------------------------------------------------------
  const page = await api.get('/ui/studio.html', { auth: false });
  const bundle = await api.get('/ui/studio/studio.js', { auth: false });
  assertStep(
    '静态面无凭据可取到搭建台页面',
    page.status === 200 && typeof page.body === 'string' && page.body.includes('studio/studio.js'),
    `studio.html ${page.status} / studio.js ${bundle.status}`
  );

  // ---- 2. labels -----------------------------------------------------------
  const labelsBody = await api.get('/studio/labels');
  const L = labelsBody.body?.labels ?? {};
  const labelCount = Object.keys(L).length;

  const source = await fs.readFile(path.join(REPO, 'desktop/ui/studio/studio.js'), 'utf8');
  const referenced = [...new Set(
    [...source.matchAll(/'((?:UI|STUDIO|MODE|GATE|TASK|STAGE|ARTIFACT|ROLE|DEPT|DESKTOP)_[A-Z0-9_]+)'/g)].map((m) => m[1])
  )];
  const missing = referenced.filter((key) => typeof L[key] !== 'string' || L[key].length === 0);
  assertStep(
    '页面引用的标签键全部可解析',
    referenced.length > 0 && missing.length === 0,
    `引用 ${referenced.length} 键 / 标签表 ${labelCount} 键 / 缺失 ${missing.length}${missing.length ? ` -> ${missing.join(',')}` : ''}`
  );

  // ---- 3. the six wizard steps --------------------------------------------
  const scan = await api.action({ action: 'cli.scan' });  const cliId = scan.body?.findings?.[0]?.cli_id ?? null;
  assertStep(
    '步骤① 扫描本机 Agent CLI',
    scan.body?.ok === true && Array.isArray(scan.body?.findings),
    `发现 ${scan.body?.count ?? 0} 个${cliId ? `（首个 ${cliId}）` : ''}`
  );

  const seed = await api.action({ action: 'org.seed', cli: cliId ?? undefined, perRole: 2 });
  const seedCounts = seed.body?.counts ?? {};
  assertStep(
    '步骤② 一键建组织（角色 + 员工）',
    seed.body?.ok === true && seedCounts.roles > 0 && seedCounts.employees === seedCounts.roles * 2,
    `角色 ${seedCounts.roles ?? 0} / 员工 ${seedCounts.employees ?? 0} / CLI ${seed.body?.cliId ?? '-'}`
  );

  const flowCreated = await api.action({ action: 'flow.create', template: 'rd-12' });
  const flowId = flowCreated.body?.flow?.id ?? null;
  assertStep(
    '步骤③ 创建工作流（12 阶段模板）',
    flowCreated.body?.ok === true && (flowCreated.body?.flow?.stages ?? []).length === 12,
    `工作流 ${flowId ?? '-'} / 阶段 ${(flowCreated.body?.flow?.stages ?? []).length} / 门禁 ${(flowCreated.body?.flow?.gates ?? []).length}`
  );

  const stateAfterFlow = await api.get('/studio/state');
  const roles = stateAfterFlow.body?.roles ?? [];
  const roleIds = roles.map((role) => role.id);

  const teamCreated = await api.action({
    action: 'team.create',
    name: 'ui-core-team',
    leadRoleId: roleIds[0],
    roleIds,
    flowId,
    runMode: 'semi'
  });
  const teamId = teamCreated.body?.team?.id ?? null;
  assertStep(
    '步骤④ 组建 Agent Team',
    teamCreated.body?.ok === true && roleIds.length > 0,
    `团队 ${teamId ?? '-'} / 成员角色 ${roleIds.length}`
  );

  const stateAfterTeam = await api.get('/studio/state');
  const team = (stateAfterTeam.body?.teams ?? []).find((row) => row.id === teamId);
  assertStep(
    '团队就绪判定由服务端给出',
    team?.ready === true,
    `ready=${team?.ready} / 覆盖 ${(team?.roleCount ?? 0) - (team?.missingCodes ?? []).length}/${team?.roleCount ?? 0} / 员工 ${team?.employeeCount ?? 0}`
  );

  const started = await api.action({ action: 'run.start', teamId, flowId, mode: 'simulate' });
  const runId = started.body?.run?.id ?? null;
  assertStep(
    '步骤⑤ 启动运行并被门禁拦停',
    started.body?.ok === true && started.body?.waiting?.stageId != null && started.body?.run?.status === 'awaiting-approval',
    `运行 ${runId ?? '-'} / 停在 ${started.body?.waiting?.stageId ?? '-'}（门禁 ${started.body?.waiting?.gate ?? '-'}）`
  );

  const change = await api.action({
    action: 'task.change',
    runId,
    stageId: started.body?.waiting?.stageId,
    summary: '验收核实需求缺口回流'
  });
  assertStep(
    '步骤⑥ 提需求缺口 → 退回产品评审',
    change.body?.ok === true && change.body?.change?.status === 'pending-review' && change.body?.task?.status === 'blocked',
    `变更 ${change.body?.change?.id ?? '-'}（${change.body?.change?.status ?? '-'}）/ 任务 ${change.body?.task?.id ?? '-'} → ${change.body?.task?.status ?? '-'}`
  );

  // ---- 4. walk every gate -------------------------------------------------
  let gateRounds = 0;
  let lastRun = started.body?.run ?? null;
  for (let i = 0; i < 8; i += 1) {
    const approved = await api.action({ action: 'run.approve', runId });
    if (approved.body?.ok !== true) {
      record('门禁批准', false, JSON.stringify(approved.body));
      break;
    }
    gateRounds += 1;
    lastRun = approved.body.run;
    if (approved.body.waiting == null) break;
  }
  const finalState = await api.get('/studio/state');
  const finalRun = (finalState.body?.runs ?? []).find((row) => row.id === runId);
  assertStep(
    '逐级批准门禁直至跑完',
    finalRun?.status === 'completed' && finalRun?.progress?.done === finalRun?.progress?.total,
    `${gateRounds} 次批准 / ${finalRun?.progress?.done ?? 0}/${finalRun?.progress?.total ?? 0} 阶段完成 / 状态 ${finalRun?.status ?? '-'}`
  );

  // ---- 5. projection hygiene ---------------------------------------------
  const kbDir = path.join(root, '.orch', 'kb', runId ?? 'none');
  let kbFiles = 0;
  let kbStages = 0;
  try {
    for (const entry of await fs.readdir(kbDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue; // run.md lives beside the stage dirs
      kbStages += 1;
      const files = await fs.readdir(path.join(kbDir, entry.name));
      kbFiles += files.filter((f) => f.endsWith('.md')).length;
    }
  } catch { kbFiles = 0; }
  assertStep('知识库产物按阶段落盘', kbFiles > 0, `${kbStages} 个阶段目录 / ${kbFiles} 个产物文件（${path.relative(root, kbDir)}）`);

  const flowOut = (finalState.body?.flows ?? [])[0];
  const rawKeyLeak = [...(flowOut?.stages ?? [])].filter((stage) => /^STAGE_/.test(stage.title ?? '')).length;
  const rawDeptLeak = (finalState.body?.departments ?? []).filter((d) => /^DEPT_/.test(d.label ?? '')).length;
  assertStep(
    '投影无原始标签键泄漏（页面不会显示 STAGE_*）',
    rawKeyLeak === 0 && rawDeptLeak === 0,
    `阶段标题泄漏 ${rawKeyLeak} / 部门名泄漏 ${rawDeptLeak} / 首个阶段标题「${flowOut?.stages?.[0]?.title ?? '-'}」`
  );

  const tasks = finalState.body?.tasks ?? [];
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  assertStep(
    '任务板与运行一致',
    tasks.length > 0 && doneTasks === tasks.length,
    `任务 ${doneTasks}/${tasks.length} 完成`
  );

  // ---- 6. failure paths ---------------------------------------------------
  const unknown = await api.action({ action: 'nope.nope' });
  assertStep(
    '未知操作返回可渲染错误',
    unknown.body?.ok === false && unknown.body?.code === 'STUDIO_ACTION_UNKNOWN',
    `code=${unknown.body?.code ?? '-'}`
  );

  const badApprove = await api.action({ action: 'run.approve', runId: 'R-NOPE' });
  const badKey = badApprove.body?.labelKey ?? null;
  assertStep(
    '失败路径带可解析的 labelKey',
    badApprove.body?.ok === false && typeof badKey === 'string' && typeof L[badKey] === 'string',
    `code=${badApprove.body?.code ?? '-'} / labelKey=${badKey ?? '-'} → ${typeof L[badKey] === 'string' ? L[badKey] : '缺失'}`
  );

  // ---- 7. projects (D) ----------------------------------------------------
  const projectAdd = await api.action({ action: 'cli.scan' });
  assertStep('通道可重复调用（幂等扫描）', projectAdd.body?.ok === true, `第二次扫描 ${projectAdd.body?.count ?? 0} 个`);

  await httpServer.close();
  return finish(root, home);
}

async function finish(root, home) {
  const failed = steps.filter((step) => !step.ok);
  console.log('');
  console.log(`ui flow: ${steps.length - failed.length}/${steps.length} steps passed`);
  if (root) console.log(`fixture: ${root}`);
  if (failed.length > 0) {
    console.log('UI_FLOW_FAILED');
    for (const step of failed) console.log(`  - ${step.name}: ${step.detail}`);
  } else {
    console.log('UI_FLOW_OK');
  }
  if (root && process.env.KEEP_FIXTURE !== '1') {
    try { await fs.rm(root, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('verify-ui-flow crashed:', err?.stack ?? err);
  process.exit(1);
});
