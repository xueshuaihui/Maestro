// AC-44 三族命令的用法错误矩阵（异常 + 机检）
// 12 次 = 三族 × 四类（未知子命令 / 未知参数 / 标志用错子命令 / 缺必填位置参数）。
// 「未知参数：--nope」三族共用一句属预期（Then 原文口径）。
import {
  makeCase, freshRoot, orch, roleList, roleShow, skillList, skillShow, workflowList,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';
import { USAGE_25 } from './ac43.mjs';

const AC = 'AC-44';
// [说明, 执行器(root) => res, 期望原因行]
const MATRIX = [
  ['role bogus', (root) => orch(root, ['role', 'bogus']), '  （未知的 role 子命令：bogus）'],
  ['skill bogus', (root) => orch(root, ['skill', 'bogus']), '  （未知的 skill 子命令：bogus）'],
  ['workflow bogus', (root) => orch(root, ['workflow', 'bogus']), '  （未知的 workflow 子命令：bogus）'],
  ['role list --nope', (root) => roleList(root, ['--nope']), '  （未知参数：--nope）'],
  ['skill list --nope', (root) => skillList(root, ['--nope']), '  （未知参数：--nope）'],
  ['workflow list --nope', (root) => workflowList(root, ['--nope']), '  （未知参数：--nope）'],
  ['skill show x --instance y', (root) => skillShow(root, 'x', ['--instance', 'y']), '  （--instance 不适用于 skill show）'],
  ['workflow list --group x', (root) => workflowList(root, ['--group', 'x']), '  （--group 不适用于 workflow list）'],
  ['role show x --group coding', (root) => roleShow(root, 'x', ['--group', 'coding']), '  （--group 不适用于 role show）'],
  ['skill show（缺位置参数）', (root) => orch(root, ['skill', 'show']), '  （skill show 需要技能 id）'],
  ['workflow show（缺位置参数）', (root) => orch(root, ['workflow', 'show']), '  （workflow show 需要工作流 id）'],
  ['role show（缺位置参数）', (root) => orch(root, ['role', 'show']), '  （role show 需要角色 id）']
];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（无 .orch）；12 条命令依次执行', root);

    let allExit2 = true;
    for (const [name, run, reason] of MATRIX) {
      const res = c.cmd(run(root), `orch ${name}`);
      const rows = nonEmptyLines(clean(text(res)));
      c.evText(name.replace(/\s+/g, '-').replace(/[（）]/g, ''), text(res));
      c.eq(`Then ${name} 退出码 2`, res.exitCode, 2);
      c.eq(`Then ${name} 用法块 25 行 + 原因行`, rows.length, 26);
      c.lineEq(`Then ${name} 原因行逐字`, rows[25], reason);
      const parenLines = rows.filter((l) => l.includes('（'));
      c.eq(`机检：${name} 含（的行恰 1 行且即原因行`, parenLines.length === 1 && parenLines[0] === reason, true);
      c.deepEq(`机检：${name} 前 25 行 = 用法块`, rows.slice(0, 25), [...USAGE_25]);
      if (res.exitCode !== 2) allExit2 = false;
    }

    // 机检：十二次退出码均为 2
    c.check('机检：十二次退出码均为 2', allExit2, allExit2 ? '12/2' : '存在非 2 退出码');
    c.eq('机检：共 12 条命令', MATRIX.length, 12);

    return finish(c);
  }
}];
