// AC-31 · 四类运行期异常提示逐字 + 异常后界面仍可操作；架构：渲染层不抛异常
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-31', {
  testFile: 'drill-errors.test.js',
  arch: [
    { label: '渲染层不抛异常（throw new Error 零命中）', pattern: 'throw new Error', target: 'desktop/ui/drill/', expect: 'zero' },
  ],
  literals: [
    "assert.equal(EXPECTED.missingInstance, '实例 INST-999 · 不存在')",
    "assert.equal(EXPECTED.unusedRole, '角色 协调者 · 本实例未使用')",
    "assert.equal(EXPECTED.missingNode, '节点 T-003 · 不存在')",
    "assert.equal(EXPECTED.reconnecting, '已断开 · 正在重连…')",
    'composed.actions.some',
    "'back-to-list'",
    "app.state().view, 'drill'",
    "app.state().view, 'graph'",
    'w(\'DRILL_EMPTY_TASK\')',
  ],
  notes: [
    '四类异常逐字基线取自 A-9：实例 INST-999 · 不存在 / 角色 协调者 · 本实例未使用 / 节点 T-003 · 不存在 / 已断开 · 正在重连…；均由文案键派生，机检 F-16 逐字通过。',
    '界面仍可操作由 compose().actions 的 back-to-list / retry-graph 探针 + view 在 drill→graph 间可迁移证明；不白屏、不抛栈。',
  ],
})];
