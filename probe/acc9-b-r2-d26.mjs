/**
 * D-26 复验（B 组）：只跑 AC-23 三个降级夹具 + AC-22 进行中回归。
 *
 * 背景：D-26 把 renderTraceShow 的 hasTrace 从「traceId 存在 || 跨度非空」改为
 *       「跨度数组（含进行中叠加）非空」。因此「当前代码实例删掉 traces.jsonl」应落 A-1。
 *
 * 纪律：夹具根 os.tmpdir()、NODE_ENV=test、--host mock；只读产品代码，不改任何 src/test。
 * 证据：evidence/acc9/AC-23/*-after-d26-r2.txt、evidence/acc9/AC-22/trace-hold-after-d26-r2.txt，
 *       结果写 result-d26.json（不覆盖原有 result.json）。
 */
import fs from 'node:fs';
import {
  mkroot, writeMockConfig, writeJson, writeTraces, runCli, readJson,
  statePath, tracesPath, stopCore, save, localIso, spawnCli, waitFor, sleep,
} from './acc9-b-lib.mjs';

const checks = [];
function check(name, ok, detail = '') {
  const item = { name, ok: Boolean(ok), detail: String(detail ?? '') };
  checks.push(item);
  if (!ok) process.stderr.write(`FAIL ${name}${detail ? ` :: ${detail}` : ''}\n`);
  return Boolean(ok);
}
const eq = (name, actual, expected) => check(name, actual === expected, `actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
const hasStack = (text) => /at\s+.+:\d+:\d+/.test(text ?? '');

// ---------------------------------------------------------------- AC-23 missing（当前代码实例删文件）

async function ac23Missing() {
  const root = mkroot('d26-missing');
  writeMockConfig(root, []);
  // ① 用当前代码真实跑一个 single 实例（会落 traceId + traces.jsonl 真实跨度）。
  const run = runCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '写一份说明']);
  const state = readJson(statePath(root));
  const traceId = String(state?.traceId ?? '');
  const before = fs.existsSync(tracesPath(root))
    ? fs.readFileSync(tracesPath(root), 'utf8').split('\n').filter((l) => l.trim()).length
    : 0;
  check('missing：真实 run 后存在 traceId', /^TRC-[0-9a-f]{8}$/.test(traceId), traceId);
  check('missing：真实 run 后 traces.jsonl 有跨度行', before >= 1, `spans=${before}`);

  // ② 停核心，删除追踪文件。
  stopCore(root);
  fs.rmSync(tracesPath(root), { force: true });
  check('missing：traces.jsonl 已删除', !fs.existsSync(tracesPath(root)), String(fs.existsSync(tracesPath(root))));

  // ③ 重新拉起核心后查看追踪（CLI 会自动起核心）。
  const trace = runCli(root, ['trace', 'show', 'INST-001']);
  const status = runCli(root, ['instance', 'status', 'INST-001']);
  save('AC-23', 'missing-after-d26-r2.txt', `exit=${trace.code}\n${trace.stdout}${trace.stderr}`);
  save('AC-23', 'missing-after-d26-r2-status.txt', `exit=${status.code}\n${status.stdout}${status.stderr}`);
  save('AC-23', 'missing-after-d26-r2-facts.json', {
    runExit: run.code,
    traceId,
    spansBeforeDelete: before,
    tracesExistsAfterDelete: fs.existsSync(tracesPath(root)),
    traceShowExit: trace.code,
    traceShowStdout: trace.stdout,
  });
  eq('missing：trace show exit 0', trace.code, 0);
  eq('missing：逐字 A-1「暂无追踪记录」', trace.stdout, '实例 INST-001 · 暂无追踪记录\n');
  check('missing：无堆栈', !hasStack(trace.stdout + trace.stderr), trace.stderr);
  eq('missing：status exit 0', status.code, 0);
  // 本夹具是真实跑完的实例（state=completed），健康度应为「已结束」；判据是「照常给出且不崩」。
  const healthLine = status.lines.find((l) => l.startsWith('健康度')) ?? '';
  check('missing：健康度照常给出（四档之一）',
    /^健康度 (正常|慢|需关注|已结束)/.test(healthLine), healthLine);
  eq('missing：已完成实例健康度为「已结束」', healthLine, '健康度 已结束');
  stopCore(root);
}

// ---------------------------------------------------------------- AC-23 badline / notime

function baseSnapshot({ traceId, nodes, health }) {
  const at = localIso(10, 0, 0);
  return {
    schemaVersion: 2, instanceId: 'INST-001', coreGeneration: 'acc9-b',
    createdAt: at, updatedAt: at, state: 'running', stateSince: at,
    template: 'single', cwd: '.', task: 'acc9-b', halted: false, rev: 0,
    counters: { eventSeq: 0, runCount: 1, dispatchCount: 0 },
    hostRaw: { stopReason: null, lastError: null, agentInfo: null },
    nodes, sessions: [], handoffs: [], escalations: [], health, traceId,
  };
}

function emptyCore(root, id = 'INST-001') {
  const res = runCli(root, ['instance', 'status', id], { timeout: 40_000 });
  return res.code === 1 && res.stdout.trim() === `实例 ${id} · 不存在`;
}

async function ac23Badline() {
  const root = mkroot('d26-badline');
  check('badline：先起核心', emptyCore(root), '');
  writeJson(statePath(root), baseSnapshot({
    traceId: 'TRC-0000aaaa',
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', round: 1, state: 'done', startedAt: localIso(10, 0, 0), endedAt: localIso(10, 0, 10) },
      { nodeId: 'T-002', roleId: 'tester', round: 1, state: 'done', startedAt: localIso(10, 0, 10), endedAt: localIso(10, 0, 30) },
    ],
    health: { nodeTimeoutMs: 300000 },
  }));
  writeTraces(root, [
    '{"trace_id":',
    { trace_id: 'TRC-0000aaaa', instance_id: 'INST-001', node_id: 'T-001', round: 1, start_time: localIso(10, 0, 0), end_time: localIso(10, 0, 10), status: 'done' },
    { trace_id: 'TRC-0000aaaa', instance_id: 'INST-001', node_id: 'T-002', round: 1, start_time: localIso(10, 0, 10), end_time: localIso(10, 0, 30), status: 'done' },
  ]);
  const trace = runCli(root, ['trace', 'show', 'INST-001']);
  save('AC-23', 'badline-after-d26-r2.txt', `exit=${trace.code}\n${trace.stdout}${trace.stderr}`);
  eq('badline：trace show exit 0', trace.code, 0);
  eq('badline：首行带追踪号', trace.lines[0], '实例 INST-001 · 追踪 TRC-0000aaaa');
  eq('badline：A-11 提示行在汇总行之前', trace.lines[1], '追踪记录有 1 行不可读，已跳过');
  eq('badline：汇总 跨度 2 条', trace.lines[2], '跨度 2 条 · 回流 0 次');
  const spanLines = trace.lines.filter((l) => /^\d{2}:\d{2}:\d{2} → \d{2}:\d{2}:\d{2}  T-00\d  /.test(l));
  eq('badline：正常跨度行 2 条', spanLines.length, 2);
  check('badline：无堆栈', !hasStack(trace.stdout + trace.stderr), trace.stderr);
  stopCore(root);
}

async function ac23Notime() {
  const root = mkroot('d26-notime');
  check('notime：先起核心', emptyCore(root), '');
  const started = new Date(Date.now() - 70_000).toISOString();
  writeJson(statePath(root), baseSnapshot({
    traceId: 'TRC-0000bbbb',
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', round: 1, state: 'done', startedAt: localIso(10, 0, 0), endedAt: localIso(10, 0, 10) },
      { nodeId: 'T-006', roleId: 'developer', round: 1, state: 'running', startedAt: started, endedAt: null },
    ],
    health: { nodeTimeoutMs: 300000 },
  }));
  // 6 条只有 end_time、无 start_time：不构成 P90 样本。
  writeTraces(root, Array.from({ length: 6 }, (_, i) => ({
    trace_id: 'TRC-0000bbbb', instance_id: 'INST-001', node_id: `T-00${i + 1}`, round: 1,
    end_time: localIso(10, 0, 10 + i), status: 'done',
  })));
  const trace = runCli(root, ['trace', 'show', 'INST-001']);
  const status = runCli(root, ['instance', 'status', 'INST-001']);
  save('AC-23', 'notime-after-d26-r2.txt', `exit=${trace.code}\n${trace.stdout}${trace.stderr}`);
  save('AC-23', 'notime-after-d26-r2-status.txt', `exit=${status.code}\n${status.stdout}${status.stderr}`);
  eq('notime：trace show exit 0', trace.code, 0);
  check('notime：无堆栈', !hasStack(trace.stdout + trace.stderr), trace.stderr);
  eq('notime：status exit 0', status.code, 0);
  const health = status.lines.find((l) => l.startsWith('健康度'));
  eq('notime：不计 P90 样本、档位不判慢', health, '健康度 正常');
  stopCore(root);
}

// ---------------------------------------------------------------- AC-22 hold 回归（防 D-26 误伤）

async function ac22Hold() {
  const root = mkroot('d26-hold');
  writeMockConfig(root, ['--hold-session']);
  const bg = spawnCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '写一份说明']);
  const running = await waitFor(() => {
    if (!fs.existsSync(statePath(root))) return null;
    try {
      const s = readJson(statePath(root));
      return s?.nodes?.[0]?.state === 'running' && (s.sessions?.length ?? 0) > 0 ? s : null;
    } catch { return null; }
  }, { timeoutMs: 40_000, label: 'hold 节点运行中' });
  const traceId = String(running.traceId ?? '');
  check('hold：当前代码实例带 traceId', /^TRC-[0-9a-f]{8}$/.test(traceId), traceId);

  const first = runCli(root, ['trace', 'show', 'INST-001']);
  save('AC-22', 'trace-hold-after-d26-r2.txt', `exit=${first.code}\n${first.stdout}${first.stderr}`);
  eq('hold：exit 0', first.code, 0);
  eq('hold：首行带实例与追踪号', first.lines[0], `实例 INST-001 · 追踪 ${traceId}`);
  eq('hold：汇总 跨度 0 条 · 回流 0 次', first.lines[1], '跨度 0 条 · 回流 0 次');
  check('hold：跨度行 HH:MM:SS → —  T-001  进行中  交接 HO-001',
    /^\d{2}:\d{2}:\d{2} → —  T-001  进行中  交接 HO-001$/.test(first.lines[3] ?? ''), first.lines[3]);
  eq('hold：末两行 回流链 / 无', first.lines.slice(-2).join('|'), '回流链|无');
  check('hold：不出现「暂无追踪记录」', !first.stdout.includes('暂无追踪记录'), first.stdout);

  // 收尾：cancel 释放 hold 进程（不冒充「放行完成」）。
  const cancel = runCli(root, ['cancel', '--instance', 'INST-001']);
  save('AC-22', 'hold-cancel-after-d26-r2.txt', `exit=${cancel.code}\n${cancel.stdout}${cancel.stderr}`);
  check('hold：cancel 收尾 exit 0', cancel.code === 0, cancel.code);
  try { await Promise.race([bg.exited, sleep(20_000)]); } catch { /* best effort */ }
  stopCore(root);
}

await ac23Missing();
await ac23Badline();
await ac23Notime();
await ac22Hold();

const failed = checks.filter((c) => !c.ok);
const result = {
  group: 'B',
  after: 'D-26',
  generatedAt: new Date().toISOString(),
  scope: ['AC-23 missing/badline/notime', 'AC-22 hold 回归'],
  passed: failed.length === 0,
  total: checks.length,
  failed: failed.length,
  checks,
};
save('AC-23', 'result-d26.json', result);
console.log(`D-26 复验：${result.passed ? 'PASS' : 'FAIL'} ${result.total - result.failed}/${result.total}`);
if (result.failed) process.exitCode = 1;
