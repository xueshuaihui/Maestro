// AC-29 角色到会话的映射保留全部会话（夹具 + 机检）
import {
  makeCase, freshRoot, roleListJson, readState, sessionsOfNode, waitUntil, requirementTitle, finish
} from '../acc5-f-common.mjs';
import { startCodeLoopRetest } from './_fixtures.mjs';

const AC = 'AC-29';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：一次回流后 T-001 与 T-002 的第 2 轮都已派发，停在 T-002 第 2 轮执行中
    const { h, state } = await startCodeLoopRetest(root);
    try {
      c.check('Given 夹具：T-001 与 T-002 都已进入第 2 轮', Boolean(state)
        && (state.nodes ?? []).every((n) => n.round === 2),
        JSON.stringify((state?.nodes ?? []).map((n) => [n.nodeId, n.round, n.state])));

      // When：等第 2 轮的两个会话都建好（T-002 的第 2 轮会话在节点 running 之后才创建）
      const ready = await waitUntil(() => {
        const probe = roleListJson(root);
        const map = probe.payload?.instance?.roleToSessions ?? {};
        return (map.developer?.length ?? 0) >= 2 && (map.tester?.length ?? 0) >= 2 ? probe : null;
      }, { timeout: 25000, label: '两个节点各 2 个会话' });
      c.check('Given 机检：两个节点各已新建第 2 轮会话', Boolean(ready),
        ready ? 'roleToSessions 各 2 个' : '25s 内未达到');
      const { res, payload } = ready ?? roleListJson(root);
      c.cmd(res, 'orch role list --instance INST-001 --format json');
      c.evJson('payload', payload);
      const map = payload?.instance?.roleToSessions ?? {};

      // Then
      c.eq('Then roleToSessions.developer 有 2 个会话 id', map.developer?.length, 2);
      c.eq('Then roleToSessions.tester 有 2 个会话 id', map.tester?.length, 2);

      const disk = readState(root);
      const devOnDisk = sessionsOfNode(disk, 'T-001').map((s) => s.sessionId);
      const testerOnDisk = sessionsOfNode(disk, 'T-002').map((s) => s.sessionId);
      c.evJson('sessions-on-disk', { developer: devOnDisk, tester: testerOnDisk, state: disk?.sessions?.map((s) => s.sessionId) });
      c.deepEq('机检：developer 的会话与 state.json 里 T-001 的会话顺序一致', map.developer, devOnDisk);
      c.deepEq('机检：tester 的会话与 state.json 里 T-002 的会话顺序一致', map.tester, testerOnDisk);
      c.check('机检：两个数组都按创建顺序（与 state.json 的 sessions[] 顺序一致）',
        JSON.stringify(map.developer) === JSON.stringify(devOnDisk)
        && JSON.stringify(map.tester) === JSON.stringify(testerOnDisk),
        JSON.stringify(map));
    } finally {
      await h.stop();
      c.keep('driver --scenario retest-slow --keep（停在 T-002 第 2 轮执行中）', h);
    }

    return finish(c);
  }
}];
