// AC-45 只读命令不建 `.orch`、不连核心（边界 + 机检）
// Given 全新项目根（无 .orch）；When 十条只读命令逐条执行；
// 机检：`.orch` 不存在 + 仓库 assets/** sha256 清单执行前后逐字相同。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, makeCase, freshRoot, listFiles, sha256File,
  roleList, roleShow, roleValidate, skillList, skillShow, skillValidate,
  workflowList, workflowShow, workflowValidate, workflowDiff,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-45';

/** 仓库 assets/** 的 sha256 清单（相对路径正斜杠、字典序，逐字可比）。 */
function assetManifest() {
  return listFiles(path.join(REPO, 'assets'))
    .map((rel) => `${rel}  ${sha256File(path.join(REPO, 'assets', ...rel.split('/')))}`)
    .join('\n');
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);
    c.note('机检口径：assets/** 指仓库根 assets/（内置资产只读红线 BR-30/BR-01）；清单 = 递归相对路径 + sha256，执行前后逐字比对。');

    // --- Given：全新项目根（无 .orch）---
    c.eq('Given 项目根下不存在 .orch', fs.existsSync(path.join(root, '.orch')), false);

    const manifestBefore = assetManifest();
    c.evText('assets-manifest-before', manifestBefore);

    // --- When：十条只读命令逐条执行 ---
    const cmds = [
      ['role list', () => roleList(root)],
      ['role show developer', () => roleShow(root, 'developer')],
      ['role validate', () => roleValidate(root)],
      ['skill list', () => skillList(root)],
      ['skill show code-change', () => skillShow(root, 'code-change')],
      ['skill validate', () => skillValidate(root)],
      ['workflow list', () => workflowList(root)],
      ['workflow show code-loop', () => workflowShow(root, 'code-loop')],
      ['workflow validate', () => workflowValidate(root)],
      ['workflow diff code-loop', () => workflowDiff(root, 'code-loop')]
    ];

    let allOk = true;
    const summaries = [];
    for (const [label, fn] of cmds) {
      const res = c.cmd(fn(), `orch ${label}`);
      const rows = nonEmptyLines(clean(text(res)));
      summaries.push(`${label}: exit=${res.exitCode} lines=${rows.length}`);
      c.evText(label.replace(/\s+/g, '-'), text(res));
      // Then：全新根上十条都退出 0（Then 原文允许 0/1「仅因资产不合法」，本 Given 无坏资产，取严断 0）
      if (res.exitCode !== 0) allOk = false;
      // 机检：每条之后 .orch 都不存在
      if (fs.existsSync(path.join(root, '.orch'))) allOk = false;
    }
    c.evText('summaries', summaries.join('\n'));

    // --- Then：十条命令都退出 0；.orch 始终不存在 ---
    c.check('Then 十条只读命令全部退出 0（Given 无坏资产，Then 的 0/1 档取严断 0）', allOk, summaries.join('；'));

    // --- 机检 ---
    c.eq('机检：执行后 test -e "$ROOT/.orch" 为假', fs.existsSync(path.join(root, '.orch')), false);
    const manifestAfter = assetManifest();
    c.evText('assets-manifest-after', manifestAfter);
    c.eq('机检：assets/** sha256 清单执行前后逐字相同', manifestAfter, manifestBefore);

    return finish(c);
  }
}];
