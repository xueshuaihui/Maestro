// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v4 §3.1 AC-40。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-40",
  "title": "门禁与产物冒烟不过就不出包",
  "face": "非功能 / 发布可靠性（v3 新增）",
  "level": "mock 实测",
  "refs": "BR-37",
  "risk": "高（否则会把跑不起来的包发出去）",
  "given": "某次改动让质量门禁不过，或构建出的应用无法启动 / 鉴权守卫失效 / 签名丢失。",
  "when": "维护者照样推一个 tag 触发发布。",
  "then": [
    "构建记录显示失败并给出可读的失败环节；**该次发布不产生任何新的可下载资产**；用户不会在 Releases 页看到一个跑不起来的包；修复后重推同名 tag 能重新出包。"
  ],
  "judgement": "",
  "jijian": "`test -f test/wp13/release-contract.test.js && NODE_ENV=test node --test test/wp13/release-contract.test.js` 静态断言门禁步骤在打包步骤之前、产物冒烟步骤在上传步骤之前、且冒烟覆盖「应用可启动 + 鉴权守卫 + 签名验签 + 安装包完整性」四项；`node probe/acc10-release-verify.mjs <tag> --check gating` 断言失败构建的 Release 资产数为 **0**（**v4 修订，F-24**：判定点取「该次失败 run 的 `conclusion=failure`」+「同名 Release 的资产数在 run 前后相等」两个可读取事实，不依赖对失败原因的主观判读）。",
  "fixture": "构造一次故意失败的试跑（走 AC-42 的草稿通道），保留失败原始帧，不污染正式 Releases。**v4 补充**：失败构造必须在**草稿通道**内进行（草稿对访客不可见，失败不会外泄）；确实无法构造真实红色 run 时，本 AC 判 **`阻塞`**，不得用静态断言替代真实失败帧。",
  "archText": "质量门禁调用的是仓库既有判定命令（全量单测失败集合与基线差集为 0），不得为发布单开一套宽松判定；冒烟脚本不得用 `--skip-smoke` / `--skip-gates` 跳过（`grep -REn \"skip-smoke|skip-gates\" .github/ scripts/` **零命中，exit 1**）。",
  "files": [
    "release-contract.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"skip-smoke|skip-gates\" .github/ scripts/",
      "expect": 1,
      "note": "无跳过门禁/冒烟的旁路开关"
    },
    {
      "cmd": "grep -REn \"gate[.]mjs\" .github/workflows/release.yml",
      "expect": 0,
      "note": "门禁调用仓库既有判定脚本"
    }
  ],
  "notes": [
    "失败判定点（需求 v4 F-24）：该次 run `conclusion=failure` 且同名 Release 资产数在 run 前后相等；构造不出真实红色 run 时本条判 `阻塞`，不得用静态断言替代真实失败帧。"
  ],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-40"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
