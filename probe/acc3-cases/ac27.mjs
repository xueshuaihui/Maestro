// AC-27 已挂起实例不能再次发起（doc-reject-twice 跑完 → 再 run --instance 被拒）。
import {
  makeCase, freshRoot, runSync, runProduct, text, lines, readState, nodeOf,
  coreStop, forceKillCore, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-27';
const SCENARIO = 'doc-reject-twice';

function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '已挂起实例不能再次发起',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    try {
      // Given：夹具场景 doc-reject-twice 已跑完，INST-001 已挂起
      const run = c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（完整跑完）`);
      c.eq('Given 前置：夹具跑完退出码 4（挂起）', run.exitCode, 4);

      const before = readState(root);
      c.eq('Given 机检：INST-001 已挂起', before?.state, 'suspended');
      const escalationsBefore = (before?.escalations ?? []).length;
      c.check('Given 机检：T-003 已升级（前置）', nodeOf(before, 'T-003')?.state === 'escalated', nodeOf(before, 'T-003')?.state);

      // When：用同一实例再次发起
      const again = c.cmd(
        runProduct(root, {
          instance: 'INST-001',
          cwd: before?.cwd,
          task: '重写发布说明。产物：release-notes.md'
        }),
        'orch run --instance INST-001 --template task-loop --cwd <该实例的项目根> --task "重写发布说明。产物：release-notes.md"'
      );

      // Then
      const expect = '该实例已挂起，不能再次发起；如要重来请新建实例';
      c.includes('Then 输出含「该实例已挂起，不能再次发起；如要重来请新建实例」', hitLine(text(again), expect), expect);
      c.eq('Then 退出码 1', again.exitCode, 1);

      // And 机检：仍是 suspended，escalations 数量不变
      const after = readState(root);
      c.eq('And 机检：INST-001 仍是 suspended', after?.state, 'suspended');
      c.eq('And 机检：escalations 数量不变', (after?.escalations ?? []).length, escalationsBefore);
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
