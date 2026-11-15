// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v4 §3.1 AC-36。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-36",
  "title": "重复双击单实例，托盘「打开主窗口」激活已有窗口",
  "face": "功能 / 桌面壳",
  "level": "mock 实测",
  "refs": "BR-31, BR-01",
  "risk": "中（双开会让用户面对两份界面、误以为状态不同步）",
  "given": "`/tmp/maestro-i10a-single` 项目根、mock 宿主；应用已启动、主窗口可见、守护进程运行中；已记录探针文件内容与守护进程进程号；`NODE_ENV=test`。",
  "when": "再次执行与启动等价的 `open -na .../Maestro.app --args ...`（模拟重复双击）；随后向 `--ctl` 目录写入 `tray-open` 触发托盘“打开主窗口”（先经 `close-window` 把窗口隐藏）。",
  "then": [
    "第二次启动不产生第二个窗口、不产生第二个守护进程：探针不出现第二个 `ready` 事件、守护进程 `pid` 前后相等，已有窗口被激活到前台（探针记录 `activated`）；窗口隐藏后经 `tray-open` 打开，探针出现 `visible=true` 且视图仍为实例列表。"
  ],
  "judgement": "",
  "jijian": "`test -f test/wp13/single-instance.test.js && NODE_ENV=test node --test test/wp13/single-instance.test.js`，断言第二次启动后探针无第二个 `ready`、出现 `activated`、`daemon.pid` 前后相等；`tray-open` 后探针出现 `{\"event\":\"tray-open\",\"window\":{\"visible\":true}}`；`# pass ≥ 1`、`# fail 0`。",
  "fixture": "两次 `open -na .../Maestro.app --args --project /tmp/maestro-i10a-single --probe ... --ctl ...`（探针文件为追加式，同一份）；`ctl/close-window` 与 `ctl/tray-open` 文件触发（接缝见 §3.3）。",
  "archText": "单实例用应用级锁实现；第二次启动进程在激活既有窗口后自行退出，不初始化第二份守护进程连接。",
  "files": [
    "single-instance.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"SingleInstance|single_instance|activate\" desktop/src-tauri/src/",
      "expect": 0,
      "note": "单实例用应用级锁；二次启动激活已有窗口"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-36"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
