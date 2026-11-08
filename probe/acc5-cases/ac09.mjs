// AC-09 YAML 语法错误带行号（用户可见 + 机检）
import {
  makeCase, freshRoot, writeRole, roleList, roleValidate, jsonOf, text, nonEmptyLines,
  requirementTitle, finish
} from '../acc5-f-common.mjs';
import { listHeader } from './_baselines.mjs';

const AC = 'AC-09';

// 需求原文：第 4 行有一处非法缩进（同一层级出现两种缩进宽度）。
// 1~3 行是 0 缩进根键，第 4 行是 4 空格缩进且前面没有 2 空格的父级 —— 无父可挂。
const BROKEN = [
  'schema: role/v1',
  'id: broken',
  'name: 坏语法',
  '    summary: 四个空格缩进，前面没有 2 空格的父级可挂',
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

    c.noteFixture('写 .orch/roles/broken.yaml（第 4 行非法缩进）', writeRole(root, 'broken', BROKEN));

    const res = c.cmd(roleValidate(root), 'orch role validate');
    const out = text(res);
    c.evText('validate', out);
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.includes('Then 原因码 YAML_PARSE_FAILED', out, 'YAML_PARSE_FAILED');
    c.includes('Then 明细含「第 4 行」', out, '第 4 行');
    c.eq('Then 行文本逐字', out.split('\n').filter((l) => l.startsWith('- roles/broken.yaml'))[0],
      '- roles/broken.yaml：第 4 行无法解析：缩进不一致（YAML_PARSE_FAILED）');

    const jsonRes = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    c.eq('机检：errors[0].code === YAML_PARSE_FAILED', payload?.errors?.[0]?.code, 'YAML_PARSE_FAILED');
    c.eq('机检：errors[0].line === 4', payload?.errors?.[0]?.line, 4);
    c.eq('机检：counts.roles 仍为 16（A-7 的六键表，不是 A-6 的 total）', payload?.counts?.roles, 16);
    c.check('机检：该文件不进入角色表（list 里没有 broken）',
      !text(c.cmd(roleList(root), 'orch role list')).includes('- broken '),
      'list 输出无 broken 行');

    const list = c.cmd(roleList(root), 'orch role list');
    const rows = nonEmptyLines(text(list));
    c.eq('Then 其它 16 个角色不受影响（首行仍是 16 个内置）', rows[0], listHeader());
    c.eq('机检：list 仍是 18 行（首行 + 16 行 + 末行提示）', rows.length, 18);

    return finish(c);
  }
}];
