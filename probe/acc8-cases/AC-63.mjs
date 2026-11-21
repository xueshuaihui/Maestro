/**
 * AC-63 · 重建后的会话再次崩溃 → 直接升级，不再重建（BR-52）。
 *
 * Given/When：recovery-driver --scenario crash-twice（MAESTRO_MOCK_CRASH=twice）。
 * Then：出现「会话重建失败：已升级人工」；实例挂起；不会出现第二次「正在重建会话」。
 * 夹具：只重建一次（session.rebuilt=1、session.crash=1、第二次崩溃走 rebuild_failed），
 *       节点 escalated、escalations 新增 1 条、orch run 退出码 4。
 *
 * v4 机检改为可数锚点（session.rebuilt=1 / rebuild_failed=1 / sessions=2 / escalated / 退出码 4），
 * 文案节点号与轮次按实测 detail 动态填充（裁-21a / 裁-21f②），不再写死 T-003/2/3。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import { REPO, NODE, baseEnv, freshRoot, cleanupRoot, runCmd, readState, readEvents, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';

const DRIVER = path.join(REPO, 'test', 'fixtures', 'recovery-driver.mjs');
const readLines = (file) => {
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)).filter(Boolean);
  } catch {
    return [];
  }
};

export async function run() {
  const c = makeCase('AC-63', {
    scenario: 'crash-twice-no-second-rebuild',
    title: '重建后的会话再次崩溃 → 直接升级，不再重建',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-63');
  c.root = root;
  try {
    const env = baseEnv();
    const promptLog = path.join(root, 'prompt-log.ndjson');
    env.MAESTRO_MOCK_PROMPT_LOG = promptLog;
    const r = runCmd([NODE, DRIVER, '--root', root, '--scenario', 'crash-twice'], {
      cwd: REPO, env, timeout: 180_000,
    });
    let s = null;
    try { s = JSON.parse(r.stdout.trim().split(/\r?\n/).pop()); } catch { /* 证据仍落盘 */ }
    const state = readState(root);
    const events = readEvents(root);
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env }).stdout;
    const status = orch(root, ['status', '--instance', 'INST-001'], { env }).stdout;
    const promptFailures = readLines(promptLog);
    evidence(c, 'given', 'driver-summary.json', JSON.stringify({
      ok: s?.ok, scenario: s?.scenario, exitCodes: s?.exitCodes, kills: s?.kills,
      afterRecovery: s?.afterRecovery, runMs: s?.runMs,
    }, null, 2));
    evidence(c, 'given', 'run-output.txt', r.stderr);
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(state, null, 2));
    evidence(c, 'then', 'instance-log.txt', log);
    evidence(c, 'then', 'status.txt', status);
    evidence(c, 'then', 'prompt-log.ndjson', promptFailures.map((p) => JSON.stringify(p)).join('\n'));

    const crash = events.filter((e) => e.reason === 'session.crash');
    const rebuilt = events.filter((e) => e.reason === 'session.rebuilt');
    const rebuildFailed = events.filter((e) => e.reason === 'session.rebuild_failed');
    const escalations = events.filter((e) => e.reason === 'escalation.created');
    evidence(c, 'then', 'crash-rebuild-events.json', JSON.stringify({
      crash, rebuilt, rebuildFailed, escalations,
    }, null, 2));

    check(c, '夹具：crash-twice 场景跑通', s?.ok === true,
      JSON.stringify({ ok: s?.ok, exitCodes: s?.exitCodes }));
    eq(c, 'Then：orch run 退出码 4', s?.exitCodes?.[0], 4);
    eq(c, '夹具：session.crash 只进入一次产品重建路径', crash.length, 1);
    eq(c, '夹具：session.rebuilt 恰好 1 次（只重建一次，不再有第二次）', rebuilt.length, 1);
    eq(c, '夹具：第二次崩溃走 session.rebuild_failed', rebuildFailed.length, 1);
    eq(c, '夹具：session/new 只增加 1 次（会话数 = 原始 + 重建）', (state?.sessions ?? []).length, 2);
    includes(c, 'Then：出现「会话重建失败：已升级人工」', log, '会话重建失败：已升级人工');
    check(c, 'Then：不会出现第二次「正在重建会话」',
      (log.match(/正在重建会话/g) ?? []).length <= 1,
      JSON.stringify((log.match(/会话进程已退出：正在重建会话/g) ?? [])));
    excludes(c, 'Then：没有第二次「会话已重建」', log.slice(log.indexOf('会话重建失败') + 1), '会话已重建');

    eq(c, 'Then：实例挂起', state?.state ?? null, 'suspended');
    includes(c, 'Then：status 显示「已挂起」', status, '已挂起');
    const failedDetail = rebuildFailed[0]?.detail ?? {};
    const node = (state?.nodes ?? []).find((n) => n.nodeId === failedDetail.nodeId);
    eq(c, 'Then：节点升级（escalated）', node?.state ?? null, 'escalated');
    eq(c, 'Then：escalations 新增 1 条', (state?.escalations ?? []).length, 1);
    eq(c, '夹具：升级 reasonCode=session_crash', state?.escalations?.[0]?.reasonCode ?? null, 'session_crash');
    includes(c, '夹具：升级行点名 ESC-001', status, 'ESC-001');

    // v4：文案按实测 detail（nodeId/round/maxRounds）动态填充，不再写死 T-003/2/3。
    const failParen = `（节点 ${failedDetail.nodeId} · 轮次 ${failedDetail.round}/${failedDetail.maxRounds}）`;
    includes(c, '夹具：文案按实测 detail 填充「（节点 <当前节点> · 轮次 <当前轮>/<上限>）」',
      log, failParen);

    note(c, 'v4 改法（裁-21a / 裁-21f②）：机检用可数锚点 —— session.rebuilt 恰 1 条、session.rebuild_failed 恰 1 条、'
      + `state.sessions 恰 2 条（原始 + 重建）、节点 escalated、退出码 4；文案按实测 rebuild_failed 明细`
      + ` ${JSON.stringify(failedDetail)} 动态填充，不再写死「节点 T-003 · 轮次 2/3」。`
      + '「不会出现第二次正在重建会话」的 Then 实质不变。');
    note(c, '「session/new 比单次崩溃场景少 1 次」按产品可观测锚点核对：'
      + 'crash-twice 只产生 1 次 session.rebuilt / 2 个会话（原始 + 重建），第二次崩溃直接 rebuild_failed + 升级，'
      + '没有第二次重建；需求按「若每次崩溃都重建应有更强计数」理解时本夹具不可兼得。');
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
