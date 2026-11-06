// AC-19 撰写产物缺失、为空或不是本轮新写（夹具：doc-missing / doc-empty / doc-stale）。
import {
  makeCase, freshRoot, runSync, statusText, text, coreStop, forceKillCore,
  readState, nodeOf, handoffOf, requirementTitle, lines, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-19';

/** 命中行（核对表显示实际命中的那一行；判定仍是「该行包含 needle」）。 */
function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

const BRANCHES = [
  {
    dir: AC,
    scenario: 'doc-missing',
    label: '分支一',
    reason: '原因：核对失败：未找到声明的产出 artifacts/docs/release-notes.v1.md'
  },
  {
    dir: `${AC}-b`,
    scenario: 'doc-empty',
    label: '分支二（另起全新根）',
    reason: '原因：核对失败：产出为空 artifacts/docs/release-notes.v1.md'
  },
  {
    dir: `${AC}-c`,
    scenario: 'doc-stale',
    label: '分支三（另起全新根）',
    reason: '原因：核对失败：产出不是本轮新写 artifacts/docs/release-notes.v1.md'
  }
];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '撰写产物缺失、为空或不是本轮新写',
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

      // And 机检：三次都是 T-002 state='escalated'、T-003 state='pending'
      c.check("机检：三次都是 T-002 state='escalated'",
        states.every(({ s }) => nodeOf(s, 'T-002')?.state === 'escalated'),
        states.map(({ br, s }) => `${br.label}:T-002=${nodeOf(s, 'T-002')?.state}`).join('；'));
      c.check("机检：三次都是 T-003 state='pending'",
        states.every(({ s }) => nodeOf(s, 'T-003')?.state === 'pending'),
        states.map(({ br, s }) => `${br.label}:T-003=${nodeOf(s, 'T-003')?.state}`).join('；'));

      // And 机检：三次的 counters.dispatchCount 都是 2
      c.check('机检：三次的 counters.dispatchCount 都是 2',
        states.every(({ s }) => s?.counters?.dispatchCount === 2),
        states.map(({ br, s }) => `${br.label}:dispatchCount=${s?.counters?.dispatchCount}`).join('；'));

      // And 机检：三次都没有名为 HO-002 的交接包
      c.check('机检：三次都没有名为 HO-002 的交接包',
        states.every(({ s }) => handoffOf(s, 'HO-002') === null),
        states.map(({ br, s }) => `${br.label}:handoffs=${(s?.handoffs ?? []).map((h) => h.handoffId).join('|')}`).join('；'));
    } finally {
      for (const root of roots) await forceKillCore(root);
    }
    return finish(c);
  }
}];
