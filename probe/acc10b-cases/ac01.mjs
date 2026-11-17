// AC-01 · 从角色流程图进入角色下钻：view==='drill' / A-1 第 7 行逐字 / 注入时钟≤1000ms / state.json 哈希不变
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-01', {
  testFile: 'drill-entry.test.js',
  arch: [
    { label: 'drill.js 无 saveState/appendSpan', pattern: 'saveState|appendSpan', target: 'src/daemon/drill.js', expect: 'zero' },
    { label: 'drill.js 无宿主 if/switch 硬判', pattern: 'if \\(.*[Hh]ost.*===|switch \\(.*[Hh]ost', target: 'src/daemon/drill.js', expect: 'zero' },
  ],
  literals: [
    "assert.equal(st.view, 'drill')",
    "'实例 INST-001 / 角色 开发'",
    "'角色栏 开发'", "'2 个活跃会话'", "'服务 T-001, T-002'", "'宿主 dsh cursor'",
    '最近 T-002 · 轮次 2/3 · ',
    'assert.equal(view.cards.length, 5)',
    "assert.equal(view.cards[0].nodeId, 'T-001')",
    'assert.equal(view.roleBar.activeSessions, 2)',
    "assert.deepEqual(view.roleBar.servingNodes, ['T-001', 'T-002'])",
    "assert.deepEqual(view.roleBar.hostIcons, ['dsh', 'cursor'])",
    'assert.ok(st.drillTiming.enteredAt - clickAt <= 1000)',
    'assert.equal(hash(stateFile), before)',
  ],
  notes: [
    'Then 逐字锚点：附录 A-1 第 7 行「角色栏 开发 · 服务中 · 2 个活跃会话 · 服务 T-001, T-002 · 宿主 dsh cursor · 最近 T-002 · 轮次 2/3 · 待校验」；源码由文案键拼行，逐字核对取拼行所需片段，机检 F-16 通过证明投影结果逐字相等。',
    '内部断言：t_drill - t_click ≤ 1000（注入时钟 5000→5300，差 300ms）；进入前后 state.json 字节哈希不变（只读）。',
  ],
})];
