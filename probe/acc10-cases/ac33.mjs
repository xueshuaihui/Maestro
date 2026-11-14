// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-33。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-33",
  "title": "悬停高亮：角色节点上下游与连接线两端",
  "face": "功能 / 交互",
  "level": "mock 实测",
  "refs": "BR-27, BR-28",
  "risk": "中（高亮错集合会误导排查方向）",
  "given": "`/tmp/maestro-i10a-hover` 项目根的一个实例（夹具构造快照），图上有节点 A、B、C、D 与边 A→B、B→C、C→D、D→B（回流）；流程图已打开并完整渲染；`NODE_ENV=test`。",
  "when": "鼠标悬停角色节点 B；移开；再悬停连接线 B→C；移开。",
  "then": [
    "悬停 B 时：B 的全部上下游连接线（A→B、B→C、D→B）与其两端节点（A、B、C、D）保持全不透明，其余元素降低不透明度；悬停连接线 B→C 时：该线与两端节点（B、C）保持全不透明，其余元素降低不透明度；两次移开后全部元素恢复默认不透明度；全程节点坐标与尺寸不变。"
  ],
  "judgement": "",
  "jijian": "`test -f test/wp13/hover-highlight.test.js && NODE_ENV=test node --test test/wp13/hover-highlight.test.js`，用与界面同一批渲染模块对四种状态（默认 / 悬停 B / 默认 / 悬停 B→C）导出可见元素的不透明度集合，断言两次悬停的“全不透明集合”分别等于上述集合、两次移开后恢复全集；`# pass ≥ 1`、`# fail 0`。",
  "fixture": "快照 + 图定义按附录 D-9 口径构造；渲染经 `desktop/harness/graph-dump.mjs` 同批模块导出，不依赖真实交互事件。",
  "archText": "高亮集合由图邻接关系派生，不按坐标邻近猜测；悬停不修改布局坐标、不写视图偏好。",
  "files": [
    "hover-highlight.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"Math[.]\" desktop/ui/graph/highlight.js",
      "expect": 1,
      "note": "高亮由邻接关系派生，模块零数学运算（不按坐标邻近猜测）"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-33"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
