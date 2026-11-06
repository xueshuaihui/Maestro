// AC-24 未知模板仍被拒绝（`--template taskloop`）。
import {
  makeCase, freshRoot, runProduct, text, lines, instanceIds,
  coreStop, forceKillCore, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-24';

function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '未知模板仍被拒绝',
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    try {
      const res = c.cmd(
        runProduct(root, { template: 'taskloop', task: '写发布说明。产物：release-notes.md' }),
        'orch run --template taskloop --cwd ./demo-doc --task "写发布说明。产物：release-notes.md"'
      );
      c.includes('Then 输出含「未知模板：taskloop」', hitLine(text(res), '未知模板：taskloop'), '未知模板：taskloop');
      c.eq('Then 退出码 1', res.exitCode, 1);
      c.eq('And 机检：.orch/instances 为空', instanceIds(root).join(',') || '（空）', '（空）');
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
