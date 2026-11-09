// AC-39 工作流差异与「无差异」（混合：用户可见 + 机检）
// Given：fork.yaml 由 `workflow create fork --name 分叉版 --from code-loop` 生成后改一个节点标题；
// copy 由同命令派生后一字不改（裁-14①：同名内置/定义体全等回退 → 无差异）。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, workflowCreate, workflowDiff, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish, readText
} from '../acc6-f-common.mjs';

const AC = 'AC-39';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '混合',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '混合' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：生成 fork 并改一个节点标题（nodes[0].title：开发 → 开发（改））
    const created = c.cmd(workflowCreate(root, 'fork', ['--name', '分叉版', '--from', 'code-loop']),
      'orch workflow create fork --name 分叉版 --from code-loop');
    c.evText('create-fork', text(created));
    c.eq('Given：create fork 退出 0', created.exitCode, 0);
    const forkFile = path.join(root, '.orch', 'workflows', 'fork.yaml');
    const original = readText(forkFile) ?? '';
    const modified = original.replace('    title: 开发\n', '    title: 开发（改）\n');
    c.check('夹具自检：nodes[0].title 已改为 开发（改）', modified.includes('title: 开发（改）'), 'replace applied');
    fs.writeFileSync(forkFile, modified, 'utf8');
    c.noteFixture('把 fork.yaml 的 nodes[0].title 从 开发 改为 开发（改）', '');

    // When：orch workflow diff fork --against code-loop
    const res = c.cmd(workflowDiff(root, 'fork', ['--against', 'code-loop']), 'orch workflow diff fork --against code-loop');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('diff-fork', text(res));

    // Then：三行逐字 + 退出 0
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.eq('Then 恰好三行', rows.length, 3);
    c.lineEq('Then 首行逐字', rows[0], '对比工作流 fork（项目）与基线 code-loop（内置）');
    c.lineEq('Then 差异行逐字', rows[1], '~ nodes[0].title：开发 → 开发（改）');
    c.lineEq('Then 末行逐字', rows[2], '差异 1 项');

    // 机检：diff fork --format json
    const json = c.cmd(workflowDiff(root, 'fork', ['--against', 'code-loop', '--format', 'json']),
      'orch workflow diff fork --against code-loop --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);
    c.deepEq('机检：顶层键恰 base/target/changes', Object.keys(payload ?? {}).sort(), ['base', 'changes', 'target']);
    c.eq('机检：changes.length === 1', (payload?.changes ?? []).length, 1);
    c.eq('机检：changes[0].field === nodes[0].title', payload?.changes?.[0]?.field, 'nodes[0].title');

    // When：新建 copy（--from code-loop 后一字不改）并 diff
    const created2 = c.cmd(workflowCreate(root, 'copy', ['--name', '复制版', '--from', 'code-loop']),
      'orch workflow create copy --name 复制版 --from code-loop');
    c.evText('create-copy', text(created2));
    c.eq('Given：create copy 退出 0', created2.exitCode, 0);
    const res2 = c.cmd(workflowDiff(root, 'copy'), 'orch workflow diff copy');
    const rows2 = nonEmptyLines(clean(text(res2)));
    c.evText('diff-copy', text(res2));

    // Then：末行 无差异
    c.eq('Then diff copy 退出码 0', res2.exitCode, 0);
    c.eq('Then diff copy 恰两行', rows2.length, 2);
    c.lineEq('Then diff copy 末行 = 无差异', rows2[1], '无差异');
    c.lineEq('Then diff copy 首行（裁-14①：定义体全等回退到内置基线）', rows2[0], '对比工作流 copy（项目）与基线 code-loop（内置）');

    return finish(c);
  }
}];
