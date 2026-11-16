// AC-21 · 点击升级节点跳到本实例升级处理面板（标题/计数 2/两条编号/原因缺陷逐字/排除 INST-002）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-21', {
  testFile: 'special-node-jump.test.js',
  arch: [
    { label: '面板数据按实例过滤，不 listAll/instanceIds', pattern: 'listAll|instanceIds', target: 'desktop/ui/drill/escalation-panel.js', expect: 'zero' },
  ],
  literals: [
    "assert.equal(p.title, w('DRILL_ESC_TITLE'))",
    "assert.equal(p.countLine, w('DRILL_ESC_COUNT').replace('{n}', '2'))",
    "assert.deepEqual(p.items.map((i) => i.escalationId), ['ESC-001', 'ESC-002'])",
    "assert.equal(p.items[0].reasonLine, '原因：测试第 2 轮失败')",
    "assert.equal(p.items[0].defectLines[0], '缺陷：断言失败（证据 defects/d1.md）')",
    "assert.equal(JSON.stringify(p.items).includes('INST-002'), false)",
    "reasonDetail: '合并冲突'",
  ],
  notes: [
    'Then 逐字：面板标题「升级处理」（DRILL_ESC_TITLE）、计数「本实例待处理升级 2 个」（DRILL_ESC_COUNT 替换 {n}=2）；两条依次列出 ESC-001 / ESC-002（编号·状态·节点·角色·轮次）。',
    '展开第一条逐字「原因：测试第 2 轮失败」「缺陷：断言失败（证据 defects/d1.md）」（值取自 Given 的 reasonDetail/defects，与 A-6 同形）；不出现 INST-002 的升级（本实例作用域）。',
  ],
})];
