/**
 * I1.9 / S3 B 组：AC-15 ~ AC-19 取证。
 *
 * AC-15 三个 TTL 快照实例；
 * AC-16 受控档位变化（快照 normal -> attention）+ 真实 task-loop 场景对照；
 * AC-17 task-loop 真实运行的元数据 / status.md / graph 可见性；
 * AC-18 同一实例三次 status + 三次 trace 的只读性；
 * AC-19 真实 single / code-loop 与 `322fb5e` 基线树的 status / graph 逐字对照。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  REPO, BIN, MOCK, mkroot, writeMockConfig, writeJson, runCli, readJson, readEvents,
  statePath, eventsPath, tracesPath, statusDocPath, startCoreOnEmptyRoot, stopCore,
  save, collector, localIso, sha256, chainHash, nonEmptyLines, sleep,
} from './acc9-b-lib.mjs';

const here = (p) => path.join(REPO, p);

function baseSnapshot({ id = 'INST-001', template = 'code-loop', nodes, handoffs = [], sessions = [], escalations = [], health = { nodeTimeoutMs: 300000 } }) {
  const at = localIso(10, 0, 0);
  return {
    schemaVersion: 2,
    instanceId: id,
    coreGeneration: 'acc9-b',
    createdAt: at,
    updatedAt: at,
    state: 'running',
    stateSince: at,
    template,
    cwd: '.',
    task: 'acc9-b',
    halted: false,
    rev: 0,
    counters: { eventSeq: 0, runCount: 1, dispatchCount: 0 },
    hostRaw: { stopReason: null, lastError: null, agentInfo: null },
    nodes,
    sessions,
    handoffs,
    escalations,
    health,
  };
}

// ---------------------------------------------------------------- AC-15

async function ac15() {
  const c = collector('AC-15', {
    title: '健康度 🟡 连接线待投递超过 TTL 50%',
    fixture: '三个 code-loop 实例，每个只放一条 pending 交接包',
  });
  const root = mkroot('ttl');
  const boot = startCoreOnEmptyRoot(root);
  c.check('先起核心：INST-001 不存在', boot.ok, boot.stdout.trim());
  const now = Date.now();
  const mk = (id, pendingAt) => baseSnapshot({
    id,
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', round: 0, state: 'pending' },
      { nodeId: 'T-002', roleId: 'tester', round: 0, state: 'pending' },
    ],
    handoffs: [{
      handoffId: 'HO-001',
      fromNodeId: 'T-001',
      toNodeId: 'T-002',
      edge: { from: 'T-001', to: 'T-002', kind: 'forward' },
      round: 1,
      state: 'pending',
      createdAt: pendingAt ?? localIso(10, 0, 0),
      ...(pendingAt === undefined ? {} : { pendingAt }),
      deliveredAt: null,
      acceptedAt: null,
      consumedAt: null,
    }],
  });
  // INST-003：pending 但既无 pendingAt 也无 createdAt。
  const inst3 = mk('INST-003', undefined);
  delete inst3.handoffs[0].createdAt;
  writeJson(statePath(root, 'INST-001'), mk('INST-001', new Date(now - 895_000).toISOString()));
  writeJson(statePath(root, 'INST-002'), mk('INST-002', new Date(now - 905_000).toISOString()));
  writeJson(statePath(root, 'INST-003'), inst3);

  const results = {};
  for (const id of ['INST-001', 'INST-002', 'INST-003']) {
    const res = runCli(root, ['instance', 'status', id]);
    results[id] = res;
    save('AC-15', `status-${id}.txt`, `$ orch instance status ${id}\nexit=${res.code}\n${res.stdout}`);
  }
  c.eq('INST-001 exit 0', results['INST-001'].code, 0);
  c.eq('INST-001 14:55 不命中 -> 正常', results['INST-001'].lines.find((l) => l.startsWith('健康度')) ?? null, '健康度 正常');
  c.eq('INST-002 exit 0', results['INST-002'].code, 0);
  c.eq('INST-002 15:05 命中 -> 慢（单原因逐字）', results['INST-002'].lines.find((l) => l.startsWith('健康度')) ?? null, '健康度 慢 · 交接包 HO-001 待投递超过 TTL 一半');
  c.eq('INST-003 exit 0', results['INST-003'].code, 0);
  c.eq('INST-003 无起算时间不命中 -> 正常', results['INST-003'].lines.find((l) => l.startsWith('健康度')) ?? null, '健康度 正常');
  c.check('INST-002 状态不变（仍 pending）', (() => {
    const st = readJson(statePath(root, 'INST-002'));
    return st.handoffs[0].state === 'pending';
  })(), '健康度只读时间，不改交接包状态');
  save('AC-15', 'snapshots.json', {
    INST_001_pendingAt: new Date(now - 895_000).toISOString(),
    INST_002_pendingAt: new Date(now - 905_000).toISOString(),
    INST_003: 'pendingAt / createdAt 均缺失',
  });
  stopCore(root);

  // 等值边界：单元级 computeHealth 注入固定 now（引用用例名，不复制断言）。
  const unit = spawnSync(process.execPath, ['--test', 'test/wp12/health.test.js'], {
    cwd: REPO, env: { ...process.env, NODE_ENV: 'test' }, encoding: 'utf8', timeout: 60_000,
  });
  save('AC-15', 'unit-health.log', unit.stdout + unit.stderr);
  c.eq('单元级 TTL 等值边界用例文件全绿', unit.status, 0);
  const unitOut = `${unit.stdout}${unit.stderr}`;
  for (const name of [
    'TTL: now - pendingAt = 900000 (exact) -> NOT handoff_ttl_half',
    'TTL: now - pendingAt = 900001 -> handoff_ttl_half',
    'TTL: now - pendingAt = 899999 -> NOT handoff_ttl_half',
  ]) {
    c.check(`单元用例存在：${name}`, unitOut.includes(name), name);
  }
  return c.finish({
    keyEvidence: [
      'status-INST-001.txt / status-INST-002.txt / status-INST-003.txt',
      'unit-health.log',
    ],
  });
}

// ---------------------------------------------------------------- AC-16

async function ac16() {
  const c = collector('AC-16', {
    title: '规划验收②：健康度在实例状态变化后正确更新并进事件日志',
    fixture: '快照先读 normal，只追加一条 pending 升级后二次读取 -> attention',
  });
  const root = mkroot('health-event');
  const boot = startCoreOnEmptyRoot(root);
  c.check('先起核心', boot.ok, boot.stdout.trim());
  const snap = baseSnapshot({
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', round: 1, state: 'done', startedAt: localIso(9, 59, 0), endedAt: localIso(9, 59, 2) },
      { nodeId: 'T-002', roleId: 'tester', round: 0, state: 'pending' },
    ],
    health: { nodeTimeoutMs: 300000 },
  });
  writeJson(statePath(root), snap);

  const first = runCli(root, ['instance', 'status', 'INST-001']);
  save('AC-16', 'status-first.txt', `exit=${first.code}\n${first.stdout}`);
  c.eq('首次查看：正常', first.lines.find((l) => l.startsWith('健康度')) ?? null, '健康度 正常');
  const afterFirst = readEvents(root);
  c.eq('首次补写不追加 health.changed', afterFirst.filter((e) => e.reason === 'health.changed').length, 0);
  const persisted = readJson(statePath(root));
  c.eq('首次查看已写回 level=normal', persisted.health?.level, 'normal');

  // 只追加一条 pending 升级，不改节点 / 会话。
  persisted.escalations = [{ escalationId: 'ESC-001', nodeId: 'T-002', state: 'pending', reasonCode: 'dispatch_failed' }];
  persisted.updatedAt = new Date().toISOString();
  writeJson(statePath(root), persisted);

  const before = readEvents(root).length;
  const second = runCli(root, ['instance', 'status', 'INST-001']);
  save('AC-16', 'status-second.txt', `exit=${second.code}\n${second.stdout}`);
  c.eq('二次查看：需关注（单原因逐字）', second.lines.find((l) => l.startsWith('健康度')) ?? null, '健康度 需关注 · 有待处理升级');
  const events = readEvents(root);
  const changed = events.filter((e) => e.reason === 'health.changed');
  c.eq('档位变化事件恰 1 条', changed.length, 1);
  c.eq('变化事件 from=normal', changed[0]?.from, 'normal');
  c.eq('变化事件 to=attention', changed[0]?.to, 'attention');
  c.eq('变化事件 object=health', changed[0]?.object, 'health');
  c.eq('变化事件 objectId=INST-001', changed[0]?.objectId, 'INST-001');
  c.eq('detail.reasons=[pending_escalation]', JSON.stringify(changed[0]?.detail?.reasons), JSON.stringify(['pending_escalation']));
  c.eq('事件 seq 接在链尾（before+1）', changed[0]?.seq, before + 1);
  c.check('prev_event_hash 为 64 位十六进制', /^[0-9a-f]{64}$/.test(String(changed[0]?.prev_event_hash ?? '')), changed[0]?.prev_event_hash);

  const logText = runCli(root, ['instance', 'log', 'INST-001']);
  save('AC-16', 'log-text.txt', `exit=${logText.code}\n${logText.stdout}`);
  const healthLine = logText.lines.find((l) => l.includes('健康度 INST-001'));
  c.check('文本视图健康度行逐字（A-8）', /^\d{2}:\d{2}:\d{2}  健康度 INST-001  正常 → 需关注  原因 有待处理升级$/.test(healthLine ?? ''), healthLine);
  const logJson = runCli(root, ['instance', 'log', 'INST-001', '--format', 'json']);
  const parsed = JSON.parse(logJson.stdout);
  c.eq('JSON 可检索同一条 health.changed', parsed.filter((e) => e.reason === 'health.changed').length, 1);
  c.eq('JSON detail.reasons 含 pending_escalation', JSON.stringify(parsed.find((e) => e.reason === 'health.changed')?.detail?.reasons), JSON.stringify(['pending_escalation']));

  // 同档位再查：条数不变。
  const third = runCli(root, ['instance', 'status', 'INST-001']);
  c.eq('三次查看仍同档', third.lines.find((l) => l.startsWith('健康度')) ?? null, '健康度 需关注 · 有待处理升级');
  c.eq('同档位再查不追加事件', readEvents(root).length, events.length);
  stopCore(root);

  // 任务书要求的真实 task-loop dispatch-fail-first 对照：首次补写已在 run 收尾完成，
  // 真实场景的 health.changed 计数为 0（BR-15：首次写入不算变化、档位未变不重复记）。
  const realRoot = mkroot('task-loop-health-event');
  const driver = here('test/fixtures/task-loop-driver.mjs');
  const real = spawnSync(process.execPath, [driver, '--root', realRoot, '--scenario', 'dispatch-fail-first'], {
    cwd: realRoot, env: { ...process.env, NODE_ENV: 'test' }, encoding: 'utf8', timeout: 120_000,
  });
  save('AC-16', 'real-task-loop-driver.txt', `exit=${real.status}\n${real.stdout}\n${real.stderr}`);
  const realStateBefore = readJson(statePath(realRoot));
  const realS1 = runCli(realRoot, ['instance', 'status', 'INST-001']);
  save('AC-16', 'real-status.txt', `exit=${realS1.code}\n${realS1.stdout}`);
  const realEvents = readEvents(realRoot);
  c.eq('真实场景首次查看：需关注（有待处理升级）', realS1.lines.find((l) => l.startsWith('健康度')) ?? null, '健康度 需关注 · 有待处理升级');
  c.check('真实场景 health.changed=0（首次补写在 run 收尾完成）', realEvents.filter((e) => e.reason === 'health.changed').length === 0,
    `count=${realEvents.filter((e) => e.reason === 'health.changed').length}, run 前 level=${realStateBefore.health?.level}`);
  const realS2 = runCli(realRoot, ['instance', 'status', 'INST-001']);
  c.check('真实场景再次查看同档、不追加事件', realS1.stdout === realS2.stdout && readEvents(realRoot).length === realEvents.length, `events=${readEvents(realRoot).length}`);
  save('AC-16', 'real-status-second.txt', `exit=${realS2.code}\n${realS2.stdout}`);
  stopCore(realRoot);

  return c.finish({
    keyEvidence: ['status-first.txt', 'status-second.txt', 'log-text.txt', 'real-task-loop-driver.txt', 'real-status.txt'],
    note: '快照受控变化恰 1 条 health.changed；真实 dispatch-fail-first 为 0 条（首次补写已在 run 收尾完成）。若任务书要求真实场景也必须恰 1 条，需主控裁决（与 BR-15 冲突）。',
  });
}

// ---------------------------------------------------------------- AC-17 / AC-18

function runTaskLoop(root) {
  const driver = here('test/fixtures/task-loop-driver.mjs');
  const res = spawnSync(process.execPath, [driver, '--root', root, '--scenario', 'dispatch-fail-first'], {
    cwd: root, env: { ...process.env, NODE_ENV: 'test' }, encoding: 'utf8', timeout: 120_000,
  });
  return { code: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

async function ac17and18() {
  const c17 = collector('AC-17', {
    title: '健康度写入实例元数据，并在两个用户面可见',
    fixture: 'task-loop driver --scenario dispatch-fail-first（真实运行）',
  });
  const root = mkroot('health-visible');
  const run = runTaskLoop(root);
  save('AC-17', 'run-task-loop.txt', `exit=${run.code}\n${run.stdout}\n${run.stderr}`);
  c17.eq('run 退出码 4（升级收尾，预期）', run.code, 4);
  c17.check('run 收尾输出没有健康度行', !run.stdout.includes('健康度'), run.stdout);

  const boot = runCli(root, ['instance', 'status', 'INST-001']);
  save('AC-17', 'status.txt', `exit=${boot.code}\n${boot.stdout}`);
  c17.eq('instance status exit 0', boot.code, 0);
  const healthLine = boot.lines.find((l) => l.startsWith('健康度'));
  c17.eq('instance status 健康度行逐字', healthLine, '健康度 需关注 · 有待处理升级');

  const state = readJson(statePath(root));
  c17.eq('元数据 health.level=attention', state.health?.level, 'attention');
  c17.eq('元数据 health.reasons=[pending_escalation]', JSON.stringify(state.health?.reasons), JSON.stringify(['pending_escalation']));
  c17.check('元数据保留 nodeTimeoutMs', Number.isFinite(state.health?.nodeTimeoutMs), JSON.stringify(state.health));
  c17.check('元数据 computedAt 存在', typeof state.health?.computedAt === 'string', state.health?.computedAt);

  const doc = fs.readFileSync(statusDocPath(root), 'utf8');
  save('AC-17', 'status.md', doc);
  c17.check('status.md 同一行逐字', doc.split('\n').includes('- 健康度：需关注 · 有待处理升级'), doc.split('\n').filter((l) => l.includes('健康度')).join('|'));

  const graphText = runCli(root, ['instance', 'graph', 'INST-001']);
  const graphJson = runCli(root, ['instance', 'graph', 'INST-001', '--format', 'json']);
  save('AC-17', 'graph.txt', graphText.stdout);
  save('AC-17', 'graph.json', graphJson.stdout);
  c17.check('graph 文本无健康度/health', !graphText.stdout.includes('健康度') && !graphText.stdout.includes('health'), graphText.stdout);
  c17.check('graph JSON 无健康度/health', !graphJson.stdout.includes('健康度') && !graphJson.stdout.includes('"health"'), graphJson.stdout);
  const parsedGraph = JSON.parse(graphJson.stdout);
  c17.check('graph JSON 顶层无 health 键', !Object.prototype.hasOwnProperty.call(parsedGraph, 'health'), Object.keys(parsedGraph).join(','));
  c17.check('实例目录不存在 graph.json（健康度不写入图文件）', !fs.existsSync(path.join(path.dirname(statePath(root)), 'graph.json')), '');

  const again = runCli(root, ['instance', 'status', 'INST-001']);
  c17.eq('再次查看仍同档同原因', again.lines.find((l) => l.startsWith('健康度')), '健康度 需关注 · 有待处理升级');
  save('AC-17', 'status-again.txt', again.stdout);

  // ---------------------------------------------------------------- AC-18
  const c18 = collector('AC-18', {
    title: '健康度只读：不改变节点/会话/交接包，不触发升级',
    fixture: '同一 task-loop dispatch-fail-first 实例，三次 status + 三次 trace show',
  });
  const stateFile = statePath(root);
  const eventsFile = eventsPath(root);
  const before = readJson(stateFile);
  const beforeEvents = sha256(eventsFile);
  const groups = (s) => ({
    nodes: s.nodes, sessions: s.sessions, handoffs: s.handoffs, escalations: s.escalations,
  });
  const beforeGroups = JSON.stringify(groups(before));
  const beforeEsc = before.escalations.length;

  const statuses = [];
  const traces = [];
  for (let i = 0; i < 3; i += 1) {
    statuses.push(runCli(root, ['instance', 'status', 'INST-001']));
    traces.push(runCli(root, ['trace', 'show', 'INST-001']));
  }
  save('AC-18', 'status-1.txt', statuses[0].stdout);
  save('AC-18', 'status-2.txt', statuses[1].stdout);
  save('AC-18', 'status-3.txt', statuses[2].stdout);
  save('AC-18', 'trace-1.txt', traces[0].stdout);
  save('AC-18', 'trace-2.txt', traces[1].stdout);
  save('AC-18', 'trace-3.txt', traces[2].stdout);
  c18.check('三次 status exit 0', statuses.every((r) => r.code === 0), statuses.map((r) => r.code).join(','));
  c18.check('三次 trace exit 0', traces.every((r) => r.code === 0), traces.map((r) => r.code).join(','));
  c18.check('三次 status 输出一致', new Set(statuses.map((r) => r.stdout)).size === 1, '');
  c18.check('三次 trace 输出一致', new Set(traces.map((r) => r.stdout)).size === 1, '');
  c18.check('三次 status 健康度档位不变', statuses.every((r) => (r.lines.find((l) => l.startsWith('健康度')) ?? '') === '健康度 需关注 · 有待处理升级'), '');

  const after = readJson(stateFile);
  c18.eq('节点/会话/交接包/升级四组深比较不变', JSON.stringify(groups(after)), beforeGroups);
  c18.eq('升级条数不变', after.escalations.length, beforeEsc);
  c18.eq('events.jsonl 字节哈希不变', sha256(eventsFile), beforeEvents);
  c18.check('run 收尾输出没有健康度行（同一 run 的保存输出）', !run.stdout.includes('健康度'), '');
  c18.eq('健康度档位不变', after.health?.level, 'attention');

  stopCore(root);
  return { c17: c17.finish({ keyEvidence: ['run-task-loop.txt', 'status.txt', 'status.md', 'graph.txt', 'graph.json'] }), c18: c18.finish({ keyEvidence: ['status-1..3.txt', 'trace-1..3.txt'] }) };
}

// ---------------------------------------------------------------- AC-19

function git(args, cwd = REPO) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 120_000 });
}

function writeMockConfigFor(root, mockPath, switches = []) {
  const dir = path.join(root, '.orch', 'hosts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'mock.json'), JSON.stringify({
    transport: 'stdio',
    launch: { command: process.execPath, args: [mockPath, ...switches] },
    limits: { initializeTimeoutMs: 15_000, requestTimeoutMs: 15_000, promptTimeoutMs: 40_000, quietIdleMs: 30, quietCapMs: 200 },
  }, null, 2), 'utf8');
}

function runCliAt(binPath, root, args, timeout = 120_000) {
  const res = spawnSync(process.execPath, [binPath, ...args], {
    cwd: root, env: { ...process.env, NODE_ENV: 'test' }, timeout, encoding: 'utf8', windowsHide: true,
  });
  return {
    code: res.status,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    lines: (res.stdout ?? '').replace(/\n$/, '').split('\n'),
  };
}

function normalizeLine(line) {
  return line
    .replace(/mock-sess-\d+-\d+/g, 'mock-sess-PID-SEQ')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, 'ISOTIME')
    .replace(/\d{2}:\d{2}:\d{2}/g, 'TIME')
    .replace(/已运行 \d+s/g, '已运行 Ns')
    .replace(/耗时 \d+s/g, '耗时 Ns')
    .replace(/已等待 \d+s/g, '已等待 Ns');
}

async function ac19() {
  const c = collector('AC-19', {
    title: '既有状态输出不回归：只允许新增一行健康度',
    fixture: '真实 single / code-loop，与 322fb5e 基线工作树对照',
  });
  const baseDir = '/tmp/acc9-b-base';
  // 清理旧工作树后新建。
  git(['worktree', 'remove', '--force', baseDir]);
  fs.rmSync(baseDir, { recursive: true, force: true });
  const add = git(['worktree', 'add', '--detach', baseDir, '322fb5e']);
  c.eq('git worktree add 322fb5e exit 0', add.status, 0);
  if (add.status !== 0) {
    save('AC-19', 'worktree-add.log', add.stdout + add.stderr);
    return c.finish({ blocked: 'worktree add failed' });
  }
  const baseBin = path.join(baseDir, 'bin', 'orch.js');
  const baseMock = path.join(baseDir, 'test', 'fixtures', 'mock-acp-agent.js');

  const cases = [
    { tag: 'single', template: 'single', task: '写一份说明' },
    { tag: 'code-loop', template: 'code-loop', task: '实现一个示例功能\n产物：calc.js' },
  ];
  const evidence = {};
  try {
    for (const item of cases) {
      const curRoot = mkroot(`regress-${item.tag}-cur`);
      const baseRoot = mkroot(`regress-${item.tag}-base`);
      writeMockConfig(curRoot, []);
      writeMockConfigFor(baseRoot, baseMock, []);
      const curRun = runCliAt(BIN, curRoot, ['run', '--cwd', '.', '--template', item.template, '--host', 'mock', '--task', item.task]);
      const baseRun = runCliAt(baseBin, baseRoot, ['run', '--cwd', '.', '--template', item.template, '--host', 'mock', '--task', item.task]);
      save('AC-19', `${item.tag}-run-current.txt`, `exit=${curRun.code}\n${curRun.stdout}${curRun.stderr}`);
      save('AC-19', `${item.tag}-run-base.txt`, `exit=${baseRun.code}\n${baseRun.stdout}${baseRun.stderr}`);
      c.eq(`${item.tag} run 退出码一致`, curRun.code, baseRun.code);

      const curStatus = runCliAt(BIN, curRoot, ['instance', 'status', 'INST-001']);
      const baseStatus = runCliAt(baseBin, baseRoot, ['instance', 'status', 'INST-001']);
      save('AC-19', `${item.tag}-status-current.txt`, `exit=${curStatus.code}\n${curStatus.stdout}`);
      save('AC-19', `${item.tag}-status-base.txt`, `exit=${baseStatus.code}\n${baseStatus.stdout}`);
      const healthLines = curStatus.lines.filter((l) => l.startsWith('健康度'));
      c.eq(`${item.tag} 健康度行恰 1 行`, healthLines.length, 1);
      c.eq(`${item.tag} 健康度行紧跟实例状态行（index=1）`, curStatus.lines.findIndex((l) => l.startsWith('健康度')), 1);
      const without = curStatus.lines.filter((l) => !l.startsWith('健康度')).map(normalizeLine);
      const baseNorm = baseStatus.lines.map(normalizeLine);
      c.check(`${item.tag} 删健康度行后与 322fb5e 基线逐字一致`, JSON.stringify(without) === JSON.stringify(baseNorm), `cur=${JSON.stringify(without)}\nbase=${JSON.stringify(baseNorm)}`);

      const curText = runCliAt(BIN, curRoot, ['instance', 'graph', 'INST-001']);
      const baseText = runCliAt(baseBin, baseRoot, ['instance', 'graph', 'INST-001']);
      save('AC-19', `${item.tag}-graph-current.txt`, `exit=${curText.code}\n${curText.stdout}`);
      save('AC-19', `${item.tag}-graph-base.txt`, `exit=${baseText.code}\n${baseText.stdout}`);
      c.check(`${item.tag} graph 文本逐字一致`, normalizeLine(curText.stdout) === normalizeLine(baseText.stdout), curText.stdout);
      c.check(`${item.tag} graph 文本无健康度/health 字段`, !/健康度|health/i.test(curText.stdout), curText.stdout);

      const curJson = runCliAt(BIN, curRoot, ['instance', 'graph', 'INST-001', '--format', 'json']);
      const baseJson = runCliAt(baseBin, baseRoot, ['instance', 'graph', 'INST-001', '--format', 'json']);
      save('AC-19', `${item.tag}-graph-current.json`, curJson.stdout);
      save('AC-19', `${item.tag}-graph-base.json`, baseJson.stdout);
      c.check(`${item.tag} graph JSON 逐字一致`, normalizeLine(curJson.stdout) === normalizeLine(baseJson.stdout), curJson.stdout.slice(0, 400));
      c.check(`${item.tag} graph JSON 无健康度/health`, !/健康度|"health"/.test(curJson.stdout), '');
      evidence[item.tag] = { curRun: curRun.code, baseRun: baseRun.code };
      stopCore(curRoot);
      stopCore(baseRoot);
      fs.rmSync(curRoot, { recursive: true, force: true });
      fs.rmSync(baseRoot, { recursive: true, force: true });
    }
  } finally {
    git(['worktree', 'remove', '--force', baseDir]);
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
  c.check('工作树已移除（不留仓库外残留）', !fs.existsSync(baseDir), baseDir);
  return c.finish({ cases: evidence, keyEvidence: ['single-status-current/base.txt', 'code-loop-status-current/base.txt', '*-graph-*'] });
}

// ---------------------------------------------------------------- main

const out = {};
out.ac15 = await ac15();
out.ac16 = await ac16();
const both = await ac17and18();
out.ac17 = both.c17;
out.ac18 = both.c18;
out.ac19 = await ac19();
for (const [key, value] of Object.entries(out)) {
  process.stdout.write(`${key.toUpperCase()}: ${value.passed ? 'PASS' : 'FAIL'} (${value.failed}/${value.total} failed)\n`);
}
