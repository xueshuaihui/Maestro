// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-13。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-13",
  "title": "特殊节点：人工、升级、子工作流的视觉与标签",
  "face": "功能",
  "level": "mock 实测",
  "refs": "BR-10",
  "risk": "高（缺一个就不算“拓扑完整”）",
  "given": "一个人工节点（标题“人工验收”、状态待执行）、一个升级节点（标题“人工裁决”、状态已升级）、一个子工作流节点（标题“发布子流程”、内部 3 个角色）。",
  "when": "渲染。",
  "then": [
    "三者逐字为附录 A-10 的三行；人工节点视觉 token 为灰色盾牌；升级节点为红色感叹号并带脉冲；子工作流为折叠组并标注“3 角色”（整行含全角冒号：“子工作流：发布子流程 · 3 角色”）。"
  ],
  "judgement": "",
  "jijian": "`test/wp13/special-node.test.js` 断言三行文本逐字、`visual.shape` 分别为 `shield`/`alert`/`group`、`visual.color` 分别为 `gray`/`red`/`green`（子工作流内部无升级时）。",
  "fixture": "工作流定义 + 快照；子工作流 `workflow` 指向一个声明的子工作流资产。",
  "archText": "特殊节点类型只从定义层 `node_type` 读，不得按标题文本猜类型。",
  "files": [
    "special-node.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"node_type|nodeType\" src/daemon/graph.js",
      "expect": 0,
      "note": "特殊节点类型只从定义层 node_type 读"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-13"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
