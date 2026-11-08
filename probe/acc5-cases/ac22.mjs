// AC-22 运行中角色为服务中且活跃会话、服务节点正确（夹具 + 机检）
// 宿主 id 用 `dsh`：需求要 `hostIcons` 含 `dsh`，而 code-loop 驱动硬编码 `--host mock`，
// 因此这里只借它的 `--prepare-only` 备现场，再用产品 `orch run --host dsh` 起实例。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, CODE_TASK, prepareCodeLoop, writeHostConfig, startProduct, waitPaused,
  roleShowJson, readState, sessionsOfNode, baseEnv, waitUntil, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-22';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：夹具把 code-loop 停在「开发完成、测试执行中」
    c.cmd(prepareCodeLoop(root, 'backflow'), '夹具：code-loop 驱动 --prepare-only --reset（备 .mock 现场）');
    c.noteFixture('写 .orch/hosts/dsh.json（launch 指向仓库内 mock agent，scenario=backflow）',
      writeHostConfig(root, { hostId: 'dsh', scenario: 'backflow' }));
    fs.mkdirSync(path.join(root, 'demo-code'), { recursive: true });

    const h = startProduct(root, ['run', '--cwd', './demo-code', '--task', CODE_TASK,
      '--template', 'code-loop', '--host', 'dsh'], {
      env: baseEnv({ MAESTRO_TEST_PAUSE: 'after_accepted:T-002' }),
      timeout: 90000
    });
    try {
      const paused = await waitPaused(root, { timeout: 60000 });
      c.check('Given 夹具：.mock/paused 存在（测试接受交接后暂停，节点仍在执行）', Boolean(paused),
        paused ? 'paused 存在' : '未等到 paused');

      // 暂停只挡住「推进」，不挡 saveLive：等核心把 T-002 的会话落盘后再取快照。
      const st = await waitUntil(() => {
        const snap = readState(root);
        const node = (snap?.nodes ?? []).find((n) => n.nodeId === 'T-002');
        return node?.sessionId ? snap : null;
      }, { timeout: 10000 });
      c.check('Given 机检：state.json 已记录 T-002 的会话（saveLive 已落盘）', Boolean(st),
        st ? 'T-002 sessionId 存在' : '10s 内未落盘');
      const t2 = (st?.nodes ?? []).find((n) => n.nodeId === 'T-002');
      const t2Sessions = sessionsOfNode(st, 'T-002');
      c.eq('Given 机检：T-001 为 done（开发完成）',
        (st?.nodes ?? []).find((n) => n.nodeId === 'T-001')?.state, 'done');
      c.eq('Given 机检：T-002 为 running（测试执行中）', t2?.state, 'running');

      // When
      const { res, payload } = roleShowJson(root, 'tester');
      c.cmd(res, 'orch role show tester --instance INST-001 --format json');
      c.evJson('payload', payload);

      // Then
      const view = payload?.roleInstance ?? {};
      c.eq("Then status === 'busy'", view.status, 'busy');
      c.eq('Then activeSessions 恰好 1 个', view.activeSessions?.length, 1);
      c.eq('Then 该会话就是 state.json 里 T-002 的会话', view.activeSessions?.[0], t2Sessions.at(-1)?.sessionId);
      c.eq('Then 该会话属于 T-002', t2Sessions.at(-1)?.nodeId, 'T-002');
      c.deepEq("Then servingNodes 为 ['T-002']", view.servingNodes, ['T-002']);
      c.includes('Then hostIcons 含 dsh', JSON.stringify(view.hostIcons), 'dsh');
      c.eq("Then lastAction.nodeId === 'T-002'", view.lastAction?.nodeId, 'T-002');
      c.eq('机检：roleInstanceId', view.roleInstanceId, 'RI-tester');

      // AC-26 的隔离分支不在本条判定；此处只留原始帧便于复核
      c.evJson('state-live', {
        state: st?.state,
        nodes: (st?.nodes ?? []).map((n) => ({ nodeId: n.nodeId, state: n.state, round: n.round, sessionId: n.sessionId })),
        sessions: (st?.sessions ?? []).map((s) => ({ sessionId: s.sessionId, nodeId: s.nodeId, state: s.state, hostId: s.hostId }))
      });
    } finally {
      await h.stop();
      c.keep('orch run --template code-loop --host dsh（MAESTRO_TEST_PAUSE=after_accepted:T-002，长驻）', h);
    }

    return finish(c);
  }
}];
