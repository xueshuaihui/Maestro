// AC-20 上一版被改写或删除（夹具：doc-previous-modified + 另起全新根的 doc-previous-missing）。
import {
  makeCase, freshRoot, runSync, statusText, text, coreStop, forceKillCore,
  readState, nodeOf, handoffOf, requirementTitle, lines, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-20';

/** 命中行（核对表显示实际命中的那一行；判定仍是「该行包含 needle」）。 */
function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

const BRANCHES = [
  {
    dir: AC,
    scenario: 'doc-previous-modified',
    label: '分支一',
    reason: '原因：核对失败：上一版文档被改写 artifacts/docs/release-notes.v1.md'
  },
  {
    dir: `${AC}-b`,
    scenario: 'doc-previous-missing',
    label: '分支二（另起全新根）',
    reason: '原因：核对失败：上一版文档缺失 artifacts/docs/release-notes.v1.md'
  }
];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '上一版被改写或删除',
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

      // And 机检：两次都是 T-002 state='escalated'、round=2
      c.check("机检：两次都是 T-002 state='escalated'、round=2",
        states.every(({ s }) => nodeOf(s, 'T-002')?.state === 'escalated' && nodeOf(s, 'T-002')?.round === 2),
        states.map(({ br, s }) => `${br.label}:T-002=${nodeOf(s, 'T-002')?.state}/${nodeOf(s, 'T-002')?.round}`).join('；'));

      // And 机检：两次的 T-003 state='failed'、round=1（保持等待复审）
      c.check("机检：两次的 T-003 state='failed'、round=1",
        states.every(({ s }) => nodeOf(s, 'T-003')?.state === 'failed' && nodeOf(s, 'T-003')?.round === 1),
        states.map(({ br, s }) => `${br.label}:T-003=${nodeOf(s, 'T-003')?.state}/${nodeOf(s, 'T-003')?.round}`).join('；'));

      // And 机检：两次的 counters.dispatchCount 都是 4
      c.check('机检：两次的 counters.dispatchCount 都是 4',
        states.every(({ s }) => s?.counters?.dispatchCount === 4),
        states.map(({ br, s }) => `${br.label}:dispatchCount=${s?.counters?.dispatchCount}`).join('；'));

      // And 机检：handoffs 恰好 3 条（HO-001~HO-003），backflow 恰好 1 条，不存在 HO-004
      c.check('机检：两次都是 handoffs 恰好 3 条',
        states.every(({ s }) => (s?.handoffs ?? []).length === 3),
        states.map(({ br, s }) => `${br.label}:count=${(s?.handoffs ?? []).length}`).join('；'));
      c.check('机检：两次的 handoffs 依次是 HO-001、HO-002、HO-003',
        states.every(({ s }) => (s?.handoffs ?? []).map((h) => h.handoffId).join(',') === 'HO-001,HO-002,HO-003'),
        states.map(({ br, s }) => `${br.label}:${(s?.handoffs ?? []).map((h) => h.handoffId).join(',')}`).join('；'));
      c.check("机检：两次都是 edge.kind='backflow' 恰好 1 条",
        states.every(({ s }) => (s?.handoffs ?? []).filter((h) => h.edge?.kind === 'backflow').length === 1),
        states.map(({ br, s }) => `${br.label}:backflow=${(s?.handoffs ?? []).filter((h) => h.edge?.kind === 'backflow').length}`).join('；'));
      c.check('机检：两次都不存在 HO-004',
        states.every(({ s }) => handoffOf(s, 'HO-004') === null),
        states.map(({ br, s }) => `${br.label}:handoffs=${(s?.handoffs ?? []).map((h) => h.handoffId).join('|')}`).join('；'));
    } finally {
      for (const root of roots) await forceKillCore(root);
    }
    return finish(c);
  }
}];
