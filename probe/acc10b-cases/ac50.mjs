// AC-50 · 角色绑定归零后重取：状态栏「未参与」+ 卡片「任务 无」+ DAG 保留（BR-41 的另一半）
import fs from 'node:fs';
import path from 'node:path';
import { standardCase } from './_shared.mjs';
import { REPO } from '../acc10b-f-common.mjs';
import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';

export const cases = [standardCase('AC-50', {
  testFile: 'drill-live.test.js',
  arch: [
    { label: '空卡片不清空面板、不短路渲染（与 AC-48 同一锚点）',
      pattern: 'if \\(!cards\\.length\\) return|return null', target: 'desktop/ui/drill/cards.js', expect: 'zero' },
    { label: '重取路径不得写盘（saveState|appendSpan|emit( 零命中）',
      pattern: 'saveState|appendSpan|emit\\(', target: 'src/daemon/drill.js', expect: 'zero' },
  ],
  literals: [
    'app.noteGraphStreamOpen();',
    "assert.equal(app.state().graphStreamReopened, true);",
    "assert.equal(app.state().graphStreamOpens, 2);",
    "app.handleFrame(frame('graph.snapshot', null, {",
    "'角色栏 开发', statusWord('inactive'), '0 个活跃会话',",
    "'服务 ' + placeholder, '宿主 ' + placeholder, '最近 ' + placeholder,",
    'assert.equal(v.cards.length, 0);',
    "assert.equal(v.cardsEmptyText, w('DRILL_EMPTY_TASK'));",
    'assert.deepEqual(v.dag.nodes.map((n) => n.nodeId), beforeDag);',
    "assert.equal(app.state().view, 'drill');",
    'assert.ok(tRefetch - tDrop <= 2000);',
  ],
  extra(c) {
    // 契约 A5：ensureStreams 只把条件扩到 graph | drill，不新建通道/帧类型
    const appSrc = fs.readFileSync(path.join(REPO, 'desktop', 'ui', 'app.js'), 'utf8');
    c.includes('契约 A5：ensureStreams 条件含 graph || drill',
      appSrc, "current.view === 'graph' || current.view === 'drill'");
    c.includes('契约 A5：仅一条 graph/stream 通道',
      appSrc, '/graph/stream');
    // Then 逐字：重取后状态栏形态（A-1 第 3 行）与卡片空态（A-9）
    c.eq("状态词 inactive → 未参与",
      JSON.parse(UI_LABEL_KEYS.DRILL_ROLE_STATUS_TOKEN).inactive, '未参与');
    c.eq("卡片空态 DRILL_EMPTY_TASK → 任务 无", UI_LABEL_KEYS.DRILL_EMPTY_TASK, '任务 无');
    c.check('Then 逐字：重取后角色行逐字等于 A-1 第 3 行形态',
      ['角色栏 开发', '未参与', '0 个活跃会话', '服务 —', '宿主 —', '最近 —'].join(' · ')
        === '角色栏 开发 · 未参与 · 0 个活跃会话 · 服务 — · 宿主 — · 最近 —',
      '角色栏 开发 · 未参与 · 0 个活跃会话 · 服务 — · 宿主 — · 最近 —');
  },
  notes: [
    'Then 逐字锚点（requirement.md:985-986）：重取完成后状态栏「未参与 / 服务 — / 宿主 — / 最近 — / 0 个活跃会话」，卡片「任务 无」，局部 DAG 保留上一帧（节点数不变、不清空、不塌陷、不重排），不白屏、下钻不关闭、可返回流程图。',
    '局部更新规则（评审 F4-13）：重取只替换状态栏与卡片，DAG 不按空节点集重建——"完整数据"指状态栏与卡片的数据来源，不是把 DAG 清空重画。',
    '契约 A5 / graphStreamReopened（D-14 表 A5）：drill 复用同一条 /graph/stream，ensureStreams 在 view===drill（drill 视图）保持/重开；同一通道重开两次置 graphStreamReopened===true，不新开通道、不新增帧类型。',
    '内部断言（非用户可见）：t_refetch - t_drop ≤ 2000（含既有 1 秒重连窗口）；替换前后 rev 与哈希各自留证。',
    'F5-01 竞态回改路径：S2 实证核心对活跃 run 的写盘会覆盖外部 state.json 替换，回改为「先起核再写盘且核心不驱动 / 走产品路径 + 既有接缝」；AC-50 机检以 noteGraphStreamOpen + graph.snapshot 首帧在模块面构造重取，真实断开重连时序属人工核验面。',
  ],
})];
