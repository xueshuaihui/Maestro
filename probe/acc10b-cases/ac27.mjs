// AC-27 · 下钻层实时更新，会话变化不重排（状态词 2s 到达且顺序不变 / 5 次会话变化只动指示器）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-27', {
  testFile: 'drill-live.test.js',
  arch: [
    { label: '下钻层不新增事件类型/定时器', pattern: 'new EventEmitter|setInterval\\(.*refetch', target: 'src/daemon/drill.js desktop/ui/drill/', expect: 'zero' },
    { label: 'drill.js 无私建 overlay 映射（只读既有 hub）', pattern: 'new Map\\(\\).*overlay|overlayRoles|overlayEdges', target: 'src/daemon/drill.js', expect: 'zero' },
  ],
  literals: [
    '状态词 2s 内到达、会话 5 次变化只动指示器不重排',
    "app.handleFrame(frame('role_instance.updated', 'developer', { status: 'serving' }))",
    "app.handleFrame(frame('session.indicator', 'SESS-' + i, { state: 'thinking' }))",
    "assert.equal(v.roleBar.status, statusWord('serving'))",
    'assert.deepEqual(order(v), beforeOrder)',
    'assert.deepEqual(v.dag.nodes.map((n) => n.nodeId), beforeDag)',
    'assert.ok(roleAt - trigger <= 2000)',
    'assert.ok(app.state().frames.session <= 5)',
  ],
  notes: [
    'Then 逐字：状态词由可用转服务中（statusWord(\'serving\')，用户不刷新即见）；5 次会话变化只让对应卡片指示器跟着变，卡片顺序 order_before===order_after、DAG 节点集合不变、不整体重绘。',
    '内部断言（非用户可见）：roleAt-trigger≤2000ms；每张卡片 top/height 差集空、dagCoords 差集空、indicatorFrames≤5。取数路径复用同一 pulse overlay（裁决 H 第 2 条），只翻状态词不翻 servingNodes/hostIcons，属已知限制照实登记。',
  ],
})];
