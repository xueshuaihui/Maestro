// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v4 §3.1 AC-04。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-04",
  "title": "列表的空态、不可读行与实时增减",
  "face": "功能 / 边界",
  "level": "mock 实测",
  "refs": "BR-05, BR-06, BR-24",
  "risk": "中（空态与坏数据是最常见的首次体验）",
  "given": "三个阶段共用一个项目根 `/tmp/maestro-i10a-list-live`：阶段一没有任何实例；阶段二写入一个 `state.json` 损坏的实例；阶段三用 `--host mock` 启动一个单节点实例。`NODE_ENV=test`。",
  "when": "依次：打开列表；写入损坏实例后等待 2 秒；启动新实例后等待 2 秒。",
  "then": [
    "阶段一显示“实例 无”；阶段二多出一行“实例 {id} · 状态不可读”，其余行不变；阶段三新实例行在 2 秒内出现、阶段为“运行中”，期间没有点过任何刷新控件。"
  ],
  "judgement": "",
  "jijian": "`test/wp13/instance-list.test.js` 断言三次渲染结果分别等于附录 A-2 的空态行、含不可读行、含新行；并断言新行的出现由 `instances.changed` 推送触发（探针记录 `refetch` 次数），而不是定时轮询（2 秒内 `refetch ≥ 1` 且无周期性重复）。",
  "fixture": "`cd /tmp/maestro-i10a-list-live && NODE_ENV=test node \"$MAESTRO_REPO/bin/orch.js\" run --cwd . --template single --host mock --task \"写一份说明\"`；损坏实例通过写入非法 `state.json` 构造。",
  "archText": "不可读实例的渲染复用既有 `renderInstanceUnreadable` 的文案，不新造第二套。",
  "files": [
    "instance-list.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"renderListUnreadable\" desktop/ui/list/list.js",
      "expect": 0,
      "note": "不可读行复用既有渲染函数（需求写作 renderInstanceUnreadable，实现导出名为 renderListUnreadable）"
    },
    {
      "cmd": "grep -REn \"状态不可读\" desktop/ui/list/",
      "expect": 1,
      "note": "界面层不得硬编码中文（走 /ui/labels）"
    }
  ],
  "notes": [
    "R-08 已登记的时序竞态基线项；单文件机检若失败，须保留全部 attempt 原始帧并在 blockers 台账登记，不得改断言。"
  ],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-04"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
