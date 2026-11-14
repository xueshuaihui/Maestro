// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-32。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-32",
  "title": "健康度悬停原因逐字复用 I1.9 八类，无原因只显「健康度 正常」",
  "face": "功能 / 文案基线",
  "level": "mock 实测",
  "refs": "BR-26, BR-23",
  "risk": "中（自造原因句会让用户看到 CLI 里不存在的解释）",
  "given": "`/tmp/maestro-i10a-health` 项目根里 9 个实例：8 个分别按附录 A-7 的八类原因构造 `state.health`（`level` + `reasons`：待处理升级、节点超时、会话崩溃、角色不可用、连接线已拒绝、连接线已过期、慢-超过 P90、慢-交接包 TTL），1 个 `level: normal` 且 `reasons` 为空；`NODE_ENV=test`；快照夹具按 §3.3 的“先起核再写盘”顺序构造。",
  "when": "打开实例列表，逐行把鼠标停在健康度档位上；再停在“正常”实例的健康度上，然后移开。",
  "then": [
    "前八行悬停浮层逐字等于附录 A-7 对应行（可变值按 A-0 替换）；“正常”实例悬停只显示 `健康度 正常`，没有自造句；移开后浮层消失且行内容不变。"
  ],
  "judgement": "",
  "jijian": "`test -f test/wp13/health-hover.test.js && NODE_ENV=test node --test test/wp13/health-hover.test.js`，用 harness 对 9 行分别导出悬停态文本，断言 8 条与附录 A-7 逐字相等、第 9 条为 `健康度 正常`；并断言原因句由 `GET /ui/labels` 的 `HEALTH_LINE`/`HEALTH_REASON` 模板与接口返回的 `health.reasons` 参数渲染，`# pass ≥ 1`、`# fail 0`。",
  "fixture": "9 份 `state.json` 的 `health.level` / `health.reasons` 按附录 D-8 口径直接取 I1.9 既有判定结果，不在夹具里重算；harness 用 `desktop/harness/collect.mjs` 取列表数据。",
  "archText": "悬停原因只透传 `health.reasons` 原文，不得在界面层重算或拼接；`grep -REn \"P90|TTL|崩溃\" desktop/ui/` 必须**零命中（exit 1）**。",
  "files": [
    "health-hover.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"P90|TTL|崩溃\" desktop/ui/",
      "expect": 1,
      "note": "悬停原因只透传 health.reasons，不重算、不拼接"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-32"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
