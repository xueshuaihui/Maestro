// AC-13 审核文件缺失 → 升级，不回流（夹具：review-missing）。
import {
  makeCase, freshRoot, runSync, statusText, text, coreStop, forceKillCore,
  readState, readEvents, nodeOf, handoffOf, workspacePath, taskDir,
  exists, readJson, requirementTitle, lines, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-13';
const SCENARIO = 'review-missing';

/** 命中行（核对表显示实际命中的那一行；判定仍是「该行包含 needle」）。 */
function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '审核文件缺失 → 升级，不回流',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    try {
      // Given：夹具场景 review-missing 已完整跑完
      const run = c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（完整跑完）`);

      // Then 退出码是 4
      c.eq('Then 退出码是 4', run.exitCode, 4);

      // When：orch status --instance INST-001
      const st = c.cmd(statusText(root), 'orch status --instance INST-001');
      const t = text(st);
      c.includes('输出含「原因：核对失败：未找到审核文件 out/review.json」', hitLine(t, '原因：核对失败：未找到审核文件 out/review.json'), '原因：核对失败：未找到审核文件 out/review.json');
      c.includes('输出含「节点 T-003 审核者 已升级」', hitLine(t, '节点 T-003 审核者 已升级'), '节点 T-003 审核者 已升级');
      c.includes('输出含「节点 T-002 撰写者 已完成」', hitLine(t, '节点 T-002 撰写者 已完成'), '节点 T-002 撰写者 已完成');

      // 机检
      const s = readState(root);
      c.eq("机检：T-003 state='escalated'", nodeOf(s, 'T-003')?.state, 'escalated');
      c.eq("机检：T-002 state='done'", nodeOf(s, 'T-002')?.state, 'done');
      c.eq('机检：counters.dispatchCount=3', s?.counters?.dispatchCount, 3);
      c.eq('机检：handoffs 恰好 2 条', (s?.handoffs ?? []).length, 2);
      c.eq('机检：handoffs 依次是 HO-001、HO-002', (s?.handoffs ?? []).map((h) => h.handoffId).join(','), 'HO-001,HO-002');
      c.check('机检：没有 HO-003', handoffOf(s, 'HO-003') === null, (s?.handoffs ?? []).map((h) => h.handoffId).join(','));

      const bf = readEvents(root).filter((e) => e.reason === 'backflow.constructed');
      c.eq('机检：events 中没有 backflow.constructed', bf.length, 0);

      // And：读取根是「任务目录」而不是实例工作区
      const decoyFile = `${workspacePath(root).replace(/\\/g, '/')}/out/review.json`;
      const decoy = readJson(decoyFile);
      c.eq('机检：夹具在工作区放了一份合法 pass 干扰文件（decision）', decoy?.decision, 'pass');
      c.includes('机检：核心仍报「未找到审核文件 out/review.json」（未被工作区同名文件带偏）', hitLine(t, '未找到审核文件 out/review.json'), '未找到审核文件 out/review.json');
      c.check('机检：任务目录 demo-doc/out/review.json 不存在', !exists(`${taskDir(root)}/out/review.json`), `${taskDir(root)}/out/review.json`);
      c.check('机检：任务目录 demo-doc/out 目录不存在', !exists(`${taskDir(root)}/out`), `${taskDir(root)}/out`);
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
