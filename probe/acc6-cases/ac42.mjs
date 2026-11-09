// AC-42 预演对不合法工作流直接拒绝（异常 + 机检）
// Given：doc-fanout 的 T-001 的 role 改成不存在的 ghost-role。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, workflowDryRun,
  text, nonEmptyLines, clean, requirementTitle, finish, exists, readText
} from '../acc6-f-common.mjs';
import { writeDocFanout } from './_fixtures.mjs';

const AC = 'AC-42';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);
    const file = writeDocFanout(root);
    c.noteFixture('预置附录 A-13 的 doc-fanout（writeDocFanout）', '');

    // Given：T-001 的 role 改成 ghost-role
    const broken = (readText(file) ?? '').replace('    role: researcher', '    role: ghost-role');
    c.check('夹具自检：T-001 的 role 已改为 ghost-role', broken.includes('role: ghost-role'), 'replace applied');
    fs.writeFileSync(file, broken, 'utf8');
    c.noteFixture('把 T-001 的 role 改成不存在的 ghost-role', '');

    // When：orch workflow dry-run doc-fanout
    const res = c.cmd(workflowDryRun(root, 'doc-fanout'), 'orch workflow dry-run doc-fanout');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('dry-run', text(res));

    // Then：预演被拒 + 提示 + 退出 1；没有任何编排计划行
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.eq('Then 恰好两行', rows.length, 2);
    c.lineEq('Then 第 1 行逐字', rows[0], '预演被拒：引用的角色不存在：ghost-role（WORKFLOW_ROLE_UNKNOWN）');
    c.lineEq('Then 第 2 行逐字', rows[1], '执行 orch workflow validate 查看全部问题');
    c.notIncludes('Then 没有任何编排计划行', text(res), '编排计划');

    // 机检：stdout 不含 编排计划；.orch/instances 不存在
    c.notIncludes('机检：stdout 不含 编排计划', res.stdout ?? '', '编排计划');
    c.check('机检：.orch/instances 不存在', !exists(path.join(root, '.orch', 'instances')), path.join(root, '.orch', 'instances'));

    return finish(c);
  }
}];
