// AC-14 · 证据引用可解析/缺失两态，可复制，不判过期
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-14', {
  testFile: 'node-detail.test.js',
  arch: [
    { label: '证据段不引入过期判定', pattern: '已过期|过期', target: 'desktop/ui/drill/', expect: 'zero' },
    { label: '证据状态不读过期/TTL', pattern: 'expiredAt|ttl|TTL', target: 'desktop/ui/drill/', expect: 'zero' },
  ],
  literals: [
    '证据 1 · artifacts/code/calc.js · 产物 · 可解析',
    '证据 2 · defects/d1.md · 缺陷 · 缺失',
    '证据 3 · logs/T-003.log · 产物引用 · 可解析',
    "result.copyEvidence(1).copied, 'artifacts/code/calc.js'",
  ],
  notes: [
    'Then 逐字：三行逐字（可解析/缺失/可解析）；复制把引用原文放入剪贴板（copied === artifacts/code/calc.js）；证据段内不出现「已过期/过期」。',
    '证据状态只由「引用能否解析到可读文件」决定；连接线面板里的「已过期」是交接包七态之一，不属本 AC 约束范围。',
  ],
})];
