// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v4 §3.1 AC-28。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-28",
  "title": "非功能：零依赖、中文唯一来源、纯净扫描、无宿主分支",
  "face": "非功能 / 架构",
  "level": "mock 实测",
  "refs": "BR-21, BR-22",
  "risk": "高（违反即阻断合入）",
  "given": "本迭代实现完成，`NODE_ENV=test`。",
  "when": "检查依赖、中文来源、禁词扫描与宿主分支。",
  "then": [
    "`dependencies` 仍为 `{}`；桌面界面层无任何中文字面量，`GET /ui/labels` 返回界面用到的全部文案键；`src/core` / `src/daemon` 仍零命中 31 词、无 `if host ==` / `switch (host)`；全量测试通过（失败集合与基线差集为 0）。"
  ],
  "judgement": "",
  "jijian": "`cd \"$MAESTRO_REPO\" && node -p \"Object.keys(require('./package.json').dependencies||{}).length\"` 输出 `0`；`cd \"$MAESTRO_REPO\" && NODE_ENV=test node --test test/wp13/labels-desktop.test.js` 断言 `desktop/ui` 与 `desktop/harness` 的 CJK 命中数为 0、`GET /ui/labels` 覆盖界面引用到的键集合、`# pass ≥ 1`、`# fail 0`。",
  "fixture": "本 AC 是仓库静态检查，不使用业务夹具；命令从仓库根执行，不读写 `/tmp` 业务数据。",
  "archText": "`cd \"$MAESTRO_REPO\" && node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`；`cd \"$MAESTRO_REPO\" && node test/fixtures/purity-check.mjs --dirs desktop/ui --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 也必须 `exit 0`（界面层不得出现模板名与角色字面量）。",
  "files": [
    "labels-desktop.test.js"
  ],
  "arch": [
    {
      "cmd": "node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid \"task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check\"",
      "expect": 0,
      "note": "31 词全表，src/core+src/daemon 零命中"
    },
    {
      "cmd": "node test/fixtures/purity-check.mjs --dirs desktop/ui --forbid \"task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check\"",
      "expect": 0,
      "note": "31 词全表，desktop/ui 零命中"
    },
    {
      "cmd": "node -p \"Object.keys(require('./package.json').dependencies||{}).length\"",
      "expect": 0,
      "lines": 1,
      "contains": "0",
      "note": "输出 0（零运行时依赖）"
    },
    {
      "cmd": "grep -REn \"[一-龥]\" desktop/ui/ desktop/harness/",
      "expect": 1,
      "note": "界面层与 harness 零中文字面量"
    }
  ],
  "notes": [],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-28"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
