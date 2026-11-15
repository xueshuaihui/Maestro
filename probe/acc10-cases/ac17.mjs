// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v4 §3.1 AC-17。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-17",
  "title": "层次布局：同层并行、回流不改层次、坐标稳定",
  "face": "功能 / 布局",
  "level": "mock 实测",
  "refs": "BR-12",
  "risk": "高（布局是“图能不能读”的基础）",
  "given": "一个纯图数据（不经接口）：A→B、A→C、B→D、D→B（回流）、C→D。",
  "when": "连续布局两次。",
  "then": [
    "层号 A=0、B=1、C=1、D=2；A 的 x=0、B/C 的 x=240、D 的 x=480；B 与 C 的 y 不同；回流 D→B 不把 B 推到第 2 层，且该边 `path.kind === 'arc'`；两次布局输出的坐标逐字节相同。"
  ],
  "judgement": "",
  "jijian": "`test/wp13/graph-layout.test.js` 断言层号、x/y、`path.kind`，并对两次 `JSON.stringify(layout)` 做字节相等比较。",
  "fixture": "`desktop/harness/layout-dump.mjs --payload /tmp/maestro-i10a-layout/graph.json`，图数据由夹具直接提供（不依赖守护进程）。",
  "archText": "布局是纯函数，不读文件、不取系统时间；`grep -REn \"Date[.]now|fs[.]\" desktop/ui/graph/layout.js` 必须**零命中（exit 1）**。",
  "files": [
    "graph-layout.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"Date[.]now|fs[.]\" desktop/ui/graph/layout.js",
      "expect": 1,
      "note": "布局是纯函数：不读文件、不取系统时间"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-17"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
