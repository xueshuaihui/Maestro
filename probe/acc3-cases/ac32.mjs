// AC-32 审核以文件为准，不以对话为准（review-says-pass 定格在 stop-after 4；review-says-reject 反向）。
import path from 'node:path';
import {
  makeCase, freshRoot, startKeep, runSync, readState, readEvents, nodeOf,
  coreStop, forceKillCore, requirementTitle, finish, waitMarker, exists
} from '../acc3-f-common.mjs';

const AC = 'AC-32';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '审核以文件为准，不以对话为准',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const rootA = freshRoot(AC);
    const rootB = freshRoot(`${AC}-b`);
    c.add(rootA);
    c.add(rootB);

    // ---- Given A：review-says-pass --stop-after 4 --keep（对话说“全部通过”，文件写 reject）
    const h = startKeep(rootA, 'review-says-pass', ['--stop-after', '4'], undefined, 60000);
    try {
      const marker = await waitMarker(rootA, 4, { timeout: 45000 });
      c.check('Given 机检：`.mock/stopped-after-4` 存在', Boolean(marker) && exists(path.join(rootA, '.mock', 'stopped-after-4')),
        `${Date.now() - h.startedAt}ms`);

      const s = readState(rootA);
      c.eq('Given 机检：停在 4 次派发之后', s?.counters?.dispatchCount, 4);
      c.eq('Given 机检：T-002 已进入第 2 轮（回流已投递）', nodeOf(s, 'T-002')?.round, 2);

      // Then：T-003 第 1 轮按文件判 reject，并发生回流
      const t3 = nodeOf(s, 'T-003');
      c.eq("Then 机检：T-003 第 1 轮 review.decision='reject'", t3?.review?.decision, 'reject');
      const backflow = (s?.handoffs ?? []).filter((x) => x?.edge?.kind === 'backflow');
      c.check("Then 机检：存在 edge.kind='backflow' 的交接包", backflow.length === 1,
        backflow.map((x) => `${x.handoffId}:${x.state}`).join(',') || '（无）');
      const backflowEvents = readEvents(rootA).filter((e) => e.reason === 'backflow.constructed');
      c.eq('Then 机检：events 里有 backflow.constructed（文件 reject 生效）', backflowEvents.length, 1);
      c.snap(rootA, 'state.stopped-after-4');
      c.note('对话消息是「全部通过」但核心按 out/review.json 的 reject 走；不放行到底（步骤耗尽会变 dispatch_failed）。');
    } finally {
      await h.stop();
      c.keep('driver --scenario review-says-pass --keep --stop-after 4', h, h.argv);
      c.cmd(coreStop(rootA), 'orch core stop（A）');
      await forceKillCore(rootA);
    }

    // ---- Given B：review-says-reject（对话说“不通过”，文件写 pass）
    try {
      const run = c.cmd(runSync(rootB, 'review-says-reject'), 'driver --scenario review-says-reject（完整跑完）');
      c.eq('Given（B）前置：夹具跑完退出码 0', run.exitCode, 0);

      const sb = readState(rootB);
      c.eq("Then（B）机检：T-003 review.decision='pass'", nodeOf(sb, 'T-003')?.review?.decision, 'pass');
      c.eq("Then（B）机检：实例 state='completed'", sb?.state, 'completed');
      const backflowB = (sb?.handoffs ?? []).filter((x) => x?.edge?.kind === 'backflow');
      c.eq("And（B）机检：没有 edge.kind='backflow' 的交接包", backflowB.length, 0);
      c.eq('佐证（B）：handoffs 只有 2 条（无回流）', (sb?.handoffs ?? []).length, 2);
    } finally {
      c.cmd(coreStop(rootB), 'orch core stop（B）');
      await forceKillCore(rootB);
    }

    return finish(c);
  }
}];
