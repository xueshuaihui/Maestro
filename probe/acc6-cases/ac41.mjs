// AC-41 预演不启动会话、不建实例（规划验收；边界 + 机检）
// C-12：dry-run 纯函数——不连核心、不建 .orch/instances、不写任何文件；两次输出逐字节相同。
import {
  makeCase, freshRoot, workflowDryRun,
  text, nonEmptyLines, clean, requirementTitle, finish, exists, dirSnapshot
} from '../acc6-f-common.mjs';
import path from 'node:path';
import { writeDocFanout } from './_fixtures.mjs';

const AC = 'AC-41';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '边界',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '边界' });
    const root = freshRoot(AC);
    c.add(root);
    writeDocFanout(root);
    c.noteFixture('预置附录 A-13 的 doc-fanout（writeDocFanout）', '');

    // Given：记录执行前 .orch 的目录清单与 sha256 清单
    const orchDir = path.join(root, '.orch');
    const before = dirSnapshot(orchDir);
    c.evJson('snapshot-before', before);
    c.matches('Given 自检：执行前 .orch 里是工作流夹具', Object.keys(before).join(','), /workflows\/doc-fanout\.yaml/);

    // When：orch workflow dry-run doc-fanout（连跑两次）
    const res1 = c.cmd(workflowDryRun(root, 'doc-fanout'), 'orch workflow dry-run doc-fanout（第 1 次）');
    const res2 = c.cmd(workflowDryRun(root, 'doc-fanout'), 'orch workflow dry-run doc-fanout（第 2 次）');
    const rows1 = nonEmptyLines(clean(text(res1)));
    c.evText('dry-run-1', text(res1));
    c.evText('dry-run-2', text(res2));

    // Then：末行 结论 + 退出 0
    c.eq('Then 退出码 0', res1.exitCode, 0);
    c.lineEq('Then 末行逐字', rows1[rows1.length - 1], '结论：编排可执行，未启动任何会话');

    // 机检：不建 .orch/instances、不建 .orch/core.json
    c.check('机检：test -e .orch/instances 为假', !exists(path.join(orchDir, 'instances')), path.join(orchDir, 'instances'));
    c.check('机检：test -e .orch/core.json 为假', !exists(path.join(orchDir, 'core.json')), path.join(orchDir, 'core.json'));

    // 机检：所有既有文件的 sha256 与执行前相同
    const after = dirSnapshot(orchDir);
    c.evJson('snapshot-after', after);
    c.deepEq('机检：.orch 快照前后逐字相同（含 sha256）', after, before);

    // 机检：同一命令连续执行两次 stdout 逐字节相同
    const sameBytes = Buffer.from(res1.stdout ?? '').equals(Buffer.from(res2.stdout ?? ''));
    c.check('机检：两次 stdout 逐字节相同', sameBytes,
      `len1=${(res1.stdout ?? '').length} len2=${(res2.stdout ?? '').length}`);
    c.eq('机检：第二次退出码同为 0', res2.exitCode, 0);

    return finish(c);
  }
}];
