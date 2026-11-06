// AC-17 审核结论与缺陷清单自相矛盾（夹具：review-pass-with-defects / review-reject-no-defects / review-defect-shape）。
import {
  makeCase, freshRoot, runSync, statusText, text, coreStop, forceKillCore,
  readState, nodeOf, requirementTitle, lines, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-17';

/** 命中行（核对表显示实际命中的那一行；判定仍是「该行包含 needle」）。 */
function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

const BRANCHES = [
  {
    dir: AC,
    scenario: 'review-pass-with-defects',
    label: '分支一',
    reason: '原因：核对失败：审核为通过，但缺陷清单非空'
  },
  {
    dir: `${AC}-b`,
    scenario: 'review-reject-no-defects',
    label: '分支二（另起全新根）',
    reason: '原因：核对失败：审核为驳回，但没有缺陷清单'
  },
  {
    dir: `${AC}-c`,
    scenario: 'review-defect-shape',
    label: '分支三（另起全新根）',
    reason: '原因：核对失败：审核缺陷缺少摘要或证据'
  }
];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '审核结论与缺陷清单自相矛盾',
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

        states.push({ br, s: readState(root) });
        c.cmd(coreStop(root), `[${br.label}] orch core stop`);
        await forceKillCore(root);
      }

      // And 机检：三次的 T-003 state 都是 'escalated'，dispatchCount 都是 3
      c.check("机检：三次的 T-003 state 都是 'escalated'",
        states.every(({ s }) => nodeOf(s, 'T-003')?.state === 'escalated'),
        states.map(({ br, s }) => `${br.label}:T-003=${nodeOf(s, 'T-003')?.state}`).join('；'));
      c.check('机检：三次的 dispatchCount 都是 3',
        states.every(({ s }) => s?.counters?.dispatchCount === 3),
        states.map(({ br, s }) => `${br.label}:dispatchCount=${s?.counters?.dispatchCount}`).join('；'));
    } finally {
      for (const root of roots) await forceKillCore(root);
    }
    return finish(c);
  }
}];
