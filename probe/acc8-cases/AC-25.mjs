/**
 * AC-25 · 真实 DSH：只广告 resume、不广告 load，恢复走 resume（真实宿主面）。
 *
 * 机检（需求 `:584`）：
 *  - `initialize` 的 `sessionCapabilities` 键集含 `close` / `list` / `resume`，**不含** `load`；
 *  - `instance log` 的方言行只含 `session/resume`，没有 `session/load`；
 *  - 实例恢复后「运行中」，已完成节点不再重跑。
 *
 * 取证方式：真实 DSH 0.2.2（隔离 `DSH_HOME`）+ 产品自身 CLI 的编码闭环；
 * 在「T-001 已完成 / T-002 运行中」窗口 `SIGKILL` 核心后重启，恢复路径为真实 RPC。
 */
import { makeCase, evidence, eq, includes, excludes, check, note, finish, realCrashRecovery } from '../acc8-f-common.mjs';
import { GRADING_REAL } from '../acc8-f-lib.mjs';

export async function run() {
  const c = makeCase('AC-25', {
    scenario: 'real-host-resume-dialect',
    title: '真实 DSH：只广告 resume、不广告 load，恢复走 resume',
    grading: GRADING_REAL,
  });

  const rec = await realCrashRecovery({ label: 'ac25' });
  c.root = rec.home?.projectRoot ?? null;

  evidence(c, 'caps', 'initialize.json', JSON.stringify({
    host: rec.host,
    caps: rec.caps ? { keys: rec.caps.keys, hasClose: rec.caps.hasClose, hasList: rec.caps.hasList, hasResume: rec.caps.hasResume, hasLoad: rec.caps.hasLoad, canResume: rec.caps.canResume, canLoad: rec.caps.canLoad } : null,
    raw: rec.caps?.raw ?? null,
  }, null, 2));

  if (rec.error) {
    evidence(c, 'error', 'flow.txt', `${rec.error}\n${rec.run?.stderr ?? ''}`);
    note(c, `真实宿主流程失败：${rec.error}`);
    return finish(c);
  }

  evidence(c, 'given', 'state.before.json', JSON.stringify(rec.before, null, 2));
  evidence(c, 'then', 'recover.log', rec.logAfterRecovery || rec.restart?.stdout || '(empty)');
  evidence(c, 'then', 'state.after.json', JSON.stringify(rec.after, null, 2));
  evidence(c, 'then', 'events.recovery.json', JSON.stringify(rec.after?.recoveryEvents ?? [], null, 2));

  // 1) 能力广告：close / list / resume 在，load 不在
  check(c, 'initialize 键集含 close / list / resume', Boolean(rec.caps?.hasClose && rec.caps?.hasList && rec.caps?.hasResume), JSON.stringify(rec.caps?.keys ?? null));
  eq(c, 'initialize 键集不含 load', rec.caps?.hasLoad, false);
  eq(c, 'canResume = true（真实宿主广告 resume）', rec.caps?.canResume, true);
  eq(c, 'canLoad = false（真实宿主不广告 load）', rec.caps?.canLoad, false);

  // 2) 强杀窗口成立：已完成节点 + 运行中节点
  const doneNodes = (rec.before?.nodes ?? []).filter((n) => n.state === 'done').map((n) => n.nodeId);
  const runningNodes = (rec.before?.nodes ?? []).filter((n) => n.state === 'running').map((n) => n.nodeId);
  check(c, '强杀窗口含已完成节点', doneNodes.length >= 1, JSON.stringify(doneNodes));
  check(c, '强杀窗口含运行中节点', runningNodes.length >= 1, JSON.stringify(runningNodes));
  eq(c, '强杀方式 = 核心进程 SIGKILL（非 core stop）', rec.kill?.signal === 'SIGKILL' && rec.kill?.ok === true, true);

  // 3) 恢复后方言行：只 session/resume，没有 session/load
  const logText = rec.logAfterRecovery || rec.restart?.stdout || '';
  includes(c, 'instance log 出现「session/resume（不回放）」', logText, 'session/resume（不回放）');
  excludes(c, 'instance log 不含 session/load', logText, 'session/load');
  const dialects = (rec.after?.sessions ?? []).map((s) => s.dialect).filter(Boolean);
  eq(c, '会话方言集合只含 resume', Array.from(new Set(dialects)), ['resume']);

  // 4) 实例「运行中」+ 已完成节点不重跑
  eq(c, '恢复后实例状态 = running', rec.after?.state, 'running');
  check(c, '恢复后写入 recoveredAt 且 recovery 摘要存在', Boolean(rec.after?.recoveredAt) && Boolean(rec.after?.recovery), JSON.stringify({ recoveredAt: rec.after?.recoveredAt, recovery: rec.after?.recovery }));
  for (const id of doneNodes) {
    eq(c, `已完成节点 ${id} 的 node.dispatch 次数不增加`, rec.after?.dispatch?.[id] ?? 0, rec.before?.dispatch?.[id] ?? 0);
  }

  note(c, `真实宿主版本 ${rec.host?.version ?? '未知'}（需求基线 0.2.2-rc.1，本机如实登记漂移）`);
  note(c, `强杀前会话：${JSON.stringify((rec.before?.sessions ?? []).map((s) => s.sessionId))}`);
  note(c, '轮次说明：真实模型一轮即通过（判定 通过），实跑窗口为「第 1 轮开发已完成 + 测试运行中」；'
    + '「已完成节点 + 运行中节点」的恢复语义与第 2 轮相同，未人为制造失败轮次（不伪造）。');
  return finish(c);
}
