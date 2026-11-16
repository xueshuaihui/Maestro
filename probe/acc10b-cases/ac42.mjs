// AC-42 · 60 条交接包：能滚到 HO-060、行文本正确、不空白（用户可见 Then）+ 内部断言 scrollElapsed/renderedRows
import fs from 'node:fs';
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-42', {
  testFile: 'connection-panel.test.js',
  arch: [], // 架构检查为零依赖（见 extra），非 grep
  literals: [
    "panel.visibleIds.includes('HO-001')",
    "panel.visibleIds.includes('HO-060')",
    "panel.rows.every((r) => r.id.startsWith('HO-'))",
    '/^交接 HO-060 · 第 1 轮 · 已投递 · \\d{2}:\\d{2}:\\d{2}$/',
    'panel.renderedRows < 60',
    'panel.scrollElapsed <= 200',
    'panel.scrollToEnd()',
    "for (let i = 1; i <= 60; i += 1)",
  ],
  extra(c) {
    // 架构检查（需求 requirement.md:900）：不引第三方虚拟滚动依赖，dependencies === {}
    const deps = JSON.parse(fs.readFileSync('package.json', 'utf8')).dependencies || {};
    c.check('架构：package.json 零运行时依赖（dependencies={}）', Object.keys(deps).length === 0, JSON.stringify(deps));
  },
  notes: [
    '用户可见 Then（requirement.md:897）：打开可见首行 HO-001、滚到底可见 HO-060 且行逐字、rows 均为 HO- 前缀、无空白行、滚到底仍可展开时间线。',
    '内部断言（非用户可见，裁决 H 第5条 / 评审 F4-14）：renderedRows<60、scrollElapsed≤200 为纯模块面「模型坐标+注入时钟」模拟值，只作内部回归信号；S2 不引入真实 DOM/第三方虚拟滚动依赖。',
  ],
})];
