// AC-40 从内置工作流生成项目工作流（用户可见 + 机检；含 --force 三段追加用例）
// 第三段：待覆盖内容不合法时即使 --force 仍被拒（BR-08 / C-05：--force 只覆盖文件、不跳过校验）。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, workflowCreate, workflowValidate, workflowList, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish, sha256File, readText
} from '../acc6-f-common.mjs';

const AC = 'AC-40';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);
    const forkFile = path.join(root, '.orch', 'workflows', 'fork.yaml');

    // When：orch workflow create fork --name 分叉版 --from code-loop
    const res = c.cmd(workflowCreate(root, 'fork', ['--name', '分叉版', '--from', 'code-loop']),
      'orch workflow create fork --name 分叉版 --from code-loop');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('create', text(res));

    // Then：回两行 + 退出 0
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.eq('Then 恰好两行', rows.length, 2);
    c.lineEq('Then 第 1 行逐字', rows[0], '已创建项目工作流：.orch/workflows/fork.yaml');
    c.lineEq('Then 第 2 行逐字', rows[1], '校验：通过');

    // Then：随后 orch workflow validate 首行 校验工作流 4 个：全部通过
    const val = c.cmd(workflowValidate(root), 'orch workflow validate');
    const valRows = nonEmptyLines(clean(text(val)));
    c.evText('validate', text(val));
    c.lineEq('Then validate 首行', valRows[0], '校验工作流 4 个：全部通过');
    c.eq('Then validate 退出 0', val.exitCode, 0);

    // 机检：生成文件含 schema/id/两个节点/三条边；list json counts.project === 1
    const content = readText(forkFile) ?? '';
    c.evText('fork.yaml', content);
    c.includes('机检：文件含 schema: workflow/v1', content, 'schema: workflow/v1');
    c.matches('机检：文件含 id: fork', content, /^id: fork$/m);
    c.eq('机检：两个 - id: T-00 节点', (content.match(/^  - id: T-00/gm) ?? []).length, 2);
    c.eq('机检：三条边', (content.match(/^  - from:/gm) ?? []).length, 3);
    const listJson = c.cmd(workflowList(root, ['--format', 'json']), 'orch workflow list --format json');
    const listPayload = jsonOf(listJson);
    c.evJson('list-payload', listPayload);
    c.eq('机检：counts.project === 1', listPayload?.counts?.project, 1);

    // ---- --force 追加用例 ----
    // 前置：fork.yaml 已存在且合法（上面第一段生成）。
    const shaBeforeDup = sha256File(forkFile);

    // 第一次：不带 --force → 已存在同名、退出 1、文件不变
    const dup = c.cmd(workflowCreate(root, 'fork', ['--name', '另一个名字']),
      'orch workflow create fork --name 另一个名字（不带 --force）');
    const dupRows = nonEmptyLines(clean(text(dup)));
    c.evText('dup-no-force', text(dup));
    c.eq('Then 第一次退出码 1', dup.exitCode, 1);
    c.lineEq('Then 第一次输出逐字', dupRows[0], '已存在同名项目工作流：.orch/workflows/fork.yaml（加 --force 覆盖）');
    c.eq('机检：第一次后 grep -c 另一个名字 为 0（AC-40 机检逐字）',
      ((readText(forkFile) ?? '').match(/另一个名字/g) ?? []).length, 0);
    c.eq('机检：第一次后文件不变', sha256File(forkFile), shaBeforeDup);

    // 第二次：加 --force → 成功、退出 0、文件被覆盖
    const force = c.cmd(workflowCreate(root, 'fork', ['--name', '另一个名字', '--force']),
      'orch workflow create fork --name 另一个名字 --force');
    const forceRows = nonEmptyLines(clean(text(force)));
    c.evText('force-ok', text(force));
    c.eq('Then 第二次退出码 0', force.exitCode, 0);
    c.lineEq('Then 第二次第 1 行逐字', forceRows[0], '已创建项目工作流：.orch/workflows/fork.yaml');
    c.lineEq('Then 第二次第 2 行逐字', forceRows[1], '校验：通过');
    const content2 = readText(forkFile) ?? '';
    c.evText('fork-after-force.yaml', content2);
    c.eq('机检：第二次后 grep -c 另一个名字 为 1（AC-40 机检逐字；实测见 blockers D-3）',
      ((content2.match(/另一个名字/g) ?? []).length), 1);
    const valFork = c.cmd(workflowValidate(root, ['fork', '--format', 'json']), 'orch workflow validate fork --format json');
    const valForkPayload = jsonOf(valFork);
    c.evJson('validate-fork-payload', valForkPayload);
    c.eq('机检：第二次后 counts.invalid === 0', valForkPayload?.counts?.invalid, 0);

    // 第三次：把 fork.yaml 换成不合法内容后 --force 仍被拒、文件保持原样
    const invalidYaml = [
      'schema: workflow/v1',
      'id: fork',
      'name: 坏的',
      'entry: T-001',
      'terminal: T-001',
      'nodes:',
      '  - id: T-001',
      '    node_type: script',
      ''
    ].join('\n');
    fs.writeFileSync(forkFile, invalidYaml, 'utf8');
    c.noteFixture('把 fork.yaml 换成不合法内容（node_type: script）', invalidYaml);
    const shaBeforeBad = sha256File(forkFile);
    const forceBad = c.cmd(workflowCreate(root, 'fork', ['--name', '另一个名字', '--force']),
      'orch workflow create fork --name 另一个名字 --force（待覆盖内容不合法）');
    const forceBadRows = nonEmptyLines(clean(text(forceBad)));
    c.evText('force-invalid', text(forceBad));
    c.eq('Then 第三次退出码 1', forceBad.exitCode, 1);
    c.eq('Then 第三次恰好一行（创建被拒：<明细>（<原因码>））', forceBadRows.length, 1);
    c.includes('Then 第三次句式 创建被拒：', forceBadRows[0] ?? '', '创建被拒：');
    c.matches('Then 第三次带原因码收尾', forceBadRows[0] ?? '', /（WORKFLOW_[A-Z_]+）$/);
    c.eq('机检：第三次后目标文件 sha256 与覆盖前相同', sha256File(forkFile), shaBeforeBad);

    return finish(c);
  }
}];
