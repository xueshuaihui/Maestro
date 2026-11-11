// I1.9 S3 验收 A 组 —— FAIL 项复验（D-25 / D-26 / D-27 之后）。
//
// 覆盖：
//   R1  AC-08：`--stop-after 3` 冻结窗口 → trace show 与附录 A-3 逐字全等（D-25 后无失败摘要行）；
//   R2  AC-04：`--fail-tool` 四项有值 → A-4 摘要行仍渲染（D-25 不打掉 A-4）；
//   R3  AC-05：`--fail-tool-no-refs` 部分缺项 → 两项「未提供」行仍渲染；
//   R4  AC-09：空实例 → A-1；真实 single 实例仍 A-2（D-26 不误伤正常追踪）；
//   R5  AC-23(missing)：删除 traces.jsonl 的**当前代码实例** → A-1（不再输出 TRC-xxx / 跨度 0 条）；
//   R6  AC-22 回归：`--hold-session` 真实运行中节点 → 仍 A-10 且首行带号（D-26 不误伤）。
//
// 复跑：`NODE_ENV=test node probe/acc9-a-reverify.mjs`
// 证据：docs/iterations/iteration-9/evidence/acc9/AC-04|AC-05|AC-08|AC-09|AC-23（复验文件带 -r2 / -a 后缀）
import fs from 'node:fs';
import path from 'node:path';

import {
  CODE_DRIVER, ensureDir, evidenceDir, eventsPath, freshRoot, instanceDir, makeChecks,
  nowIso, parseEventJson, readJson, removeProject, report, runCli, spawnCli, spawnDriver,
  startCoreOnEmptyRoot, statePath, stopCore, tracesPath, waitFor, writeEvidence, writeMockConfig,
  writeSnapshot,
} from './acc9-a-lib.mjs';

const TIME_RE = /\d{2}:\d{2}:\d{2}/g;
const LOG_REL = 'host-logs/T-001.log';
const LOG_BODY = 'line-1: start\nline-2: work\nline-3: exit 1\n';
const A4_LINE = '  失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log';
const A5_PARTIAL = '  失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 未提供 · 日志 未提供';

function linesOf(stdout) {
  return stdout.replace(/\n$/, '').split('\n');
}

function normLines(stdout) {
  return linesOf(stdout).map((l) => l.replace(TIME_RE, 'TIME'));
}

/** R1 · AC-08：冻结窗口与附录 A-3 逐字全等（D-25）。 */
async function reverifyAc08() {
  const { checks, check } = makeChecks();
  const root = freshRoot('AC-08-r2');
  const { child, done } = spawnDriver(CODE_DRIVER, root, [
    '--scenario', 'backflow-once', '--stop-after', '3', '--keep',
  ]);

  const marker = path.join(root, '.mock', 'stopped-after-3');
  const waited = await waitFor(() => fs.existsSync(marker), { timeoutMs: 90_000, intervalMs: 30, label: 'stopped-after-3' });
  check('.mock/stopped-after-3 出现（冻结点成立）', waited.ok, waited);

  const trace = runCli(root, ['trace', 'show', 'INST-001']);
  const spans = fs.existsSync(tracesPath(root))
    ? fs.readFileSync(tracesPath(root), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    : [];
  const state = readJson(statePath(root));
  const actual = normLines(trace.stdout);

  const expected = [
    `实例 INST-001 · 追踪 ${state.traceId}`,
    '跨度 3 条 · 回流 1 次',
    '',
    'TIME → TIME  T-001 开发  已完成  交接 HO-001',
    'TIME → TIME  T-002 测试  失败  交接 HO-001 HO-002',
    'TIME → TIME  T-001 开发  已完成  交接 HO-002',
    '',
    '回流链',
    '第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成',
  ];

  check('冻结窗口恰 3 条已结束跨度（T-001 r1 / T-002 r1 / T-001 r2）',
    spans.length === 3 && spans.map((s) => `${s.node_id}:${s.round}`).join(',') === 'T-001:1,T-002:1,T-001:2',
    { spans: spans.map((s) => ({ n: s.node_id, r: s.round, end: s.end_time })) });
  check('冻结窗口无进行中跨度（全部有 end_time）',
    spans.every((s) => typeof s.end_time === 'string' && s.end_time.length > 0));
  check('trace show 退出码 0', trace.exitCode === 0, { exitCode: trace.exitCode, stderr: trace.stderr });
  check('输出为 9 行内容（stdout 以换行结尾时 split 得 10 段）',
    actual.length === 9 && trace.stdout.split('\n').length === 10,
    { contentLines: actual.length, splitSegments: trace.stdout.split('\n').length });
  const exact = actual.length === expected.length && actual.every((l, i) => l === expected[i]);
  check('与附录 A-3 逐字全等（A-0 归一化后，9/9 行）', exact, { expected, actual });
  check('不再出现「失败摘要」行（D-25）',
    !actual.some((l) => l.includes('失败摘要')), { actual });
  check('时间线不含「进行中」', !trace.stdout.includes('进行中'));

  // 数据侧确认：T-002 第 1 轮确有摘要记录，但四项全 null —— 抑制是「按数据」而不是丢了记录。
  const summaries = fs.readFileSync(eventsPath(root), 'utf8')
    .split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l))
    .filter((e) => e.reason === 'execution.summary');
  const t2 = summaries.filter((e) => e.detail?.summary);
  check('数据侧：确有 execution.summary 记录（证明渲染层按四项全 null 抑制）',
    summaries.length >= 1 && t2.length >= 1, { n: summaries.length, detail: t2.map((e) => e.detail) });
  const allNull = t2.length >= 1 && t2.every((e) => ['command', 'exitCode', 'keyOutputLines', 'logRef']
    .every((k) => e.detail.summary[k] === null || e.detail.summary[k] === undefined));
  check('被抑制的那条摘要四项全 null（D-25 的触发条件成立）', allNull,
    { summaries: t2.map((e) => e.detail.summary) });

  writeEvidence('AC-08', 'trace-after-fix.txt', trace.stdout + trace.stderr);
  writeEvidence('AC-08', 'traces.jsonl', fs.readFileSync(tracesPath(root), 'utf8'));
  writeEvidence('AC-08', 'execution-summary-events-r2.json', summaries);

  fs.writeFileSync(path.join(root, '.mock', 'release'), '');
  child.kill('SIGINT');
  const drvResult = await done;
  writeEvidence('AC-08', 'stdout-driver-r2.txt', drvResult.stdout + drvResult.stderr);

  const payload = { root, checks, a3Exact: exact, pass: checks.every((c) => c.ok) };
  report('AC-08', payload, 'result-r2.json');
  stopCore(root);
  removeProject(root);
  return payload;
}

/** R2 · AC-04：D-25 之后 A-4 仍渲染（四项有值）。 */
function reverifyAc04() {
  const { checks, check } = makeChecks();
  const root = freshRoot('AC-04-r2');
  writeMockConfig(root, ['--fail-tool']);
  ensureDir(path.join(root, 'host-logs'));
  fs.writeFileSync(path.join(root, LOG_REL), LOG_BODY, 'utf8');

  const run = runCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '执行 out/run.js']);
  const trace = runCli(root, ['trace', 'show', 'INST-001']);
  const lines = linesOf(trace.stdout);

  check('run 以失败收尾（退出码 1，夹具预期）', run.exitCode === 1, { exitCode: run.exitCode });
  check('trace show 退出码 0', trace.exitCode === 0, { stderr: trace.stderr });
  check('A-4 摘要行仍逐字渲染（D-25 未打掉有值摘要）', lines.includes(A4_LINE), { lines });
  check('摘要行紧跟失败跨度行',
    lines.indexOf(A4_LINE) === lines.findIndex((l) => /^\d{2}:\d{2}:\d{2} → \d{2}:\d{2}:\d{2}  T-001  失败  交接 HO-001$/.test(l)) + 1);
  check('仅 1 条失败摘要行（无重复）',
    lines.filter((l) => l.startsWith('  失败摘要')).length === 1);
  const logJson = runCli(root, ['instance', 'log', 'INST-001', '--format', 'json']);
  const summaries = parseEventJson(logJson.stdout).filter((e) => e.reason === 'execution.summary');
  check('instance log 的 execution.summary 仍为完整四项',
    summaries.length === 1 && summaries[0].detail.summary.command === 'node out/run.js'
      && summaries[0].detail.summary.exitCode === 1
      && summaries[0].detail.summary.keyOutputLines === 3
      && summaries[0].detail.summary.logRef === LOG_REL,
    summaries[0]?.detail?.summary);

  writeEvidence('AC-04', 'stdout-trace-show-r2.txt', trace.stdout + trace.stderr);
  writeEvidence('AC-04', 'stdout-instance-log-json-r2.txt', logJson.stdout + logJson.stderr);
  const payload = { root, checks, pass: checks.every((c) => c.ok) };
  report('AC-04', payload, 'result-r2.json');
  stopCore(root);
  removeProject(root);
  return payload;
}

/** R3 · AC-05：部分缺项仍渲染（D-25 只抑制「四项全 null」）。 */
function reverifyAc05() {
  const { checks, check } = makeChecks();
  const root = freshRoot('AC-05-r2');
  writeMockConfig(root, ['--fail-tool-no-refs']);

  const run = runCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '执行 out/run.js']);
  const trace = runCli(root, ['trace', 'show', 'INST-001']);
  const lines = linesOf(trace.stdout);

  check('run 以失败收尾（退出码 1）', run.exitCode === 1, { exitCode: run.exitCode });
  check('部分缺项行仍逐字渲染（命令+退出码有值，另两项未提供）',
    lines.includes(A5_PARTIAL), { lines });
  check('仅 1 条失败摘要行', lines.filter((l) => l.startsWith('  失败摘要')).length === 1);

  writeEvidence('AC-05', 'stdout-trace-show-r2.txt', trace.stdout + trace.stderr);
  const payload = { root, checks, pass: checks.every((c) => c.ok) };
  report('AC-05', payload, 'result-r2.json');
  stopCore(root);
  removeProject(root);
  return payload;
}

/** R4/R5 · AC-09 空实例 → A-1；真实 single → A-2；删追踪文件 → A-1（D-26）。 */
function reverifyAc09() {
  const { checks, check } = makeChecks();

  // ① 空实例（快照夹具，启动顺序同 §3.3）。
  const empty = freshRoot('AC-09-empty-r2');
  writeMockConfig(empty);
  const started = startCoreOnEmptyRoot(empty);
  check('空实例夹具：核心已在空根拉起（instance status 返回不存在）', started.ok,
    { exitCode: started.res.exitCode, stdout: started.res.stdout });
  const at = new Date(Date.now() - 60_000).toISOString();
  writeSnapshot(empty, {
    schemaVersion: 2, instanceId: 'INST-001', coreGeneration: 'gen-acc9',
    createdAt: at, updatedAt: at, state: 'created', stateSince: at,
    template: 'single', cwd: '.', task: 'x', halted: false, rev: 0,
    nodes: [{ nodeId: 'T-001', roleId: 'worker', round: 0, state: 'pending' }],
    sessions: [], handoffs: [], escalations: [], health: { nodeTimeoutMs: 30000 },
  });
  const emptyTrace = runCli(empty, ['trace', 'show', 'INST-001']);
  check('空实例逐字 A-1 且退出 0',
    emptyTrace.exitCode === 0 && emptyTrace.stdout === '实例 INST-001 · 暂无追踪记录\n' && emptyTrace.stderr === '',
    { stdout: emptyTrace.stdout, stderr: emptyTrace.stderr });

  // ② 真实 single 跑完 → 仍 A-2（D-26 的核心判据是「跨度非空」，不能误判空态）。
  const single = freshRoot('AC-09-single-r2');
  writeMockConfig(single);
  const run = runCli(single, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '写一份说明']);
  const singleTrace = runCli(single, ['trace', 'show', 'INST-001']);
  const singleState = readJson(statePath(single));
  const sl = linesOf(singleTrace.stdout);
  check('真实 single 跑完（exit 0）且仍为 A-2（7 行）',
    run.exitCode === 0 && sl.length === 7 && sl[0] === `实例 INST-001 · 追踪 ${singleState.traceId}`
      && sl[1] === '跨度 1 条 · 回流 0 次' && sl[5] === '回流链' && sl[6] === '无',
    { run: run.exitCode, lines: sl });

  // ③ 当前代码实例、删掉追踪文件 → A-1（AC-23 missing，D-26）。
  const deleted = tracesPath(single);
  const beforeState = readJson(statePath(single));
  const hadTraceId = typeof beforeState.traceId === 'string' && /^TRC-[0-9a-f]{8}$/.test(beforeState.traceId);
  fs.rmSync(deleted, { force: true });
  const missTrace = runCli(single, ['trace', 'show', 'INST-001']);
  check('夹具就绪：当前代码实例带 state.traceId，追踪文件已删除',
    hadTraceId && !fs.existsSync(deleted), { traceId: beforeState.traceId, exists: fs.existsSync(deleted) });
  check('删追踪文件 → 逐字 A-1（不再输出 TRC-xxx / 跨度 0 条）',
    missTrace.exitCode === 0 && missTrace.stdout === '实例 INST-001 · 暂无追踪记录\n'
      && !missTrace.stdout.includes('TRC-') && !missTrace.stdout.includes('跨度 0 条'),
    { stdout: missTrace.stdout, exitCode: missTrace.exitCode });

  writeEvidence('AC-09', 'stdout-empty-r2.txt', emptyTrace.stdout + emptyTrace.stderr);
  writeEvidence('AC-09', 'stdout-single-r2.txt', singleTrace.stdout + singleTrace.stderr);
  writeEvidence('AC-09', 'stdout-deleted-traces-r2.txt', missTrace.stdout + missTrace.stderr);
  writeEvidence('AC-23', 'stdout-missing-traces-a.txt', missTrace.stdout + missTrace.stderr);
  writeEvidence('AC-23', 'fixture-a.json', {
    instanceCreatedByCurrentCode: true,
    stateTraceId: beforeState.traceId,
    tracesFileDeleted: true,
    stdout: missTrace.stdout,
    exitCode: missTrace.exitCode,
  });
  const payload23 = {
    checks: checks.filter((c) => /A-1|删追踪|夹具就绪/.test(c.name)),
    pass: checks.every((c) => c.ok),
  };
  report('AC-23', payload23, 'result-a.json');

  const payload = { root: single, checks, pass: checks.every((c) => c.ok) };
  report('AC-09', payload, 'result-r2.json');
  for (const root of [empty, single]) {
    stopCore(root);
    removeProject(root);
  }
  return payload;
}

/** R6 · AC-22 回归：真实 `--hold-session` 运行中节点仍为 A-10 且首行带号。 */
async function reverifyAc22() {
  const { checks, check } = makeChecks();
  const root = freshRoot('AC-22-hold-r2');
  writeMockConfig(root, ['--hold-session']);

  const { child, done } = spawnCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '写一份说明']);
  const ready = await waitFor(() => {
    try {
      const s = readJson(statePath(root));
      return s.state === 'running' && Array.isArray(s.nodes) && s.nodes.some((n) => n.state === 'running');
    } catch { return false; }
  }, { timeoutMs: 60_000, intervalMs: 50, label: 'node-running' });
  check('真实 run 进入运行中（节点 T-001 state=running）', ready.ok, ready);

  const state = readJson(statePath(root));
  const trace = runCli(root, ['trace', 'show', 'INST-001']);
  const lines = linesOf(trace.stdout);
  check('运行中实例首行为「实例 INST-001 · 追踪 <state.traceId>」（带号，D-26 不误伤）',
    typeof state.traceId === 'string' && lines[0] === `实例 INST-001 · 追踪 ${state.traceId}`,
    { traceId: state.traceId, head: lines[0] });
  check('汇总为「跨度 0 条 · 回流 0 次」', lines[1] === '跨度 0 条 · 回流 0 次', { got: lines[1] });
  check('进行中跨度行逐字 A-10 形态（结束位 —、结果位 进行中）',
    lines.some((l) => /^\d{2}:\d{2}:\d{2} → —  T-001  进行中  交接 HO-001$/.test(l)), { lines });
  check('不出现「暂无追踪记录」', !trace.stdout.includes('暂无追踪记录'));

  const beforeKill = statePath(root);
  writeEvidence('AC-09', 'stdout-hold-session-r2.txt', trace.stdout + trace.stderr);
  writeEvidence('AC-09', 'hold-session-state-r2.json', readJson(beforeKill));

  child.kill('SIGINT');
  await done;
  const payload = { root, checks, pass: checks.every((c) => c.ok) };
  report('AC-09', { ...payload, section: 'AC-22' }, 'result-ac22-r2.json');
  stopCore(root);
  removeProject(root);
  return payload;
}

ensureDir(evidenceDir('AC-08'));
ensureDir(evidenceDir('AC-23'));

const startedAt = nowIso();
const p8 = await reverifyAc08();
const p4 = reverifyAc04();
const p5 = reverifyAc05();
const p9 = reverifyAc09();
const p22 = await reverifyAc22();

process.stdout.write('\n=== REVERIFY SUMMARY ===\n');
process.stdout.write(`startedAt ${startedAt}  endedAt ${nowIso()}\n`);
for (const [ac, p] of [['AC-08', p8], ['AC-04', p4], ['AC-05', p5], ['AC-09', p9], ['AC-22(regression)', p22]]) {
  process.stdout.write(`${ac} ${p.pass ? 'PASS' : 'FAIL'}\n`);
}
const all = [p8, p4, p5, p9, p22].every((p) => p.pass);
writeEvidence('AC-09', 'reverify-summary.json', {
  startedAt, endedAt: nowIso(),
  results: { 'AC-08': p8.pass, 'AC-04': p4.pass, 'AC-05': p5.pass, 'AC-09': p9.pass, 'AC-22': p22.pass },
  node: process.version,
});
process.exit(all ? 0 : 1);
