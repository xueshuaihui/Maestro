// AC-37 未知子命令、未知参数、非法 --format 都是用法错误（用户可见 + 机检）
import {
  makeCase, freshRoot, orch, text, requirementTitle, finish
} from '../acc5-f-common.mjs';
import { USAGE_LINES } from './_baselines.mjs';

const AC = 'AC-37';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    const sub = c.cmd(orch(root, ['role', 'bogus']), 'orch role bogus');
    const arg = c.cmd(orch(root, ['role', 'list', '--nope']), 'orch role list --nope');
    const fmt = c.cmd(orch(root, ['role', 'list', '--format', 'yaml']), 'orch role list --format yaml');
    const out = `${text(sub)}\n${text(arg)}\n${text(fmt)}`;
    c.evText('three-usage-errors', `[role bogus]\n${text(sub)}\n[role list --nope]\n${text(arg)}\n[role list --format yaml]\n${text(fmt)}`);

    c.eq('Then 第 1 次退出码 2（未知子命令）', sub.exitCode, 2);
    c.eq('Then 第 2 次退出码 2（未知参数）', arg.exitCode, 2);
    c.eq('Then 第 3 次退出码 2（非法 --format）', fmt.exitCode, 2);

    c.includes('Then 原因「未知的 role 子命令：bogus」', text(sub), '未知的 role 子命令：bogus');
    c.includes('Then 原因「未知参数：--nope」', text(arg), '未知参数：--nope');
    c.includes('Then 原因「--format 只接受 text 或 json」', text(fmt), '--format 只接受 text 或 json');

    const count = (needle) => out.split(needle).length - 1;
    c.eq('机检：三条原因各出现一次（未知子命令）', count('未知的 role 子命令：bogus'), 1);
    c.eq('机检：三条原因各出现一次（未知参数）', count('未知参数：--nope'), 1);
    c.eq('机检：三条原因各出现一次（非法 --format）', count('--format 只接受 text 或 json'), 1);
    c.check('机检：三次都打印了用法块首行', [sub, arg, fmt].every((r) => text(r).includes(USAGE_LINES[0])),
      JSON.stringify([sub, arg, fmt].map((r) => text(r).split('\n')[0])));

    return finish(c);
  }
}];
