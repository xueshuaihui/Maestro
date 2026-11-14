// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-20。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-20",
  "title": "缩放平移与一键复位",
  "face": "功能 / 交互",
  "level": "mock 实测",
  "refs": "BR-14",
  "risk": "中",
  "given": "一张已渲染的图，缩放 100%、平移 (0,0)。",
  "when": "缩放到 150%、平移到 (+120, -40)；再点“复位视图”；再尝试缩到 10% 与 300%。",
  "then": [
    "150% 时节点屏幕宽为 270（180×1.5），布局坐标不变；复位后缩放 100%、平移 (0,0)、拖拽偏移为 0；尝试 10% 被夹到 50%，尝试 300% 被夹到 200%。"
  ],
  "judgement": "",
  "jijian": "`test/wp13/view-state.test.js` 断言 `zoom`、`pan`、屏幕尺寸换算与夹取边界（0.5 / 2.0）。",
  "fixture": "纯视图状态模块，不依赖接口。",
  "archText": "缩放只影响变换矩阵，不回写布局坐标。",
  "files": [
    "view-state.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"saveState|writeFile\" desktop/ui/graph/view.js",
      "expect": 1,
      "note": "缩放只影响变换矩阵，不回写布局坐标"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-20"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
