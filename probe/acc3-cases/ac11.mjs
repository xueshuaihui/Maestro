// AC-11 挂起后不再自动推进（doc-reject-twice 跑到挂起，核心拉起后等 60 秒再对比）。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, runSync, statusText, coreStop, forceKillCore, sleep,
  text, readState, readEvents, nodeOf, handoffOf, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-11';
const SCENARIO = 'doc-reject-twice';
const WAIT_MS = 60000;

function corePid(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8'))?.pid ?? null;
  } catch { return null; }
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '挂起后不再自动推进',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);
    try {
      // Given：AC-10 同款实例已挂起（run 结束后驱动已停核心，这里先用 status 拉起核心）
      const run = c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（跑到挂起）`);
      c.check('前置：实例已挂起（run 退出码 4）', run.exitCode === 4, `exit=${run.exitCode}`);
      const warm = c.cmd(statusText(root), 'orch status --instance INST-001（拉起核心）');
      c.includes('前置：核心已拉起且实例显示「已挂起」', text(warm), '实例 INST-001 · 已挂起');

      const before = readState(root);
      const beforeDoc = {
        pid: corePid(root),
        dispatchCount: before?.counters?.dispatchCount ?? null,
        handoffs: (before?.handoffs ?? []).length,
        sessions: (before?.sessions ?? []).length,
        events: readEvents(root).length,
        t3: `${nodeOf(before, 'T-003')?.state}/${nodeOf(before, 'T-003')?.round}`,
        instance: before?.state
      };
      c.check('前置：核心进程活着（.orch/core.json 的 pid 非空）', Number.isInteger(beforeDoc.pid) && beforeDoc.pid > 0,
        `pid=${beforeDoc.pid}`);
      c.snap(root, 'state.before-wait');

      // When：我等待 60 秒
      await sleep(WAIT_MS);

      // Then：机检四项都不得变化
      const after = readState(root);
      c.snap(root, 'state.after-wait');
      const afterDoc = {
        pid: corePid(root),
        dispatchCount: after?.counters?.dispatchCount ?? null,
        handoffs: (after?.handoffs ?? []).length,
        sessions: (after?.sessions ?? []).length,
        events: readEvents(root).length,
        t3: `${nodeOf(after, 'T-003')?.state}/${nodeOf(after, 'T-003')?.round}`,
        instance: after?.state
      };

      c.check('机检：dispatchCount 仍为 5（等待 60 秒后）', afterDoc.dispatchCount === 5,
        `等待前 ${beforeDoc.dispatchCount} → 等待后 ${afterDoc.dispatchCount}`);
      c.check('机检：events.jsonl 行数与等待前相同', afterDoc.events === beforeDoc.events,
        `等待前 ${beforeDoc.events} 行 → 等待后 ${afterDoc.events} 行`);
      c.check('机检：sessions 数量不再增加', afterDoc.sessions === beforeDoc.sessions,
        `等待前 ${beforeDoc.sessions} → 等待后 ${afterDoc.sessions}`);
      c.check("机检：T-003 仍为 escalated、实例仍为 suspended",
        afterDoc.t3 === 'escalated/2' && afterDoc.instance === 'suspended',
        `T-003=${afterDoc.t3} 实例=${afterDoc.instance}`);
      c.check('机检：handoffs 数量也不增加（4 条，无 HO-005）',
        afterDoc.handoffs === beforeDoc.handoffs && !(after?.handoffs ?? []).some((h) => h.handoffId === 'HO-005'),
        `${beforeDoc.handoffs} → ${afterDoc.handoffs}`);
      c.check('备注：等待期间核心 pid 未变（未重启、未换核）', afterDoc.pid === beforeDoc.pid,
        `pid ${beforeDoc.pid} → ${afterDoc.pid}`);
      c.note(`等待时长 ${WAIT_MS}ms（需求原文 60 秒）；等待前后各落一份 state 快照，便于逐字段对照。`);
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
