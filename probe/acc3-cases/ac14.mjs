// AC-14 审核文件不是本轮新写 → 单独原因（夹具：review-stale）。
import {
  makeCase, freshRoot, runSync, statusText, text, coreStop, forceKillCore,
  readState, nodeOf, handoffOf, requirementTitle, lines, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-14';
const SCENARIO = 'review-stale';

/** 命中行（核对表显示实际命中的那一行；判定仍是「该行包含 needle」）。 */
function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '审核文件不是本轮新写 → 单独原因',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    try {
      // Given：夹具场景 review-stale 已完整跑完
      const run = c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（完整跑完）`);
      c.eq('Then 退出码是 4', run.exitCode, 4);

      // When：orch status --instance INST-001
      const st = c.cmd(statusText(root), 'orch status --instance INST-001');
      const t = text(st);
      c.includes('输出含「原因：核对失败：审核文件不是本轮新写 out/review.json」', hitLine(t, '原因：核对失败：审核文件不是本轮新写 out/review.json'), '原因：核对失败：审核文件不是本轮新写 out/review.json');
      c.notIncludes('输出不含「未找到审核文件」（陈旧文件不能报成缺失）', t, '未找到审核文件');

      // 机检
      const s = readState(root);
      c.eq("机检：T-003 state='escalated'", nodeOf(s, 'T-003')?.state, 'escalated');
      c.eq('机检：counters.dispatchCount=3', s?.counters?.dispatchCount, 3);
      c.check('机检：没有 HO-003（未回流）', handoffOf(s, 'HO-003') === null, (s?.handoffs ?? []).map((h) => h.handoffId).join(','));
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
