// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-06。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-06",
  "title": "新建实例的校验与失败提示",
  "face": "功能 / 异常",
  "level": "mock 实测",
  "refs": "BR-07, BR-24",
  "risk": "中（提示不明确会让人以为应用卡死）",
  "given": "同 AC-05 的面板；另备一份宿主启动失败现场（`.orch/hosts/mock.json` 的 `launch.command` 指向不存在的解释器，等价于宿主拉起失败）。",
  "when": "依次：不选工作流直接点启动；选“单节点”但任务说明留空点启动；选“编码闭环”、任务说明只写 `实现 calc.js`（缺“产物：”行）点启动；最后在启动失败现场选“单节点”、填好任务说明后点启动。",
  "then": [
    "前三次分别显示“请选择工作流”“请填写任务说明”、以及既有编码闭环缺产物行的原文（逐字见附录 A-5）；第四次显示 `启动失败 · <既有错误原文>`（逐字见附录 A-5 最后一条），列表实例数不变。面板每次都不关闭，界面仍可继续操作；第三、四次都没有产生实例。"
  ],
  "judgement": "",
  "jijian": "`test -f test/wp13/new-instance.test.js && NODE_ENV=test node --test test/wp13/new-instance.test.js` 断言四条提示逐字等于预期（前三次为 A-5 校验行、第四次为 `启动失败 · <既有错误原文>` 形态）、面板 `open === true`、实例数不变、无堆栈输出。",
  "fixture": "同一项目根，四次操作后 `GET /instances` 计数相等；启动失败现场经 `--host mock` 的坏 `launch.command` 构造。",
  "archText": "错误文案只从 `labels.js` 的 `ERROR_TEMPLATE` 取，界面层不得硬编码中文。",
  "files": [
    "new-instance.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"[一-龥]\" desktop/ui/",
      "expect": 1,
      "note": "错误文案只从 labels.js / /ui/labels 取，界面层零中文字面量"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-06"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
