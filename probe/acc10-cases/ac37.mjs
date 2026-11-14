// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-37。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-37",
  "title": "角色与连接线同时变化互不阻塞、都不丢",
  "face": "功能 / 节流 / 实时",
  "level": "mock 实测",
  "refs": "BR-32, BR-19",
  "risk": "中（互不阻塞是基线推送节流规则的一部分）",
  "given": "同 AC-07 的实例已进入流程图，推送通道已连上；`NODE_ENV=test`。",
  "when": "在同一 1 秒窗口内用测试接缝先触发一次角色状态变化（`POST /__test__/graph/pulse` 的 `kind: \"role\"`），再在 200ms 内触发 5 次连接线变化（`kind: \"connection\"`、`count: 5`、`intervalMs: 40`），随后静默等待 1.5 秒。",
  "then": [
    "角色更新帧在 500ms 内到达，不被连接线合并窗口阻塞；连接线帧在窗口结束时合并为恰好 1 帧到达、值为最后一次状态；两类帧都到达、都不丢；界面上角色先变为新颜色，1 秒后连接线刷出最终态。"
  ],
  "judgement": "",
  "jijian": "`test -f test/wp13/graph-parallel.test.js && NODE_ENV=test node --test test/wp13/graph-parallel.test.js`，断言 `roleFrames === 1` 且 `t_role - t_trigger ≤ 500ms`、`connectionFrames === 1` 且聚合状态为最后一次的值、`t_conn - t_trigger ≤ 1200ms`；`# pass ≥ 1`、`# fail 0`。",
  "fixture": "服务端测试接缝见 §3.3（仅 `NODE_ENV=test` 注册的 `POST /__test__/graph/pulse`）。",
  "archText": "角色推送与连接线合并调度器互不共享队列；合并调度器仍为可注入时钟的纯调度器（同 AC-09）。",
  "files": [
    "graph-parallel.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"now\" src/daemon/http/stream.js",
      "expect": 0,
      "note": "合并调度器仍为可注入时钟的纯调度器（同 AC-09）"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-37"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
