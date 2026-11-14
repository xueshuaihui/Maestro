// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-21。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-21",
  "title": "双击聚焦 2 跳，Esc 退出",
  "face": "功能 / 交互",
  "level": "mock 实测",
  "refs": "BR-14",
  "risk": "中（聚焦错跳数会让人以为图丢了节点）",
  "given": "一条链 A→B→C→D→E，外加 A→E 一条边。",
  "when": "双击 C。",
  "then": [
    "可见节点恰为 B、C、D 三个；可见边只有两端都可见的那些；标题为“聚焦 C（2 跳）”；按 Esc 后恢复 5 个节点与全部边。"
  ],
  "judgement": "",
  "jijian": "`test/wp13/focus-mode.test.js` 断言可见集合为 `['B','C','D']`、边集合为两端可见的边、退出后恢复全集。",
  "fixture": "纯图数据。",
  "archText": "聚焦只过滤可见集合，不修改布局坐标（聚焦退出后位置不变）。",
  "files": [
    "focus-mode.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"focus|visible\" desktop/ui/graph/view.js",
      "expect": 0,
      "note": "聚焦只过滤可见集合"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-21"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
