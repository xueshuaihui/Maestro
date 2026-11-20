/**
 * AC-58 · 用户走完一遍：回流崩溃 → 恢复 → 人工作业 → 完成。
 *
 * A) 主闭环：recovery-driver --scenario e2e（回流中途 SIGKILL → 冷启动恢复）。
 *    判定只取 driver 在 core.stop 之前落下的 summary/events/state/prompt-log：
 *    driver 收尾 core.stop 会把仍在推进的实例标「已中断」，收尾后的 CLI 会再次
 *    冷启动核心继续推进，不能作为恢复瞬间的证据。
 * B) 人工节点：e2e 夹具的 backflow 图本身不含 human 节点；按需求 Given 另用
 *    test/fixtures/recovery/human-node-state.json 预置人工节点现场，核对保持等待。
 *
 * 需求示例「最终完成或升级」与夹具 5s 观察窗的冲突按原文保留断言，如实判并 note。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  REPO, NODE, baseEnv, freshRoot, cleanupRoot, runCmd, readEvents, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import { prepareGiven, boot } from './AC-28.mjs';

const DRIVER = path.join(REPO, 'test', 'fixtures', 'recovery-driver.mjs');
const HUMAN_FIXTURE = path.join(REPO, 'test', 'fixtures', 'recovery', 'human-node-state.json');
const readJsonLines = (file) => {
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)).filter(Boolean);
  } catch {
    return [];
  }
};

export async function run() {
  const c = makeCase('AC-58', {
    scenario: 'e2e-user-visible-loop',
    title: '用户走完一遍：回流崩溃 → 恢复 → 人工作业 → 完成',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-58');
  const humanRoot = freshRoot('AC-58-human');
  c.root = root;
  try {
    // 固定 killAfter=1500ms 的窗口是否抓到「running 节点 + 已构造交接包」受负载漂移影响：
    // 抓不到时同一项目根清掉重跑一次（同参数、断言口径不变），两次尝试都落证据。
    const eventFile = path.join(root, '.orch', 'instances', 'INST-001', 'events.jsonl');
    const attempts = [];
    let r = null;
    let s = null;
    let events = [];
    let prompts = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt === 1) {
        cleanupRoot(root);
        freshRoot('AC-58');
      }
      const promptLog = path.join(root, 'prompt-log.ndjson');
      const env = baseEnv({ MAESTRO_MOCK_PROMPT_LOG: promptLog });
      r = runCmd([NODE, DRIVER, '--root', root, '--scenario', 'e2e'], {
        cwd: REPO, env, timeout: 180_000,
      });
      try { s = JSON.parse(r.stdout.trim().split(/\r?\n/).pop()); } catch { /* 证据仍落盘 */ }
      events = readJsonLines(eventFile);
      prompts = readJsonLines(promptLog);
      const hasWindow = (s?.before?.nodes ?? []).some((n) => n.state === 'running')
        && (s?.before?.handoffs ?? []).length > 0;
      attempts.push({
        attempt, ok: s?.ok, before: s?.before, events: events.length, hasWindow,
      });
      if (hasWindow) break;
    }
    evidence(c, 'given', 'driver-attempts.json', JSON.stringify(attempts, null, 2));
    const statusText = s?.recoveryStatus?.stdout ?? '';
    const after = s?.afterRecovery ?? null;
    const before = s?.before ?? null;

    evidence(c, 'given', 'driver-summary.json', JSON.stringify({
      ok: s?.ok, scenario: s?.scenario, instanceId: s?.instanceId, exitCodes: s?.exitCodes,
      kills: s?.kills, before, afterKill: s?.afterKill, runMs: s?.runMs,
    }, null, 2));
    evidence(c, 'given', 'run-output.txt', r.stderr);
    evidence(c, 'then', 'recovery-status.txt', statusText);
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state-after-recovery.json', JSON.stringify(after, null, 2));
    evidence(c, 'then', 'prompt-log.ndjson', prompts.map((p) => JSON.stringify(p)).join('\n'));

    check(c, '夹具：e2e 场景跑通（SIGKILL 命中且实例可恢复）',
      s?.ok === true && (s?.kills ?? []).some((k) => k.ok === true),
      JSON.stringify({ ok: s?.ok, kills: s?.kills }));
    check(c, 'Then：实例显示「运行中」（取 core.stop 前恢复快照）',
      after?.state === 'running' && statusText.includes('运行中'),
      JSON.stringify({ state: after?.state, firstLine: statusText.split(/\r?\n/)[0] }));

    const summaryLine = statusText.split(/\r?\n/).find((l) => l.includes('恢复：检查点')) ?? '';
    evidence(c, 'then', 'recovery-summary-line.txt', summaryLine || '(未见恢复行)\n');
    check(c, 'Then：恢复行显示跳过已完成节点与轮次',
      /恢复：检查点\s+\d{2}:\d{2}:\d{2}\s+·\s+跳过 \d+ 个已完成节点\s+·\s+轮次 \d+\/\d+/.test(summaryLine),
      summaryLine);
    const summaryEvents = events.filter((e) => e.reason === 'recovery.summary');
    evidence(c, 'then', 'recovery-summary-events.json', JSON.stringify(summaryEvents, null, 2));
    eq(c, '机检：recovery.summary 恰好 1 份（无重复恢复）', summaryEvents.length, 1);
    check(c, '机检：recovery.summary 的 skipped>=1 且轮次/上限可见',
      (summaryEvents[0]?.detail?.skipped ?? 0) >= 1
      && Number.isInteger(summaryEvents[0]?.detail?.round)
      && Number.isInteger(summaryEvents[0]?.detail?.maxRounds),
      JSON.stringify(summaryEvents[0]?.detail ?? null));

    const dispatch = (nodeId) => events.filter((e) => e.reason === 'node.dispatch'
      && (e.detail?.nodeId === nodeId || e.objectId === nodeId));
    const doneNodeId = (before?.nodes ?? []).find((n) => n.state === 'done')?.nodeId ?? null;
    const runningNodeId = (before?.nodes ?? []).find((n) => n.state === 'running')?.nodeId ?? null;
    eq(c, 'Then：已完成节点恢复后不重跑（node.dispatch 仍只初始 1 次）', dispatch(doneNodeId).length, 1);
    eq(c, '夹具：已完成节点提示次数 0（prompt-log 无第二轮提示）',
      prompts.filter((p) => p.nodeId === doneNodeId).length, 1);
    check(c, '夹具：节点轮次恢复前后不变',
      JSON.stringify((after?.nodes ?? []).map((n) => ({ id: n.nodeId, round: n.round })))
      === JSON.stringify((before?.nodes ?? []).map((n) => ({ id: n.nodeId, round: n.round }))),
      JSON.stringify({ before: before?.nodes, after: after?.nodes }));

    const roleEvents = events.filter((e) => e.reason === 'recovery.session_unrecoverable');
    const resumedDispatch = dispatch(runningNodeId).filter((e) => e.detail?.recovered === true);
    evidence(c, 'then', 'role-and-reschedule-events.json', JSON.stringify({ roleEvents, resumedDispatch }, null, 2));
    check(c, 'Then：角色降级（会话不可恢复）后重新调度',
      roleEvents.length >= 1 && resumedDispatch.length >= 1,
      JSON.stringify({ role: roleEvents.length, resumedDispatch: resumedDispatch.length }));
    check(c, '夹具：重新派发后节点进入执行中（phase=running）',
      resumedDispatch.some((e) => e.detail?.phase === 'running')
      && (after?.nodes ?? []).find((n) => n.nodeId === runningNodeId)?.state === 'running',
      JSON.stringify((after?.nodes ?? []).find((n) => n.nodeId === runningNodeId) ?? null));

    const handoffEvents = events.filter((e) => e.reason === 'recovery.handoff');
    evidence(c, 'then', 'recovery-handoff-events.json', JSON.stringify(handoffEvents, null, 2));
    check(c, 'Then：交接包恢复后继续投递（created → delivered 由产品核心写入）',
      handoffEvents.some((e) => e.detail?.from === 'created' && e.detail?.to === 'delivered'),
      JSON.stringify(handoffEvents));

    check(c, 'Then：全程无「已中断」误判（恢复快照与恢复行均不含）',
      after?.state !== 'interrupted' && !statusText.includes('已中断')
      && !events.some((e) => e.reason === 'recovery.failed' || e.reason === 'core.interrupted'),
      JSON.stringify({ state: after?.state, hasFailedEvent: events.some((e) => e.reason === 'recovery.failed') }));
    check(c, 'Then：最终实例按既有规则完成或升级',
      ['completed', 'suspended'].includes(after?.state ?? null),
      JSON.stringify({ state: after?.state ?? null }));

    // ---------- B) 夹具预置人工节点：保持等待人工 ----------
    const fixture = JSON.parse(fs.readFileSync(HUMAN_FIXTURE, 'utf8'));
    fixture.cwd = path.join(humanRoot, fixture.cwd);
    fs.mkdirSync(fixture.cwd, { recursive: true });
    const hg = prepareGiven(humanRoot, fixture, { caps: 'resume' });
    evidence(c, 'given', 'human-fixture-state.json', JSON.stringify(fixture, null, 2));
    const hb = await boot(humanRoot, hg.env, 'INST-HUMAN-001');
    const hStatus = (await import('../acc8-f-lib.mjs')).orch(humanRoot,
      ['status', '--instance', 'INST-HUMAN-001'], { env: hg.env });
    const hLog = (await import('../acc8-f-lib.mjs')).orch(humanRoot,
      ['instance', 'log', '--instance', 'INST-HUMAN-001'], { env: hg.env });
    evidence(c, 'then', 'human-status.txt', hStatus.stdout);
    evidence(c, 'then', 'human-log.txt', hLog.stdout || '(无新增日志)\n');
    evidence(c, 'then', 'human-state.json', JSON.stringify(hb.afterState, null, 2));
    evidence(c, 'then', 'human-events.jsonl', hb.events.map((e) => JSON.stringify(e)).join('\n'));
    const humanNode = (hb.afterState?.nodes ?? []).find((n) => n.nodeId === 'T-004');
    check(c, 'Then：人工节点恢复后保持 running（不重派、不跳过）',
      humanNode?.nodeType === 'human' && humanNode?.state === 'running',
      JSON.stringify(humanNode ?? null));
    includes(c, 'Then：instance log 出现人工节点保持等待行',
      hLog.stdout, '恢复：人工节点 T-004 保持等待人工（不重派）');
    eq(c, '机检：人工节点无 node.dispatch',
      hb.events.filter((e) => e.reason === 'node.dispatch'
        && (e.objectId === 'T-004' || e.detail?.nodeId === 'T-004')).length, 0);

    note(c, '批次负载下 e2e 的固定 killAfter=1500ms 偶发落在 T-001 done / T-002 未派发窗口，'
      + '此时无 running 节点可恢复；同项目根清掉后同参数重试一次（最多一次），两次尝试与窗口判定落 driver-attempts 证据，断言不放宽。');
    note(c, 'e2e 夹具用 backflow 图（T-001 开发 / T-002 测试），不含 human 节点；人工节点组按需求 Given'
      + ' 用 test/fixtures/recovery/human-node-state.json 另起独立项目根预置，恢复保持由产品核心执行。');
    note(c, 'driver 收尾 core.stop 会把实例改写为「已中断」，-driver 之后的 CLI 再冷启动还会继续推进；'
      + '所有判定取 driver 在 stop 之前落下的 recoveryStatus / afterRecovery / events / prompt-log。');
    note(c, '口径冲突（同裁-14b/18c）：driver e2e 在恢复后只等 waitMs=5000ms，'
      + `实测 afterRecovery.state=${JSON.stringify(after?.state ?? null)}，尚未到「完成/升级」终态；`
      + '按需求原文保留「完成或升级」断言并如实判不通过，交主控裁决是否延长夹具观察窗。');
    note(c, '实测差异（交主控裁决）：events 有 recovery.handoff created→delivered，'
      + '但恢复快照与恢复行的交接包仍是「已构造」（state.json 的 deliveryAttempts=0）；'
      + '本用例按事件断言「继续投递」，不把 CLI 的「已构造」改写成通过。');
  } finally {
    cleanupRoot(root);
    cleanupRoot(humanRoot);
  }
  return finish(c);
}
