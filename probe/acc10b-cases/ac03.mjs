// AC-03 · 角色状态栏只五个状态词，已结束实例显示「未参与」，界面不出现「已关闭」
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-03', {
  testFile: 'drill-entry.test.js',
  arch: [
    { label: 'drill 无自算状态语义', pattern: 'statusReason|decideStatus', target: 'desktop/ui/drill/', expect: 'zero' },
    { label: 'daemon 下发状态词表', pattern: 'ROLE_INSTANCE_STATUS_LABEL', target: 'src/daemon/http/labels.js', expect: 'min1' },
    { label: 'desktop/ui + harness 无「已关闭」', pattern: '已关闭', target: 'desktop/ui desktop/harness', expect: 'zero' },
  ],
  literals: [
    "'可用', '服务中', '冷却中', '不可用', '未参与'",
    "word('NODE_LABEL_REVIEW')",
    'allUi.includes(\'已关闭\'), false',
  ],
  notes: [
    'Then 逐字：十行状态词只取「未参与/可用/服务中/冷却中/不可用」五词，INST-002 全「未参与」，任何位置不出现「已关闭」；机检把五词集合与界面全文扫描并列核对。',
    '架构口径（裁决 H / A-10）：drill 不重算状态，中文值只在文案表，daemon 平铺下发键与词表。',
  ],
})];
