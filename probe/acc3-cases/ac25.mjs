// AC-25 同一目录不能同时跑两个通用任务闭环（第一个 hold 住，第二个被 DIR_BUSY 拒绝）。
import {
  makeCase, freshRoot, startKeep, runProduct, statusText, text, lines,
  instanceIds, readState, nodeOf, coreStop, forceKillCore, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-25';
const SCENARIO = 'doc-hold-research';

function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '同一目录不能同时跑两个通用任务闭环',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：夹具场景 doc-hold-research --keep 让 INST-001 在 demo-doc 目录运行
    const h = startKeep(root, SCENARIO, [], undefined, 30000);
    try {
      const paused = await h.waitFile('paused', 20000);
      c.check('Given：INST-001 已停在 T-001 的 prompt 前（.mock/paused 出现）', Boolean(paused), `${Date.now() - h.startedAt}ms`);
      const live = readState(root);
      c.eq('Given 机检：实例 state=running', live?.state, 'running');
      c.eq('Given 机检：T-001 state=running', nodeOf(live, 'T-001')?.state, 'running');

      // When：在项目根发起第二个 task-loop，--cwd 仍指向 demo-doc
      const second = c.cmd(
        runProduct(root, { task: '写第二篇发布说明。产物：second.md' }),
        'orch run --template task-loop --cwd ./demo-doc --task "…产物：second.md"（同目录第二次发起）'
      );

      // Then
      const expect = '该目录已有未结束的实例 INST-001，本次未发起';
      c.includes('Then 输出含「该目录已有未结束的实例 INST-001，本次未发起」', hitLine(text(second), expect), expect);
      c.eq('Then 退出码 1', second.exitCode, 1);

      // And 机检：.orch/instances 仍只有 INST-001
      c.eq('And 机检：.orch/instances 仍只有 INST-001', instanceIds(root).join(','), 'INST-001');

      // 现场佐证：第一个实例没有被第二个发起动过
      const st = c.cmd(statusText(root), 'orch status --instance INST-001');
      c.includes('佐证：第一个实例仍在运行', hitLine(text(st), '实例 INST-001 · 运行中'), '实例 INST-001 · 运行中');
    } finally {
      await h.stop();
      c.keep('driver --scenario doc-hold-research --keep 输出（长驻进程由脚手架终止）', h, h.argv);
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
