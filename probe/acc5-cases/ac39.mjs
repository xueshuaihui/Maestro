// AC-39 --instance 指向不存在的实例（用户可见 + 机检）
import {
  makeCase, freshRoot, roleShow, orch, text, nonEmptyLines, requirementTitle, finish
} from '../acc5-f-common.mjs';
import { SHOW_DEVELOPER } from './_baselines.mjs';

const AC = 'AC-39';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（没有任何实例）', root);

    const res = c.cmd(roleShow(root, 'developer', ['--instance', 'INST-999']),
      'orch role show developer --instance INST-999');
    const rows = nonEmptyLines(text(res));
    c.evText('show', text(res));

    c.eq('Then 退出码 1', res.exitCode, 1);
    c.deepEq('机检：stdout 前 6 行是角色契约（A-3 逐字）', rows.slice(0, 6), SHOW_DEVELOPER);
    c.includes('Then 末行含「找不到实例：INST-999」', rows.at(-1), '找不到实例：INST-999');
    c.eq('机检：契约之后只多一行结论', rows.length, 7);

    // 收尾：本条会真的启动核心（--instance 需要连核心），停掉以免留下常驻进程
    c.cmd(orch(root, ['core', 'stop']), 'orch core stop（收尾）');

    return finish(c);
  }
}];
