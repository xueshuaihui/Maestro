// AC-19 · 连接线面板：4 包 4 行倒序、HO-010 时间=展开末条 09:12:41、标题聚合已拒绝、空态交接 无
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-19', {
  testFile: 'connection-panel.test.js',
  arch: [
    { label: '时间线只用交接包既有时间戳，不取当前时间', pattern: 'Date[.]now', target: 'src/daemon/drill.js', expect: 'zero' },
  ],
  literals: [
    "assert.equal(panel.title, '连接 开发→测试 · 正向 · 已拒绝 · 2 并行交接')",
    'assert.equal(panel.rows.length, 4)',
    "assert.deepEqual(panel.rows.map((r) => r.id), ['HO-010', 'HO-011', 'HO-009', 'HO-008'])",
    "assert.deepEqual(panel.rows.map((r) => r.time), ['09:12:41', '09:12:39', '09:05:10', '08:58:02'])",
    "'交接 HO-010 · 第 3 轮 · 已投递 · 09:12:41'",
    "'时间线 09:12:40 已构造'",
    "'时间线 09:12:41 已投递'",
    "assert.equal(panel.rows.find((r) => r.id === 'HO-010').time, '09:12:41')",
    "assert.equal(empty.emptyText, '交接 无')",
    'assert.equal(empty.rows.length, 0)',
  ],
  notes: [
    'Then 逐字：标题「连接 开发→测试 · 正向 · 已拒绝 · 2 并行交接」（按基线优先级聚合为已拒绝；2 并行指第 3 轮两包并行）；4 行倒序 HO-010/HO-011/HO-009/HO-008（行数=交接包个数=4，并行不合并行）。',
    'HO-010 行时间=其最近活动 09:12:41=展开时间线末条 09:12:41（一致）；时间线恰好 [09:12:40 已构造, 09:12:41 已投递]，不补未发生的已接受；第 1、2 轮可展开显示拒绝/过期原因；「测试→协调者」显示「交接 无」。',
  ],
})];
