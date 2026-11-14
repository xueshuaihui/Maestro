// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-09。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-09",
  "title": "连接线合并：1 秒内 5 次变化只推 1 次、且是最后一次",
  "face": "功能 / 节流",
  "level": "mock 实测",
  "refs": "BR-19",
  "risk": "高（不合并会刷屏，合并错会显示旧状态）",
  "given": "图上只有一条连接线（边 ID `E-01`，两端为开发与测试），当前聚合状态为“已投递”。",
  "when": "用测试接缝在 200ms 内依次把它改成已接受、待投递、已拒绝、已完成、已过期（5 次），随后静默等待 1.5 秒。",
  "then": [
    "推送通道在这 1.5 秒内只为这条线送 **1 帧**连接线更新；帧里的聚合状态是最后一次的“已过期”；界面上该线变为橙色虚线 + 感叹号，没有出现五次闪烁。"
  ],
  "judgement": "",
  "jijian": "`test/wp13/graph-throttle.test.js` 断言 `frames.filter(f => f.type==='connection.updated' && f.key==='E-01').length === 1`、该帧 `aggregateStatus === 'expired'`；并断言窗口从第一次变更起算、长度 1000ms（第二次变更不会把窗口往后推）。",
  "fixture": "`POST /__test__/graph/pulse` 的 `kind: \"connection\"` 分支，`count: 5`、`intervalMs: 40`。",
  "archText": "合并实现必须是可注入时钟的纯调度器（`now` 参数），单测注入固定时钟覆盖窗口边界；不得用 `setTimeout` 硬等。",
  "files": [
    "graph-throttle.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"setTimeout\" src/daemon/http/stream.js",
      "expect": null,
      "note": "调度器内部定时器留证；窗口边界由注入时钟单测覆盖"
    },
    {
      "cmd": "grep -REn \"now\" src/daemon/http/stream.js",
      "expect": 0,
      "note": "合并调度器 now 可注入"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-09"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
