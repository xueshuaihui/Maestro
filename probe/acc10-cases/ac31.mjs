// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v4 §3.1 AC-31。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-31",
  "title": "项目未指定 / 项目不可用：停在提示页，填入可用目录后进入列表",
  "face": "功能 / 异常 / 首次体验",
  "level": "mock 实测",
  "refs": "BR-25, BR-24",
  "risk": "高（首次启动的第一屏，无项目根就无法取任何实例）",
  "given": "两个现场共用配置目录思路：现场一 `MAESTRO_CONFIG_DIR=/tmp/maestro-i10a-proj/config`（目录为空、无 `projects.json`）且**不带** `--project` 启动；现场二带 `--project /tmp/maestro-i10a-proj/nope`（不存在的目录）启动；`NODE_ENV=test`；宿主仍为 mock（本 AC 不取实例，宿主配置不参与判定）。",
  "when": "分别双击启动应用（等价命令见夹具），等待主窗口出现；随后在现场一写入“已记住的项目根”（`projects.json` 指向 `/tmp/maestro-i10a-proj`）并再次启动。",
  "then": [
    "现场一主窗口停在提示页，逐字显示“项目 未指定 · 请填写项目目录”（附录 A-3），不出现实例列表、不崩溃；现场二逐字显示“项目 不可用 · /tmp/maestro-i10a-proj/nope”（可变值按 A-0 替换为夹具实际路径），不崩溃；写入记住的项目根后第三次启动直接进入实例列表。"
  ],
  "judgement": "",
  "jijian": "`cd \"$MAESTRO_REPO\" && test -f test/wp13/project-guard.test.js && NODE_ENV=test node --test test/wp13/project-guard.test.js`，断言三次探针的 `view` 分别为 `project-missing` / `project-invalid` / `instances`，前两次提示文本与附录 A-3 逐字相等、窗口 `visible === true`、探针无未捕获异常事件；`# pass ≥ 1`、`# fail 0`。",
  "fixture": "`open -na \"$MAESTRO_REPO/desktop/src-tauri/target/release/bundle/macos/Maestro.app\" --args --probe /tmp/maestro-i10a-proj/probe.json --ctl /tmp/maestro-i10a-proj/ctl`（现场一）；现场二追加 `--project /tmp/maestro-i10a-proj/nope`；`projects.json` 由夹具直接写入配置目录；探针轮询同 §3.3。",
  "archText": "项目提示文案只从 `labels.js` 的 `DESKTOP_PROJECT_MISSING` / `DESKTOP_PROJECT_INVALID` 取；`grep -REn \"项目 未指定|项目 不可用\" desktop/ui desktop/harness` 必须**零命中（exit 1）**（含中文的扫描走 `grep -RE`，见判定口径 4）。",
  "files": [
    "project-guard.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"项目 未指定|项目 不可用\" desktop/ui desktop/harness",
      "expect": 1,
      "note": "提示文案只从 labels.js 取"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-31"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
