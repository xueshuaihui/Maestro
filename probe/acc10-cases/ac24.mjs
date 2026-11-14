// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-24。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-24",
  "title": "节点看板作为可选切换，7 列只读",
  "face": "功能 / 视图切换",
  "level": "mock 实测",
  "refs": "BR-17, BR-23",
  "risk": "中（列映射错会让人误判任务卡在哪）",
  "given": "一个实例节点状态为：2 个待执行（其中 1 个上游未完成）、1 个执行中、1 个待校验、2 个已完成、1 个失败、1 个已升级、2 个已取消。",
  "when": "切到“节点看板”，再切回“流程图”。",
  "then": [
    "7 列顺序固定为“被阻塞 可调度 执行中 待校验 已完成 失败 已升级”；待执行且上游未完成的落在“被阻塞”、另一个落在“可调度”；2 个已取消折入“已完成”列并显示“已取消 2”；切回流程图后缩放、平移、拖拽偏移、折叠状态都保持。"
  ],
  "judgement": "",
  "jijian": "`test/wp13/board.test.js` 断言列名数组、每列卡片 ID 集合、折叠标记“已取消 2”，以及切回前后视图状态对象逐字段相等。",
  "fixture": "快照 + 纯投影；拖拽偏移与缩放先通过视图状态模块设置。",
  "archText": "看板列只由“节点状态 + 上游是否全部完成”派生，不新增状态字段。",
  "files": [
    "board.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"column|blocked\" desktop/ui/board/board.js",
      "expect": 0,
      "note": "看板列由状态 + 上游完成度派生"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-24"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
