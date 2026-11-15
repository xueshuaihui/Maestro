// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v4 §3.1 AC-41。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-41",
  "title": "版本与通道：包内版本一致、预发布与正式版不串档",
  "face": "功能 / 版本管理（v3 新增）",
  "level": "mock 实测",
  "refs": "BR-35, BR-34",
  "risk": "中（版本串档会让用户装到旧代码却以为装了新版）",
  "given": "仓库里应用版本号只有一个来源。",
  "when": "分别推 `v0.x.y` 与 `v1.0.0` 两种 tag。",
  "then": [
    "前者在 Releases 页标「预发布」、后者标正式版；两种情况下安装包文件名里的版本都与包内版本一致；改一处版本号后，产物名、包内版本、清单同步变化，不出现四处各写各的。",
    "- **来源唯一**：`node -p \"require('./package.json').version\"` 是版本号的唯一读取入口；`grep -c '^  \"version\"' package.json` **等于 1**（exit 0）。",
    "- **值相等**：`node -e` 读取 `package.json` / `desktop/src-tauri/Cargo.toml` / `desktop/src-tauri/tauri.conf.json` 三处版本，断言三者**逐字相等**；不做 `grep` 字面量扫描（这样才允许 cargo 必需字段存在）。",
    "- **派生物不写字面量**：`grep -REn \"0\\.[0-9]+\\.[0-9]+\" scripts/desktop/` **零命中（exit 1）**——构建/打包脚本不得再写死版本号，必须从 `package.json` 读取。"
  ],
  "judgement": "",
  "jijian": "`test -f test/wp13/release-contract.test.js && NODE_ENV=test node --test test/wp13/release-contract.test.js` 断言版本单点（其余位置由同一来源派生或校验对齐）、`v0.* → 预发布` 与 `v1+ → 正式` 两条分支都在；`node probe/acc10-release-verify.mjs <tag> --check channel` 断言远端 `prerelease` 标记与 tag 前缀一致。",
  "fixture": "两种 tag 各一次；静态契约机检不依赖网络。",
  "archText": "",
  "files": [
    "release-contract.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"0[.]1[.]0\" scripts/desktop/",
      "expect": 1,
      "note": "派生物不写版本字面量（唯一来源 = package.json）"
    },
    {
      "cmd": "grep -REn \"assertAligned|readVersion\" scripts/desktop/version.mjs",
      "expect": 0,
      "note": "版本模块提供唯一读取入口与对齐断言"
    }
  ],
  "notes": [
    "静态契约三条（来源唯一 / 值相等 / 派生物零字面量）由 release-version.test.js 承载；真实面由 `--check channel` 断言 `v0.* → prerelease`、`v1+ → 正式`。"
  ],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-41"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
