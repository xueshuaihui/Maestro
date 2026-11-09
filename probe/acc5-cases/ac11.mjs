// AC-11 坏资产不阻塞列表但以失败退出（用户可见 + 机检）
import {
  makeCase, freshRoot, writeRole, roleList, jsonOf, text, nonEmptyLines,
  requirementTitle, finish
} from '../acc5-f-common.mjs';
import { LIST_ROWS, invalidHint, listHeader } from './_baselines.mjs';

const AC = 'AC-11';

// 需求原文给的坏文件：除第 4 行外都是 0 缩进的根键，第 4 行 4 空格缩进且无父可挂。
const BROKEN = [
  'schema: role/v1',
  'id: broken',
  'name: 坏文件',
  '    summary: 坏缩进',
  'group: coding',
  'artifact_type: code',
  'side_effect: write',
  'skills: []',
  'max_concurrent_sessions: 1',
  ''
].join('\n');

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    c.noteFixture('写 .orch/roles/broken.yaml（第 4 行 4 空格缩进、无父可挂）', writeRole(root, 'broken', BROKEN));

    const res = c.cmd(roleList(root), 'orch role list');
    const rows = nonEmptyLines(text(res));
    c.evText('list', text(res));

    c.eq('Then 退出码 1', res.exitCode, 1);
    c.lineEq('Then 首行计数仍为「角色 16 个（内置 16 · 项目 0）」', rows[0], listHeader());
    c.deepEq('Then 仍列出 16 个合法角色（与 A-2 逐字一致）', rows.slice(1, 17), LIST_ROWS);
    c.lineEq('Then 末行是「1 个资产未通过校验，执行 orch role validate 查看」', rows.at(-1), invalidHint(1));
    c.eq('机检：行数 18（首行 + 16 行 + 末行）', rows.length, 18);

    const jsonRes = c.cmd(roleList(root, ['--format', 'json']), 'orch role list --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    c.eq('机检：counts.invalid === 1', payload?.counts?.invalid, 1);
    c.eq('机检：roles 长度 16', payload?.roles?.length, 16);

    return finish(c);
  }
}];
