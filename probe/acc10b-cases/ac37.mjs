// AC-37 · 未知角色状态栏「不可用」逐字 + statusReason 透传 + 其余四项照常
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-37', {
  testFile: 'drill-errors.test.js',
  arch: [
    { label: '界面不查注册表判定角色（registry|roleMap 零命中）', pattern: 'registry|roleMap', target: 'desktop/ui/drill/', expect: 'zero' },
  ],
  literals: [
    'assert.equal(bar.status, statusWord(\'unavailable\'))',
    "assert.equal(bar.statusReason, 'unknown-role')",
    "'角色栏 外部审核'",
    "'1 个活跃会话'",
    "'服务 T-021'",
    "'宿主 dsh'",
    '最近 T-021 · 轮次 1/1 · ',
    "assert.deepEqual(bar.servingNodes, ['T-021'])",
    "assert.deepEqual(bar.hostIcons, ['dsh'])",
    'app.state().drillView.cards.length, 2',
  ],
  extra(c, { src }) {
    // 需求机检原文（requirement.md:843）逐字要求 lastAction 为含 stateSince 的 5 字段对象：
    //   {nodeId:'T-021', round:1, maxRounds:1, state:'running', stateSince:'2026-11-15T10:04:00.000Z'}
    // 裁决 J / F4-05 明确「AC-37 lastAction 期望对象补齐 stateSince」。
    // 取证：drill-errors.test.js 夹具(:87)与 deepEqual 断言(:114)的对象均只有 4 字段，缺 stateSince；
    // 2026-11-15T10:04:00.000Z 在 test/wp14 全域零命中。按「只认需求 Then/机检逐字、不放宽」判不通过。
    const hasField = /stateSince/.test(src);
    const hasValue = /2026-11-15T10:04:00[.]000Z/.test(src);
    c.check(
      '机检逐字：lastAction 含 stateSince=2026-11-15T10:04:00.000Z（requirement.md:843 / 裁决 J F4-05）',
      hasField && hasValue,
      hasField && hasValue
        ? '机检源码含 stateSince 字段与 ISO 逐字值'
        : `drill-errors.test.js 的 lastAction 夹具/断言对象仅 4 字段、缺 stateSince；hasField=${hasField} hasValue=${hasValue}（与需求机检逐字要求冲突）`
    );
  },
  notes: [
    '用户可见 Then（状态栏逐字行「角色栏 外部审核 · 不可用 · 1 个活跃会话 · 服务 T-021 · 宿主 dsh · 最近 T-021 · 轮次 1/1 · 执行中」+ 卡片两张 + statusReason=unknown-role 透传）全部由机检源码承载并通过。',
    '判定分歧点：需求机检逐字要求 roleBar.lastAction 为 5 字段对象（含 stateSince=2026-11-15T10:04:00.000Z），实测机检夹具/断言只有 4 字段——按不放宽断言纪律判该核对项不通过，AC 整体不通过，已登记 blockers.md 附原始帧。',
  ],
})];
