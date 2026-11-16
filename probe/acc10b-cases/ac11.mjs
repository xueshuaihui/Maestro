// AC-11 · 节点详情四段齐全，空段保留标题并给「无记录」（A-4 逐字）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-11', {
  testFile: 'node-detail.test.js',
  arch: [
    { label: '详情只读：drill.js 无写盘/发事件', pattern: 'saveState|emit\\(|appendSpan', target: 'src/daemon/drill.js', expect: 'zero' },
  ],
  literals: [
    'assert.equal(result.sections.length, 4)',
    '节点 T-003 · 实现登录 · 执行中 · 轮次 1/2',
    '时间线 09:12:03 执行中',
    '摘要 命令 npm test · 退出码 1 · 关键输出 12 行 · 日志 logs/T-003.log',
    '证据 1 · artifacts/code/calc.js · 产物 · 可解析',
    '证据 2 · defects/d1.md · 缺陷 · 缺失',
    '证据 3 · logs/T-003.log · 产物引用 · 可解析',
    '交接 HO-006 · 正向 · 第 1 轮 · 已完成 · 09:20:11',
    "['时间线', '摘要', '证据', '交接']",
    "'时间线 无记录', '摘要 无记录', '证据 无记录', '交接 无记录'",
  ],
  notes: [
    'Then 逐字：T-003 四段标题与内容逐字等于 A-4；T-004 四段标题都在且分别显示「时间线/摘要/证据/交接 无记录」；面包屑「实例 INST-001 / 角色 开发 / 节点 T-004」（由 node-detail 段投影与机检覆盖）。',
    '详情只读，不写 state、不发事件、不加 span。',
  ],
})];
