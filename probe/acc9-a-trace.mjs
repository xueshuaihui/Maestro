// I1.9 S3 验收 A 组：AC-06 / AC-07 / AC-08 / AC-09 / AC-10（追踪链）。
//
// 现场：
// - AC-06：code-loop 正向两节点（driver 场景 `pass`，开发 → 测试都完成）；
// - AC-07：driver `backflow-once` 跑完（1 次回流、4 条跨度）；
// - AC-08：driver `backflow-once --stop-after 3 --keep` 后台启动，轮询 `.mock/stopped-after-3`，
//          冻结窗口内执行 `trace show` 与附录 A-3 逐字比对；
// - AC-09：空追踪 / 单节点 / 实例不存在三形态（A-1 / A-2 / A-5）；
// - AC-10：两次节点实例连续三次 `trace show`，字节一致且 state/events 哈希不变。
//
// 复跑：`NODE_ENV=test node probe/acc9-a-trace.mjs`
// 证据：docs/iterations/iteration-9/evidence/acc9/AC-06..AC-10/
import fs from 'node:fs';
import path from 'node:path';

import {
  CODE_DRIVER, ensureDir, evidenceDir, freshRoot, makeChecks, nowIso, readJson, removeProject,
  report, runCli, runDriver, sha256File, spawnDriver, startCoreOnEmptyRoot, statePath,
  stopCore, tracesPath, waitFor, writeEvidence, writeMockConfig, writeSnapshot, eventsPath,
} from './acc9-a-lib.mjs';

const TIME = '(\\d{2}:\\d{2}:\\d{2})';

function fieldsOf(span) {
  return Object.keys(span).sort();
}

/** AC-06。 */
function ac06() {
  const { checks, check } = makeChecks();
  const root = freshRoot('AC-06');
  const drv = runDriver(CODE_DRIVER, root, ['--scenario', 'pass']);
  const trace = runCli(root, ['trace', 'show', 'INST-001']);
  const state = readJson(statePath(root));
  const spans = fs.readFileSync(tracesPath(root), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const lines = trace.stdout.replace(/\n$/, '').split('\n');

  check('driver pass 场景跑完（exit 0）且实例 completed',
    drv.exitCode === 0 && state.state === 'completed', { drv: drv.exitCode, state: state.state });
  check('追迹文件落在 state/traces.jsonl（不在实例根目录）',
    fs.existsSync(path.join(root, '.orch', 'instances', 'INST-001', 'state', 'traces.jsonl'))
      && !fs.existsSync(path.join(root, '.orch', 'instances', 'INST-001', 'traces.jsonl')));
  check('跨度恰 2 条、按时间排序、两条都已结束',
    spans.length === 2 && spans[0].end_time && spans[1].end_time
      && Date.parse(spans[0].start_time) <= Date.parse(spans[1].start_time), { spans });
  check('每行跨度恰 7 字段（不含 handoff_ids 落盘）',
    spans.every((s) => JSON.stringify(fieldsOf(s)) === JSON.stringify(
      ['end_time', 'instance_id', 'node_id', 'round', 'start_time', 'status', 'trace_id'])), { keys: spans.map(fieldsOf) });
  check('同一实例跨度共用一个追踪号，且与 state.traceId 一致',
    new Set(spans.map((s) => s.trace_id)).size === 1 && spans[0].trace_id === state.traceId,
    { traceId: state.traceId, spanIds: spans.map((s) => s.trace_id) });
  check('trace show 退出码 0，首行为实例号 + 追踪号',
    trace.exitCode === 0 && new RegExp(`^实例 INST-001 · 追踪 ${state.traceId}$`).test(lines[0]), { head: lines[0] });
  check('汇总行为「跨度 2 条 · 回流 0 次」', lines[1] === '跨度 2 条 · 回流 0 次', { got: lines[1] });
  check('两条跨度行含节点标题、结果与关联交接包',
    lines.some((l) => /^\d{2}:\d{2}:\d{2} → \d{2}:\d{2}:\d{2}  T-001 开发  已完成  交接 HO-001$/.test(l))
      && lines.some((l) => /^\d{2}:\d{2}:\d{2} → \d{2}:\d{2}:\d{2}  T-002 测试  已完成  交接 HO-001$/.test(l)),
    { lines });
  check('handoff_ids 与状态里的交接包一致（两条都归 HO-001）',
    state.handoffs.filter((h) => h.handoffId === 'HO-001').length === 1
      && lines.filter((l) => l.includes('交接 HO-001')).length === 2);

  writeEvidence('AC-06', 'stdout-driver.txt', drv.stdout + drv.stderr);
  writeEvidence('AC-06', 'stdout-trace-show.txt', trace.stdout + trace.stderr);
  writeEvidence('AC-06', 'traces.jsonl', fs.readFileSync(tracesPath(root), 'utf8'));
  writeEvidence('AC-06', 'state.json', JSON.stringify(state, null, 2));
  const payload = { root, checks, pass: checks.every((c) => c.ok) };
  report('AC-06', payload);
  stopCore(root);
  removeProject(root);
  return payload;
}

/** AC-07：一次回流的完整实例（4 条跨度）。 */
function ac07() {
  const { checks, check } = makeChecks();
  const root = freshRoot('AC-07');
  const drv = runDriver(CODE_DRIVER, root, ['--scenario', 'backflow-once']);
  const trace = runCli(root, ['trace', 'show', 'INST-001']);
  const state = readJson(statePath(root));
  const spans = fs.readFileSync(tracesPath(root), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const lines = trace.stdout.replace(/\n$/, '').split('\n');

  check('driver backflow-once 跑完（exit 0）且实例 completed',
    drv.exitCode === 0 && state.state === 'completed', { drv: drv.exitCode, state: state.state });
  check('跨度恰 4 条：T-001 两条 + T-002 两条',
    spans.length === 4
      && spans.map((s) => s.node_id).join(',') === 'T-001,T-002,T-001,T-002', { nodes: spans.map((s) => s.node_id) });
  check('round 覆盖 1 与 2（同一节点多轮不合并、不覆盖）',
    spans.map((s) => s.round).join(',') === '1,1,2,2', { rounds: spans.map((s) => s.round) });
  check('T-001 第 1 轮跨度仍在（未被第 2 轮覆盖）',
    spans[0].node_id === 'T-001' && spans[0].round === 1 && Boolean(spans[0].end_time));
  check('汇总行为「跨度 4 条 · 回流 1 次」', lines[1] === '跨度 4 条 · 回流 1 次', { got: lines[1] });
  check('回流链恰 1 条且逐字为附录 A-3 的回流行',
    lines.includes('第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成'),
    { tail: lines.slice(-4) });
  const ho2 = state.handoffs.find((h) => h.handoffId === 'HO-002');
  check('HO-002 = backflow、round 2、状态 consumed（推导「第 2 轮/已完成」）',
    ho2 && ho2.edge?.kind === 'backflow' && ho2.round === 2 && ho2.state === 'consumed',
    { ho2: ho2 && { kind: ho2.edge?.kind, round: ho2.round, state: ho2.state } });
  const ho3 = state.handoffs.find((h) => h.handoffId === 'HO-003');
  check('复测包 HO-003 是 retest，不计入「回流 1 次」', ho3 && ho3.edge?.kind === 'retest',
    { ho3: ho3 && { kind: ho3.edge?.kind, state: ho3.state } });
  check('交接包总数 3（HO-001 forward / HO-002 backflow / HO-003 retest）',
    state.handoffs.length === 3, { ids: state.handoffs.map((h) => `${h.handoffId}:${h.edge?.kind}`) });

  writeEvidence('AC-07', 'stdout-driver.txt', drv.stdout + drv.stderr);
  writeEvidence('AC-07', 'stdout-trace-show.txt', trace.stdout + trace.stderr);
  writeEvidence('AC-07', 'traces.jsonl', fs.readFileSync(tracesPath(root), 'utf8'));
  const payload = { root, checks, pass: checks.every((c) => c.ok) };
  report('AC-07', payload);
  stopCore(root);
  removeProject(root);
  return payload;
}

/** AC-08：`--stop-after 3` 冻结窗口，与附录 A-3 逐字比对。 */
async function ac08() {
  const { checks, check } = makeChecks();
  const root = freshRoot('AC-08');
  const { child, done } = spawnDriver(CODE_DRIVER, root, ['--scenario', 'backflow-once', '--stop-after', '3', '--keep']);

  const marker = path.join(root, '.mock', 'stopped-after-3');
  const waited = await waitFor(() => fs.existsSync(marker), { timeoutMs: 90_000, intervalMs: 30, label: 'stopped-after-3' });
  check('.mock/stopped-after-3 出现（冻结点成立）', waited.ok, waited);

  const trace = runCli(root, ['trace', 'show', 'INST-001']);
  const spans = fs.existsSync(tracesPath(root))
    ? fs.readFileSync(tracesPath(root), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    : [];
  const state = readJson(statePath(root));

  check('冻结窗口恰 3 条已结束跨度（T-001 r1 / T-002 r1 / T-001 r2）',
    spans.length === 3 && spans.map((s) => `${s.node_id}:${s.round}`).join(',') === 'T-001:1,T-002:1,T-001:2',
    { spans: spans.map((s) => ({ n: s.node_id, r: s.round, end: s.end_time })) });
  check('冻结窗口没有进行中的跨度行（无 end_time 为空的跨度）',
    spans.every((s) => typeof s.end_time === 'string' && s.end_time.length > 0));

  // A-3 逐字（时刻 / 追踪号按 A-0 替换）。
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
  const actual = trace.stdout.replace(/\n$/, '').split('\n')
    .map((l) => l.replace(new RegExp(TIME, 'g'), 'TIME'));
  check('trace show 退出码 0', trace.exitCode === 0, { exitCode: trace.exitCode, stderr: trace.stderr });
  const exactA3 = actual.length === expected.length && actual.every((l, i) => l === expected[i]);
  check('输出与附录 A-3 逐字一致（A-0 归一化后）', exactA3, { expected, actual });
  // 差异归因（供主控裁决）：AC-04 / A-4 与 BR-04 要求失败跨度下方带一行摘要，
  // 而附录 A-3 的基线里没有这一行。这里单独核「剔除该行后其余 9 行逐字一致」，
  // 以证明差异仅来自这一条冲突，不是格式漂移。
  const SUMMARY_LINE = '  失败摘要 命令 未提供 · 退出码 未提供 · 关键输出 未提供 · 日志 未提供';
  const extraSummaryLines = actual.filter((l) => l.startsWith('  失败摘要'));
  const stripped = actual.filter((l) => !l.startsWith('  失败摘要'));
  check('除「失败摘要」行外，其余各行与 A-3 逐字一致（差异仅此一行）',
    stripped.length === expected.length && stripped.every((l, i) => l === expected[i]),
    { stripped, expected });
  extraSummaryLines.forEach((l, i) => {
    check(`A-3 未含、实测多出的失败摘要行 #${i + 1}（AC-04/BR-04 要求，需主控裁决）`, l === SUMMARY_LINE,
      { line: l });
  });
  const a3Conflict = !exactA3 && extraSummaryLines.length > 0;
  check('时间线不含「进行中」，汇总为「跨度 3 条 · 回流 1 次」',
    !trace.stdout.includes('进行中') && trace.stdout.includes('跨度 3 条 · 回流 1 次'));
  check('时间线含两个角色标题与两个节点编号，回流链含 HO-002 与「第 2 轮」',
    trace.stdout.includes('T-001 开发') && trace.stdout.includes('T-002 测试')
      && trace.stdout.includes('HO-002') && trace.stdout.includes('第 2 轮'));

  const summaryEvents = fs.readFileSync(eventsPath(root), 'utf8')
    .split('\n').filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l))
    .filter((e) => e.reason === 'execution.summary');
  writeEvidence('AC-08', 'execution-summary-events.json', summaryEvents);
  writeEvidence('AC-08', 'stdout-trace-show.txt', trace.stdout + trace.stderr);
  writeEvidence('AC-08', 'traces.jsonl', fs.readFileSync(tracesPath(root), 'utf8'));
  writeEvidence('AC-08', 'state.json', JSON.stringify(state, null, 2));

  fs.writeFileSync(path.join(root, '.mock', 'release'), '');
  child.kill('SIGINT');
  const drvResult = await done;
  writeEvidence('AC-08', 'stdout-driver.txt', drvResult.stdout + drvResult.stderr);

  const payload = {
    root,
    checks,
    a3Exact: exactA3,
    extraSummaryLines,
    needsArbitration: a3Conflict,
    note: a3Conflict
      ? 'AC-08 Then 要求与附录 A-3 逐字一致，但 A-3 未包含失败跨度下方的摘要行；AC-04 Then / A-4 / BR-04 要求失败跨度展示摘要行，两处判据冲突，登记需主控裁决。'
      : null,
    pass: checks.every((c) => c.ok),
  };
  report('AC-08', payload);
  stopCore(root);
  removeProject(root);
  return payload;
}

/** AC-09：A-1 / A-2 / A-5 三形态。 */
function ac09() {
  const { checks, check } = makeChecks();

  // ① 空追踪：先起核心、再写 created 快照（不派发节点）。
  const empty = freshRoot('AC-09-empty');
  writeMockConfig(empty);
  const started = startCoreOnEmptyRoot(empty);
  check('空实例夹具：核心已在空根拉起（instance status 返回「不存在」）', started.ok,
    { exitCode: started.res.exitCode, stdout: started.res.stdout });
  const at = new Date(Date.now() - 60_000).toISOString();
  writeSnapshot(empty, {
    schemaVersion: 2,
    instanceId: 'INST-001',
    coreGeneration: 'gen-acc9',
    createdAt: at,
    updatedAt: at,
    state: 'created',
    stateSince: at,
    template: 'single',
    cwd: '.',
    task: 'x',
    halted: false,
    rev: 0,
    nodes: [{ nodeId: 'T-001', roleId: 'worker', round: 0, state: 'pending' }],
    sessions: [],
    handoffs: [],
    escalations: [],
    health: { nodeTimeoutMs: 30000 },
  });
  const emptyTrace = runCli(empty, ['trace', 'show', 'INST-001']);
  check('空追踪逐字为 A-1 且退出码 0',
    emptyTrace.exitCode === 0 && emptyTrace.stdout === '实例 INST-001 · 暂无追踪记录\n' && emptyTrace.stderr === '',
    { exitCode: emptyTrace.exitCode, stdout: emptyTrace.stdout, stderr: emptyTrace.stderr });

  // ② 单节点跑完。
  const single = freshRoot('AC-09-single');
  writeMockConfig(single);
  const run = runCli(single, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '写一份说明']);
  const singleTrace = runCli(single, ['trace', 'show', 'INST-001']);
  const singleState = readJson(statePath(single));
  const singleLines = singleTrace.stdout.replace(/\n$/, '').split('\n');
  check('单节点实例跑完（run 退出码 0）', run.exitCode === 0, { exitCode: run.exitCode });
  check('单节点逐字为 A-2：首行 = 实例 + 追踪号',
    singleTrace.exitCode === 0 && singleLines[0] === `实例 INST-001 · 追踪 ${singleState.traceId}`,
    { head: singleLines[0] });
  check('单节点逐字为 A-2：跨度 1 条 · 回流 0 次 / 一条跨度 / 回流链 + 无',
    singleLines.length === 7
      && singleLines[1] === '跨度 1 条 · 回流 0 次'
      && singleLines[2] === ''
      && /^\d{2}:\d{2}:\d{2} → \d{2}:\d{2}:\d{2}  T-001  已完成  交接 HO-001$/.test(singleLines[3])
      && singleLines[4] === '' && singleLines[5] === '回流链' && singleLines[6] === '无',
    { lines: singleLines });

  // ③ 实例不存在：空根，无任何实例。
  const missing = freshRoot('AC-09-missing');
  writeMockConfig(missing);
  const missingTrace = runCli(missing, ['trace', 'show', 'INST-999']);
  check('实例不存在逐字为 A-5、退出码 1、无堆栈',
    missingTrace.exitCode === 1
      && missingTrace.stdout === '实例 INST-999 · 不存在\n'
      && missingTrace.stderr.trim() === '' && !/at .*\(.*:\d+:\d+\)/.test(missingTrace.stdout),
    { exitCode: missingTrace.exitCode, stdout: missingTrace.stdout, stderr: missingTrace.stderr });

  writeEvidence('AC-09', 'stdout-empty.txt', emptyTrace.stdout + emptyTrace.stderr);
  writeEvidence('AC-09', 'stdout-single.txt', singleTrace.stdout + singleTrace.stderr);
  writeEvidence('AC-09', 'stdout-missing.txt', missingTrace.stdout + missingTrace.stderr);
  writeEvidence('AC-09', 'fixtures.json', {
    emptySnapshotState: 'created', singleRunExit: run.exitCode, missingExit: missingTrace.exitCode,
  });
  const payload = { checks, pass: checks.every((c) => c.ok) };
  report('AC-09', payload);
  for (const root of [empty, single, missing]) {
    stopCore(root);
    removeProject(root);
  }
  return payload;
}

/** AC-10：只读三次。 */
function ac10() {
  const { checks, check } = makeChecks();
  const root = freshRoot('AC-10');
  const drv = runDriver(CODE_DRIVER, root, ['--scenario', 'pass']);
  const before = {
    state: sha256File(statePath(root)),
    events: sha256File(eventsPath(root)),
    traces: sha256File(tracesPath(root)),
    snapshot: readJson(statePath(root)),
    eventCount: fs.readFileSync(eventsPath(root), 'utf8').split('\n').filter((l) => l.trim() !== '').length,
  };

  const runs = [0, 1, 2].map(() => runCli(root, ['trace', 'show', 'INST-001']));
  const after = {
    state: sha256File(statePath(root)),
    events: sha256File(eventsPath(root)),
    traces: sha256File(tracesPath(root)),
    snapshot: readJson(statePath(root)),
    eventCount: fs.readFileSync(eventsPath(root), 'utf8').split('\n').filter((l) => l.trim() !== '').length,
  };

  check('driver pass 跑完（exit 0）', drv.exitCode === 0, { exitCode: drv.exitCode });
  check('三次 trace show 退出码均 0、stderr 为空',
    runs.every((r) => r.exitCode === 0 && r.stderr === ''), runs.map((r) => r.exitCode));
  check('三次 stdout 字节一致', runs.every((r) => r.stdout === runs[0].stdout));
  check('state.json sha256 不变', before.state === after.state, { before: before.state, after: after.state });
  check('events.jsonl sha256 不变', before.events === after.events, { before: before.events, after: after.events });
  check('traces.jsonl sha256 不变（追踪只读不追写）', before.traces === after.traces);
  const countEvents = () => fs.readFileSync(eventsPath(root), 'utf8')
    .split('\n').filter((l) => l.trim() !== '').length;
  const pick = (s) => ({
    nodes: s.nodes, sessions: s.sessions, handoffs: s.handoffs, escalations: s.escalations, health: s.health,
  });
  check('节点/会话/交接包/升级/健康度深比较相等',
    JSON.stringify(pick(before.snapshot)) === JSON.stringify(pick(after.snapshot)));
  check('事件条数不增加',
    before.eventCount === countEvents(), { before: before.eventCount, after: countEvents() });

  writeEvidence('AC-10', 'stdout-trace-1.txt', runs[0].stdout + runs[0].stderr);
  writeEvidence('AC-10', 'stdout-trace-2.txt', runs[1].stdout + runs[1].stderr);
  writeEvidence('AC-10', 'stdout-trace-3.txt', runs[2].stdout + runs[2].stderr);
  writeEvidence('AC-10', 'sha256-before-after.json', {
    before: { state: before.state, events: before.events, traces: before.traces },
    after: { state: after.state, events: after.events, traces: after.traces },
  });
  const payload = { root, checks, pass: checks.every((c) => c.ok) };
  report('AC-10', payload);
  stopCore(root);
  removeProject(root);
  return payload;
}

ensureDir(evidenceDir('AC-08'));
const p6 = ac06();
const p7 = ac07();
const p8 = await ac08();
const p9 = ac09();
const p10 = ac10();
process.stdout.write('\n=== SUMMARY ===\n');
for (const [ac, p] of [['AC-06', p6], ['AC-07', p7], ['AC-08', p8], ['AC-09', p9], ['AC-10', p10]]) {
  process.stdout.write(`${ac} ${p.pass ? 'PASS' : 'FAIL'}\n`);
}
process.exit([p6, p7, p8, p9, p10].every((p) => p.pass) ? 0 : 1);
