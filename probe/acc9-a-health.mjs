// I1.9 S3 验收 A 组：AC-11 / AC-12 / AC-13 / AC-14（健康度四档）。
//
// 现场（全部按 requirement §3.3 的启动顺序）：
// - AC-11：`running` 快照，T-001 done / T-002 pending、无运行中节点、nodeTimeoutMs=300000；
// - AC-12：真实跑完的 `single` 实例 + 四个终态（completed/failed/cancelled/interrupted）
//          带历史 `expired` 交接包的快照，验证终态优先；
// - AC-13：六个独立夹具，每个只放**一种**红条件，逐字命中 A-6 附的对应行；
// - AC-14：三个实例，5/5/4 条已结束跨度 + 运行中的 T-006（70s / 30s / 70s），nodeTimeoutMs=300000。
//
// 复跑：`NODE_ENV=test node probe/acc9-a-health.mjs`
// 证据：docs/iterations/iteration-9/evidence/acc9/AC-11..AC-14/
import fs from 'node:fs';
import path from 'node:path';

import {
  evidenceDir, freshRoot, makeChecks, nowIso, readJson, removeProject, report, runCli,
  startCoreOnEmptyRoot, statePath, stopCore, tracesPath, writeEvidence, writeMockConfig,
  writeSnapshot, writeTraces, ensureDir,
} from './acc9-a-lib.mjs';

const HOUR = 3600_000;
const notFound = (root, id = 'INST-001') => {
  const r = runCli(root, ['instance', 'status', id], { timeout: 40_000 });
  return r.exitCode === 1 && r.stdout.trim() === `实例 ${id} · 不存在`;
};

function baseSnapshot({ id = 'INST-001', template = 'code-loop', state = 'running', nodeTimeoutMs = 300_000 } = {}) {
  const at = new Date(Date.now() - 2 * HOUR).toISOString();
  return {
    schemaVersion: 2,
    instanceId: id,
    coreGeneration: 'gen-acc9-health',
    createdAt: at,
    updatedAt: at,
    state,
    stateSince: at,
    template,
    cwd: '.',
    task: 'x',
    halted: false,
    rev: 0,
    nodes: [],
    sessions: [],
    handoffs: [],
    escalations: [],
    health: { nodeTimeoutMs },
  };
}

const doneNode = (nodeId, roleId, round = 1) => ({
  nodeId, roleId, round, state: 'done',
  startedAt: new Date(Date.now() - 2 * HOUR).toISOString(),
  endedAt: new Date(Date.now() - 2 * HOUR + 2000).toISOString(),
});

/** AC-11：🟢 正常（无任何异常快照）。 */
function ac11() {
  const { checks, check } = makeChecks();
  const root = freshRoot('AC-11');
  writeMockConfig(root);
  check('空目录先拉起核心（status 返回「不存在」）', startCoreOnEmptyRoot(root).ok);

  const snap = baseSnapshot();
  snap.nodes = [doneNode('T-001', 'developer'), { nodeId: 'T-002', roleId: 'tester', round: 0, state: 'pending' }];
  writeSnapshot(root, snap);

  const res = runCli(root, ['instance', 'status', 'INST-001']);
  const lines = res.stdout.replace(/\n$/, '').split('\n');
  const docPath = path.join(root, '.orch', 'instances', 'INST-001', 'workspace', 'status.md');
  const doc = fs.readFileSync(docPath, 'utf8');

  check('instance status 退出码 0', res.exitCode === 0, { exitCode: res.exitCode, stderr: res.stderr });
  check('健康度行为「健康度 正常」且无附加原因', lines.includes('健康度 正常'), { lines });
  check('健康度行紧跟实例状态行之后（第 2 行）',
    lines[0].startsWith('实例 INST-001 · 运行中') && lines[1] === '健康度 正常', { head: lines.slice(0, 3) });
  check('status.md 的「- 健康度：正常」', doc.split('\n').includes('- 健康度：正常'),
    { doc: doc.split('\n').filter((l) => l.includes('健康度')) });
  const persisted = readJson(statePath(root));
  check('健康度写入实例元数据（level=normal、保留 nodeTimeoutMs=300000）',
    persisted.health?.level === 'normal' && persisted.health?.nodeTimeoutMs === 300000,
    { health: persisted.health });

  writeEvidence('AC-11', 'stdout-instance-status.txt', res.stdout + res.stderr);
  writeEvidence('AC-11', 'status.md', doc);
  writeEvidence('AC-11', 'state.json', JSON.stringify(persisted, null, 2));
  const payload = { root, checks, pass: checks.every((c) => c.ok) };
  report('AC-11', payload);
  stopCore(root);
  removeProject(root);
  return payload;
}

/** AC-12：⚪ 已结束（真实跑完 + 四终态快照带历史过期连接线）。 */
function ac12() {
  const { checks, check } = makeChecks();

  // ① 真实跑完的 single 实例。
  const real = freshRoot('AC-12-real');
  writeMockConfig(real);
  const run = runCli(real, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '写一份说明']);
  const status = runCli(real, ['instance', 'status', 'INST-001']);
  const doc = fs.readFileSync(path.join(real, '.orch', 'instances', 'INST-001', 'workspace', 'status.md'), 'utf8');
  check('真实实例跑完（run 退出码 0）', run.exitCode === 0, { exitCode: run.exitCode });
  check('真实已完成实例：instance status 显示「健康度 已结束」',
    status.stdout.split('\n').includes('健康度 已结束'), { lines: status.stdout.split('\n') });
  check('真实已完成实例：status.md 显示「- 健康度：已结束」', doc.includes('- 健康度：已结束'));

  // ② 四个终态快照：每个都带一条历史 `expired` 交接包，验证终态不被红条件覆盖。
  const root = freshRoot('AC-12-terminal');
  writeMockConfig(root);
  check('终态夹具：空目录先拉起核心', startCoreOnEmptyRoot(root, 'INST-001').ok);

  const states = ['completed', 'failed', 'cancelled', 'interrupted'];
  const outcomes = [];
  states.forEach((state, i) => {
    const id = `INST-${String(i + 1).padStart(3, '0')}`;
    const snap = baseSnapshot({ id, template: 'single', state });
    snap.nodes = [doneNode('T-001', 'worker')];
    snap.handoffs = [{
      handoffId: 'HO-001',
      edge: null,
      state: 'expired',
      createdAt: new Date(Date.now() - 3 * HOUR).toISOString(),
      pendingAt: new Date(Date.now() - 3 * HOUR).toISOString(),
      expiredAt: new Date(Date.now() - 2 * HOUR).toISOString(),
    }];
    snap.escalations = [{ escalationId: 'ESC-001', nodeId: 'T-001', state: 'pending' }];
    writeSnapshot(root, snap, id);
    const res = runCli(root, ['instance', 'status', id]);
    const lines = res.stdout.replace(/\n$/, '').split('\n');
    outcomes.push({
      state, id, exitCode: res.exitCode,
      healthLine: lines.find((l) => l.startsWith('健康度')) ?? null,
      lines,
    });
  });

  for (const o of outcomes) {
    check(`${o.state} 终态 → 「健康度 已结束」（历史红条件不覆盖）`,
      o.healthLine === '健康度 已结束', o);
  }

  writeEvidence('AC-12', 'stdout-real-completed.txt', status.stdout + status.stderr);
  writeEvidence('AC-12', 'status-md-real-completed.md', doc);
  writeEvidence('AC-12', 'terminal-states.json', outcomes);
  const payload = { checks, outcomes, pass: checks.every((c) => c.ok) };
  report('AC-12', payload);
  stopCore(real); removeProject(real);
  stopCore(root); removeProject(root);
  return payload;
}

/** AC-13：六个独立夹具，每个只放一种红条件。 */
function ac13() {
  const { checks, check } = makeChecks();
  const results = [];

  const fixtures = [
    {
      name: 'pending',
      expect: '健康度 需关注 · 有待处理升级',
      build(snap) {
        snap.nodes = [doneNode('T-001', 'developer')];
        snap.escalations = [{ escalationId: 'ESC-001', nodeId: 'T-001', state: 'pending' }];
      },
    },
    {
      name: 'timeout',
      expect: '健康度 需关注 · 节点 T-001 执行超时',
      build(snap) {
        snap.nodes = [{
          nodeId: 'T-001', roleId: 'developer', round: 1, state: 'running',
          startedAt: new Date(Date.now() - 31_000).toISOString(), endedAt: null,
        }];
        snap.health.nodeTimeoutMs = 30_000;
      },
    },
    {
      name: 'crash',
      expect: '健康度 需关注 · 会话 mock-sess-12345-1 崩溃',
      build(snap) {
        snap.nodes = [{ ...doneNode('T-001', 'developer'), state: 'failed', endedAt: new Date().toISOString() }];
        snap.sessions = [{
          sessionId: 'mock-sess-12345-1', nodeId: 'T-001', round: 1, hostId: 'mock',
          state: 'idle', quarantined: true,
        }];
        // 不放开级；会话 state 不是 escalated。
      },
    },
    {
      name: 'role',
      expect: '健康度 需关注 · 角色 开发 不可用',
      build(snap) {
        snap.nodes = [{ ...doneNode('T-001', 'developer'), state: 'review', endedAt: undefined }];
        snap.sessions = [{
          sessionId: 'mock-sess-22345-1', nodeId: 'T-001', round: 1, hostId: 'mock',
          state: 'escalated', quarantined: false,
        }];
        // 不放开级。
      },
    },
    {
      name: 'conn-rejected',
      expect: '健康度 需关注 · 连接线 测试→开发 已拒绝',
      build(snap) {
        snap.nodes = [doneNode('T-001', 'developer'), doneNode('T-002', 'tester')];
        snap.handoffs = [{
          handoffId: 'HO-001', edge: { from: 'T-002', to: 'T-001', kind: 'forward' },
          state: 'rejected', round: 2, createdAt: new Date().toISOString(),
        }];
      },
    },
    {
      name: 'conn-expired',
      expect: '健康度 需关注 · 连接线 测试→开发 已过期',
      build(snap) {
        snap.nodes = [doneNode('T-001', 'developer'), doneNode('T-002', 'tester')];
        snap.handoffs = [{
          handoffId: 'HO-001', edge: { from: 'T-002', to: 'T-001', kind: 'forward' },
          state: 'expired', round: 2, createdAt: new Date().toISOString(),
        }];
      },
    },
  ];

  for (const fixture of fixtures) {
    const root = freshRoot(`AC-13-${fixture.name}`);
    writeMockConfig(root);
    const started = startCoreOnEmptyRoot(root);
    const snap = baseSnapshot();
    fixture.build(snap);
    writeSnapshot(root, snap);
    const res = runCli(root, ['instance', 'status', 'INST-001']);
    const lines = res.stdout.replace(/\n$/, '').split('\n');
    const healthLines = lines.filter((l) => l.startsWith('健康度'));
    const ok = res.exitCode === 0 && healthLines.length === 1 && healthLines[0] === fixture.expect;
    check(`${fixture.name}：健康度行逐字为「${fixture.expect}」`, ok, {
      exitCode: res.exitCode, healthLines, expected: fixture.expect, lines,
    });
    results.push({ name: fixture.name, expect: fixture.expect, ok, healthLines, exitCode: res.exitCode, started: started.ok });
    writeEvidence('AC-13', `stdout-${fixture.name}.txt`, res.stdout + res.stderr);
    writeEvidence('AC-13', `snapshot-${fixture.name}.json`, JSON.stringify(snap, null, 2));
    stopCore(root);
    removeProject(root);
  }

  check('六个夹具全部「需关注」一档（每次只显示一档）',
    results.every((r) => r.healthLines.length === 1 && r.healthLines[0].startsWith('健康度 需关注 · ')),
    { results });

  const payload = { results, checks, pass: checks.every((c) => c.ok) };
  report('AC-13', payload);
  return payload;
}

/** AC-14：P90 三实例（5 条样本 P90=50s）。 */
function ac14() {
  const { checks, check } = makeChecks();
  const root = freshRoot('AC-14');
  writeMockConfig(root);
  check('空目录先拉起核心（INST-001 返回「不存在」）', startCoreOnEmptyRoot(root).ok);

  const samples = [10, 20, 30, 40, 50];
  const baseMs = Date.now() - 6 * HOUR; // 远离当前时刻的固定样本区
  const spanAt = (id, index, seconds) => ({
    trace_id: 'TRC-0000aaa1',
    instance_id: id,
    node_id: `T-00${index + 1}`,
    round: 1,
    start_time: new Date(baseMs + index * 600_000).toISOString(),
    end_time: new Date(baseMs + index * 600_000 + seconds * 1000).toISOString(),
    status: 'done',
  });

  const specs = [
    { id: 'INST-001', sampleCount: 5, runningMs: 70_000, expect: '健康度 慢 · 节点 T-006 执行超过本实例 P90' },
    { id: 'INST-002', sampleCount: 5, runningMs: 30_000, expect: '健康度 正常' },
    { id: 'INST-003', sampleCount: 4, runningMs: 70_000, expect: '健康度 正常' },
  ];

  const outcomes = [];
  for (const spec of specs) {
    const snap = baseSnapshot({ id: spec.id });
    snap.nodes = [];
    for (let i = 0; i < spec.sampleCount; i += 1) {
      snap.nodes.push(doneNode(`T-00${i + 1}`, i % 2 === 0 ? 'developer' : 'tester', 1));
    }
    snap.nodes.push({
      nodeId: 'T-006', roleId: 'tester', round: 1, state: 'running',
      startedAt: new Date(Date.now() - spec.runningMs).toISOString(), endedAt: null,
    });
    writeSnapshot(root, snap, spec.id);
    writeTraces(root, samples.slice(0, spec.sampleCount).map((s, i) => spanAt(spec.id, i, s)), spec.id);
    const res = runCli(root, ['instance', 'status', spec.id]);
    const lines = res.stdout.replace(/\n$/, '').split('\n');
    const healthLine = lines.find((l) => l.startsWith('健康度')) ?? null;
    outcomes.push({ ...spec, healthLine, exitCode: res.exitCode, lines });
    check(`${spec.id}（${spec.sampleCount} 条样本、运行 ${spec.runningMs / 1000}s）→「${spec.expect}」`,
      res.exitCode === 0 && healthLine === spec.expect, { healthLine, expect: spec.expect, exitCode: res.exitCode });
    writeEvidence('AC-14', `stdout-${spec.id}.txt`, res.stdout + res.stderr);
  }

  writeEvidence('AC-14', 'snapshots-and-p90.json', outcomes);
  const payload = { outcomes, checks, pass: checks.every((c) => c.ok) };
  report('AC-14', payload);
  stopCore(root);
  removeProject(root);
  return payload;
}

const p11 = ac11();
const p12 = ac12();
const p13 = ac13();
const p14 = ac14();
process.stdout.write('\n=== SUMMARY ===\n');
for (const [ac, p] of [['AC-11', p11], ['AC-12', p12], ['AC-13', p13], ['AC-14', p14]]) {
  process.stdout.write(`${ac} ${p.pass ? 'PASS' : 'FAIL'}\n`);
  if (!p.pass) for (const c of p.checks) if (!c.ok) process.stdout.write(`  - ${c.name}\n`);
}
process.exit([p11, p12, p13, p14].every((p) => p.pass) ? 0 : 1);
