// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-16。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-16",
  "title": "连接线聚合优先级、正向/回流分线、并行合并",
  "face": "功能 / 聚合",
  "level": "mock 实测",
  "refs": "BR-11",
  "risk": "中（优先级错会把已拒绝显示成已完成）",
  "given": "角色对“测试→开发”上有 3 个交接包（已拒绝、已接受、已完成），角色对“开发→测试”上有 2 个并行交接（均已投递）。",
  "when": "渲染。",
  "then": [
    "画布上“测试→开发”只有 1 条回流弧线，聚合状态为“已拒绝”；“开发→测试”只有 1 条正向线，标注“2 并行交接”；不存在第 3 条同向线。"
  ],
  "judgement": "",
  "jijian": "`test/wp13/edge-aggregate.test.js` 断言该角色对的边数 = 2、`backflow.aggregateStatus === 'rejected'`、`forward.parallelCount === 2`、`forward.label` 含“2 并行交接”；并以 7 个状态两两组合的表驱动断言优先级顺序。",
  "fixture": "快照（交接包 `edge.kind` 分别为 `backflow` / `forward`）。",
  "archText": "聚合必须复用基线优先级顺序常量，界面与核心各有一份时由测试锁定同一顺序。",
  "files": [
    "edge-aggregate.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"AGGREGATE_PRIORITY\" src/daemon/graph.js",
      "expect": 0,
      "note": "聚合复用基线优先级顺序常量"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-16"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
