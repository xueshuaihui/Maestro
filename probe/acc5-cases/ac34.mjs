// AC-34 角色不存在时明确报错（用户可见 + 机检）
import {
  makeCase, freshRoot, roleShow, text, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-34';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    const res = c.cmd(roleShow(root, 'no-such-role'), 'orch role show no-such-role');
    const out = text(res);
    c.evText('show', out);

    c.eq('Then 退出码 1', res.exitCode, 1);
    c.includes('Then 终端出现「找不到角色：no-such-role」', out, '找不到角色：no-such-role');
    c.includes('Then 一行「可用角色：执行 orch role list 查看」', out, '可用角色：执行 orch role list 查看');
    c.check('机检：stdout 含这两行',
      out.split('\n').includes('找不到角色：no-such-role')
      && out.split('\n').includes('可用角色：执行 orch role list 查看'),
      JSON.stringify(out.split('\n').filter(Boolean)));

    return finish(c);
  }
}];
