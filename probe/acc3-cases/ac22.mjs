// AC-22 发起前拦截空任务与缺产物行（产品 CLI `orch run`，判据逐字）。
import {
  makeCase, freshRoot, runProduct, text, lines, instanceIds, exists,
  coreStop, forceKillCore, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-22';

/** 命中行（核对表显示实际命中的那一行；判定仍是「该行包含 needle」）。 */
function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '发起前拦截空任务与缺产物行',
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    try {
      // When 1：--task "   "
      const r1 = c.cmd(runProduct(root, { task: '   ' }), 'orch run --template task-loop --cwd ./demo-doc --task "   "');
      c.includes('Then 输出含「任务描述不能为空」', hitLine(text(r1), '任务描述不能为空'), '任务描述不能为空');
      c.eq('Then 退出码 1（空任务）', r1.exitCode, 1);

      // When 2：没有产物行
      const r2 = c.cmd(
        runProduct(root, { task: '写一篇发布说明，但没有产物行' }),
        'orch run --template task-loop --cwd ./demo-doc --task "写一篇发布说明，但没有产物行"'
      );
      const missingLine = '通用任务闭环需要在任务里写「产物：<文件名>.md」一行（全角冒号，例如 产物：release-notes.md）';
      c.includes('Then 输出含「通用任务闭环需要在任务里写…」', hitLine(text(r2), missingLine), missingLine);
      c.eq('Then 退出码 1（缺产物行）', r2.exitCode, 1);

      // When 3：半角冒号同样算缺行
      const r3 = c.cmd(
        runProduct(root, { task: '写一篇发布说明。产物: release-notes.md' }),
        'orch run --template task-loop --cwd ./demo-doc --task "写一篇发布说明。产物: release-notes.md"'
      );
      c.includes('Then 半角冒号同样输出上面的提示', hitLine(text(r3), missingLine), missingLine);
      c.eq('Then 退出码 1（半角冒号）', r3.exitCode, 1);

      // And：三次之后 .orch/instances 仍为空，没有创建工作区目录
      c.eq('And 机检：三次之后 .orch/instances 仍为空', instanceIds(root).join(',') || '（空）', '（空）');
      c.check(
        'And 机检：没有创建工作区目录 .orch/instances/INST-001',
        !exists(`${root}/.orch/instances/INST-001`),
        `${root}/.orch/instances/INST-001`
      );

      // And：单独 --task "" → 用法错误
      const r4 = c.cmd(runProduct(root, { task: '' }), 'orch run --template task-loop --cwd ./demo-doc --task ""');
      c.includes('And 输出含「--task 需要一个值」', hitLine(text(r4), '--task 需要一个值'), '--task 需要一个值');
      c.eq('And 退出码 2（用法错误）', r4.exitCode, 2);
      c.eq('And 机检：--task "" 之后 .orch/instances 仍为空', instanceIds(root).join(',') || '（空）', '（空）');
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
