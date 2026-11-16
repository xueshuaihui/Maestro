// AC-08 · 卡片按状态优先级排序，rank [1,2,3,4,5,6,7,8,8]，assigned 独立第 5 档（显示词折叠执行中）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-08', {
  testFile: 'drill-cards.test.js',
  arch: [
    { label: 'cards.js 排序不读时间/DOM', pattern: 'sort\\(.*Date|updatedAt', target: 'desktop/ui/drill/cards.js', expect: 'zero' },
  ],
  literals: [
    "'T-010', 'T-011', 'T-013', 'T-014', 'T-012', 'T-015', 'T-016', 'T-017', 'T-018'",
    'assert.deepEqual(result.map((c) => c.rank), [1, 2, 3, 4, 5, 6, 7, 8, 8])',
    "assert.equal(result.find((c) => c.nodeId === 'T-012').tier, 'assigned')",
    "assert.equal(result.find((c) => c.nodeId === 'T-012').displayStatus, '执行中')",
    "'escalated', 'failed', 'running', 'review', 'assigned', 'ready', 'blocked', 'done'",
  ],
  notes: [
    'Then 逐字：8 档顺序「已升级>失败>执行中>待校验>已分配>可调度>被阻塞>已完成」，assigned 独立一档位于 review 之后、ready 之前；rank 序列 [1,2,3,4,5,6,7,8,8] 单调不减（9 节点含 done 两例）；T-012 显示词「执行中」但档位 assigned。',
    '显示词折叠 ≠ 排序档位折叠（F4-01）。',
  ],
})];
