// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v4 §3.1 AC-30。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-30",
  "title": "六种异常提示：实例不存在、定义不可读、角色数未知、守护进程未启动、重连中、状态不可读",
  "face": "功能 / 异常",
  "level": "mock 实测",
  "refs": "BR-24, BR-08",
  "risk": "中（异常静默会让人误以为数据就是这样）",
  "given": "六种现场各准备一份：`INST-999` 不存在；`INST-001` 的 `workflowRef` 指向不存在的文件；子工作流 `workflow` 指向不存在的资产；守护进程被停掉；推送连接被断开；某实例 `state.json` 损坏。",
  "when": "依次触发对应界面动作。",
  "then": [
    "依次显示：`实例 INST-999 · 不存在`；`流程图定义不可读 · 已按内置模板显示`；`子工作流 child-x · 角色数未知`；`连接守护进程失败 · 请确认项目目录后重试`；`已断开 · 正在重连…`；`实例 {id} · 状态不可读`。全部不白屏、不打印堆栈，界面仍可返回列表或重试。"
  ],
  "judgement": "",
  "jijian": "`test/wp13/errors.test.js` 逐条断言文本与行为（每条都断言“界面仍可继续操作”的探针状态）。",
  "fixture": "六份独立快照/进程状态，逐条构造。",
  "archText": "异常降级不得删除或跳过其它正常元素；图投影对未知定义按内置模板回退。",
  "files": [
    "errors.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"[一-龥]\" desktop/ui/",
      "expect": 1,
      "note": "异常文案不硬编码中文"
    },
    {
      "cmd": "grep -REn \"fallback|内置模板\" src/daemon/graph.js",
      "expect": 0,
      "note": "未知定义按内置模板回退"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-30"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
