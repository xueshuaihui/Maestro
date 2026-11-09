// AC-57 改不存在的角色与 diff 缺对比基线（异常路径 + 机检）
// Given：.orch/roles/my-role.yaml（合法、字段与内置 developer 相同仅 name 不同）
//        与 .orch/workflows/my-wf.yaml（合法工作流，无同名内置）。
// Then：edit ghost / diff 缺基线三种 1；diff --against developer 按 A-5 口径给出差异与退出 0。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, roleEdit, roleDiff, workflowDiff, writeRole, writeWorkflow, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish, readText
} from '../acc6-f-common.mjs';

const AC = 'AC-57';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);

    // --- Given：合法 my-role（除 name 外与内置 developer 逐字段相同）与合法 my-wf ---
    writeRole(root, 'my-role', {
      id: 'my-role', name: '我的角色',
      group: 'coding', summary: '按任务修改代码，交出声明的产物文件',
      artifactType: 'code', sideEffect: 'write',
      skills: ['code-change', 'test-run'], tools: ['read', 'write', 'edit', 'bash'],
      wakeAllow: ['tester']
    });
    writeWorkflow(root, 'my-wf', [
      'schema: workflow/v1',
      'id: my-wf',
      'name: 我的工作流',
      'entry: T-001',
      'terminal: T-001',
      'nodes:',
      '  - id: T-001',
      '    node_type: role',
      '    role: developer',
      '    title: 唯一节点',
      ''
    ].join('\n'));
    c.noteFixture('预置 .orch/roles/my-role.yaml（除 name 外与 developer 逐字段相同）与 .orch/workflows/my-wf.yaml', '');

    // 内置 developer 资产的 name 字段（期望 base 值以资产文件为准，不用常量硬编码）
    const devName = /^name: (.+)$/m.exec(readText(path.join('assets', 'roles', 'developer.yaml')) ?? '')?.[1] ?? null;
    const myName = /^name: (.+)$/m.exec(readText(path.join(root, '.orch', 'roles', 'my-role.yaml')) ?? '')?.[1] ?? null;
    c.check('夹具自检：developer 与 my-role 的 name 均可读', Boolean(devName) && Boolean(myName), `${devName} / ${myName}`);

    // --- When ①：edit 不存在的角色 ---
    const edit = c.cmd(roleEdit(root, 'ghost-id', ['--set', 'summary=x']), 'orch role edit ghost-id --set summary=x');
    const editRows = nonEmptyLines(clean(text(edit)));
    c.evText('edit-ghost', text(edit));
    c.eq('Then ① 退出码 1', edit.exitCode, 1);
    c.lineEq('Then ① 首行逐字', editRows[0], '找不到角色：ghost-id');
    c.lineEq('Then ① 提示行逐字', editRows[1], '可用角色：执行 orch role list 查看');

    // --- When ②③：diff 缺对比基线 ---
    const diffRole = c.cmd(roleDiff(root, 'my-role'), 'orch role diff my-role');
    c.evText('diff-role-nobaseline', text(diffRole));
    const roleRows = nonEmptyLines(clean(text(diffRole)));
    c.eq('Then ② 退出码 1', diffRole.exitCode, 1);
    c.eq('Then ② 只回一行', roleRows.length, 1);
    c.lineEq('Then ② 逐字', roleRows[0], '缺少对比基线：my-role（用 --against 指定内置角色或文件）');

    const diffWf = c.cmd(workflowDiff(root, 'my-wf'), 'orch workflow diff my-wf');
    c.evText('diff-wf-nobaseline', text(diffWf));
    const wfRows = nonEmptyLines(clean(text(diffWf)));
    c.eq('Then ③ 退出码 1', diffWf.exitCode, 1);
    c.eq('Then ③ 只回一行', wfRows.length, 1);
    c.lineEq('Then ③ 逐字', wfRows[0], '缺少对比基线：my-wf（用 --against 指定内置工作流或文件）');

    // --- When ④：role diff --against developer（A-5 角色口径）---
    const diff = c.cmd(roleDiff(root, 'my-role', ['--against', 'developer']), 'orch role diff my-role --against developer');
    const diffRows = nonEmptyLines(clean(text(diff)));
    c.evText('diff-against-developer', text(diff));
    // 机检 JSON 先取（末行 N 与 changes.length 一致要引用它）
    const json = c.cmd(roleDiff(root, 'my-role', ['--against', 'developer', '--format', 'json']),
      'orch role diff my-role --against developer --format json');
    const payload = jsonOf(json);
    c.evJson('diff-payload', payload);
    const changeCount = payload?.changes?.length ?? -1;
    c.eq('Then ④ 退出码 0', diff.exitCode, 0);
    c.lineEq('Then ④ 首行逐字（A-5 句式）', diffRows[0], '对比角色 my-role（项目）与基线 developer（内置）');
    // 除 id 外全比（name 与其余键），缺省键按缺省值比较：夹具只差 name → 恰一条 ~ 行
    c.eq('Then ④ 恰一条差异行', diffRows.length, 3);
    c.lineEq('Then ④ 差异行逐字', diffRows[1], `~ name：${devName} → ${myName}`);
    const lastLine = diffRows[diffRows.length - 1];
    c.matches('Then ④ 末行为 差异 N 项 或 无差异', lastLine, /^(差异 \d+ 项|无差异)$/);
    c.eq('Then ④ 末行 N 与 changes.length 一致', lastLine, `差异 ${changeCount} 项`);

    // --- 机检：diff --format json 顶层恰三键；changes 无 id 项；name 项 base/target 取自资产文件 ---
    c.eq('机检：退出码 0', json.exitCode, 0);
    c.deepEq('机检：顶层键恰 base/target/changes', Object.keys(payload ?? {}).sort(), ['base', 'changes', 'target']);
    const changes = payload?.changes ?? [];
    c.eq('机检：changes 中不存在 field === id 的项（diff 忽略 id）',
      changes.some((ch) => ch.field === 'id'), false);
    for (const ch of changes) {
      c.deepEq('机检：changes[] 每项恰四键 field/kind/base/target', Object.keys(ch).sort(), ['base', 'field', 'kind', 'target']);
    }
    const nameItem = changes.find((ch) => ch.field === 'name');
    if (nameItem) {
      c.eq('机检：name 项 base 等于内置 developer 资产的 name 字段', nameItem.base, devName);
      c.eq('机检：name 项 target 等于 my-role.yaml 的 name 字段', nameItem.target, myName);
    }

    return finish(c);
  }
}];
