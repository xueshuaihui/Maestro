/**
 * Studio domain tests (v2 A2~A6 / B / D).
 *
 * Fast-track scope (AD-11): each test asserts one user-visible contract of the
 * core journey, not one per field. Fixtures use an isolated temp root and never
 * write inside the repository. `NODE_ENV=test` is set by the runner.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  loadStudio,
  updateStudio,
  addRole,
  addEmployee,
  addEmployee as addEmp,
  employeesOfRole,
  openSession,
  checkOrganization,
  createTeam,
  checkTeam,
  createFlow,
  buildRd12,
  validateFlow,
  topoOrder,
  removeRole,
  startRun,
  approveRun,
  raiseRequirementGap,
  transitionTask,
  compileStudio,
  hostMatrix,
  addProject,
  listProjects,
  useProject,
  removeProject
} from '../../src/studio/index.js';
import { checkWorkflowShape } from '../../src/registry/workflow-schema.js';
import { checkRoleShape } from '../../src/registry/role-schema.js';

function freshRoot(prefix = 'studio-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function withDoc() {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    departments: ['product', 'engineering-management', 'frontend', 'backend', 'qa', 'platform-security']
      .map((id) => ({ id, labelKey: `DEPT_${id.replace(/-/g, '_').toUpperCase()}` })),
    roles: [],
    employees: [],
    sessions: [],
    teams: [],
    flows: [],
    tasks: [],
    defects: [],
    changes: [],
    runs: []
  };
}

test('A2-1 角色用语义代码作 id，且不携带 cli 绑定；员工才绑定 cli', () => {
  const doc = withDoc();
  const role = addRole(doc, { name: '产品负责人', code: 'product-lead', departmentId: 'product' });
  assert.equal(role.ok, true);
  assert.equal(role.role.id, 'product-lead');
  assert.equal(role.role.cliId, undefined, '角色不得绑定具体 CLI');
  const emp = addEmployee(doc, { name: '甲', roleId: 'product-lead', cliId: 'mock-cli' });
  assert.equal(emp.ok, true);
  assert.equal(emp.employee.cliId, 'mock-cli');
  assert.equal(employeesOfRole(doc, 'product-lead').length, 1);
});

test('A2-2 一角色多员工，且同一员工可开多会话受并发上限约束', () => {
  const doc = withDoc();
  addRole(doc, { name: '前端开发', code: 'frontend-dev', departmentId: 'frontend' });
  addEmployee(doc, { name: '甲', roleId: 'frontend-dev', cliId: 'c1' });
  addEmployee(doc, { name: '乙', roleId: 'frontend-dev', cliId: 'c2' });
  assert.equal(employeesOfRole(doc, 'frontend-dev').length, 2);

  const first = openSession(doc, { employeeId: 'frontend-dev', task: 'a' });
  assert.equal(first.ok, true);
  const second = openSession(doc, { employeeId: 'frontend-dev', task: 'b' });
  assert.equal(second.ok, false);
  assert.equal(second.code, 'STUDIO_SESSION_LIMIT');
});

test('A2-3 能力校验：ACL 明确 false → 错误；未探测 → 警告（不冒充通过）', () => {
  const doc = withDoc();
  addRole(doc, {
    name: '开发',
    code: 'backend-dev',
    departmentId: 'backend',
    requires: { acp: true }
  });
  addEmployee(doc, { name: '甲', roleId: 'backend-dev', cliId: 'no-acp' });
  addEmployee(doc, { name: '乙', roleId: 'backend-dev', cliId: 'unprobed' });

  const clis = [
    { cli_id: 'no-acp', executable: '/bin/x', connection_status: 'idle', acp: false, max_concurrent_sessions: null },
    { cli_id: 'unprobed', executable: '/bin/y', connection_status: 'idle', acp: null, max_concurrent_sessions: null }
  ];
  const report = checkOrganization(doc, clis);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((e) => e.code === 'STUDIO_CAPABILITY_MISMATCH'));
  assert.ok(report.warnings.some((w) => w.code === 'STUDIO_CAPABILITY_UNPROBED'));
});

test('A2-4 角色仍被员工引用时不可删除', () => {
  const doc = withDoc();
  addRole(doc, { name: 'QA', code: 'qa-lead', departmentId: 'qa' });
  addEmployee(doc, { name: '甲', roleId: 'qa-lead', cliId: 'c' });
  const removed = removeRole(doc, 'qa-lead');
  assert.equal(removed.ok, false);
  assert.equal(removed.code, 'STUDIO_ROLE_IN_USE');
});

test('A4-1 内置 12 阶段模板：12 阶段、3 道门禁、DAG 无环', () => {
  const flow = buildRd12();
  assert.equal(flow.stages.length, 12);
  assert.equal(flow.gates.length, 3);
  assert.deepEqual(flow.gates, ['prd-freeze', 'arch-confirm', 'release-approve']);
  assert.equal(topoOrder(flow).length, 12);
  assert.equal(validateFlow(flow).ok, true);
});

test('A4-2 自定义 DAG：可建线性/分支；成环被拒；未知角色代码被校验出来', () => {
  const doc = withDoc();
  const ok = createFlow(doc, {
    name: 'custom',
    id: 'custom',
    stages: [
      { id: 'a1', roleCodes: ['product-lead'] },
      { id: 'b1', roleCodes: ['eng-lead'] }
    ],
    edges: [{ from: 'a1', to: 'b1' }]
  });
  assert.equal(ok.ok, true);

  const cyclic = createFlow(doc, {
    name: 'bad',
    id: 'bad',
    stages: [
      { id: 'a1', roleCodes: ['product-lead'] },
      { id: 'b1', roleCodes: ['eng-lead'] }
    ],
    edges: [{ from: 'a1', to: 'b1' }, { from: 'b1', to: 'a1' }]
  });
  assert.equal(cyclic.ok, false);
  assert.equal(cyclic.code, 'STUDIO_FLOW_INVALID');

  const scope = validateFlow(doc.flows[0], { roleCodes: new Set(['product-lead']) });
  assert.equal(scope.ok, false);
  assert.ok(scope.errors.some((e) => e.code === 'STUDIO_FLOW_ROLE_UNCOVERED'));
});

function seedTeam(doc, { runMode = 'auto' } = {}) {
  const codes = buildRd12().stages.flatMap((stage) => stage.roleCodes);
  const unique = [...new Set(codes)];
  for (const code of unique) {
    addRole(doc, { name: code, code, departmentId: 'engineering-management' });
    addEmp(doc, { name: `${code}-1`, roleId: code, cliId: 'mock-cli' });
  }
  const flow = createFlow(doc, { template: 'rd-12' });
  assert.equal(flow.ok, true);
  const team = createTeam(doc, {
    name: 'team',
    leadRoleId: 'eng-lead',
    roleIds: unique,
    flowId: flow.flow.id,
    runMode
  });
  assert.equal(team.ok, true);
  return { flow: flow.flow, team: team.team, codes: unique };
}

test('A3-1 团队成员按角色挂员工；角色代码未覆盖时团队不就绪', () => {
  const doc = withDoc();
  const { team } = seedTeam(doc);
  const ready = checkTeam(doc, team);
  assert.equal(ready.ok, true);
  assert.equal(ready.coverage.missing.length, 0);

  const partial = createTeam(doc, { name: 'partial', leadRoleId: 'eng-lead', roleIds: ['eng-lead'], flowId: team.flowId });
  assert.equal(partial.ok, true);
  const notReady = checkTeam(doc, partial.team);
  assert.equal(notReady.ok, false);
  assert.ok(notReady.errors.some((e) => e.code === 'STUDIO_FLOW_ROLE_UNCOVERED'));
});

test('A5-1 auto 模式模拟运行：12 阶段全完成、产物落知识库、任务全 done', async () => {
  const root = freshRoot();
  const doc = withDoc();
  const { team, flow } = seedTeam(doc, { runMode: 'auto' });
  const started = await startRun({ root, doc, teamId: team.id, flowId: flow.id, mode: 'simulate' });
  assert.equal(started.ok, true);
  assert.equal(started.run.status, 'completed');
  assert.equal(started.run.stages.filter((s) => s.status === 'done').length, 12);
  assert.ok(doc.tasks.every((task) => task.status === 'done'));

  const runDir = path.join(root, '.orch', 'kb', started.run.id);
  assert.equal(fs.existsSync(path.join(runDir, 'run.md')), true);
  const artifacts = started.run.stages.reduce((n, s) => n + s.artifacts.length, 0);
  assert.ok(artifacts >= 20);
  const prd = fs.readFileSync(path.join(runDir, 's01', 'prd.md'), 'utf8');
  assert.match(prd, /mode: simulate/);
});

test('A5-2 semi 模式在门禁拦截，逐级批准后跑完（三道门禁）', async () => {
  const root = freshRoot();
  const doc = withDoc();
  const { team, flow } = seedTeam(doc, { runMode: 'semi' });
  const started = await startRun({ root, doc, teamId: team.id, flowId: flow.id, mode: 'simulate' });
  assert.equal(started.ok, true);
  assert.equal(started.run.status, 'awaiting-approval');
  assert.equal(started.run.stages.find((s) => s.status === 'awaiting-approval').stageId, 's02');

  const gates = [];
  let run = started.run;
  for (let i = 0; i < 5 && run.status !== 'completed'; i += 1) {
    const approved = await approveRun({ root, doc, runId: run.id, approve: true });
    assert.equal(approved.ok, true);
    if (approved.approvedStage) gates.push(approved.approvedStage);
    run = approved.run;
  }
  assert.deepEqual(gates, ['s02', 's04', 's11']);
  assert.equal(run.status, 'completed');
});

test('A5-3 plan 模式只建计划不执行（无产物、任务停留 todo）', async () => {
  const root = freshRoot();
  const doc = withDoc();
  const { team, flow } = seedTeam(doc);
  const started = await startRun({ root, doc, teamId: team.id, flowId: flow.id, mode: 'plan' });
  assert.equal(started.ok, true);
  assert.equal(started.run.status, 'planned');
  assert.ok(doc.tasks.every((task) => task.status === 'todo'));
  assert.equal(fs.existsSync(path.join(root, '.orch', 'kb', started.run.id, 'run.md')), true);
});

test('A6-1 任务非法流转被拒，合法链路可走通', async () => {
  const root = freshRoot();
  const doc = withDoc();
  const { team, flow } = seedTeam(doc);
  await startRun({ root, doc, teamId: team.id, flowId: flow.id, mode: 'plan' });
  const task = doc.tasks[0];
  const illegal = transitionTask(doc, task.id, 'done');
  assert.equal(illegal.ok, false);
  assert.equal(illegal.code, 'STUDIO_TASK_TRANSITION_ILLEGAL');
  for (const to of ['ready', 'claimed', 'running', 'review', 'done']) {
    assert.equal(transitionTask(doc, task.id, to).ok, true);
  }
  void team;
});

test('A6-2 QA 发现需求缺失：缺陷 kind=requirement、变更退回产品评审、任务置 blocked', async () => {
  const root = freshRoot();
  const doc = withDoc();
  const { team, flow } = seedTeam(doc);
  await startRun({ root, doc, teamId: team.id, flowId: flow.id, mode: 'plan' });
  const task = doc.tasks.find((item) => item.stageId === 's08');
  const raised = raiseRequirementGap(doc, {
    runId: task.runId,
    stageId: 's08',
    summary: '验收标准缺失'
  });
  assert.equal(raised.ok, true);
  assert.equal(raised.defect.kind, 'requirement');
  assert.equal(raised.change.status, 'pending-review');
  assert.equal(raised.task.status, 'blocked');
});

test('B-1 编译产物通过引擎自身校验（角色/工作流 schema）', () => {
  const doc = withDoc();
  const { team, flow } = seedTeam(doc);
  const compiled = compileStudio({ doc, team, flow });
  assert.equal(compiled.ok, true);
  assert.ok(compiled.roles.length >= 12);
  for (const role of compiled.roles) {
    assert.deepEqual(checkRoleShape(role.doc, { fileId: role.id }), [], role.id);
    assert.equal(role.doc.wake_allow.includes(role.id), false, '唤醒白名单不得包含自己');
  }
  assert.deepEqual(checkWorkflowShape(compiled.workflow, { fileId: flow.id }), []);
  assert.equal(compiled.workflow.nodes.length, 12);
});

test('D-1 多项目登记：add / list / use / remove 幂等且可追溯', async () => {
  const home = freshRoot('studio-home-');
  const previous = process.env.HOME;
  process.env.HOME = home;
  try {
    const project = freshRoot('studio-project-');
    const added = await addProject({ root: project, name: 'demo' });
    assert.equal(added.ok, true);
    const again = await addProject({ root: project });
    assert.equal(again.ok, true);
    const listed = await listProjects();
    assert.equal(listed.projects.length, 1);
    assert.equal(listed.active, project);
    assert.equal((await useProject(project)).ok, true);
    const removed = await removeProject(project);
    assert.equal(removed.ok, true);
    assert.equal((await listProjects()).projects.length, 0);
  } finally {
    if (previous === undefined) delete process.env.HOME;
    else process.env.HOME = previous;
  }
});

test('D-2 宿主矩阵：能力驱动的可承载清单与团队角色覆盖', () => {
  const matrix = hostMatrix(
    [
      { cli_id: 'a', name: 'A', executable: '/bin/a', connection_status: 'idle', acp: true },
      { cli_id: 'b', name: 'B', executable: null, connection_status: 'unreachable', acp: null }
    ],
    [{ id: 't', name: 'T', roleIds: ['r1'] }],
    [{ id: 'r1', code: 'qa-lead' }]
  );
  assert.equal(matrix.rows.length, 2);
  assert.equal(matrix.readyCount, 1);
  assert.deepEqual(matrix.teams[0].roleCodes, ['qa-lead']);
});

test('存储：一次 updateStudio 落盘并回读一致', async () => {
  const root = freshRoot();
  const saved = await updateStudio(root, (doc) => {
    const role = addRole(doc, { name: '产品负责人', code: 'product-lead', departmentId: 'product' });
    return role.ok ? { ok: true } : role;
  });
  assert.equal(saved.ok, true);
  const loaded = await loadStudio(root);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.doc.roles.length, 1);
  assert.equal(loaded.doc.departments.length, 6);
});
