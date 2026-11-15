// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v4 §3.1 AC-23。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-23",
  "title": "异常高亮：角标 + 红色脉冲，尺寸与坐标不变",
  "face": "功能 / 视觉 / 边界",
  "level": "mock 实测",
  "refs": "BR-13, BR-11",
  "risk": "高（脉动若改尺寸会引发重排）",
  "given": "一个角色节点从正常变为“身上有已升级节点”，一条连接线从已完成变为已拒绝。",
  "when": "前后各渲染一次。",
  "then": [
    "角色节点出现红色角标与 `pulse` 动画 token，宽度与高度与变化前相等，坐标相等；连接线变为红色实线 + 回流箭头；其它节点坐标不变。"
  ],
  "judgement": "",
  "jijian": "`test/wp13/abnormal-style.test.js` 断言 `width/height/x/y` 四项相等、`visual.animation === 'pulse'`、`visual.badge === 'escalated'`、连接线 `color === 'red'` 且 `arrow === 'back'`。",
  "fixture": "两份图数据（仅异常状态不同）。",
  "archText": "脉冲只能是 CSS/变换层效果，不得改变节点几何尺寸常量。",
  "files": [
    "abnormal-style.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"pulse\" desktop/ui/graph/style.js",
      "expect": 0,
      "note": "脉冲是 CSS/变换层 token，不改几何尺寸常量"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-23"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
