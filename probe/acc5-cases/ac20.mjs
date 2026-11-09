// AC-20 声明但未绑定节点的角色不参与派发（夹具 + 机检）
import {
  makeCase, freshRoot, CODE_DRIVER, startDriver, waitMarker, readState, roleListJson, viewOf,
  roleIdsOf, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-20';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：code-loop 完成一次回流后停在 T-002 第 2 轮（backflow = 开发1 → 测试不通过 → 开发2 → 测试通过）
    const h = startDriver(root, ['--scenario', 'backflow', '--stop-after', '4', '--keep'],
      { driver: CODE_DRIVER, timeout: 90000 });
    try {
      const marker = await waitMarker(root, 4, { timeout: 60000 });
      c.check('Given 夹具：停在 .mock/stopped-after-4（回流水回写完成、实例非终态）', Boolean(marker),
        marker ? 'stopped-after-4 存在' : '未等到 stopped-after-4');

      const st = readState(root);
      c.eq('Given 机检：实例 state = running（不是终态）', st?.state, 'running');

      // When
      const { res, payload } = roleListJson(root);
      c.cmd(res, 'orch role list --instance INST-001 --format json');
      c.evJson('payload', payload);

      // Then
      c.deepEq('Then 角色实例集合为 developer / tester / coordinator 三个',
        roleIdsOf(payload), ['coordinator', 'developer', 'tester']);
      const coord = viewOf(payload, 'coordinator');
      c.eq('机检：coordinator.status === inactive', coord?.status, 'inactive');
      c.deepEq('机检：coordinator.servingNodes === []', coord?.servingNodes, []);
      c.deepEq('机检：coordinator.activeSessions === []', coord?.activeSessions, []);
      c.eq('机检：state.json 的 nodes[].roleId 集合不含 coordinator',
        (st?.nodes ?? []).some((n) => n.roleId === 'coordinator'), false);
      c.check('机检：instance.roleToSessions 里没有 coordinator 键',
        !Object.prototype.hasOwnProperty.call(payload?.instance?.roleToSessions ?? {}, 'coordinator'),
        JSON.stringify(payload?.instance?.roleToSessions));
      c.eq('Then 协调者没有会话（roleToSessions 无该键）、没有节点、没有派发', coord?.lastAction, null);
    } finally {
      await h.stop();
      c.keep('driver --scenario backflow --stop-after 4 --keep（长驻，跑完停核心）', h);
    }

    return finish(c);
  }
}];
