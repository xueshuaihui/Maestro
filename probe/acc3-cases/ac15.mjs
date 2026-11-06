// AC-15 审核文件不可解析或结论非法（夹具：review-bad-json + 另起全新根的 review-decision-invalid）。
import {
  makeCase, freshRoot, runSync, statusText, text, coreStop, forceKillCore,
  readState, nodeOf, requirementTitle, lines, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-15';

/** 命中行（核对表显示实际命中的那一行；判定仍是「该行包含 needle」）。 */
function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

const BRANCHES = [
  {
    dir: AC,
    scenario: 'review-bad-json',
    label: '分支一',
    reason: '原因：核对失败：审核文件不可解析'
  },
  {
    dir: `${AC}-b`,
    scenario: 'review-decision-invalid',
    label: '分支二（另起全新根）',
    reason: '原因：核对失败：审核结论只能是 pass 或 reject'
  }
];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '审核文件不可解析或结论非法',
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
        const run = c.cmd(runSync(root, br.scenario), `[${br.label}] driver --scenario ${br.scenario}（完整跑完）`);
        c.eq(`Then [${br.label}] 退出码是 4`, run.exitCode, 4);

        // When：orch status --instance INST-001
        const st = c.cmd(statusText(root), `[${br.label}] orch status --instance INST-001`);
        const t = text(st);
        c.includes(`输出含「${br.reason}」`, hitLine(t, br.reason), br.reason);

        states.push({ br, s: readState(root) });
        c.cmd(coreStop(root), `[${br.label}] orch core stop`);
        await forceKillCore(root);
      }

      // And 机检：两次的 T-003 state 都是 'escalated'，dispatchCount 都是 3
      c.note('分支二（review-decision-invalid）的需求正文只对「结论非法」给了 Then 文案，未单列退出码；此处按同一异常路径一并核对退出码 4（实测 4），属加严观测，不构成放宽。');
      c.check("机检：两次的 T-003 state 都是 'escalated'",
        states.every(({ s }) => nodeOf(s, 'T-003')?.state === 'escalated'),
        states.map(({ br, s }) => `${br.label}:T-003=${nodeOf(s, 'T-003')?.state}`).join('；'));
      c.check('机检：两次的 dispatchCount 都是 3',
        states.every(({ s }) => s?.counters?.dispatchCount === 3),
        states.map(({ br, s }) => `${br.label}:dispatchCount=${s?.counters?.dispatchCount}`).join('；'));
    } finally {
      for (const root of roots) await forceKillCore(root);
    }
    return finish(c);
  }
}];
