/**
 * AC-36 · 连接线聚合在恢复实例的图上可见。
 *
 * Given：AC-32 同款恢复实例（HO-001 delivered→pending，测试→开发回流）。
 * When：orch instance graph [--format json]。
 * Then：文本行「连接线：测试→开发（回流） 待投递（重投中）」；
 *       JSON 恢复实例含 recovery(4 键) 与 connections，每项恰 4 键；非恢复实例不含这两键。
 */
import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import {
  baseState, nodeTpl, sessionTpl, handoffTpl, prepareGiven, boot, releaseAndStop,
} from './AC-28.mjs';

export async function run() {
  const c = makeCase('AC-36', {
    scenario: 'connection-visible-on-recovered-graph',
    title: '连接线聚合在恢复实例的图上可见',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-36');
  const plainRoot = freshRoot('AC-36-plain');
  c.root = root;
  try {
    const given = baseState(root, {
      nodes: [
        nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'running', phase: 'assigned' }),
        nodeTpl({ nodeId: 'T-002', roleId: 'tester', state: 'done', extra: { verdict: { value: 'fail', defects: [] } } }),
      ],
      sessions: [sessionTpl({ sessionId: 'mock-sess-dev', nodeId: 'T-001', roleId: 'developer', state: 'idle' })],
      handoffs: [handoffTpl({
        handoffId: 'HO-001', from: 'T-002', to: 'T-001', kind: 'backflow',
        state: 'delivered', acceptedAt: null, deliveryAttempts: 1,
      })],
    });
    given.nodes[0].sessionId = 'mock-sess-dev';
    const g = prepareGiven(root, given, {
      caps: 'resume', extraEnv: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
    });
    const b = await boot(root, g.env, 'INST-001', { waitPaused: true });
    check(c, 'Given：恢复实例 recoveredAt 落盘', Boolean(b.afterState?.recoveredAt),
      JSON.stringify({ recoveredAt: b.afterState?.recoveredAt ?? null }));

    const graphText = orch(root, ['instance', 'graph', '--instance', 'INST-001'], { env: g.env });
    const graphJson = orch(root, ['instance', 'graph', '--instance', 'INST-001', '--format', 'json'], { env: g.env });
    evidence(c, 'then', 'graph.txt', graphText.stdout);
    evidence(c, 'then', 'graph.json.txt', graphJson.stdout);
    let parsed = null;
    try { parsed = JSON.parse(graphJson.stdout); } catch { /* 证据已落 */ }
    evidence(c, 'then', 'graph.json.parsed.txt', JSON.stringify(parsed, null, 2));

    includes(c, 'Then：实例行后出现「连接线：测试→开发（回流） 待投递（重投中）」',
      graphText.stdout, '连接线：测试→开发（回流） 待投递（重投中）');
    check(c, '机检：恢复实例 JSON 含 recovery 与 connections 两键',
      Object.prototype.hasOwnProperty.call(parsed ?? {}, 'recovery')
      && Object.prototype.hasOwnProperty.call(parsed ?? {}, 'connections'),
      JSON.stringify(Object.keys(parsed ?? {})));
    const recoveryKeys = Object.keys(parsed?.recovery ?? {}).sort();
    check(c, '机检：recovery 恰 4 键（checkpointAt/skipped/round/maxRounds）',
      JSON.stringify(recoveryKeys) === JSON.stringify(['checkpointAt', 'maxRounds', 'round', 'skipped']),
      JSON.stringify(recoveryKeys));
    const connections = parsed?.connections ?? [];
    eq(c, '机检：connections 数组恰 1 项（该回流连接线）', connections.length, 1);
    const keys = Object.keys(connections[0] ?? {}).sort();
    check(c, '机检：connections[] 每项恰 4 键（from/to/kind/aggregate）',
      JSON.stringify(keys) === JSON.stringify(['aggregate', 'from', 'kind', 'to']),
      JSON.stringify(keys));
    check(c, '机检：connections[0] 方向/类别/聚合正确',
      connections[0]?.from === 'T-002' && connections[0]?.to === 'T-001'
      && connections[0]?.kind === 'backflow' && connections[0]?.aggregate === 'pending',
      JSON.stringify(connections[0] ?? null));
    includes(c, '机检：connections[].aggregate 与文本行一致（pending → 待投递（重投中））',
      graphText.stdout, '待投递（重投中）');

    // 对照组：非恢复实例（completed 终态，reconcile 不触碰，未写 recoveredAt）。
    const plain = baseState(plainRoot, {
      state: 'completed',
      nodes: [nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'done' })],
    });
    const pg = prepareGiven(plainRoot, plain, { caps: 'resume' });
    const plainJson = orch(plainRoot, ['instance', 'graph', '--instance', 'INST-001', '--format', 'json'], { env: pg.env });
    const plainText = orch(plainRoot, ['instance', 'graph', '--instance', 'INST-001'], { env: pg.env });
    evidence(c, 'then', 'plain-graph.json.txt', plainJson.stdout);
    evidence(c, 'then', 'plain-graph.txt', plainText.stdout);
    let plainParsed = null;
    try { plainParsed = JSON.parse(plainJson.stdout); } catch { /* 证据已落 */ }
    check(c, '机检：非恢复实例 JSON 不含 recovery 键',
      !Object.prototype.hasOwnProperty.call(plainParsed ?? {}, 'recovery'),
      JSON.stringify(Object.keys(plainParsed ?? {})));
    check(c, '机检：非恢复实例 JSON 不含 connections 键',
      !Object.prototype.hasOwnProperty.call(plainParsed ?? {}, 'connections'),
      JSON.stringify(Object.keys(plainParsed ?? {})));
    includes(c, '机检：非恢复实例文本可读（实例行存在）', plainText.stdout, '实例 INST-001');
    check(c, '机检：非恢复实例文本确实没有「连接线：」',
      !plainText.stdout.includes('连接线：'), plainText.stdout.slice(0, 400));

    note(c, 'connections 每项 4 键与「恢复实例才追加两键」按 render.js A-9 / D-12 逐字核对；'
      + '非恢复对照组用 completed 终态实例（不会被 reconcile 写 recoveredAt）。');
    releaseAndStop(root, g.env);
  } finally {
    cleanupRoot(root); cleanupRoot(plainRoot);
  }
  return finish(c);
}
