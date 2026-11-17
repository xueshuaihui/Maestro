// AC-12 · 会话状态时间线：跨会话按时间正序合并（时间列不降序、形态 HH:mm:ss）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-12', {
  testFile: 'node-detail.test.js',
  arch: [
    { label: '时间线不读系统时间', pattern: 'Date[.]now', target: 'desktop/ui/drill/node-detail.js', expect: 'zero' },
  ],
  literals: [
    '时间线 09:12:03 执行中',
    '时间线 09:13:10 执行中',
    '时间线 09:13:40 已升级',
    '时间线 09:14:02 空闲',
    '时间线 09:15:41 待校验',
    "['09:12:03', '09:13:10', '09:13:40', '09:14:02', '09:15:41']",
    '/^\\d{2}:\\d{2}:\\d{2}$/',
  ],
  notes: [
    'Then 逐字：5 行按 09:12:03 / 09:13:10 / 09:13:40 / 09:14:02 / 09:15:41 正序，每行形如「09:12:03 执行中」；机检断言时间列严格不降序、状态词序列逐项相等、行数 5、形态正则。',
    '时间线只读事件回放，不读系统时间（Date.now 零命中）。',
  ],
})];
