// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-12。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-12",
  "title": "角色节点折叠规则：服务节点超 2 个、活跃会话大于 1",
  "face": "功能 / 边界",
  "level": "mock 实测",
  "refs": "BR-09",
  "risk": "中（不折叠会把节点撑爆）",
  "given": "一个角色服务 3 个节点、3 条活跃会话、单宿主 `mock`。",
  "when": "渲染。",
  "then": [
    "服务节点显示“服务 T-001 等 3 个”；活跃会话显示“3 个活跃会话”并带 `×3` 堆叠角标；宿主显示 `mock`；节点宽度与只有一个服务节点时一致（不因内容变宽）。"
  ],
  "judgement": "",
  "jijian": "`test/wp13/role-node.test.js` 断言文本与附录 A-9 的折叠示例逐字相等、`visual.sessionStack === 3`、`width === 180`（布局常量见附录 D-4）。",
  "fixture": "快照构造。",
  "archText": "折叠只发生在渲染层，不改图数据。",
  "files": [
    "role-node.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"saveState|emit\\(\" desktop/ui/graph/",
      "expect": 1,
      "note": "折叠只发生在渲染层，不改图数据"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-12"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
