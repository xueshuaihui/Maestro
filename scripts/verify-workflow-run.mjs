/**
 * Project workflow -> runnable instance acceptance (beta.4 P4).
 *
 * The documented break was: a flow saved in the canvas/Studio could never be
 * started because the daemon only loaded the three built-in graphs. This test
 * builds a real project with the 12-stage flow, starts the real daemon, and
 * asserts the project flow appears in /workflows AND can start an instance.
 *
 * Run: node scripts/verify-workflow-run.mjs
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const REPO = path.resolve(import.meta.dirname, '..');
const sleep = (ms) => delay(ms);
let pass = 0;
const failures = [];
function step(name, ok, detail = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass += 1; else failures.push(name);
}
async function waitFor(predicate, timeoutMs, intervalMs = 200) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const value = await predicate();
    if (value) return value;
    await sleep(intervalMs);
  }
  return null;
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-wf-run-'));
let daemon = null;

try {
  // Seed a complete project organization + the 12-stage flow using the same
  // domain functions the Studio UI calls. No test-only fixtures.
  const { saveStudio } = await import(path.join(REPO, 'src/studio/store.js'));
  const { emptyStudio } = await import(path.join(REPO, 'src/studio/schema.js'));
  const { seedOrganization } = await import(path.join(REPO, 'src/templates/studio-seed.js'));
  const studio = await import(path.join(REPO, 'src/studio/index.js'));
  const doc = emptyStudio();
  seedOrganization(doc, {
    cliId: 'opencode', perRole: 1,
    addRole: studio.addRole, addEmployee: studio.addEmployee,
    employeesOfRole: studio.employeesOfRole, label: (k, fallback) => fallback ?? k
  });
  const flow = studio.createFlow(doc, { template: 'rd-12', name: '项目自定义十二阶段' });
  if (!flow.ok) throw new Error(`createFlow: ${flow.code}`);
  // Point the first team at the project flow so compileStudio can resolve roles.
  if (doc.teams.length > 0) doc.teams[0].flowId = flow.flow.id;
  await saveStudio(root, doc);
  step('项目组织 + 12 阶段工作流已落盘', true, `roles=${doc.roles.length} flow=${flow.flow.id}`);

  const { loadProjectGraphs } = await import(path.join(REPO, 'src/daemon/project-graphs.js'));
  const graphs = await loadProjectGraphs(root);
  step('Studio flow 编译成可执行图', graphs.ok && graphs.ids.includes(flow.flow.id),
    `ids=${JSON.stringify(graphs.ids)} errors=${graphs.errors.length}`);
  if (graphs.ids.includes(flow.flow.id)) {
    const g = graphs.graphs[flow.flow.id];
    step('执行图含 12 节点与真实边', g.nodes.length === 12 && g.edges.length > 0,
      `nodes=${g.nodes.length} edges=${g.edges.length}`);
  }

  // Bind a host so startRun can actually dispatch.
  const { bindHost } = await import(path.join(REPO, 'src/studio/host.js'));
  const cliBin = process.env.MAESTRO_CLI_BIN;
  if (cliBin) {
    const bound = await bindHost(root, {
      id: 'opencode', cliId: 'opencode', command: path.join(cliBin, 'opencode'), args: []
    });
    step('宿主配置写入', bound.ok === true, JSON.stringify(bound).slice(0, 120));
  }

  const logFd = fs.openSync(path.join(root, 'daemon.log'), 'w');
  daemon = spawn(process.execPath, [path.join(REPO, 'src/daemon/serve-entry.js'), '--project', root, '--desktop'], {
    cwd: root, env: { ...process.env, HOME: root, USERPROFILE: root, NODE_ENV: 'test' },
    stdio: ['ignore', logFd, logFd]
  });
  const meta = await waitFor(() => {
    try { return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'desktop.json'), 'utf8')); }
    catch { return null; }
  }, 25000);
  if (!meta?.port) throw new Error(`daemon not ready: ${fs.readFileSync(path.join(root, 'daemon.log'), 'utf8').slice(0, 300)}`);
  step('真实 daemon 就绪', true, `port ${meta.port}`);

  const headers = { 'content-type': 'application/json', authorization: `Bearer ${meta.token}` };
  const workflows = await fetch(`http://127.0.0.1:${meta.port}/workflows`, { headers }).then((r) => r.json());
  const ids = (workflows.items ?? []).map((item) => item.id);
  step('/workflows 暴露项目工作流', ids.includes(flow.flow.id), `ids=${JSON.stringify(ids)}`);

  const start = await fetch(`http://127.0.0.1:${meta.port}/instances`, {
    method: 'POST', headers,
    body: JSON.stringify({ template: flow.flow.id, task: '实现登录页按钮文案修改 产物：login.js', earlyReturn: true })
  }).then((r) => r.json()).catch((err) => ({ ok: false, message: String(err) }));
  // POST /instances returns `{instanceId}` on success (legacy shape, no `ok`).
  step('用项目工作流启动实例', typeof start.instanceId === 'string' && !start.code,
    JSON.stringify(start).slice(0, 220));
} catch (err) {
  step('脚本执行', false, String(err?.stack ?? err).slice(0, 400));
} finally {
  if (daemon) daemon.kill('SIGKILL');
  console.log(`\nworkflow-run: ${pass}/${pass + failures.length} steps passed`);
  if (failures.length > 0) {
    console.log('WORKFLOW_RUN_FAIL: ' + failures.join(' | '));
    process.exitCode = 1;
  } else {
    console.log('WORKFLOW_RUN_OK');
  }
}
