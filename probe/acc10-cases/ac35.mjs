// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v4 §3.1 AC-35。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-35",
  "title": "看板未知状态落「被阻塞」并标注「状态未知」",
  "face": "功能 / 边界",
  "level": "mock 实测",
  "refs": "BR-30, BR-17",
  "risk": "中（旧数据的未知状态不能丢卡片）",
  "given": "`/tmp/maestro-i10a-board-x` 项目根的实例有 3 个节点：状态分别为执行中、已完成、以及一个不在九态映射内的历史值（夹具在 `state.json` 写入 `\"status\": \"mystery\"`，`schemaVersion` 仍为 2）；`NODE_ENV=test`。",
  "when": "切到“节点看板”；再切回“流程图”。",
  "then": [
    "7 列照常显示；“执行中”落在执行中列、“已完成”落在已完成列；未知节点卡片出现在“被阻塞”列并标注“状态未知”（附录 A-12），不丢卡片、不崩溃；切回流程图后界面照常可用。"
  ],
  "judgement": "",
  "jijian": "`test -f test/wp13/board-unknown.test.js && NODE_ENV=test node --test test/wp13/board-unknown.test.js`，断言未知节点 `column === 'blocked'`、卡片标注含 `状态未知`、卡片总数 = 3、切回后视图状态对象不变；`# pass ≥ 1`、`# fail 0`。",
  "fixture": "快照直接写入非法状态值（先起核再写盘，顺序同 §3.3）；看板投影经 `desktop/harness/board-dump.mjs` 导出。",
  "archText": "未知状态不进入任何状态机改写，只影响看板投影；映射函数对未知值有显式默认分支，不抛异常。",
  "files": [
    "board-unknown.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"default|未知\" desktop/ui/board/board.js",
      "expect": 0,
      "note": "未知状态有显式默认分支"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-35"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
