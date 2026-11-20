/**
 * AC-07 · 重启后轮次不重置。
 *
 * 现场：自控制 backflow + killAfter=2500（实测恢复行「轮次 2/2」、
 * T-001 处于 review/running round=2）。断言 graph json 的 round===2、
 * status 恢复行「轮次 2/…」，且开发节点不回退到第 1 轮。
 *
 * 需求机检写 maxRounds===3；本机内建 code-loop 图（src/templates/index.js:186）对
 * T-001/T-002 的 maxRounds 都是 2。裁-15c：这是需求示例数字与内建模板的冲突，
 * 按「实测模板真值 2」收紧断言（不放宽为「正整数」，也不伪造 3），差异入 note() 与报告 §5。
 */
import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, readState, orch } from '../acc8-f-lib.mjs';
import { driveRecovery } from './AC-01.mjs';

export async function run() {
  const c = makeCase('AC-07', { scenario: 'checkpoint-advance', title: '重启后轮次不重置' });
  const root = freshRoot('AC-07');
  c.root = root;
  try {
    const d = await driveRecovery(root, 2500, {}, true, true);
    evidence(c, 'given', 'recovery.json', JSON.stringify(
      { ok: d.ok, kill: d.kill, boots: d.boots, before: d.before }, null, 2));
    check(c, 'Given：自控制强杀 + status 冷启动后 recoveredAt 落盘', d.ok === true,
      JSON.stringify({ kill: d.kill, boots: d.boots }));
    check(c, 'Given：恢复行含轮次 2', /轮次 2\//.test(d.status.stdout),
      (d.status.stdout.match(/恢复：[^\n]*/) || [])[0] ?? '');

    const graphJ = orch(root, ['instance', 'graph', '--instance', 'INST-001', '--format', 'json']);
    const graphT = orch(root, ['instance', 'graph', '--instance', 'INST-001', '--format', 'text']);
    const status = orch(root, ['status', '--instance', 'INST-001']);
    evidence(c, 'then', 'graph.json', graphJ.stdout);
    evidence(c, 'then', 'graph.txt', graphT.stdout);
    evidence(c, 'then', 'status.txt', status.stdout);
    let gj = null;
    try { gj = JSON.parse(graphJ.stdout); } catch { /* 取证已保存 */ }
    const dev = gj?.nodes?.find((n) => n.nodeId === 'T-001');
    const devLine = graphT.stdout.split(/\r?\n/).find((l) => /T-001\s+开发/.test(l)) || '';
    eq(c, '机检：node T-001 round === 2', dev?.round, 2);
    includes(c, 'graph 文本：开发节点仍是「第 2 轮」', devLine, '第 2 轮');
    excludes(c, 'graph 文本：开发节点不回退到「第 1 轮」', devLine, '第 1 轮');
    includes(c, 'status：恢复行是「轮次 2/…」', status.stdout, '轮次 2/');
    excludes(c, 'status：不出现「轮次 1/3」', status.stdout, '轮次 1/3');
    const recLine = (status.stdout.match(/恢复：检查点[^\n]*/) || [])[0] || '';
    check(c, '恢复行同时含跳过数量与轮次', /跳过 \d+ 个已完成节点 · 轮次 \d+\/\d+/.test(recLine), recLine);
    // 裁-15c：需求机检写 maxRounds===3，内建 code-loop 模板（src/templates/index.js:186）
    // 实测 T-001/T-002 均为 2，恢复行分母即模板真值。收紧到「分母 === 内建模板值」，
    // 不放宽为「正整数」，也不为凑需求示例伪造 3。
    const declaredMax = 2; // src/templates/index.js:186 codeLoop.maxRounds['T-001']
    const shownMax = Number((recLine.match(/轮次 \d+\/(\d+)/) || [])[1]);
    eq(c, '机检：恢复行轮次分母 === 内建模板 maxRounds（实测 2，需求写 3）', shownMax, declaredMax);
    check(c, 'state.json 可读且开发节点 round=2', readState(root)?.nodes?.find((n) => n.nodeId === 'T-001')?.round === 2,
      JSON.stringify(readState(root)?.nodes?.find((n) => n.nodeId === 'T-001')));
    note(c, '需求机检写 maxRounds===3；内建 code-loop 图（src/templates）对 T-001/T-002 的 maxRounds 均为 2，'
      + 'graph json 的 maxRounds 在恢复行里体现为「轮次 2/2」。以实际值为准，未伪造 3。');
    note(c, '恢复行「跳过数」取实际值：killAfter=2500 窗口 T-001 处于 review/running round2，跳过数为 0；'
      + '需求示例跳过 1 对应 killAfter=1200（T-001 done round1）的窗口，两者不可兼得。');
    try { orch(root, ['core', 'stop']); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
