// AC-28 运行中取消 5 秒内收敛（doc-slow-reviewer：审核者delay 60s，正好留出取消窗口）。
import {
  makeCase, freshRoot, startKeep, cancel, statusText, text, lines, readState, readEvents,
  nodeOf, handoffOf, coreStop, forceKillCore, requirementTitle, finish, waitUntil
} from '../acc3-f-common.mjs';

const AC = 'AC-28';
const SCENARIO = 'doc-slow-reviewer';
const LIMIT_MS = 5000;
const BUSY_SESSION = new Set(['thinking', 'tool_running', 'waiting_input', 'waiting_dependency']);

function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '运行中取消 5 秒内收敛',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：doc-slow-reviewer --keep，撰写者完成、审核者正在执行
    const h = startKeep(root, SCENARIO, [], undefined, 60000);
    try {
      const ready = await waitUntil(() => {
        const s = readState(root);
        const ho2 = (s?.handoffs ?? []).find((x) => x.handoffId === 'HO-002');
        return ho2 && ho2.state === 'accepted' ? s : null;
      }, { timeout: 40000, interval: 50, label: 'HO-002 accepted' });

      const live = readState(root);
      const ho2 = handoffOf(live, 'HO-002');
      c.check("Given 机检：HO-002 的 state='accepted'（审核者已接手）", ho2?.state === 'accepted', ho2?.state ?? '（缺失）');
      c.check('Given 机检：T-001/T-002 已完成', nodeOf(live, 'T-001')?.state === 'done' && nodeOf(live, 'T-002')?.state === 'done',
        `${nodeOf(live, 'T-001')?.state}/${nodeOf(live, 'T-002')?.state}`);
      c.check('Given 机检：T-003 正在执行', ['running', 'review'].includes(nodeOf(live, 'T-003')?.state), nodeOf(live, 'T-003')?.state);
      c.snap(root, 'state.before-cancel');
      c.check('Given：现场已就位（等待到 HO-002 accepted）', Boolean(ready), `${Date.now() - h.startedAt}ms`);

      const openHandoffs = (live?.handoffs ?? []).filter((x) => ['created', 'delivered', 'accepted'].includes(x.state));
      c.note(`取消前处于 created/delivered/accepted 的交接包：${openHandoffs.map((x) => `${x.handoffId}:${x.state}`).join('、') || '（无）'}`);

      // When：orch cancel --instance INST-001
      const res = c.cmd(cancel(root), 'orch cancel --instance INST-001');

      // Then：5 秒内结束、退出码 0
      c.check(`Then 命令在 ${LIMIT_MS / 1000} 秒内结束（实测 ${res.durationMs}ms）`, res.durationMs <= LIMIT_MS, `${res.durationMs}ms`);
      c.eq('Then 退出码 0', res.exitCode, 0);
      c.note(`orch cancel 实测耗时：${res.durationMs}ms（硬指标 ${LIMIT_MS}ms）`);

      // 取消输出佐证（会话/节点/交接包收尾行）
      const t = text(res);
      c.includes('Then 输出含「节点 T-003 审核者 已取消」', hitLine(t, '节点 T-003 审核者 已取消'), '节点 T-003 审核者 已取消');

      // 机检：实例 / 节点
      const after = readState(root);
      c.eq("机检：实例 state='cancelled'", after?.state, 'cancelled');
      c.eq("机检：T-001/T-002 state='done'",
        `${nodeOf(after, 'T-001')?.state}/${nodeOf(after, 'T-002')?.state}`, 'done/done');
      c.eq("机检：T-003 state='cancelled'", nodeOf(after, 'T-003')?.state, 'cancelled');

      // 机检：所有 created/delivered/accepted 的 handoff 都变 rejected/withdrawn
      const stillOpen = (after?.handoffs ?? []).filter((x) => ['created', 'delivered', 'accepted'].includes(x.state));
      c.eq('机检：取消后没有 handoff 停在 created/delivered/accepted', stillOpen.map((x) => x.handoffId).join(',') || '（无）', '（无）');
      const withdrawn = openHandoffs.map((x) => handoffOf(after, x.handoffId));
      c.check(
        '机检：取消前未结束的 handoff 都变 rejected 且 rejectReason=withdrawn',
        withdrawn.every((x) => x && x.state === 'rejected' && x.rejectReason === 'withdrawn'),
        withdrawn.map((x) => `${x?.handoffId}:${x?.state}/${x?.rejectReason}`).join('、')
      );

      // 机检：sessions 中没有 thinking/tool_running/waiting_input/waiting_dependency
      const busy = (after?.sessions ?? []).filter((s) => BUSY_SESSION.has(s.state));
      c.eq('机检：sessions 中没有 thinking/tool_running/waiting_input/waiting_dependency',
        busy.map((s) => `${s.sessionId}:${s.state}`).join(',') || '（无）', '（无）');

      // 佐证：事件里 run.cancelled 已落盘
      const cancelledEvents = readEvents(root).filter((e) => e.reason === 'run.cancelled');
      c.check('佐证：events 里有 run.cancelled 迁移', cancelledEvents.length > 0, cancelledEvents.map((e) => `${e.object}${e.objectId}`).join(','));

      const st = c.cmd(statusText(root), 'orch status --instance INST-001（取消后）');
      c.includes('佐证：status 显示实例已取消', hitLine(text(st), '实例 INST-001 · 已取消'), '实例 INST-001 · 已取消');
    } finally {
      await h.stop();
      c.keep('driver --scenario doc-slow-reviewer --keep（长驻进程由脚手架终止）', h, h.argv);
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
