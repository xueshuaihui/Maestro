// AC-22 · 「继续」让实例从已挂起恢复运行（两份等价夹具各跑一条路径，终态逐项相等；elapsed≤2000）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-22', {
  testFile: 'escalation-continue.test.js',
  arch: [
    { label: '界面与 HTTP 层不得直接改状态，只能调既有裁决', pattern: "state = 'running'|node.state = ", target: 'src/daemon/http/ desktop/ui/drill/', expect: 'zero' },
  ],
  literals: [
    '两份等价夹具各跑一条路径，终态逐项相等；UI 路径经 io.continueEscalation',
    'const fixtureA = fixture();',
    'const fixtureB = fixture();',
    'assert.deepEqual(terminal(terminalA), terminal(terminalB))',
    "assert.equal(result.ok, true)",
    "w('DRILL_ESC_DONE').replace('{id}', 'ESC-001')",
    'assert.ok(clock.t - trigger <= 2000)',
  ],
  notes: [
    'Then 逐字：2 秒内实例 state suspended→running、节点 T-002 escalated→running、escalations[0].state→resolved；提示「已继续 · ESC-001」（DRILL_ESC_DONE）；三处视图字段一致。',
    '机检核心：两份等价夹具 A（界面继续经 io.continueEscalation）/ B（同一快照走 CLI escalate resolve --decision retry）各只跑一条路径，比较终态逐项相等、同形同位；不在同一份夹具上先后跑两条（否则命中 ESCALATION_NOT_PENDING）。内部断言 elapsed≤2000。',
  ],
})];
