// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v4 §3.1 AC-15。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-15",
  "title": "连接线 7 种聚合状态的视觉编码",
  "face": "功能 / 视觉编码",
  "level": "mock 实测",
  "refs": "BR-11",
  "risk": "高（7 态是基线的硬约定）",
  "given": "一张图上有 7 条连接线，分别处于已拒绝、已过期、待投递、已投递、已接受、已完成、未开始。",
  "when": "默认渲染；然后打开“显示未开始连接线”。",
  "then": [
    "默认只显示前 6 条，未开始的 1 条隐藏；每条的视觉 token 与附录 A-11 的表逐项相等（颜色、虚实、箭头、动画、角标）；打开开关后第 7 条以灰色虚线出现。"
  ],
  "judgement": "",
  "jijian": "`test/wp13/edge-visual.test.js` 断言 6 条的 token 表逐项相等、`not_started` 默认 `hidden === true`、开开关后 `hidden === false`。",
  "fixture": "快照里写 7 条交接包，分别落在 7 个状态上。",
  "archText": "颜色/虚实/动画只由聚合状态映射，不由界面按连接线数量或位置推断。",
  "files": [
    "edge-visual.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"aggregateStatus\" desktop/ui/graph/edge-rows.js",
      "expect": 0,
      "note": "视觉 token 只由聚合状态映射"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-15"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
