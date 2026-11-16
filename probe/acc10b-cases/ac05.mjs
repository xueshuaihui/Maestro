// AC-05 · 局部 DAG 只显示 1 跳，状态色 / 加粗 / 实线虚线正确
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-05', {
  testFile: 'drill-dag.test.js',
  arch: [
    { label: 'dag.js 不做图遍历 BFS', pattern: 'BFS|bfs|visited|queue', target: 'desktop/ui/drill/dag.js', expect: 'zero' },
  ],
  literals: [
    "result.nodes.map((n) => n.nodeId), ['A', 'B', 'D', 'C', 'E']",
    "result.nodes.filter((n) => n.bold).map((n) => n.nodeId), ['A', 'B', 'D']",
    'result.dangling, 0',
    "back.style, 'dashed'",
    "'局部连线 D→B · 回流 · 待执行'",
    "'局部连线 A→B · 正向 · 已完成'",
    "'solid'",
    'JSON.stringify(a), JSON.stringify(b)',
  ],
  notes: [
    'Then 逐字：可见节点恰为 A/B/C/D/E（本角色 A/B/D + 1 跳 C/E），连线 A→B/B→C/B→E/C→D/D→B 五条，D→B 虚线标「回流」其余实线标「正向」，本角色三节点加粗，无悬空端点，两次布局坐标逐字节相等。',
    '架构：1 跳只取直接前后驱，禁 BFS/visited/queue（A-2 局部节点/连线行由投影产出）。',
  ],
})];
