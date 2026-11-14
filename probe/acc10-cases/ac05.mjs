// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v2 §3.1 AC-05。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-05",
  "title": "新建实例：选工作流 → 填任务说明 → 启动成功",
  "face": "功能",
  "level": "mock 实测",
  "refs": "BR-07, BR-06",
  "risk": "高（唯一会写状态的用户操作）",
  "given": "`/tmp/maestro-i10a-new` 已有一个可运行项目根，宿主配置为 mock，列表已打开，`NODE_ENV=test`。",
  "when": "点“新建实例”，选“编码闭环”，任务说明分两行填：第一行 `实现 calc.js`，第二行 `产物：calc.js`，点“启动”。",
  "then": [
    "面板关闭并出现“已启动 {id}”；2 秒内列表出现新行，阶段为“运行中”，工作流为“编码闭环”；该行与 CLI 用同样参数启动的实例逐字同构（同一套状态词、同一套健康度、同样的六项顺序），不出现界面临时拼出来的第二套写法。"
  ],
  "judgement": "",
  "jijian": "`test -f test/wp13/new-instance.test.js && NODE_ENV=test node --test test/wp13/new-instance.test.js` 断言启动回包成功、`GET /instances` 含新实例、渲染行与附录 A-1 模板匹配、2 秒内出现；并断言同一参数下 `node \"$MAESTRO_REPO/bin/orch.js\" instance status <id>` 的状态词与健康度词分别与界面行里的对应字段相等（逐词比较），本次操作只新增一个实例、无重复。",
  "fixture": "`POST /instances`（见附录 D-2）等价于 `NODE_ENV=test node \"$MAESTRO_REPO/bin/orch.js\" run --cwd . --template code-loop --host mock --task $'实现 calc.js\\n产物：calc.js'`（zsh 的 `$'…'` 会把 `\\n` 转成换行）；harness 从同一项目根取列表。",
  "archText": "新建实例必须复用既有 `run.start` 路径，不得在界面层重写启动逻辑；`grep -Rn \"startRun\" desktop/` 零命中（界面只能经接口）。",
  "files": [
    "new-instance.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -Rn \"startRun\" desktop/",
      "expect": null,
      "note": "需求原文形态；本机 bundle 构建产物内有产品源码副本，命中仅作留证"
    },
    {
      "cmd": "grep -REn \"startRun\" desktop/ui/ desktop/harness/",
      "expect": 1,
      "note": "界面层零命中：新建实例只能经接口，不得重写 run.start"
    }
  ],
  "notes": [
    "需求架构检查原文 `grep -Rn \"startRun\" desktop/` 在本机包含 bundle 构建产物（`desktop/src-tauri/target/**` 内为产品源码副本）；判定以界面层作用域 `desktop/ui/ desktop/harness/` 零命中为准，原文形态仅留证。"
  ],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-05"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
