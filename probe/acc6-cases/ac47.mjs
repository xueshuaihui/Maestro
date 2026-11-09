// AC-47 工作流不能被 `orch run` 实例化（范围边界，BR-28）
// Given 项目里存在合法的项目工作流 doc-fanout（_fixtures.writeDocFanout，A-1 + 裁-15 wake_allow 行）；
// When orch run --cwd ./demo --task "写下说明" --template doc-fanout；
// Then 输出「未知模板：doc-fanout」、退出 1、没有启动核心、没有建实例；
// 机检：.orch/instances 与 .orch/core.json 不存在；assets 与 .orch/workflows 文件字节不变。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, makeCase, freshRoot, listFiles, sha256File, exists, orch, dirSnapshot,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';
import { writeDocFanout } from './_fixtures.mjs';

const AC = 'AC-47';

function assetManifest() {
  return listFiles(path.join(REPO, 'assets'))
    .map((rel) => `${rel}  ${sha256File(path.join(REPO, 'assets', ...rel.split('/')))}`)
    .join('\n');
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '混合',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '混合' });
    const root = freshRoot(AC);
    c.add(root);

    // --- Given：合法的项目工作流 doc-fanout ---
    const wfFile = writeDocFanout(root);
    c.noteFixture('写 .orch/workflows/doc-fanout.yaml（A-1 + 裁-15 的 T-001 wake_allow 行，见 _fixtures.mjs）', '');
    c.check('Given doc-fanout.yaml 已写入', exists(wfFile), wfFile);

    const manifestBefore = assetManifest();
    const wfBefore = dirSnapshot(path.join(root, '.orch', 'workflows'));

    // --- When ---
    const res = c.cmd(orch(root, ['run', '--cwd', './demo', '--task', '写下说明', '--template', 'doc-fanout']),
      'orch run --cwd ./demo --task 写下说明 --template doc-fanout');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('run', text(res));

    // --- Then ---
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.includes('Then 输出 未知模板：doc-fanout', rows.join('\n'), '未知模板：doc-fanout');

    // --- 机检 ---
    c.eq('机检：.orch/instances 不存在', exists(path.join(root, '.orch', 'instances')), false);
    c.eq('机检：.orch/core.json 不存在', exists(path.join(root, '.orch', 'core.json')), false);
    c.eq('机检：assets/** 文件字节不变（sha256 清单前后一致）', assetManifest(), manifestBefore);
    c.eq('机检：.orch/workflows 文件字节不变（快照前后一致）',
      JSON.stringify(dirSnapshot(path.join(root, '.orch', 'workflows'))), JSON.stringify(wfBefore));

    return finish(c);
  }
}];
