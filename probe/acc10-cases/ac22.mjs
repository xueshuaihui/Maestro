// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-22。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-22",
  "title": "手动拖拽按实例保存，且不写实例状态",
  "face": "功能 / 持久化 / 只读",
  "level": "mock 实测（结构断言）",
  "refs": "BR-16, BR-20",
  "risk": "中（写错目录会污染实例状态）",
  "given": "`/tmp/maestro-i10a-drag` 的实例有三个角色节点；记下 `state.json` 与 `events.jsonl` 的字节哈希。",
  "when": "把 B 拖动 (+40, +60)，重新打开该实例的流程图；再打开另一个实例的流程图。",
  "then": [
    "B 的坐标为“基础坐标 + (40, 60)”；另一个实例不受影响；视图偏好写在 `.orch/desktop/views/INST-001.json`；实例的 `state.json` 与 `events.jsonl` 字节哈希运行前后完全相同。"
  ],
  "judgement": "",
  "jijian": "`test/wp13/view-state.test.js` 断言偏移文件内容、重开后坐标、另一实例坐标不变、两份文件哈希相等。",
  "fixture": "两个实例项目根；拖拽通过视图状态模块完成（等价于界面拖拽结束时的写入）。",
  "archText": "视图偏好只写 `.orch/desktop/views/`；`grep -REn \"instanceDir|statePath\" desktop/ui/` 必须**零命中（exit 1）**。",
  "files": [
    "view-state.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"instanceDir|statePath\" desktop/ui/",
      "expect": 1,
      "note": "视图偏好只写 .orch/desktop/views/"
    },
    {
      "cmd": "grep -REn \"views\" desktop/src-tauri/src/config.rs",
      "expect": 0,
      "note": "写入端路径常量（R-12：结构断言补证）"
    }
  ],
  "notes": [
    "R-12：B-36 真实壳内拖拽仍为结构断言（写入端 config.rs 零窗口级自动化用例）。本条按「mock 实测（结构断言）」判定，不冒充真实宿主实测；S3 以 view-state.test.js + config.rs 路径常量补结构证据。"
  ],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-22"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
