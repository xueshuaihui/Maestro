// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-19。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-19",
  "title": "角色超过 12 个时按分组折叠，可展开/收起",
  "face": "功能 / 布局 / 折叠",
  "level": "mock 实测",
  "refs": "BR-15",
  "risk": "中（不折叠大图没法看）",
  "given": "一个实例有 13 个角色节点：8 个属于“编码工程”、5 个属于“研究分析”，两组之间有 1 条正向边。",
  "when": "渲染；然后展开“编码工程”组；再收起。",
  "then": [
    "默认只显示 2 个组节点，逐字为“分组 编码工程 · 8 角色”“分组 研究分析 · 5 角色”，13 个成员节点都不显示；组间 1 条边连接两个组节点；展开编码组后出现 8 个成员节点、研究组仍折叠；收起后恢复 2 个组节点。"
  ],
  "judgement": "",
  "jijian": "`test/wp13/graph-collapse.test.js` 断言三态的可见节点集合大小分别为 2 / 10 / 2、组节点标签逐字、边数在折叠态为 1；并断言折叠前后成员节点的层号不因折叠而改变（展开后仍在原层）。",
  "fixture": "`.orch/roles/*.yaml` 写 13 个角色（8 个 `group: coding`、5 个 `group: research`），工作流定义写 13 个角色节点与 1 条跨组边。",
  "archText": "分组键只取角色 `group`；缺失分组时统一落“未分组”，不得按角色 ID 猜。",
  "files": [
    "graph-collapse.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"group\" desktop/ui/graph/collapse.js",
      "expect": 0,
      "note": "分组键只取角色 group"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-19"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
