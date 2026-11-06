// AC-16 审核未引用或引用了别的文档（夹具：review-artifact-missing + 另起全新根的 review-artifact-mismatch）。
import {
  makeCase, freshRoot, runSync, statusText, text, coreStop, forceKillCore,
  readState, readEvents, nodeOf, handoffOf, requirementTitle, lines, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-16';

/** 命中行（核对表显示实际命中的那一行；判定仍是「该行包含 needle」）。 */
function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

const BRANCHES = [
  {
    dir: AC,
    scenario: 'review-artifact-missing',
    label: '分支一',
    reason: '原因：核对失败：审核未引用本轮文档'
  },
  {
    dir: `${AC}-b`,
    scenario: 'review-artifact-mismatch',
    label: '分支二（另起全新根）',
    reason: '原因：核对失败：审核引用的不是本轮文档 artifacts/docs/orphan.md'
  }
];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '审核未引用或引用了别的文档',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const states = [];
    const roots = [];

    try {
      for (const br of BRANCHES) {
        const root = freshRoot(br.dir);
        c.add(root);
        roots.push(root);

        // Given：场景完整跑完
        c.cmd(runSync(root, br.scenario), `[${br.label}] driver --scenario ${br.scenario}（完整跑完）`);

        // When：orch status --instance INST-001
        const st = c.cmd(statusText(root), `[${br.label}] orch status --instance INST-001`);
        c.includes(`输出含「${br.reason}」`, hitLine(text(st), br.reason), br.reason);

        const s = readState(root);
        const bf = readEvents(root).filter((e) => e.reason === 'backflow.constructed');
        states.push({
          br,
          s,
          backflows: bf.length,
          hasHo003: handoffOf(s, 'HO-003') !== null
        });
        c.cmd(coreStop(root), `[${br.label}] orch core stop`);
        await forceKillCore(root);
      }

      // And 机检：两次的 T-003 state 都是 'escalated'
      c.check("机检：两次的 T-003 state 都是 'escalated'",
        states.every(({ s }) => nodeOf(s, 'T-003')?.state === 'escalated'),
        states.map(({ br, s }) => `${br.label}:T-003=${nodeOf(s, 'T-003')?.state}`).join('；'));

      // And 机检：都没有 backflow.constructed，也没有 HO-003
      c.check('机检：两次都没有 backflow.constructed',
        states.every(({ backflows }) => backflows === 0),
        states.map(({ br, backflows }) => `${br.label}:backflow.constructed=${backflows}`).join('；'));
      c.check('机检：两次都没有 HO-003',
        states.every(({ hasHo003 }) => !hasHo003),
        states.map(({ br, s }) => `${br.label}:handoffs=${(s?.handoffs ?? []).map((h) => h.handoffId).join('|')}`).join('；'));
    } finally {
      for (const root of roots) await forceKillCore(root);
    }
    return finish(c);
  }
}];
