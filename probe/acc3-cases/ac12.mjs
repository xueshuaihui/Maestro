// AC-12 重启后仍挂起，轮次与升级都在（doc-reject-twice 挂起 → core stop → status 自动拉起新核心）。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, runSync, statusText, coreStop, forceKillCore,
  text, lines, readState, readEvents, nodeOf, escalationOf, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-12';
const SCENARIO = 'doc-reject-twice';

function corePid(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8'))?.pid ?? null;
  } catch { return null; }
}
function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}
const dispatches = (events) => events.filter((e) => e.reason === 'node.dispatch').length;

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '重启后仍挂起，轮次与升级都在',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);
    try {
      // Given：实例已挂起（run 结束后先拉起一次核心，拿到"重启前"的 pid 与盘上状态）
      const run = c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（跑到挂起）`);
      c.check('前置：实例已挂起（run 退出码 4）', run.exitCode === 4, `exit=${run.exitCode}`);
      c.cmd(statusText(root), 'orch status --instance INST-001（重启前，拉起核心）');

      const beforeState = readState(root);
      const pidBefore = corePid(root);
      const before = {
        pid: pidBefore,
        t2: nodeOf(beforeState, 'T-002')?.round,
        t3: nodeOf(beforeState, 'T-003')?.round,
        t3state: nodeOf(beforeState, 'T-003')?.state,
        instance: beforeState?.state,
        esc: escalationOf(beforeState)?.escalationId,
        escState: escalationOf(beforeState)?.state,
        dispatches: dispatches(readEvents(root)),
        escDetail: escalationOf(beforeState)?.reasonDetail
      };
      c.snap(root, 'state.before-restart');
      c.check('前置：挂起时核心活着（pid 非空且进程存在）', Number.isInteger(pidBefore) && alive(pidBefore), `pid=${pidBefore}`);

      // When：orch core stop
      const stop = c.cmd(coreStop(root), 'orch core stop');
      c.check('orch core stop 执行后核心进程已退出', stop.exitCode === 0 && !alive(pidBefore),
        `exit=${stop.exitCode} pid=${pidBefore} alive=${alive(pidBefore)}`);

      // And：重新执行 orch status（核心由 status 自动拉起）
      const st = c.cmd(statusText(root), 'orch status --instance INST-001（重启后）');
      const t = text(st);
      const pidAfter = corePid(root);
      c.check('status 之后是**新**核心进程（pid 变了）', Number.isInteger(pidAfter) && pidAfter !== pidBefore && alive(pidAfter),
        `pid ${pidBefore} → ${pidAfter}`);

      // Then
      const first = (lines(t).find((l) => l.trim().length > 0) ?? '').trim();
      c.check('第一行含「已挂起」且不含「已中断」', first.includes('已挂起') && !first.includes('已中断'), first);
      c.includes('输出仍含「升级 ESC-001 待处理」', t, '升级 ESC-001 待处理');
      c.includes('输出仍含「回流超上限」', t, '回流超上限');

      const afterState = readState(root);
      const after = {
        t2: nodeOf(afterState, 'T-002')?.round,
        t3: nodeOf(afterState, 'T-003')?.round,
        t3state: nodeOf(afterState, 'T-003')?.state,
        instance: afterState?.state,
        esc: escalationOf(afterState)?.escalationId,
        escState: escalationOf(afterState)?.state,
        dispatches: dispatches(readEvents(root))
      };
      c.snap(root, 'state.after-restart');

      c.eq('机检：T-002 round 与重启前一致（2）', after.t2, before.t2);
      c.eq('机检：T-003 round 与重启前一致（2）', after.t3, before.t3);
      c.check('机检：重启后 T-002/T-003 round 都是 2', after.t2 === 2 && after.t3 === 2, `T-002=${after.t2} T-003=${after.t3}`);
      c.check('机检：没有新增 node.dispatch 事件', after.dispatches === before.dispatches,
        `重启前 ${before.dispatches} 条 → 重启后 ${after.dispatches} 条`);

      // 补充（同一 Given 的延续）：升级与实例状态也原样
      c.check('机检：升级 ESC-001 仍是 pending、reasonDetail 未变',
        after.esc === 'ESC-001' && after.escState === 'pending' && escalationOf(afterState)?.reasonDetail === before.escDetail,
        `${after.esc}/${after.escState} ${escalationOf(afterState)?.reasonDetail}`);
      c.check('机检：实例仍是 suspended、T-003 仍是 escalated',
        after.instance === 'suspended' && after.t3state === 'escalated', `${after.instance}/${after.t3state}`);
      c.note('重启手法：`orch run` 挂起后先用 `orch status` 拉起核心（拿到 pid A）→ `orch core stop` → 再 `orch status` 由 CLI 的 `connect({ensure:true})` 自动拉起新核心（pid B≠A）→ 读盘。');
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
