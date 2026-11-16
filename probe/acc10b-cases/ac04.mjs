// AC-04 · 状态栏折叠 / 占位 / 多宿主并列（A-1 第 4、2、3 行逐字）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-04', {
  testFile: 'drill-entry.test.js',
  arch: [
    { label: 'daemon 不拼折叠/省略文案', pattern: '等 |等$|折叠', target: 'src/daemon/drill.js', expect: 'zero' },
  ],
  literals: [
    "'服务 T-001 等 3 个'", "'宿主 dsh cursor'", "'3 个活跃会话'",
    'app.state().drillView.roleBar.servingFolded, true',
    'app.state().drillView.roleBar.servingNodes.length, 3',
    "'角色栏 测试'", "'0 个活跃会话'", "lastAction: { nodeId: 'T-010'", '最近 T-010 · 轮次 1/1 · ',
    'app.state().drillView.roleBar.hostIcons, []',
    "'角色栏 协调者'", 'lastAction: null', 'app.state().drillView.roleBar.lastAction, null',
  ],
  notes: [
    'Then 逐字：第 4 行「服务 T-001 等 3 个 · 宿主 dsh cursor」、第 2 行「测试 · 可用 · 0 个活跃会话 · 服务 — · 宿主 — · 最近 T-010 · 轮次 1/1 · 待执行」、第 3 行「协调者 · 未参与 · 0 个活跃会话 · 服务 — · 宿主 — · 最近 —」，无 undefined/null/空字段。',
    '夹具不手写状态词与整行：折叠与占位只在渲染层，daemon 只下发 servingNodes[]/hostIcons[] 结构化字段。',
  ],
})];
