// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-10。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-10",
  "title": "会话状态变化只走指示器：不重排、不动版本号",
  "face": "功能 / 节流 / 边界",
  "level": "mock 实测",
  "refs": "BR-19, BR-20",
  "risk": "中（做错会让流程图一直抖）",
  "given": "同 AC-07 的实例，记下所有节点坐标、尺寸与当前图快照的 `rev`。",
  "when": "200ms 内让某角色的会话状态连续变化 5 次（空闲 → 执行中 → 调用工具中 → 执行中 → 空闲），期间不改节点状态。",
  "then": [
    "图不重绘：没有任何角色更新或连接线更新帧；只有指示器类事件（≤5 帧）；所有节点坐标与尺寸逐项不变（不重排）；界面不出现闪烁或跳动。"
  ],
  "judgement": "",
  "jijian": "`NODE_ENV=test node --test test/wp13/graph-throttle.test.js` 断言 `rev_before === rev_after`、`roleFrames === 0`、`connectionFrames === 0`、`indicatorFrames ≤ 5`，并用两帧布局导出的坐标与尺寸做逐项相等比较；`# fail 0`。",
  "fixture": "`POST /__test__/graph/pulse` 的 `kind: \"session\"` 分支。",
  "archText": "会话事件不得进入“图版本号白名单”（白名单见附录 D-3）；`src/daemon/graph.js` 中版本号只由节点/交接包/升级/实例状态事件推进。",
  "files": [
    "graph-throttle.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"REV_WHITELIST\" src/daemon/graph.js",
      "expect": 0,
      "note": "版本号白名单存在"
    },
    {
      "cmd": "grep -REn \"'session'|'execution'|'health'\" src/daemon/graph.js",
      "expect": 1,
      "note": "白名单数组不含 session / execution / health 字面量（注释里用反引号说明排除语义，故只扫带引号的数组成员）"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-10"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
