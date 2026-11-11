/**
 * I1.9 / S3 B 组：AC-26 ~ AC-27 取证。
 *
 * AC-26 live 取消：--turn-delay-ms 30000 让会话进 tool_running，第二进程 cancel；
 * AC-27 code-loop backflow-once --stop-after 3 --keep 冻结窗口的每轮摘要条数。
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, mkroot, writeMockConfig, runCli, readJson, readEvents, statePath,
  spawnCli, spawnNode, stopCore, waitFor, waitFile, save, collector, nonEmptyLines, sleep,
} from './acc9-b-lib.mjs';

// ---------------------------------------------------------------- AC-26

async function ac26() {
  const c = collector('AC-26', {
    title: '取消收尾的执行摘要：被取消的会话也答得出“为什么结束”',
    fixture: '--turn-delay-ms 30000 → tool_running；第二进程 orch cancel',
  });
  const root = mkroot('cancel-summary');
  writeMockConfig(root, ['--turn-delay-ms', '30000']);
  const bg = spawnCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '执行 out/run.js']);

  const toolRunning = await waitFor(() => readEvents(root).find(
    (e) => e?.object === 'session' && e?.to === 'tool_running' && e?.reason === 'session.state',
  ) ?? null, { timeoutMs: 45_000, label: '会话进入 tool_running' });
  save('AC-26', 'tool-running-event.json', toolRunning);

  const cancel = runCli(root, ['cancel', '--instance', 'INST-001'], { timeout: 30_000 });
  save('AC-26', 'cancel.txt', `exit=${cancel.code}\n${cancel.stdout}${cancel.stderr}`);
  c.eq('orch cancel exit 0', cancel.code, 0);

  const runExit = await bg.exited;
  save('AC-26', 'run.txt', `exit=${runExit.code}\n${runExit.stdout}${runExit.stderr}`);
  await sleep(200);

  const logText = runCli(root, ['instance', 'log', 'INST-001']);
  save('AC-26', 'log-text.txt', `exit=${logText.code}\n${logText.stdout}`);
  c.eq('instance log 文本 exit 0', logText.code, 0);
  const summaryLine = logText.lines.find((l) => l.includes('执行摘要'));
  c.check('A-14 取消摘要四项全「未提供」逐字',
    /^\d{2}:\d{2}:\d{2}  会话 mock-sess-\d+-\d+  执行摘要 命令 未提供 · 退出码 未提供 · 关键输出 未提供 · 日志 未提供$/.test(summaryLine ?? ''),
    summaryLine);

  const status = runCli(root, ['instance', 'status', 'INST-001']);
  save('AC-26', 'status.txt', `exit=${status.code}\n${status.stdout}`);
  c.eq('instance status exit 0', status.code, 0);
  c.check('实例状态为已取消', status.lines[0] === '实例 INST-001 · 已取消', status.lines[0]);
  c.eq('健康度为已结束', status.lines.find((l) => l.startsWith('健康度')), '健康度 已结束');

  const state = readJson(statePath(root));
  c.eq('state.json state=cancelled', state.state, 'cancelled');
  c.eq('state.json health.level=ended', state.health?.level, 'ended');

  const json = runCli(root, ['instance', 'log', 'INST-001', '--format', 'json']);
  save('AC-26', 'log.json', json.stdout);
  c.eq('instance log json exit 0', json.code, 0);
  const events = JSON.parse(json.stdout);
  const summaries = events.filter((e) => e.reason === 'execution.summary');
  c.eq('取消会话 execution.summary 恰 1 条', summaries.length, 1);
  c.eq('四项全为 null', JSON.stringify(summaries[0]?.detail?.summary), JSON.stringify({
    command: null, exitCode: null, keyOutputLines: null, logRef: null,
  }));

  const allowed = new Set([
    'execution.summary', 'permission.requested', 'permission.allowed', 'permission.denied',
    'session.state', 'output.submitted', 'run.completed', 'run.failed', 'run.cancelled', 'state.change',
  ]);
  const sessionReasons = [...new Set(events.filter((e) => e.object === 'session').map((e) => e.reason))];
  save('AC-26', 'session-event-reasons.txt', sessionReasons.join('\n'));
  c.check('除 execution.summary 与既有冻结会话事件外无新增类型', sessionReasons.every((r) => allowed.has(r)), sessionReasons.join(','));
  // D-15：不做取消摘要 ts 与状态变更时刻的等值断言；只记录两者供人工核对。
  const cancelledEvent = events.find((e) => e.object === 'instance' && e.reason === 'run.cancelled');
  save('AC-26', 'ts-note.json', {
    summaryTs: summaries[0]?.ts,
    instanceCancelledTs: cancelledEvent?.ts,
    note: 'D-15：不对取消摘要 ts 与状态变更时刻做等值断言。',
  });
  stopCore(root);
  return c.finish({ keyEvidence: ['tool-running-event.json', 'cancel.txt', 'log-text.txt', 'status.txt', 'log.json'] });
}

// ---------------------------------------------------------------- AC-27

async function ac27() {
  const c = collector('AC-27', {
    title: '同一节点多轮：每轮会话各一条摘要，条数等于轮次',
    fixture: 'code-loop backflow-once --stop-after 3 --keep 冻结窗口',
  });
  const root = mkroot('summary-rounds');
  const driver = path.join(REPO, 'test/fixtures/code-loop-driver.mjs');
  const drv = spawnNode(root, driver, ['--root', root, '--scenario', 'backflow-once', '--stop-after', '3', '--keep']);
  const marker = path.join(root, '.mock', 'stopped-after-3');
  let finished = false;
  try {
    await waitFile(marker, 60_000);
    c.check('.mock/stopped-after-3 存在（冻结点成立）', fs.existsSync(marker), marker);
    const state = readJson(statePath(root));
    c.eq('冻结窗口 state=running', state.state, 'running');
    c.eq('冻结窗口会话数 3', state.sessions.length, 3);

    const logText = runCli(root, ['instance', 'log', 'INST-001']);
    save('AC-27', 'log-text.txt', `exit=${logText.code}\n${logText.stdout}`);
    c.eq('instance log 文本 exit 0', logText.code, 0);

    const json = runCli(root, ['instance', 'log', 'INST-001', '--format', 'json']);
    save('AC-27', 'log.json', json.stdout);
    c.eq('instance log json exit 0', json.code, 0);
    const events = JSON.parse(json.stdout);
    const summaries = events.filter((e) => e.reason === 'execution.summary');
    c.eq('全文摘要条数 = 会话数', summaries.length, state.sessions.length);

    const byNode = (nodeId) => summaries.filter((e) => e.detail?.nodeId === nodeId);
    c.eq('T-001 摘要恰 2 条', byNode('T-001').length, 2);
    c.eq('T-001 轮次为 1 与 2', JSON.stringify(byNode('T-001').map((e) => e.detail?.round).sort()), JSON.stringify([1, 2]));
    c.eq('T-002 摘要恰 1 条', byNode('T-002').length, 1);
    c.eq('T-002 轮次为 1', byNode('T-002')[0]?.detail?.round, 1);
    const perSession = new Map();
    for (const e of summaries) perSession.set(e.objectId, (perSession.get(e.objectId) ?? 0) + 1);
    c.check('每会话恰 1 条摘要', [...perSession.values()].every((n) => n === 1), JSON.stringify([...perSession]));

    // 文本视图按会话映射回节点：T-001 两行、T-002 一行。
    const sessionNode = new Map(state.sessions.map((s) => [s.sessionId, s.nodeId]));
    const summaryLines = logText.lines.filter((l) => l.includes('执行摘要'));
    c.eq('文本视图摘要行数 = 3', summaryLines.length, 3);
    const countTextFor = (nodeId) => summaryLines.filter((line) => {
      const hit = [...sessionNode.entries()].find(([sid]) => line.includes(sid));
      return hit && hit[1] === nodeId;
    }).length;
    c.eq('文本视图 T-001 摘要行数 2', countTextFor('T-001'), 2);
    c.eq('文本视图 T-002 摘要行数 1', countTextFor('T-002'), 1);

    const trace = runCli(root, ['trace', 'show', 'INST-001']);
    save('AC-27', 'trace.txt', `exit=${trace.code}\n${trace.stdout}`);
    c.eq('trace show exit 0', trace.code, 0);
    const spanLines = trace.lines.filter((l) => /^\d{2}:\d{2}:\d{2} → /.test(l));
    const t1Spans = spanLines.filter((l) => l.includes('  T-001 开发  ')).length;
    const t2Spans = spanLines.filter((l) => l.includes('  T-002 测试  ')).length;
    c.eq('trace 中 T-001 跨度行 2 条', t1Spans, 2);
    c.eq('trace 中 T-002 跨度行 1 条', t2Spans, 1);
    c.eq('trace 汇总跨度 3 条', trace.lines[1], '跨度 3 条 · 回流 1 次');
  } finally {
    if (fs.existsSync(marker)) fs.writeFileSync(path.join(root, '.mock', 'release'), '', 'utf8');
    try { drv.child.kill('SIGINT'); } catch { /* ignore */ }
    const exit = await Promise.race([drv.exited, sleep(20_000).then(() => ({ timeout: true }))]);
    if (exit?.timeout) {
      try { drv.child.kill('SIGKILL'); } catch { /* ignore */ }
    }
    save('AC-27', 'driver.txt', `exit=${exit?.code ?? 'timeout'} signal=${exit?.signal ?? ''}\n${drv.stdout}\n${drv.stderr}`);
    finished = exit?.timeout !== true;
    stopCore(root);
  }
  c.check('driver 已正常收尾（release + SIGINT）', finished, '');
  return c.finish({ keyEvidence: ['log-text.txt', 'log.json', 'trace.txt', 'driver.txt'] });
}

const out = {};
out.ac26 = await ac26();
out.ac27 = await ac27();
for (const [key, value] of Object.entries(out)) {
  process.stdout.write(`${key.toUpperCase()}: ${value.passed ? 'PASS' : 'FAIL'} (${value.failed}/${value.total} failed)\n`);
}
