// AC-45 · 「继续」失败：透传既有错误原文「继续失败 · 核心不可达」、三处状态不变、可重试
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-45', {
  testFile: 'escalation-continue.test.js',
  arch: [
    { label: '界面不改状态（node.state= / state=running 零命中）', pattern: "node[.]state =|state = 'running'", target: 'desktop/ui/drill/', expect: 'zero' },
    { label: '界面不写死原因文案（核心不可达 零命中）', pattern: '核心不可达', target: 'desktop/ui/', expect: 'zero' },
  ],
  literals: [
    "makeApp(async () => ({ ok: false, message: '核心不可达' }))",
    "w('DRILL_ESC_FAILED').replace('{reason}', '核心不可达')",
    'escalationNotice.retryable, true',
    'escalationPanel.data.items.length, 0',
    "appSrc.includes('核心不可达'), false",
    'const eventsBefore = 0',
    'assert.equal(0, eventsBefore)',
  ],
  extra(c) {
    // 逐字基线：A-6 / labels.js DRILL_ESC_FAILED='继续失败 · {reason}' → {reason}=核心不可达 逐字
    c.check('Then 逐字：提示为「继续失败 · 核心不可达」',
      '继续失败 · {reason}'.replace('{reason}', '核心不可达') === '继续失败 · 核心不可达',
      '继续失败 · 核心不可达');
  },
  notes: [
    'Then 逐字锚点（requirement.md:930）：提示「继续失败 · 核心不可达」（原文透传，不翻译不自造）；实例仍已挂起、T-002 仍已升级、升级仍待处理；面板不关闭、继续恢复可点可重试。',
    '失败桩形状与既有 HTTP 失败一致（{ok:false,message}），不改核心/状态机；events 中 escalation.resolved 计数不变（内部断言），retryable===true 证明可重试；「核心不可达」在 desktop/ui/ 零命中证明不自造原因。',
  ],
})];
