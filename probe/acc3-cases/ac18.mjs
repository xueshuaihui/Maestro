// AC-18 缺陷证据不可解析（夹具：review-evidence-unreadable + 另起全新根的 review-evidence-outside）。
import {
  makeCase, freshRoot, runSync, statusText, text, coreStop, forceKillCore,
  readState, nodeOf, escalationOf, requirementTitle, lines, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-18';

/** 命中行（核对表显示实际命中的那一行；判定仍是「该行包含 needle」）。 */
function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

const BRANCHES = [
  {
    dir: AC,
    scenario: 'review-evidence-unreadable',
    label: '分支一',
    reason: '原因：核对失败：缺陷证据不可解析 artifacts/docs/missing.md#L3'
  },
  {
    dir: `${AC}-b`,
    scenario: 'review-evidence-outside',
    label: '分支二（另起全新根）',
    reason: '原因：核对失败：缺陷证据不可解析 ../outside.md#L1'
  }
];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '缺陷证据不可解析',
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

      // And 机检：两次的 T-003 state 都是 'escalated'
      c.check("机检：两次的 T-003 state 都是 'escalated'",
        states.every(({ s }) => nodeOf(s, 'T-003')?.state === 'escalated'),
        states.map(({ br, s }) => `${br.label}:T-003=${nodeOf(s, 'T-003')?.state}`).join('；'));

      // And 机检：escalations[0].defects 为空（未校验通过的缺陷不进入升级块）
      c.check('机检：escalations[0].defects 为空（两次）',
        states.every(({ s }) => Array.isArray(escalationOf(s, 0)?.defects) && escalationOf(s, 0).defects.length === 0),
        states.map(({ br, s }) => `${br.label}:defects=${JSON.stringify(escalationOf(s, 0)?.defects ?? null)}`).join('；'));
    } finally {
      for (const root of roots) await forceKillCore(root);
    }
    return finish(c);
  }
}];
