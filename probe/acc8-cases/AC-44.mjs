/**
 * AC-44 · 运行慢：不重建会话（BR-36 / BR-39）。
 *
 * Given/When：recovery-driver --scenario slow（MAESTRO_MOCK_SLOW=1 + MAESTRO_TEST_SLOW_MS=100），
 *   mock 进程存活但不再推 session/update，超过慢阈值。
 * Then：「会话无进展：判定为运行慢，不重建会话（节点 … · 已等待 {N}m）」；
 *   无「会话进程已退出」、无新会话 id；session/new 次数不变。
 */
import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, GRADING_MOCK } from '../acc8-f-lib.mjs';
import { SESSION_FAILURE_TEXT, fill } from '../../src/cli/labels.js';
import { driveRecoveryScenario } from './AC-42.mjs';

export async function run() {
  const c = makeCase('AC-44', {
    scenario: 'slow-no-rebuild',
    title: '运行慢：不重建会话',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-44');
  c.root = root;
  try {
    const d = driveRecoveryScenario(root, 'slow', {
      MAESTRO_MOCK_SLOW: '1', MAESTRO_TEST_SLOW_MS: '100',
    });
    evidence(c, 'given', 'driver-summary.json', JSON.stringify({
      ok: d.summary?.ok, scenario: d.summary?.scenario, exitCodes: d.summary?.exitCodes,
      runMs: d.summary?.runMs,
    }, null, 2));
    evidence(c, 'given', 'run-output.txt', d.r.stderr);
    evidence(c, 'then', 'events.jsonl', d.events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'state.json', JSON.stringify(d.state, null, 2));
    evidence(c, 'then', 'instance-log.txt', d.log);

    check(c, '夹具：slow 场景跑通', d.summary?.ok === true,
      JSON.stringify({ ok: d.summary?.ok, exitCodes: d.summary?.exitCodes }));
    check(c, 'Given：进程存活（driver 等到 runMs 仍未自然退出）',
      d.summary?.exitCodes?.[0] === null, JSON.stringify(d.summary?.exitCodes));

    const slowEvents = d.events.filter((e) => e.reason === 'session.slow');
    eq(c, '夹具：session.slow 事件 1 条', slowEvents.length, 1);
    eq(c, '夹具：session.slow 明细 rebuild=false', slowEvents[0]?.detail?.rebuild, false);
    const waited = Number(slowEvents[0]?.detail?.waitedMs) || 0;
    const slowLine = fill(SESSION_FAILURE_TEXT.slow, {
      nodeId: slowEvents[0]?.detail?.nodeId ?? '', minutes: Math.floor(waited / 60000),
    });
    includes(c, 'Then：出现按 labels 渲染的「判定为运行慢，不重建会话」', d.log, slowLine);
    check(c, '夹具：慢行匹配「已等待 \\d+m」（缩短后允许 0m）', /已等待 \d+m/.test(slowLine), slowLine);

    eq(c, '夹具：没有 session.crash 事件', d.events.filter((e) => e.reason === 'session.crash').length, 0);
    eq(c, '夹具：没有 session.rebuilt 事件', d.events.filter((e) => e.reason === 'session.rebuilt').length, 0);
    excludes(c, 'Then：没有「会话进程已退出」', d.log, '会话进程已退出');
    excludes(c, 'Then：没有「正在重建会话」', d.log, '正在重建会话');
    check(c, 'Then：没有新会话 id（会话数仍为 1）', (d.state?.sessions ?? []).length === 1,
      JSON.stringify((d.state?.sessions ?? []).map((s) => s.sessionId)));
    check(c, '夹具：orch run 输出里「会话已创建」恰好 1 次（session/new 次数不变）',
      (d.r.stderr.match(/会话已创建/g) || []).length === 1,
      JSON.stringify((d.r.stderr.match(/会话已创建/g) || []).length));

    const node = (d.state?.nodes ?? []).find((n) => n.nodeId === slowEvents[0]?.detail?.nodeId);
    eq(c, 'Then：节点仍执行中（running）', node?.state, 'running');
    check(c, 'Then：节点没有失败原因', !('failed_reason' in (node ?? {})), JSON.stringify(node));
    // driver 末尾 core.stop 会把实例标记为「已中断」；判定取 stop 前的 afterRecovery 快照。
    check(c, 'Then：实例没有被判失败/挂起（取 driver core.stop 前快照）',
      ['running', 'completed'].includes(d.summary?.afterRecovery?.state),
      JSON.stringify({ beforeStop: d.summary?.afterRecovery?.state, afterStop: d.state?.state }));

    note(c, '夹具 MAESTRO_TEST_SLOW_MS=100 把阈值从 10m 缩短到 100ms，'
      + `实测 waitedMs=${waited}，渲染为 0m；按需求「{N} 允许为 0，不写死 10」断言。`);
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
