// AC-45 停在「待校验（等待下游）」：核心活着能取消；重启后记成已中断且不重复派发。
//
// 两支必须分开根、顺序不能反：
//  A）先 core stop（对账成 interrupted，终态）→ status 看已中断停点 → cancel 被拒；
//  B）核心不停 → cancel 直接收敛为 cancelled。
import {
  makeCase, freshRoot, startKeep, waitMarker, statusText, cancel, text, lines, nonEmptyLines,
  readState, readEvents, nodeOf, handoffOf, statePath, sha256File, coreStop, forceKillCore,
  requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-45';
const SCENARIO = 'doc-pass';
const BUSY_SESSION = new Set(['thinking', 'tool_running', 'waiting_input', 'waiting_dependency']);
const LIMIT_MS = 5000;

function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}
function count(t, needle) {
  return lines(t).filter((l) => l.includes(needle)).length;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '停在「待校验（等待下游）」时可取消；重启后记成已中断',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const rootA = freshRoot(`${AC}-a`);
    const rootB = freshRoot(`${AC}-b`);
    c.add(rootA); c.add(rootB);

    const hA = startKeep(rootA, SCENARIO, ['--stop-after', '2'], undefined, 60000);
    let hB = null;
    try {
      // ================================================================ 分支 A
      const marker = await waitMarker(rootA, 2, { timeout: 40000 });
      c.check('Given 机检：.mock/stopped-after-2 存在', Boolean(marker), `${Date.now() - hA.startedAt}ms`);
      const live = readState(rootA);
      c.eq("Given 机检：T-001 state='done'", nodeOf(live, 'T-001')?.state, 'done');
      c.eq("Given 机检：T-002 state='review'", nodeOf(live, 'T-002')?.state, 'review');
      c.eq("Given 机检：T-002 reviewReason='downstream'", nodeOf(live, 'T-002')?.reviewReason, 'downstream');
      c.eq('Given 机检：handoffs 只有 HO-001 且 state=\'consumed\'',
        (live?.handoffs ?? []).map((h) => `${h.handoffId}:${h.state}`).join(','), 'HO-001:consumed');
      c.snap(rootA, 'state.live');

      const eventsBefore = readEvents(rootA);
      const seqBefore = eventsBefore.length;

      // When 我执行 orch core stop
      const stop = c.cmd(coreStop(rootA), 'orch core stop');
      c.eq('When core stop 退出码 0', stop.exitCode, 0);
      c.includes('When 输出含「核心已停止」', text(stop), '核心已停止');

      // And 我重新执行一次 orch status --instance INST-001（必要时自动拉起核心）
      const st = c.cmd(statusText(rootA), 'orch status --instance INST-001（重启后）');
      const t = text(st);
      c.eq('Then status 退出码 0', st.exitCode, 0);
      c.includes('Then 输出含「实例 INST-001 · 已中断 ｜ 停在节点 待校验 / 会话 等待下游」',
        hitLine(t, '实例 INST-001 · 已中断 ｜ 停在节点 待校验 / 会话 等待下游'),
        '实例 INST-001 · 已中断 ｜ 停在节点 待校验 / 会话 等待下游');
      c.eq('Then「实例 INST-001 · 已中断」只出现 1 次', count(t, '实例 INST-001 · 已中断'), 1);
      c.includes('Then 输出含「节点 T-001 研究员 已完成 · 第 1 轮」',
        hitLine(t, '节点 T-001 研究员 已完成 · 第 1 轮'), '节点 T-001 研究员 已完成 · 第 1 轮');
      c.includes('Then 输出含「节点 T-002 撰写者 待校验（等待下游） · 第 1 轮」',
        hitLine(t, '节点 T-002 撰写者 待校验（等待下游） · 第 1 轮'), '节点 T-002 撰写者 待校验（等待下游） · 第 1 轮');
      c.notIncludes('Then 不含「节点 T-002 撰写者 已完成」', t, '节点 T-002 撰写者 已完成');
      c.includes('Then 输出含「会话 等待下游」', hitLine(t, '会话 等待下游'), '会话 等待下游');
      c.includes('Then 输出含「交接包 HO-001  研究员→撰写者  已完成」',
        hitLine(t, '交接包 HO-001  研究员→撰写者  已完成'), '交接包 HO-001  研究员→撰写者  已完成');

      // And 机检：状态字段不被改写
      const afterStop = readState(rootA);
      c.eq("And 机检：实例 state='interrupted'", afterStop?.state, 'interrupted');
      c.eq("And 机检：T-002 仍是 'review'", nodeOf(afterStop, 'T-002')?.state, 'review');
      c.eq("And 机检：T-002 reviewReason 仍为 'downstream'", nodeOf(afterStop, 'T-002')?.reviewReason, 'downstream');
      c.eq("And 机检：T-001 仍是 'done'", nodeOf(afterStop, 'T-001')?.state, 'done');
      c.eq("And 机检：HO-001 仍是 'consumed'", handoffOf(afterStop, 'HO-001')?.state, 'consumed');

      // And 机检：相对停核心之前只多出 1 条 instance 层迁到 interrupted 的事件
      const eventsAfter = readEvents(rootA);
      const added = eventsAfter.slice(seqBefore);
      c.eq('And 机检：重启只多出 1 条事件', added.length, 1);
      c.eq('And 机检：新增事件是 instance → interrupted',
        added.map((e) => `${e.object}:${e.to}`).join(','), 'instance:interrupted');
      for (const reason of ['node.dispatch', 'handoff.created', 'review.evidence_verified']) {
        c.eq(`And 机检：没有新增 ${reason}`, added.filter((e) => e.reason === reason).length, 0);
      }

      // When 我执行 orch cancel --instance INST-001
      const shaBeforeCancel = sha256File(statePath(rootA));
      const cc = c.cmd(cancel(rootA), 'orch cancel --instance INST-001（已中断后）');
      c.includes('Then 输出含「实例已结束（已中断），无需取消」',
        hitLine(text(cc), '实例已结束（已中断），无需取消'), '实例已结束（已中断），无需取消');
      c.eq('Then 退出码 1', cc.exitCode, 1);
      c.eq('And 机检：这次取消没有改写 state.json（字节不变）', sha256File(statePath(rootA)), shaBeforeCancel);
      const afterCancel = readState(rootA);
      c.eq('And 机检：节点/交接包未变',
        `${(afterCancel?.nodes ?? []).map((n) => `${n.nodeId}:${n.state}`).join(',')}|${(afterCancel?.handoffs ?? []).map((x) => `${x.handoffId}:${x.state}`).join(',')}`,
        'T-001:done,T-002:review,T-003:pending|HO-001:consumed');
      c.eq('And 机检：会话状态未变', (afterCancel?.sessions ?? []).map((x) => x.state).join(','),
        (afterStop?.sessions ?? []).map((x) => x.state).join(','));

      await hA.stop();
      c.keep('driver --scenario doc-pass --stop-after 2 --keep（根 A；已停核心回收）', hA, hA.argv);

      // ================================================================ 分支 B
      hB = startKeep(rootB, SCENARIO, ['--stop-after', '2'], undefined, 60000);
      const markerB = await waitMarker(rootB, 2, { timeout: 40000 });
      c.check('Given 机检（根 B）：.mock/stopped-after-2 存在（核心不停）', Boolean(markerB), `${Date.now() - hB.startedAt}ms`);
      const liveB = readState(rootB);
      c.eq("Given 机检（根 B）：T-002 state='review' / reviewReason='downstream'",
        `${nodeOf(liveB, 'T-002')?.state}/${nodeOf(liveB, 'T-002')?.reviewReason}`, 'review/downstream');

      // When 我执行 orch cancel --instance INST-001
      const cb = c.cmd(cancel(rootB), 'orch cancel --instance INST-001（核心活着）');

      // Then 命令在 5 秒内结束，退出码 0
      c.check(`Then 命令在 ${LIMIT_MS / 1000} 秒内结束（实测 ${cb.durationMs}ms）`, cb.durationMs <= LIMIT_MS, `${cb.durationMs}ms`);
      c.eq('Then 退出码 0', cb.exitCode, 0);
      c.note(`根 B 的 orch cancel 实测耗时：${cb.durationMs}ms（硬指标 ${LIMIT_MS}ms）`);

      // And 机检：取消后的字段
      const b = readState(rootB);
      const t2 = nodeOf(b, 'T-002');
      c.eq("And 机检：实例 state='cancelled'", b?.state, 'cancelled');
      c.eq("And 机检：T-001 state='done'（已完成节点保持）", nodeOf(b, 'T-001')?.state, 'done');
      c.eq("And 机检：T-002 state='cancelled'", t2?.state, 'cancelled');
      c.eq('And 机检：T-002 reviewReason 取消落盘后为 null', t2?.reviewReason, null);
      c.eq("And 机检：HO-001 仍为 'consumed'（已消费的交接包不撤回）", handoffOf(b, 'HO-001')?.state, 'consumed');
      c.check('And 机检：T-002 endedAt 非空（派发过的节点取消后有耗时）',
        typeof t2?.endedAt === 'string' && t2.endedAt.length > 0, String(t2?.endedAt));
      const busy = (b?.sessions ?? []).filter((x) => BUSY_SESSION.has(x.state));
      c.eq('And 机检：sessions 中没有 thinking/tool_running/waiting_input/waiting_dependency',
        busy.map((x) => `${x.sessionId}:${x.state}`).join(',') || '（无）', '（无）');

      // When 我执行 orch status --instance INST-001
      const stB = c.cmd(statusText(rootB), 'orch status --instance INST-001（取消后）');
      const tb = text(stB);
      c.includes('Then 输出含「实例 INST-001 · 已取消」', hitLine(tb, '实例 INST-001 · 已取消'), '实例 INST-001 · 已取消');
      c.includes('Then 输出含「节点 T-002 撰写者 已取消」', hitLine(tb, '节点 T-002 撰写者 已取消'), '节点 T-002 撰写者 已取消');
      c.eq('Then 不再出现交接包等待行', count(tb, '等待目标响应'), 0);
      c.note('两支顺序固定：A 先在核心活着时 core stop（对账成终态 interrupted）→ status 看停点 → cancel 被拒；'
        + 'B 核心不停直接 cancel。停点提示点名的是真正卡住的 T-002（interruptedNodeId），不是节点表第一条 T-001。');
    } finally {
      await hA.stop();
      if (hB) {
        await hB.stop();
        c.keep('driver --scenario doc-pass --stop-after 2 --keep（根 B；长驻进程由脚手架终止）', hB, hB.argv);
      }
      for (const r of [rootA, rootB]) {
        c.cmd(coreStop(r), 'orch core stop');
        await forceKillCore(r);
      }
    }
    return finish(c);
  }
}];
