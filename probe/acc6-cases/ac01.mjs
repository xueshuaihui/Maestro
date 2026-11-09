// AC-01 从零建出一个能通过校验的角色（用户可见 + 机检）
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, roleCreate, roleList, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-01';
const CREATE_ARGS = ['--name', '首席开发', '--group', 'coding', '--artifact-type', 'code',
  '--side-effect', 'write', '--skills', 'code-change,test-run'];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（无 .orch）', root);

    const res = c.cmd(roleCreate(root, 'lead-dev', CREATE_ARGS), 'orch role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect write --skills code-change,test-run');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('create', text(res));

    // Then：恰好三行 + 退出码 0
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.eq('Then 终端恰好三行', rows.length, 3);
    c.lineEq('Then 第 1 行逐字', rows[0], '已创建项目角色：.orch/roles/lead-dev.yaml');
    c.lineEq('Then 第 2 行契约行逐字', rows[1], '- lead-dev 首席开发 · 编码工程 · code · write · 技能 2 · 并发 1');
    c.lineEq('Then 第 3 行逐字', rows[2], '校验：通过');

    // Then：随后 role list 首行
    const list = c.cmd(roleList(root), 'orch role list');
    const listRows = nonEmptyLines(clean(text(list)));
    c.eq('Then role list 退出码 0', list.exitCode, 0);
    c.lineEq('Then role list 首行 = 角色 17 个（内置 16 · 项目 1）', listRows[0], '角色 17 个（内置 16 · 项目 1）');
    c.evText('list', text(list));

    // 机检：文件存在、首行 schema、含 max_concurrent_sessions: 1、JSON counts 与 source
    const file = path.join(root, '.orch', 'roles', 'lead-dev.yaml');
    c.check('机检：test -f .orch/roles/lead-dev.yaml 为真', fs.existsSync(file), file);
    const content = fs.readFileSync(file, 'utf8');
    const first = content.split('\n')[0];
    c.lineEq('机检：文件首行 schema: role/v1', first, 'schema: role/v1');
    c.includes('机检：文件含 max_concurrent_sessions: 1', content, 'max_concurrent_sessions: 1');
    c.evText('lead-dev.yaml', content);

    const json = c.cmd(roleList(root, ['--format', 'json']), 'orch role list --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);
    c.eq('机检：counts.project === 1', payload?.counts?.project, 1);
    c.eq('机检：counts.total === 17', payload?.counts?.total, 17);
    const lead = (payload?.roles ?? []).find((r) => r.id === 'lead-dev');
    c.eq('机检：lead-dev 的 source === project', lead?.source, 'project');

    return finish(c);
  }
}];
