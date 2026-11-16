// AC-28 · 只读：三文件哈希/四组状态不变 + opCount===40/fetchCount===30 + 唯一写动作「继续」单独记账
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-28', {
  testFile: 'drill-readonly.test.js',
  arch: [
    { label: 'drill 层与 daemon 不写状态/不追加 span/不 emit', pattern: 'saveState|appendSpan|emit\\(', target: 'src/daemon/drill.js desktop/ui/drill/', expect: 'zero' },
  ],
  literals: [
    'assert.equal(hash(files.state), before.state)',
    'assert.equal(hash(files.events), before.events)',
    'assert.equal(hash(files.traces), before.traces)',
    'assert.deepEqual(after, groupsBefore)',
    'assert.equal(app.state().escalationNotice, null)',
    'assert.equal(st.opCount, 40)',
    'assert.equal(st.fetchCount, 30)',
    'assert.ok(st.fetchCount <= st.opCount)',
    'assert.equal(st.maxFetchesPerView, 1)',
    'assert.equal(st.crashCount, 0)',
    'assert.equal(st.daemonRestarts, 0)',
    '唯一写动作「继续」之后才出现状态变化提示（与只读分开记账）',
  ],
  notes: [
    'Then 逐字：所有只读浏览结束后，state/events/traces 三份文件字节哈希相等、四组状态深比较相等，三处视图（状态栏/卡片/DAG）与操作前一致；全程无「已变更/已提交」提示、无白屏崩溃；连续导航无闪烁无重复加载。',
    '内部断言（非用户可见，故不入 Then）：opCount===40（进入下钻/退出/看板/子流程各 10）、fetchCount===30（10+10+10）、maxFetchesPerView===1、crashCount===0、daemonRestarts===0；随后一次「继续」才出现状态变化与提示。',
  ],
})];
