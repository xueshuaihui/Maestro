// AC-23 未开始角色为可用（夹具 + 机检）
import {
  makeCase, freshRoot, CODE_DRIVER, startDriver, waitPaused, roleShowJson, readState,
  baseEnv, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-23';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：code-loop 刚启动、T-001 尚未完成（暂停在开发产出之后、节点仍未 done）
    const h = startDriver(root, ['--scenario', 'backflow', '--keep'], {
      driver: CODE_DRIVER,
      env: baseEnv({ MAESTRO_TEST_PAUSE: 'after_output:T-001' }),
      timeout: 90000
    });
    try {
      const paused = await waitPaused(root, { timeout: 60000 });
      c.check('Given 夹具：.mock/paused 存在（首个 turn 内冻结）', Boolean(paused), paused ? 'paused 存在' : '未等到 paused');

      const st = readState(root);
      const t1 = (st?.nodes ?? []).find((n) => n.nodeId === 'T-001');
      c.check('Given 机检：T-001 尚未 done（仍在 review / running）',
        t1 !== undefined && t1.state !== 'done', `${t1?.nodeId}:${t1?.state}`);
      c.eq('Given 机检：T-002 尚未派发（pending）',
        (st?.nodes ?? []).find((n) => n.nodeId === 'T-002')?.state, 'pending');

      // When
      const { res, payload } = roleShowJson(root, 'tester');
      c.cmd(res, 'orch role show tester --instance INST-001 --format json');
      c.evJson('payload', payload);

      // Then
      const view = payload?.roleInstance ?? {};
      c.eq("Then status === 'available'", view.status, 'available');
      c.deepEq('Then activeSessions 为空', view.activeSessions, []);
      c.deepEq('Then servingNodes 为空', view.servingNodes, []);
      c.eq('机检：statusReason 为 null', view.statusReason, null);
      c.eq('机检：maxConcurrentSessions 取自注册表（tester = 1）', view.maxConcurrentSessions, 1);
    } finally {
      await h.stop();
      c.keep('driver --scenario backflow --keep（MAESTRO_TEST_PAUSE=after_output:T-001）', h);
    }

    return finish(c);
  }
}];
