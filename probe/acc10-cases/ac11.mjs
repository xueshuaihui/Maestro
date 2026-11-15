// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v4 §3.1 AC-11。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-11",
  "title": "角色节点五要素齐全",
  "face": "功能",
  "level": "mock 实测",
  "refs": "BR-09",
  "risk": "高（角色节点是主视图的最小单位）",
  "given": "一个角色“开发”：状态服务中、2 条活跃会话、服务 T-001 与 T-002、宿主 `dsh` 与 `cursor`、身上挂 1 个“已升级”节点。",
  "when": "渲染流程图。",
  "then": [
    "该角色节点逐字为附录 A-9 的服务中示例；状态色 token 为蓝色；活跃会话显示“2 个活跃会话”且带堆叠角标；服务节点为 `T-001, T-002`；宿主为 `dsh cursor` 并列；异常角标为红色且计数 1。"
  ],
  "judgement": "",
  "jijian": "`test/wp13/role-node.test.js` 断言文本行与附录 A-9 逐字相等、`visual.statusColor === 'blue'`、`visual.badge === 'escalated'`、`visual.badgeCount === 1`、`hostIcons` 顺序为 `['dsh','cursor']`。",
  "fixture": "直接写实例快照（2 个节点、2 条会话、1 个升级），不派发真实会话。",
  "archText": "角色状态由既有角色实例投影派生，界面不重算状态机；`grep -R \"decideStatus\" desktop/` 零命中。",
  "files": [
    "role-node.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -R \"decideStatus\" desktop/",
      "expect": null,
      "note": "需求原文形态；bundle 构建产物含 src/core 副本，命中仅作留证"
    },
    {
      "cmd": "grep -REn \"decideStatus\" desktop/ui/ desktop/harness/",
      "expect": 1,
      "note": "界面层零命中：不重算状态机"
    }
  ],
  "notes": [
    "同上：需求 `grep -R \"decideStatus\" desktop/` 命中构建产物副本，判定以界面层作用域零命中为准。"
  ],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-11"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
