/**
 * AC-43 · 会话重建失败 → 升级人工（BR-38）。
 *
 * Given/When：crash-rebuild + MAESTRO_MOCK_NEW_FAIL=1，重建时 session/new 也失败。
 * Then：「会话重建失败：已升级人工」；实例挂起、退出码 4、status 显示「已挂起」；不无限重试。
 * 注意：initializeAdapterOnly 成功但方言失败走降级（裁-13a/16c），本例的本意是「宿主可建但 new 失败」。
 */
import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, GRADING_MOCK } from '../acc8-f-lib.mjs';
import { SESSION_FAILURE_TEXT, fill } from '../../src/cli/labels.js';
import { driveRecoveryScenario } from './AC-42.mjs';

export async function run() {
  const c = makeCase('AC-43', {
    scenario: 'crash-rebuild-new-fail',
    title: '会话重建失败 → 升级人工',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-43');
  c.root = root;
  try {
    const d = driveRecoveryScenario(root, 'crash-rebuild', { MAESTRO_MOCK_NEW_FAIL: '1' });
    evidence(c, 'given', 'driver-summary.json', JSON.stringify({
      ok: d.summary?.ok, exitCodes: d.summary?.exitCodes, scenario: d.summary?.scenario,
    }, null, 2));
    evidence(c, 'given', 'run-output.txt', d.r.stderr);
    evidence(c, 'then', 'events.jsonl', d.events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(d.state, null, 2));
    evidence(c, 'then', 'instance-log.txt', d.log);
    evidence(c, 'then', 'status.txt', d.status);

    check(c, '夹具：crash + new-fail 场景跑通', d.summary?.ok === true,
      JSON.stringify({ ok: d.summary?.ok, exitCodes: d.summary?.exitCodes }));
    eq(c, 'Then：orch run 退出码 4', d.summary?.exitCodes?.[0], 4);

    const failEvents = d.events.filter((e) => e.reason === 'session.rebuild_failed');
    eq(c, '夹具：session.rebuild_failed 事件 1 条', failEvents.length, 1);
    const rebuiltEvents = d.events.filter((e) => e.reason === 'session.rebuilt');
    eq(c, '夹具：没有 session.rebuilt（重建确实失败）', rebuiltEvents.length, 0);
    const crashEvents = d.events.filter((e) => e.reason === 'session.crash');
    eq(c, '夹具：只有一次崩溃（不无限重试）', crashEvents.length, 1);

    const detail = failEvents[0]?.detail ?? {};
    const failedLine = fill(SESSION_FAILURE_TEXT.rebuildFailed, detail);
    includes(c, 'Then：出现按 labels 渲染的「会话重建失败：已升级人工」', d.log, failedLine);
    // v4：文案按实测 detail（nodeId/round/maxRounds）动态填充，不再写死 T-003/2/3。
    const failParen = `（节点 ${detail.nodeId} · 轮次 ${detail.round}/${detail.maxRounds}）`;
    includes(c, 'Then：文案按实测 detail 填充「（节点 <当前节点> · 轮次 <当前轮>/<上限>）」',
      d.log, failParen);

    eq(c, 'Then：实例挂起', d.state?.state, 'suspended');
    includes(c, 'Then：orch status --instance 显示「已挂起」', d.status, '已挂起');
    const node = (d.state?.nodes ?? []).find((n) => n.nodeId === detail.nodeId);
    eq(c, 'Then：节点升级（escalated）', node?.state, 'escalated');
    const escalations = d.state?.escalations ?? [];
    eq(c, 'Then：escalations 新增 1 条', escalations.length, 1);
    eq(c, '夹具：升级原因 reasonCode=session_crash', escalations[0]?.reasonCode, 'session_crash');
    eq(c, '夹具：会话数不变（没有新建成功）', (d.state?.sessions ?? []).length, 1);
    excludes(c, 'Then：不出现「会话已重建」', d.log, '会话已重建');

    note(c, 'v4 改法（裁-21a）：退出码 4 / 实例 suspended / 文案按实测 rebuild_failed 明细动态填充，'
      + `实测明细 ${JSON.stringify(detail)}；不再写死示例「节点 T-003 · 轮次 2/3」。`
      + '升级人工、不无限重试等 Then 实质不变。');
    note(c, '裁-13a/16c 区分：initializeAdapterOnly 成功而方言全失败属会话级丢失，应降级派发；'
      + '本例 session/new 在 recoveryScene 明确失败，产品走 session.rebuild_failed → 升级，未误判为宿主不可达（无 DSH_SPAWN_FAILED 中断）。');
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
