// AC-42 派发失败 → 升级挂起，不假装执行中（dispatch-fail-first）。
import {
  makeCase, freshRoot, runSync, statusText, text, lines, nonEmptyLines,
  readState, readEvents, nodeOf, escalationOf, coreStop, forceKillCore,
  requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-42';
const SCENARIO = 'dispatch-fail-first';
const LIMIT_MS = 30000;

function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '派发失败 → 升级挂起，不假装执行中',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    try {
      // Given 夹具场景 dispatch-fail-first 已完整跑完
      const run = c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（完整跑完）`);
      const t = text(run);

      // Then 命令在 30 秒内结束，退出码是 4
      c.check(`Then 命令在 ${LIMIT_MS / 1000} 秒内结束（实测 ${run.durationMs}ms）`, run.durationMs <= LIMIT_MS, `${run.durationMs}ms`);
      c.eq('Then 退出码是 4', run.exitCode, 4);

      // And 输出的最后三行依次是挂起收尾三行
      const tail = nonEmptyLines(t).slice(-3);
      c.check('And 输出末尾是三行挂起收尾（不打印节点表其余行）', nonEmptyLines(t).length === 3,
        `${nonEmptyLines(t).length} 行：${nonEmptyLines(t).join(' / ')}`);
      c.eq('And 第 1 行「实例 INST-001 · 已挂起 · 模板 通用任务闭环」', tail[0], '实例 INST-001 · 已挂起 · 模板 通用任务闭环');
      c.matches('And 第 2 行「升级 … 待处理 · 节点 T-001 研究员 · 第 1 轮」', tail[1], /^升级 ESC-\d+ 待处理 · 节点 T-001 研究员 · 第 1 轮$/);
      c.eq('And 第 3 行「下一步：…」', tail[2],
        '下一步：查看详情 orch status --instance INST-001 --events；本版本不能继续，要终止请执行 orch cancel --instance INST-001');

      // When 我执行 orch status --instance INST-001
      const st = c.cmd(statusText(root), 'orch status --instance INST-001');
      const stt = text(st);
      c.includes('Then 输出含「原因：派遣失败：目标会话不可用」', hitLine(stt, '原因：派遣失败：目标会话不可用'), '原因：派遣失败：目标会话不可用');
      c.includes('Then 输出含「节点 T-001 研究员 已升级」', hitLine(stt, '节点 T-001 研究员 已升级'), '节点 T-001 研究员 已升级');

      // And 机检
      const s = readState(root);
      const esc = escalationOf(s, 0);
      c.eq("And 机检：实例 state='suspended'", s?.state, 'suspended');
      c.eq("And 机检：T-001 state='escalated'", nodeOf(s, 'T-001')?.state, 'escalated');
      c.eq("And 机检：escalations[0].reasonCode='dispatch_failed'", esc?.reasonCode, 'dispatch_failed');
      c.eq('And 机检：counters.dispatchCount=1', s?.counters?.dispatchCount, 1);
      c.eq('And 机检：sessions 为空（首派会话没建起来）', (s?.sessions ?? []).length, 0);

      // 佐证：同一时刻没有 node.dispatch 成功事件 / 没有交接包
      const events = readEvents(root);
      c.eq('佐证：events 中没有 handoff.created（首派失败不建交接包）',
        events.filter((e) => e.reason === 'handoff.created').length, 0);
      c.eq('佐证：events 中 node.dispatch 只有 1 条（第 1 轮首派）',
        events.filter((e) => e.reason === 'node.dispatch').length, 1);
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
