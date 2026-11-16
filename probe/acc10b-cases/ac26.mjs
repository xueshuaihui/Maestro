// AC-26 · 跳转三降级逐字：无可跳转会话 / 宿主 mock 不支持跳转 / 未找到 DeepSeek Harness（无进程、状态不变）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-26', {
  testFile: 'host-jump.test.js',
  arch: [
    { label: '产品名走文案键，不在 UI 硬编码', pattern: 'DeepSeek Harness', target: 'desktop/ui/', expect: 'zero' },
  ],
  literals: [
    "none: '无可跳转会话'",
    'unsupported: (host) => `宿主 ${host} 不支持跳转`',
    "missing: '未找到 DeepSeek Harness'",
    'assert.equal(none.button.enabled, false)',
    'assert.equal(none.button.disabledReason, A7.none)',
    "assert.equal(mock.button.disabledReason, A7.unsupported('mock'))",
    'assert.deepEqual(missing.toasts, [A7.missing])',
    "assert.equal(spawnSignals, 0, 'degradations must not produce a host-launch signal')",
    "assert.equal(sha256(makeState()), stateHashBefore, 'instance state unchanged')",
  ],
  notes: [
    'Then 逐字：① 0 活跃会话→按钮置灰+悬停「无可跳转会话」；② mock 宿主→「宿主 mock 不支持跳转」；③ MAESTRO_DSH_EXE 不存在→「未找到 DeepSeek Harness」。三条提示逐字取自 A-7 冻结文案，降级原因只由适配器错误码映射。',
    '三次都不抛异常、不改变实例状态（stateHashBefore 不变）、不产生 DSH 进程（spawnSignals===0）。第四种降级「跳转失败 · <原因>」由 AC-46 单独判定，本 AC 不重复。',
    '架构锚点：desktop/ui/ 对 DeepSeek Harness 零命中（exit 1），产品名走文案键。',
  ],
})];
