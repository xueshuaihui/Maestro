// AC-43 用法块：25 行，前 8 行逐字不变（用户可见 + 机检）
// USAGE_LINES.slice(0,8) 口径（裁-11）：前 8 行 = I1.5 基线 `0cd113b:src/cli/labels.js` 的
// USAGE_LINES（8 行）逐字；第 9~25 行是 17 条新子命令；末行追加原因行，共 26 行。
import {
  makeCase, freshRoot, orch,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-43';

// I1.5 基线（git show 0cd113b:src/cli/labels.js 的 USAGE_LINES，8 行）。
const BASELINE_8 = Object.freeze([
  '用法：orch run|status|cancel|core',
  '  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]',
  '  orch status [--instance <实例号>] [--events]',
  '  orch cancel --instance <实例号>',
  '  orch core stop',
  '  orch role list [--group <组>] [--instance <实例号>] [--format text|json]',
  '  orch role show <角色> [--instance <实例号>] [--format text|json]',
  '  orch role validate [<角色>] [--format json]'
]);

// A-12 用法块全文（25 行 = 上述 8 行 + 17 条新子命令）；ac44 复用。
export const USAGE_25 = Object.freeze([...BASELINE_8,
  '  orch role create <角色> [--from <角色>] --name <中文名|继承> --group <组|继承> --artifact-type <类型|继承> --side-effect <等级|继承> [--summary <摘要>] [--skills <a,b>] [--tools <a,b>] [--wake-allow <a,b>] [--max-concurrent <1-5>] [--force]',
  '  orch role edit <角色> [--set <键=值>]... [--unset <键>]...',
  '  orch role export <角色> [--out <文件>]',
  '  orch role import <文件> [--force]',
  '  orch role diff <角色> [--against <内置角色|文件>] [--format text|json]',
  '  orch skill list [--group <组>] [--format text|json]',
  '  orch skill show <技能> [--format text|json]',
  '  orch skill create <技能> --name <中文名> --summary <摘要> [--applies-to <a,b>] [--commands <命令>] [--body-file <文件>] [--force]',
  '  orch skill validate [<技能>] [--format json]',
  '  orch skill export <技能> [--out <文件>]',
  '  orch skill import <文件|目录> [--force]',
  '  orch workflow list [--format text|json]',
  '  orch workflow show <工作流> [--format text|json]',
  '  orch workflow create <工作流> --name <中文名> [--from <工作流>] [--force]',
  '  orch workflow validate [<工作流>] [--format json]',
  '  orch workflow diff <工作流> [--against <内置工作流|文件>] [--format text|json]',
  '  orch workflow dry-run <工作流> [--task <说明>] [--format text|json]'
]);

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（无 .orch）', root);

    // When：orch role bogus
    const res = c.cmd(orch(root, ['role', 'bogus']), 'orch role bogus');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('usage', text(res));

    // Then：用法块 25 行 + 原因行，退出码 2
    c.eq('Then 退出码 2', res.exitCode, 2);
    c.eq('Then 整块行数 26（25 + 原因行）', rows.length, 26);
    c.lineEq('Then 原因行逐字', rows[25], '  （未知的 role 子命令：bogus）');

    // 机检：USAGE_LINES.length === 25 且 slice(0,8) 与 I1.5 基线逐字相同
    c.deepEq('机检：USAGE_LINES.length === 25（整块前 25 行逐字）', rows.slice(0, 25), [...USAGE_25]);
    c.deepEq('机检：USAGE_LINES.slice(0,8) 与 I1.5 基线逐字', rows.slice(0, 8), [...BASELINE_8]);
    c.eq('机检：首行仍是 用法：orch run|status|cancel|core', rows[0], '用法：orch run|status|cancel|core');
    c.eq('机检：第 9~25 行是 17 条新子命令', rows.slice(8, 25).length, 17);

    return finish(c);
  }
}];
