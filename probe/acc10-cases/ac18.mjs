// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-18。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-18",
  "title": "异常置顶不破坏布局",
  "face": "功能 / 布局 / 边界",
  "level": "mock 实测",
  "refs": "BR-13, BR-12",
  "risk": "高（“置顶”若实现成“挪到最上面”会打乱拓扑）",
  "given": "AC-17 的同一张图，B 为正常状态；再构造一份只有 B 变为“已升级”的图。",
  "when": "分别布局并比较。",
  "then": [
    "B 的 x、y、宽度、高度四项完全不变；B 的层级 z 从 0 变为 1；其它所有节点的 x、y 不变；与 B 相连的边 z 也提升；异常解除后 z 回到 0 且坐标仍不变。"
  ],
  "judgement": "",
  "jijian": "`test/wp13/graph-layout.test.js` 对两份布局做逐节点 diff：坐标与尺寸差集为空、`z` 差集为 `{B: 1}`。",
  "fixture": "两份图数据（仅 B 的状态不同）。",
  "archText": "异常态不得进入层号/坐标计算；`layout.js` 中 z 只由 `abnormal` 决定。",
  "files": [
    "graph-layout.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"abnormal\" desktop/ui/graph/layout.js",
      "expect": 0,
      "note": "z 只由 abnormal 决定，不进入层号/坐标计算"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-18"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
