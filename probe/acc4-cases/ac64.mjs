// AC-64 非法参数按用法错误退出（边界 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, orch, readState, instanceIds, text,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-64';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // 先造一个「已有实例」，用于核对非法参数不改变其 rev。
    c.cmd(runScene(root, { scenario: 'pass' }), 'orch run code-loop pass（造一个已有实例）');
    const revBefore = readState(root)?.rev;
    const idsBefore = instanceIds(root);

    const cmds = [
      { args: ['run', '--cwd', './demo', '--task', 'x', '--approval', 'maybe'], allow: 'allow|reject|hold' },
      { args: ['instance', 'graph', 'INST-001', '--format', 'yaml'], allow: 'text|json' },
      { args: ['escalate', 'resolve', 'ESC-001', '--decision', 'maybe'], allow: 'pass|fail|retry' },
      { args: ['approve', 'APR-001', '--decision', 'maybe'], allow: 'allow|deny' },
    ];
    for (const { args, allow } of cmds) {
      const r = c.cmd(orch(root, args), `orch ${args.join(' ')}`);
      c.eq(`机检：${args.join(' ')} 退出码 2`, r.exitCode, 2);
      c.includes(`Then：stdout/stderr 含允许值说明 ${allow}`, text(r), allow);
      c.includes(`Then：${args.join(' ')} 按用法错误输出（含「用法：」）`, text(r), '用法：');
    }

    c.check('机检：.orch/instances 下没有新实例目录', instanceIds(root).length === idsBefore.length,
      `before=${idsBefore.join(',')} after=${instanceIds(root).join(',')}`);
    c.eq('机检：已有实例 rev 不变', readState(root)?.rev, revBefore);
    return conclude(c, root);
  },
}];
