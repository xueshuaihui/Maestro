/**
 * I1.9 / S3 B 组：AC-20 ~ AC-25 取证。
 *
 * AC-20 静态门禁（零依赖 / 中文来源 / 31 词纯净扫描 / 无宿主分支）；
 * AC-21 历史链续接（3 条无反指纹旧记录 + 末行截断）；
 * AC-22 进行中跨度（真实当前代码实例：--hold-session，及 --turn-delay-ms 放行对照）；
 * AC-23 追踪三种降级（文件缺失 / 单行损坏 / 缺时间字段）；
 * AC-24 会话审计粒度（--fail-tool 真实失败节点 + 遗留实例只读 + grep 计数）；
 * AC-25 整份不可解析重起链。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  REPO, BIN, mkroot, writeMockConfig, writeJson, writeTraces, runCli,
  readJson, readEvents, statePath, eventsPath, tracesPath,
  startCoreOnEmptyRoot, stopCore, save, collector, localIso, sha256, chainHash,
  spawnCli, waitFor, sleep, nonEmptyLines,
} from './acc9-b-lib.mjs';

function baseSnapshot({ id = 'INST-001', template = 'single', state = 'running', nodes, handoffs = [], sessions = [], escalations = [], health = { nodeTimeoutMs: 300000 }, traceId = undefined }) {
  const at = localIso(10, 0, 0);
  const snap = {
    schemaVersion: 2,
    instanceId: id,
    coreGeneration: 'acc9-b',
    createdAt: at,
    updatedAt: at,
    state,
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
  if (traceId !== undefined) snap.traceId = traceId;
  return snap;
}

function git(args) {
  return spawnSync('git', args, { cwd: REPO, encoding: 'utf8', timeout: 120_000 });
}

// ---------------------------------------------------------------- AC-20

async function ac20() {
  const c = collector('AC-20', {
    title: '非功能：零依赖、中文唯一来源、纯净扫描、无宿主分支',
    fixture: '仓库静态检查（无业务夹具）',
  });
  const pkg = readJson(path.join(REPO, 'package.json'));
  c.eq('dependencies 键数 = 0', Object.keys(pkg.dependencies ?? {}).length, 0);
  const dep = spawnSync(process.execPath, ['-p', "Object.keys(require('./package.json').dependencies||{}).length"], {
    cwd: REPO, encoding: 'utf8', timeout: 30_000,
  });
  c.eq('node -p dependencies 输出 0', (dep.stdout ?? '').trim(), '0');

  const words = [
    'task-loop', 'researcher', 'writer', 'reviewer', '研究员', '撰写者', '审核者',
    'code-loop', 'developer', 'tester', 'coordinator', 'arbiter', 'planner',
    'summarizer', 'worker', 'data-analyst', 'fact-checker', 'editor', 'code-reviewer',
    'compliance-reviewer', 'requirement-clarifier', 'research-brief', 'fact-check',
    'data-analysis', 'doc-draft', 'doc-review', 'code-change', 'test-run', 'code-review',
    'coordination', 'compliance-check',
  ];
  c.eq('--forbid 词表 31 词', words.length, 31);
  const purity = spawnSync(process.execPath, ['test/fixtures/purity-check.mjs', '--dirs', 'src/core,src/daemon', '--forbid', words.join(',')], {
    cwd: REPO, env: { ...process.env, NODE_ENV: 'test' }, encoding: 'utf8', timeout: 60_000,
  });
  save('AC-20', 'purity.log', `exit=${purity.status}\n${purity.stdout}\n${purity.stderr}`);
  c.eq('31 词纯净扫描 exit 0', purity.status, 0);

  // src/daemon 无 `if host ==` / `switch (host)`（与 i19-regression 同一启发式，排除 typeof 守卫）。
  const daemonDir = path.join(REPO, 'src', 'daemon');
  const offenders = [];
  for (const file of fs.readdirSync(daemonDir).filter((n) => n.endsWith('.js'))) {
    const lines = fs.readFileSync(path.join(daemonDir, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/switch\s*\(\s*host/i.test(line)) offenders.push(`${file}:${i + 1} switch(host)`);
      const isHostBranch = /\bif\s*\(/.test(line) && !/typeof/.test(line) && /\bhost[A-Za-z]*\s*(===?|!==?)/.test(line);
      if (isHostBranch) offenders.push(`${file}:${i + 1} if(host...)`);
    });
  }
  c.eq('src/daemon 无宿主分支', offenders.length, 0);
  save('AC-20', 'daemon-host-branch-scan.txt', offenders.length ? offenders.join('\n') : 'no host branch');

  // 中文唯一来源：本迭代 src/core / src/daemon 新增的非注释行不得出现中文。
  const diff = git(['diff', '322fb5e..HEAD', '-U0', '--', 'src/core', 'src/daemon']);
  const added = (diff.stdout ?? '').split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));
  const cjk = /[\u4e00-\u9fff]/;
  const nonCommentCjk = added.filter((line) => cjk.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line));
  save('AC-20', 'src-core-daemon-added-cjk.txt', nonCommentCjk.length ? nonCommentCjk.join('\n') : 'none');
  c.eq('新增中文非注释行 0（中文只来自 labels.js）', nonCommentCjk.length, 0);

  const labelsSync = spawnSync(process.execPath, ['--test', 'test/wp11/labels-sync.test.js'], {
    cwd: REPO, env: { ...process.env, NODE_ENV: 'test' }, encoding: 'utf8', timeout: 60_000,
  });
  save('AC-20', 'labels-sync.log', `exit=${labelsSync.status}\n${labelsSync.stdout}${labelsSync.stderr}`);
  c.eq('labels-sync 用例 exit 0', labelsSync.status, 0);

  return c.finish({ keyEvidence: ['purity.log', 'daemon-host-branch-scan.txt', 'src-core-daemon-added-cjk.txt', 'labels-sync.log'] });
}

// ---------------------------------------------------------------- AC-21 / AC-25 helpers

const LEGACY_EVENTS = () => [
  { object: 'instance', objectId: 'INST-001', from: 'created', to: 'running', result: 'applied', reason: 'run.started', seq: 1, ts: localIso(9, 0, 0) },
  { object: 'node', objectId: 'T-001', from: 'pending', to: 'running', result: 'applied', reason: 'run.started', seq: 2, ts: localIso(9, 0, 1) },
  { object: 'handoff', objectId: 'HO-001', from: 'created', to: 'delivered', result: 'applied', reason: 'handoff.delivered', seq: 3, ts: localIso(9, 0, 2) },
];

const CREATED_STATE = () => baseSnapshot({
  state: 'created',
  nodes: [{ nodeId: 'T-001', roleId: 'worker', round: 0, state: 'pending' }],
  health: { nodeTimeoutMs: 30000 },
});

function seedChain(root, lines) {
  const dir = path.dirname(eventsPath(root));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(eventsPath(root), lines.join('\n') + (lines.at(-1)?.endsWith('\n') ? '' : '\n'), 'utf8');
}

function runContinue(root) {
  return runCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '写一份说明', '--instance', 'INST-001'], { timeout: 90_000 });
}

// ---------------------------------------------------------------- AC-21

async function ac21() {
  const c = collector('AC-21', {
    title: '事件链的历史兼容：旧记录无标记、末行被截断仍能续链',
    fixture: '3 条无反指纹旧记录（seq 1~3）；truncated 追加 1 条截断半行',
  });
  const legacyRecords = LEGACY_EVENTS();
  const legacyLine = legacyRecords.map((r) => JSON.stringify(r));

  // ---- legacy：3 条完整旧记录 ----
  const root = mkroot('chain-legacy');
  writeMockConfig(root, []);
  const boot = startCoreOnEmptyRoot(root);
  c.check('legacy 先起核心', boot.ok, boot.stdout.trim());
  c.check('legacy 先起核心', boot.ok, boot.stdout.trim());
  writeJson(statePath(root), CREATED_STATE());
  seedChain(root, legacyLine);
  const oldText = fs.readFileSync(eventsPath(root), 'utf8');
  const oldHash = sha256(eventsPath(root));
  const run = runContinue(root);
  save('AC-21', 'legacy-run.txt', `exit=${run.code}\n${run.stdout}${run.stderr}`);
  c.eq('legacy run exit 0', run.code, 0);
  const afterText = fs.readFileSync(eventsPath(root), 'utf8');
  c.check('旧 3 行字节原样保留（新文件以旧字节为前缀）', afterText.startsWith(oldText), `${oldHash}`);
  c.eq('旧 3 行字节哈希不变', sha256OfText(oldText), oldHash);
  const events = readEvents(root);
  const legacy = events.filter((e) => e.seq <= 3);
  c.eq('旧记录条数 3', legacy.length, 3);
  const fresh = events.filter((e) => e.seq >= 4);
  c.check('新记录 seq 从 4 起连续', fresh.length > 0 && fresh.every((e, i) => e.seq === 4 + i), fresh.map((e) => e.seq).join(','));
  c.eq('新首条 prev_event_hash = 旧第 3 条规范化 sha256', fresh[0]?.prev_event_hash, chainHash(legacyRecords[2]));
  const text = runCli(root, ['instance', 'log', 'INST-001']);
  save('AC-21', 'legacy-log.txt', `exit=${text.code}\n${text.stdout}`);
  c.eq('legacy log exit 0', text.code, 0);
  c.check('legacy 无不可读行提示', !text.stdout.includes('已跳过'), text.stdout.slice(-200));
  const json = runCli(root, ['instance', 'log', 'INST-001', '--format', 'json']);
  c.eq('legacy json exit 0', json.code, 0);
  save('AC-21', 'legacy-log.json', json.stdout);
  stopCore(root);

  // ---- truncated：3 条完整 + 1 条截断半行（半行带行尾 \n，模拟强杀写坏的尾行）----
  const root2 = mkroot('chain-truncated');
  writeMockConfig(root2, []);
  const boot2 = startCoreOnEmptyRoot(root2);
  c.check('truncated 先起核心', boot2.ok, boot2.stdout.trim());
  writeJson(statePath(root2), CREATED_STATE());
  const truncated = '{"object":"handoff","objectId":"HO-002","seq":4,"reason":"handoff.delivered"';
  seedChain(root2, [...legacyLine, truncated]);
  const oldText2 = fs.readFileSync(eventsPath(root2), 'utf8');
  const oldHash2 = sha256(eventsPath(root2));
  const run2 = runContinue(root2);
  save('AC-21', 'truncated-run.txt', `exit=${run2.code}\n${run2.stdout}${run2.stderr}`);
  c.eq('truncated run exit 0', run2.code, 0);
  const afterText2 = fs.readFileSync(eventsPath(root2), 'utf8');
  c.check('旧 4 行（3 好 + 1 半行）字节原样保留', afterText2.startsWith(oldText2), oldHash2);
  c.eq('truncated 旧字节哈希不变', sha256OfText(oldText2), oldHash2);
  const events2 = readEvents(root2);
  const fresh2 = events2.filter((e) => e.seq >= 4);
  c.check('truncated 新记录 seq 从 4 起连续', fresh2.length > 0 && fresh2.every((e, i) => e.seq === 4 + i), fresh2.map((e) => e.seq).join(','));
  c.eq('truncated 新首条 prev_event_hash = 旧第 3 条规范化 sha256', fresh2[0]?.prev_event_hash, chainHash(legacyRecords[2]));
  const text2 = runCli(root2, ['instance', 'log', 'INST-001']);
  save('AC-21', 'truncated-log.txt', `exit=${text2.code}\n${text2.stdout}`);
  c.eq('truncated log exit 0', text2.code, 0);
  c.check('truncated 文本视图末行为 A-13（N=1）', nonEmptyLines(text2.stdout).at(-1) === '已跳过 1 行不可读记录', nonEmptyLines(text2.stdout).at(-1));
  const json2 = runCli(root2, ['instance', 'log', 'INST-001', '--format', 'json']);
  c.eq('truncated json exit 0', json2.code, 0);
  save('AC-21', 'truncated-log.json', json2.stdout);
  stopCore(root2);

  return c.finish({
    keyEvidence: ['legacy-run.txt', 'legacy-log.txt', 'truncated-run.txt', 'truncated-log.txt'],
    note: 'truncated 夹具按 AC 机检口径构造为「3 条完整旧记录 + 第 4 条截断半行（带行尾 \\n）」：这样才能同时满足 seq 从 4、prev=旧第 3 条、badLines=1 三条判据。',
  });
}

function sha256OfText(text) {
  return crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

// ---------------------------------------------------------------- AC-22

async function ac22() {
  const c = collector('AC-22', {
    title: '进行中的跨度：显示“进行中”与结束位“—”，不显示“暂无追踪记录”',
    fixture: '真实当前代码实例：--hold-session（A-10）；--turn-delay-ms 放行后同实例变已完成跨度',
  });

  // ① --hold-session：节点停在运行中、尚无落地跨度。
  const root = mkroot('trace-running-hold');
  writeMockConfig(root, ['--hold-session']);
  const bg = spawnCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '写一份说明']);
  const running = await waitFor(() => {
    if (!fs.existsSync(statePath(root))) return null;
    try {
      const s = readJson(statePath(root));
      return s?.nodes?.[0]?.state === 'running' && (s.sessions?.length ?? 0) > 0 ? s : null;
    } catch { return null; }
  }, { timeoutMs: 40_000, label: 'hold 节点运行中' });
  c.check('当前代码实例带 traceId（D-23）', /^TRC-[0-9a-f]{8}$/.test(String(running.traceId ?? '')), running.traceId);
  const first = runCli(root, ['trace', 'show', 'INST-001']);
  save('AC-22', 'trace-hold.txt', `exit=${first.code}\n${first.stdout}`);
  c.eq('hold trace exit 0', first.code, 0);
  c.eq('首行带实例与追踪号', first.lines[0], `实例 INST-001 · 追踪 ${running.traceId}`);
  c.eq('汇总 跨度 0 条 · 回流 0 次', first.lines[1], '跨度 0 条 · 回流 0 次');
  c.check('跨度行：HH:MM:SS → —  T-001  进行中  交接 HO-001', /^\d{2}:\d{2}:\d{2} → —  T-001  进行中  交接 HO-001$/.test(first.lines[3] ?? ''), first.lines[3]);
  c.eq('末两行 回流链 / 无', first.lines.slice(-2).join('|'), '回流链|无');
  c.check('不出现暂无追踪记录', !first.stdout.includes('暂无追踪记录'), '');
  c.check('hold 期间无落地跨度文件或为空', !fs.existsSync(tracesPath(root)) || fs.readFileSync(tracesPath(root), 'utf8').trim() === '', '');
  // 夹具没有 release 通道，取消是唯一唤醒方式；取消用于结束本进程，不冒充“放行完成”。
  const cancel = runCli(root, ['cancel', '--instance', 'INST-001'], { timeout: 30_000 });
  save('AC-22', 'hold-cancel.txt', `exit=${cancel.code}\n${cancel.stdout}`);
  c.eq('hold 取消 exit 0', cancel.code, 0);
  const holdExit = await bg.exited;
  c.check('hold 运行进程已结束', holdExit.code !== null, `code=${holdExit.code}`);
  stopCore(root);

  // ② --turn-delay-ms 30000：同一实例先“进行中”，放行后变 1 条已完成跨度。
  const root2 = mkroot('trace-running-delay');
  writeMockConfig(root2, ['--turn-delay-ms', '30000']);
  const bg2 = spawnCli(root2, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '写一份说明']);
  const running2 = await waitFor(() => {
    if (!fs.existsSync(statePath(root2))) return null;
    try {
      const s = readJson(statePath(root2));
      return s?.nodes?.[0]?.state === 'running' && (s.sessions?.length ?? 0) > 0 ? s : null;
    } catch { return null; }
  }, { timeoutMs: 40_000, label: 'delay 节点运行中' });
  const mid = runCli(root2, ['trace', 'show', 'INST-001']);
  save('AC-22', 'trace-delay-running.txt', `exit=${mid.code}\n${mid.stdout}`);
  c.eq('delay 运行中：汇总 跨度 0 条', mid.lines[1], '跨度 0 条 · 回流 0 次');
  c.check('delay 运行中：跨度行为进行中/—', /^\d{2}:\d{2}:\d{2} → —  T-001  进行中  交接 HO-001$/.test(mid.lines[3] ?? ''), mid.lines[3]);
  const done = await bg2.exited;
  save('AC-22', 'delay-run.txt', `exit=${done.code}\n${done.stdout}${done.stderr}`);
  c.eq('delay run exit 0', done.code, 0);
  const after = runCli(root2, ['trace', 'show', 'INST-001']);
  save('AC-22', 'trace-delay-done.txt', `exit=${after.code}\n${after.stdout}`);
  c.eq('放行后汇总 跨度 1 条 · 回流 0 次', after.lines[1], '跨度 1 条 · 回流 0 次');
  c.check('放行后不再出现进行中', !after.stdout.includes('进行中'), after.stdout);
  c.check('放行后跨度行有起止时刻', /^\d{2}:\d{2}:\d{2} → \d{2}:\d{2}:\d{2}  T-001  已完成  交接 HO-001$/.test(after.lines[3] ?? ''), after.lines[3]);
  stopCore(root2);

  return c.finish({
    keyEvidence: ['trace-hold.txt', 'trace-delay-running.txt', 'trace-delay-done.txt'],
    note: '--hold-session 在 mock 里只能被取消唤醒，没有“放行后完成”的通道；因此同一实例的「运行中 → 已完成」用 --turn-delay-ms 的同形运行中窗口复验，两者均使用当前代码创建的实例。',
  });
}

// ---------------------------------------------------------------- AC-23

async function ac23() {
  const c = collector('AC-23', {
    title: '追踪异常：文件缺失、单行损坏、缺时间字段都降级且可见',
    fixture: '三个快照夹具（先起核心再写快照）',
  });

  // missing：历史实例无 traceId + 追踪文件被删除 -> A-1
  const root = mkroot('trace-degraded-missing');
  c.check('missing 先起核心', startCoreOnEmptyRoot(root).ok, '');
  writeJson(statePath(root), baseSnapshot({
    nodes: [{ nodeId: 'T-001', roleId: 'worker', round: 0, state: 'pending' }],
  }));
  writeTraces(root, [{ trace_id: 'TRC-deadbeef', instance_id: 'INST-001', node_id: 'T-001', round: 1, start_time: localIso(10, 0, 0), end_time: localIso(10, 0, 2), status: 'done' }]);
  fs.rmSync(tracesPath(root), { force: true });
  const missTrace = runCli(root, ['trace', 'show', 'INST-001']);
  const missStatus = runCli(root, ['instance', 'status', 'INST-001']);
  save('AC-23', 'missing-trace.txt', `exit=${missTrace.code}\n${missTrace.stdout}${missTrace.stderr}`);
  save('AC-23', 'missing-status.txt', `exit=${missStatus.code}\n${missStatus.stdout}${missStatus.stderr}`);
  c.eq('missing trace exit 0', missTrace.code, 0);
  c.eq('missing 显示 A-1', missTrace.stdout, '实例 INST-001 · 暂无追踪记录\n');
  c.check('missing 无堆栈', !/at\s+.+:\d+:\d+/.test(missTrace.stdout + missTrace.stderr), missTrace.stderr);
  c.eq('missing status exit 0', missStatus.code, 0);
  c.eq('missing 健康度照常给出（正常）', missStatus.lines.find((l) => l.startsWith('健康度')), '健康度 正常');
  stopCore(root);

  // badline：1 条坏行 + 2 条正常跨度
  const root2 = mkroot('trace-degraded-badline');
  c.check('badline 先起核心', startCoreOnEmptyRoot(root2).ok, '');
  writeJson(statePath(root2), baseSnapshot({
    traceId: 'TRC-0000aaaa',
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', round: 1, state: 'done', startedAt: localIso(10, 0, 0), endedAt: localIso(10, 0, 10) },
      { nodeId: 'T-002', roleId: 'tester', round: 1, state: 'done', startedAt: localIso(10, 0, 10), endedAt: localIso(10, 0, 30) },
    ],
    health: { nodeTimeoutMs: 300000 },
  }));
  writeTraces(root2, [
    '{"trace_id":',
    { trace_id: 'TRC-0000aaaa', instance_id: 'INST-001', node_id: 'T-001', round: 1, start_time: localIso(10, 0, 0), end_time: localIso(10, 0, 10), status: 'done' },
    { trace_id: 'TRC-0000aaaa', instance_id: 'INST-001', node_id: 'T-002', round: 1, start_time: localIso(10, 0, 10), end_time: localIso(10, 0, 30), status: 'done' },
  ]);
  const badTrace = runCli(root2, ['trace', 'show', 'INST-001']);
  const badStatus = runCli(root2, ['instance', 'status', 'INST-001']);
  save('AC-23', 'badline-trace.txt', `exit=${badTrace.code}\n${badTrace.stdout}${badTrace.stderr}`);
  save('AC-23', 'badline-status.txt', `exit=${badStatus.code}\n${badStatus.stdout}${badStatus.stderr}`);
  c.eq('badline trace exit 0', badTrace.code, 0);
  c.eq('badline 跳过提示在汇总行之前（A-11）', badTrace.lines[1], '追踪记录有 1 行不可读，已跳过');
  c.eq('badline 正常跨度 2 条', badTrace.lines[2], '跨度 2 条 · 回流 0 次');
  c.check('badline 列出 2 条跨度', badTrace.lines.filter((l) => / → .*  T-00\d  /.test(l)).length === 2, badTrace.stdout);
  c.check('badline 无堆栈', !/at\s+.+:\d+:\d+/.test(badTrace.stdout + badTrace.stderr), badTrace.stderr);
  c.eq('badline status exit 0', badStatus.code, 0);
  c.eq('badline 健康度正常', badStatus.lines.find((l) => l.startsWith('健康度')), '健康度 正常');
  stopCore(root2);

  // notime：6 条跨度缺起止时刻 -> 0 条 P90 样本，不判慢
  const root3 = mkroot('trace-degraded-notime');
  c.check('notime 先起核心', startCoreOnEmptyRoot(root3).ok, '');
  const started = new Date(Date.now() - 70_000).toISOString();
  writeJson(statePath(root3), baseSnapshot({
    traceId: 'TRC-0000bbbb',
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', round: 1, state: 'done', startedAt: localIso(10, 0, 0), endedAt: localIso(10, 0, 10) },
      { nodeId: 'T-006', roleId: 'developer', round: 1, state: 'running', startedAt: started, endedAt: null },
    ],
    health: { nodeTimeoutMs: 300000 },
  }));
  // 每行缺 start_time，end_time 存在：不可计入 P90 样本，也不渲染成「进行中」。
  writeTraces(root3, Array.from({ length: 6 }, (_, i) => ({
    trace_id: 'TRC-0000bbbb', instance_id: 'INST-001', node_id: 'T-00' + (i + 1), round: 1,
    end_time: localIso(10, 0, 10 + i), status: 'done',
  })));
  const noTimeTrace = runCli(root3, ['trace', 'show', 'INST-001']);
  const noTimeStatus = runCli(root3, ['instance', 'status', 'INST-001']);
  save('AC-23', 'notime-trace.txt', `exit=${noTimeTrace.code}\n${noTimeTrace.stdout}${noTimeTrace.stderr}`);
  save('AC-23', 'notime-status.txt', `exit=${noTimeStatus.code}\n${noTimeStatus.stdout}${noTimeStatus.stderr}`);
  c.eq('notime trace exit 0', noTimeTrace.code, 0);
  c.check('notime 无堆栈', !/at\s+.+:\d+:\d+/.test(noTimeTrace.stdout + noTimeTrace.stderr), noTimeTrace.stderr);
  c.eq('notime status exit 0', noTimeStatus.code, 0);
  const health = noTimeStatus.lines.find((l) => l.startsWith('健康度'));
  c.check('notime 不误判为慢', health === '健康度 正常', health);
  stopCore(root3);

  return c.finish({
    keyEvidence: ['missing-trace.txt', 'badline-trace.txt', 'notime-trace.txt', '*-status.txt'],
    note: 'missing 夹具采用 D-23 的历史空号形态（无 traceId + 无追踪文件），才能落到 A-1；当前代码实例删除追踪文件会因 state.traceId 存在而显示 0 条跨度头（非 A-1），该分支不属本 AC 夹具。',
  });
}

// ---------------------------------------------------------------- AC-24

async function ac24() {
  const c = collector('AC-24', {
    title: '会话的审计粒度：逐条状态不进主审计，摘要回答“为什么结束”',
    fixture: '--fail-tool 真实失败节点 + 预置逐条会话记录的遗留实例',
  });
  const root = mkroot('audit-grain');
  fs.mkdirSync(path.join(root, 'host-logs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'host-logs', 'T-001.log'), 'line1\nline2\nline3\n', 'utf8');
  writeMockConfig(root, ['--fail-tool']);
  const run = runCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '执行 out/run.js']);
  save('AC-24', 'run.txt', `exit=${run.code}\n${run.stdout}${run.stderr}`);
  c.eq('失败节点 run 退出码 1', run.code, 1);

  const text = runCli(root, ['instance', 'log', 'INST-001']);
  save('AC-24', 'log-text.txt', `exit=${text.code}\n${text.stdout}`);
  c.eq('instance log 文本 exit 0', text.code, 0);
  const summaryLine = text.lines.find((l) => l.includes('执行摘要'));
  c.check('A-12 摘要行逐字（会话号/时刻随夹具）',
    /^\d{2}:\d{2}:\d{2}  会话 mock-sess-\d+-\d+  执行摘要 命令 node out\/run\.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs\/T-001\.log$/.test(summaryLine ?? ''),
    summaryLine);

  const json = runCli(root, ['instance', 'log', 'INST-001', '--format', 'json']);
  save('AC-24', 'log.json', json.stdout);
  c.eq('instance log json exit 0', json.code, 0);
  const events = JSON.parse(json.stdout);
  const summaries = events.filter((e) => e.reason === 'execution.summary');
  c.eq('execution.summary 恰 1 条（每会话 1 条）', summaries.length, 1);
  const state = readJson(statePath(root));
  c.eq('摘要条数 = 会话数', summaries.length, state.sessions.length);
  c.eq('摘要 object=session', summaries[0]?.object, 'session');
  c.eq('摘要 result=note', summaries[0]?.result, 'note');
  c.eq('摘要 detail.nodeId=T-001', summaries[0]?.detail?.nodeId, 'T-001');
  c.eq('摘要四项与夹具一致', JSON.stringify(summaries[0]?.detail?.summary), JSON.stringify({
    command: 'node out/run.js', exitCode: 1, keyOutputLines: 3, logRef: 'host-logs/T-001.log',
  }));

  const allowed = new Set([
    'execution.summary', 'permission.requested', 'permission.allowed', 'permission.denied',
    'session.state', 'output.submitted', 'run.completed', 'run.failed', 'run.cancelled', 'state.change',
  ]);
  const sessionReasons = [...new Set(events.filter((e) => e.object === 'session').map((e) => e.reason))];
  save('AC-24', 'session-event-reasons.txt', sessionReasons.join('\n'));
  c.check('除摘要外无新增会话级事件类型', sessionReasons.every((reason) => allowed.has(reason)), sessionReasons.join(','));
  c.check('摘要事件仍在会话级原因集合内', sessionReasons.includes('execution.summary'), sessionReasons.join(','));
  c.check('完整日志未复制进实例目录', !fs.existsSync(path.join(path.dirname(statePath(root)), 'host-logs', 'T-001.log')), '');
  stopCore(root);

  // 遗留实例：预置逐条会话记录，查看前后字节不变。
  const legacyRoot = mkroot('audit-legacy');
  c.check('legacy 先起核心', startCoreOnEmptyRoot(legacyRoot).ok, '');
  const at = localIso(10, 0, 0);
  writeJson(statePath(legacyRoot), baseSnapshot({
    state: 'completed',
    nodes: [{ nodeId: 'T-001', roleId: 'worker', round: 1, state: 'done', startedAt: localIso(10, 0, 0), endedAt: localIso(10, 0, 2) }],
    health: { level: 'ended', reasons: [], computedAt: at, nodeTimeoutMs: 30000 },
  }));
  const legacyEvents = [
    { object: 'session', objectId: 'mock-sess-100-1', from: 'idle', to: 'thinking', result: 'applied', reason: 'session.state', seq: 1, ts: at },
    { object: 'session', objectId: 'mock-sess-100-1', from: 'thinking', to: 'tool_running', result: 'applied', reason: 'session.state', seq: 2, ts: at },
    { object: 'session', objectId: 'mock-sess-100-1', from: 'tool_running', to: 'idle', result: 'applied', reason: 'run.completed', seq: 3, ts: at },
  ];
  seedChain(legacyRoot, legacyEvents.map((e) => JSON.stringify(e)));
  const beforeHash = sha256(eventsPath(legacyRoot));
  const beforeText = fs.readFileSync(eventsPath(legacyRoot), 'utf8');
  const legacyLog = runCli(legacyRoot, ['instance', 'log', 'INST-001']);
  save('AC-24', 'legacy-log.txt', `exit=${legacyLog.code}\n${legacyLog.stdout}`);
  c.eq('遗留实例 log exit 0', legacyLog.code, 0);
  c.eq('遗留实例事件字节哈希不变', sha256(eventsPath(legacyRoot)), beforeHash);
  c.eq('遗留实例事件文本不变', fs.readFileSync(eventsPath(legacyRoot), 'utf8'), beforeText);
  c.check('遗留逐条会话记录仍可读', legacyLog.stdout.includes('会话 mock-sess-100-1'), legacyLog.stdout);
  stopCore(legacyRoot);

  // D-24 计数口径
  const orchSrc = fs.readFileSync(path.join(REPO, 'src', 'core', 'orchestrator.js'), 'utf8');
  const countIn = (text, needle) => text.split(needle).length - 1;
  const orchCount = countIn(orchSrc, "object: 'session'");
  c.eq('grep -c "object: \'session\'" src/core/orchestrator.js = 13', orchCount, 13);
  let coreTotal = 0;
  const coreCounts = {};
  for (const file of fs.readdirSync(path.join(REPO, 'src', 'core')).filter((n) => n.endsWith('.js'))) {
    const n = countIn(fs.readFileSync(path.join(REPO, 'src', 'core', file), 'utf8'), "object: 'session'");
    if (n > 0) coreCounts[file] = n;
    coreTotal += n;
  }
  let daemonTotal = 0;
  for (const file of fs.readdirSync(path.join(REPO, 'src', 'daemon')).filter((n) => n.endsWith('.js'))) {
    daemonTotal += countIn(fs.readFileSync(path.join(REPO, 'src', 'daemon', file), 'utf8'), "object: 'session'");
  }
  save('AC-24', 'object-session-counts.json', { orchestrator: orchCount, coreTotal, coreCounts, daemonTotal });
  c.eq('src/core 合计 14（orchestrator 13 + escalation 1）', coreTotal, 14);
  c.eq('escalation.js 存量 1 处', coreCounts['escalation.js'], 1);
  c.eq('src/daemon 合计 0', daemonTotal, 0);

  return c.finish({ keyEvidence: ['log-text.txt', 'log.json', 'legacy-log.txt', 'object-session-counts.json'] });
}

// ---------------------------------------------------------------- AC-25

async function ac25() {
  const c = collector('AC-25', {
    title: '事件链整份不可解析：从固定起点重起链、序号从 1、旧行原样保留',
    fixture: 'events.jsonl 预置 3 行乱码（无一条可解析）',
  });
  const root = mkroot('chain-corrupt');
  writeMockConfig(root, []);
  const boot = startCoreOnEmptyRoot(root);
  c.check('先起核心', boot.ok, boot.stdout.trim());
  writeJson(statePath(root), CREATED_STATE());
  const corrupt = [
    'this is not json at all',
    '<<<corrupted line two>>>',
    '%%% third unreadable row %%%',
  ];
  seedChain(root, corrupt);
  const oldText = fs.readFileSync(eventsPath(root), 'utf8');
  const oldHash = sha256(eventsPath(root));
  const run = runContinue(root);
  save('AC-25', 'run.txt', `exit=${run.code}\n${run.stdout}${run.stderr}`);
  c.eq('run exit 0', run.code, 0);
  const afterText = fs.readFileSync(eventsPath(root), 'utf8');
  c.check('旧 3 行字节原样保留（新文件以旧字节为前缀）', afterText.startsWith(oldText), oldHash);
  c.eq('旧 3 行字节哈希不变', sha256OfText(oldText), oldHash);
  const events = readEvents(root);
  c.check('新记录 seq 从 1 起连续无空洞', events.length > 0 && events.every((e, i) => e.seq === 1 + i), events.map((e) => e.seq).join(','));
  c.eq('新链首条 prev_event_hash 为 64 个 0', events[0]?.prev_event_hash, '0'.repeat(64));
  const text = runCli(root, ['instance', 'log', 'INST-001']);
  save('AC-25', 'log-text.txt', `exit=${text.code}\n${text.stdout}`);
  c.eq('instance log 文本 exit 0', text.code, 0);
  c.check('文本视图末行为 A-13（N=3）', nonEmptyLines(text.stdout).at(-1) === '已跳过 3 行不可读记录', nonEmptyLines(text.stdout).at(-1));
  c.check('无“校验失败/链已断”报错', !/校验失败|链已断/.test(text.stdout + text.stderr), text.stderr);
  const json = runCli(root, ['instance', 'log', 'INST-001', '--format', 'json']);
  save('AC-25', 'log.json', json.stdout);
  c.eq('instance log json exit 0', json.code, 0);
  const parsed = JSON.parse(json.stdout);
  c.check('JSON 只含新链（seq 从 1）', parsed.length === events.length && parsed[0]?.seq === 1, parsed.map((e) => e.seq).join(','));
  stopCore(root);

  return c.finish({ keyEvidence: ['run.txt', 'log-text.txt', 'log.json'] });
}

// ---------------------------------------------------------------- main

const out = {};
out.ac20 = await ac20();
out.ac21 = await ac21();
out.ac22 = await ac22();
out.ac23 = await ac23();
out.ac24 = await ac24();
out.ac25 = await ac25();
for (const [key, value] of Object.entries(out)) {
  process.stdout.write(`${key.toUpperCase()}: ${value.passed ? 'PASS' : 'FAIL'} (${value.failed}/${value.total} failed)\n`);
}
