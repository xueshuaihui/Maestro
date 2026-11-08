// AC-35 role show 缺参数是用法错误（用户可见 + 机检）
import {
  makeCase, freshRoot, orch, text, requirementTitle, finish
} from '../acc5-f-common.mjs';
import { USAGE_LINES } from './_baselines.mjs';

const AC = 'AC-35';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    const res = c.cmd(orch(root, ['role', 'show']), 'orch role show（缺角色 id）');
    const out = text(res);
    c.evText('usage', out);

    c.eq('Then 退出码 2', res.exitCode, 2);
    c.includes('Then 打印用法（含 orch role show <角色> 一行）', out, USAGE_LINES[6]);
    c.includes('Then 与「（role show 需要角色 id）」', out, '（role show 需要角色 id）');
    c.check('机检：用法块 8 行齐全',
      USAGE_LINES.every((line) => out.includes(line)), JSON.stringify(USAGE_LINES.filter((l) => !out.includes(l))));

    return finish(c);
  }
}];
