// AC-02 · 返回流程图后 viewState 五组值逐字段相等（本迭代用 backToGraph，不用会清空状态的 backToList）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-02', {
  testFile: 'drill-entry.test.js',
  arch: [
    { label: 'app.js createViewState 恰好 2 处', pattern: 'createViewState\\(', target: 'desktop/ui/app.js', expect: 'exact:2' },
    { label: 'drill 内零 new createViewState', pattern: 'createViewState\\(', target: 'desktop/ui/drill/', expect: 'zero' },
    { label: 'drill 内零整图重放', pattern: 'openGraph\\(|rebuildGraph\\(|replayGraph|reapplySnapshot', target: 'desktop/ui/drill/', expect: 'zero' },
    { label: 'drill 内零 backToList', pattern: 'backToList\\(', target: 'desktop/ui/drill/', expect: 'zero' },
  ],
  literals: [
    "vs.setZoom(1.5)", "vs.setPan(120, -40)", "vs.applyOffsets({ 'T-002': { dx: 40, dy: 60 } })", "vs.focus('T-003', 2)",
    'app.backToGraph()',
    's1.viewState !== null',
    's1.viewState.getZoom(), before.zoom',
    's1.viewState.getPan(), before.pan',
    's1.viewState.getOffsets(), before.offsets',
    's1.viewState.getFocus(), before.focus',
    "assert.equal(hits.length, 2)",
  ],
  notes: [
    'Then 逐字：缩放 150%、平移 (120,-40)、T-002 偏移 (+40,+60)、折叠编码工程组、2 跳聚焦 T-003，返回后五组逐字段相等；机检由 viewState 真值断言承载，避免走 backToList() 把状态整体清空。',
    '架构检查第 ④ 条：返回实现在 app.js，backToList() 会把 viewState 置 null；机检断言返回后 viewState !== null 且五组值相等，使走错路径必然判红。',
  ],
})];
