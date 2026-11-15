// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v4 §3.1 AC-39。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-39",
  "title": "三平台安装包与校验和齐全且对得上",
  "face": "功能 / 产物分发（v3 新增）",
  "level": "mock 实测",
  "refs": "BR-34, BR-38",
  "risk": "高（缺一个平台或校验和对不上，用户下载到错包/坏包）",
  "given": "某次 tag 的构建全部完成，用户打开该版本的 Releases 页。",
  "when": "用户下载页面列出的安装包与校验和清单，并自行核对下载文件。",
  "then": [
    "能拿到 macOS Intel、macOS Apple Silicon、Windows x64 三个安装包（**v4 点明格式，F-25**：macOS 为可挂载的磁盘映像 `.dmg`，Windows 为可执行的安装程序 `.exe`），文件名带版本与架构；另有一份 `SHA256SUMS.txt`，清单里每一行都能对上实际下载到的文件、逐行校验一致；不出现「清单有但页面没有」或「页面有但清单漏掉」的条目。"
  ],
  "judgement": "",
  "jijian": "`node probe/acc10-release-verify.mjs <tag> --check assets` 取远端资产名与字节数，断言三平台包 + 清单共 4 项齐全、架构后缀齐全；下载后本地重算 SHA-256 与 `SHA256SUMS.txt` 逐行比对并落 `evidence/`。",
  "fixture": "真实 Release 页面；不使用伪造的本地资产目录冒充。",
  "archText": "",
  "files": [
    "release-contract.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"lipo|-target universal-apple-darwin|universal2-apple-darwin\" .github/ scripts/",
      "expect": 1,
      "note": "不做跨架构装配（禁具体命令形态）"
    },
    {
      "cmd": "grep -REn \"macos-15-intel|macos-15|windows-latest\" .github/workflows/release.yml",
      "expect": 0,
      "note": "三平台各自在自家 runner 产出"
    }
  ],
  "notes": [
    "静态契约由 release-contract.test.js 的 `judgeAssets` 单测承载（三平台 + 清单共 4 项、资产数恰为 4）；真实面由 `acc10-release-verify.mjs --check assets` 取远端资产名与字节数并本地重算 SHA-256。",
    "禁止用仓内文件冒充远端资产（`docs/index.md` 710 行第 3 条）；缺任一平台即判不通过，不得用「另外两个平台已过」折抵。"
  ],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-39"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
