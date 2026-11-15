// 由 node probe/acc10-f-gen.mjs 生成；判据原文逐字取自 requirement.md v4 §3.1 AC-43。
// 禁止手工放宽 / 合并 / 改写任何 Then；改动请先改生成器并复跑 --check。
import { runCase } from '../acc10-f-common.mjs';

export const spec = {
  "ac": "AC-43",
  "title": "失败重跑与重复 tag 不产生重复 Release",
  "face": "非功能 / 幂等与可恢复（v3 新增）",
  "level": "mock 实测",
  "refs": "BR-37, BR-39",
  "risk": "中（重跑失败会让维护者不敢再发版，重复 Release 会让用户选错版本）",
  "given": "某次构建有一个平台失败、另两个平台成功；或同名 tag 的 Release 已经存在。",
  "when": "维护者修复后重跑，或对同名 tag 再推一次。",
  "then": [
    "Releases 页始终只有该版本**一个**条目；重跑是更新/补齐这个条目的资产，不是新建第二个；三个平台产物最终齐全；同一时刻两次触发不会互相覆盖出半套资产。"
  ],
  "judgement": "",
  "jijian": "`test -f test/wp13/release-contract.test.js && NODE_ENV=test node --test test/wp13/release-contract.test.js` 静态断言「已存在则补传、否则创建」的分支、覆盖式上传、以及同版本并发互斥；`node probe/acc10-release-verify.mjs <tag> --check idempotent` 断言远端同名 Release 计数为 1 且资产齐全。",
  "fixture": "构造一次单平台失败的试跑后重跑；保留两次构建记录。",
  "archText": "任一平台失败不得阻塞其它平台产出自己的产物（不因一红全停）；但汇总发布必须等全部平台成功，缺一不发。",
  "files": [
    "release-contract.test.js"
  ],
  "arch": [
    {
      "cmd": "grep -REn \"gh release view|[-][-]clobber\" .github/workflows/release.yml",
      "expect": 0,
      "note": "已存在则补传、覆盖式上传"
    },
    {
      "cmd": "grep -REn \"fail-fast:[[:space:]]*false\" .github/workflows/release.yml",
      "expect": 0,
      "note": "任一平台失败不阻塞其它平台产出"
    }
  ],
  "notes": [
    "真实面：同名 Release 计数为 1 且资产齐全；静态契约断言「已存在则补传 / 否则创建」与 `--clobber` 覆盖式上传。"
  ],
  "source": "docs/iterations/iteration-10a/requirement.md §3.1 AC-43"
};

export const cases = [{
  ac: spec.ac,
  title: spec.title,
  face: spec.face,
  run: () => runCase(spec),
}];
