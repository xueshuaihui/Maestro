// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-02。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-02",
  "title": "关闭主窗口缩到托盘，守护进程继续运行；托盘退出才停止",
  "face": "功能 / 桌面壳 / 规划验收",
  "level": "mock 实测",
  "refs": "BR-01, BR-20",
  "risk": "高（规划验收句第三段的直接判据）",
  "given": "同 AC-01 的窗口已打开，列表里有一个运行中的实例；记下守护进程进程号。",
  "when": "用户点击窗口关闭按钮；随后从托盘菜单选“退出”并在确认框里确认。",
  "then": [
    "关闭后：窗口消失、托盘图标仍在、后台守护进程继续运行——`orch instance status INST-001` 仍能读到该实例，且关闭前后能看到两个不同的 `updatedAt`（或一次真实的节点状态推进），不是停在旧快照上；托盘“退出”时先出现确认句（逐字附录 A-6），确认后后台停止（再执行 `instance status` 得到“核心未启动/连接失败”类提示），托盘消失。"
  ],
  "judgement": "",
  "jijian": "`test -f test/wp13/desktop-shell.test.js && NODE_ENV=test node --test test/wp13/desktop-shell.test.js` 断言探针事件序列为 `ready → close-window(visible=false) → tray-still-present(created=true) → quit-confirm-shown → quit(daemonStopped=true)`；关闭前后 `daemon.pid` 相等；关闭前后两次 `instance status` 的 `updatedAt` 不同（或节点状态至少推进一次）；退出后 `daemon.alive === false`；`# fail 0`。",
  "fixture": "`mkdir /tmp/maestro-i10a-shell/ctl/close-window` 触发关闭；读探针；`mkdir .../ctl/tray-quit` 触发退出；确认前再读一次探针确认出现确认句；`mkdir .../ctl/tray-quit-confirm` 确认。",
  "archText": "`grep -REn \"core[.]stop\" desktop/src-tauri/src/` 必须**恰好 1 条命中（exit 0）**，且该命中位于退出处理函数内（同一条命令加 `-B8` 时上下文里能看到 `fn quit`）；关闭窗口路径不得调用核心停止——由“关闭后 `daemon.pid` 不变”的行为断言兜底。",
  "files": [
    "desktop-shell.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"core[.]stop\" desktop/src-tauri/src/",
      "expect": 0,
      "lines": 1,
      "note": "恰好 1 条命中（exit 0）"
    },
    {
      "cmd": "grep -REn -B8 \"core[.]stop\" desktop/src-tauri/src/",
      "expect": 0,
      "contains": "fn quit",
      "note": "-B8 上下文可见退出处理函数 fn quit"
    },
    {
      "cmd": "grep -REn \"close-window|close_to_tray\" desktop/src-tauri/src/tray.rs",
      "expect": null,
      "note": "关窗路径不得调用核心停止（行为断言由契约测试兜底）"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-02"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
