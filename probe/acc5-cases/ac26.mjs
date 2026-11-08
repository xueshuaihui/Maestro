// AC-26 会话升级时角色为不可用（夹具 + 机检）
import {
  makeCase, freshRoot, codeDriver, roleShowJson, readState, nodeOf, text, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-26';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：两轮都不通过 → T-002 升级（确定性场景 rounds-exceeded，不依赖时序）
    const run = c.cmd(codeDriver(root, ['--scenario', 'rounds-exceeded'], { timeout: 120000 }),
      'driver --scenario rounds-exceeded（测试两轮不通过 → 升级）');
    c.evText('driver', text(run));
    const st = readState(root);
    c.eq('Given 机检：T-002 节点 state === escalated', nodeOf(st, 'T-002')?.state, 'escalated');
    c.eq('Given 机检：T-002 的会话 state === escalated',
      (st?.sessions ?? []).filter((s) => s.nodeId === 'T-002').at(-1)?.state, 'escalated');
    c.eq('Given 机检：实例 state === suspended（非终态，故不是 retired）', st?.state, 'suspended');

    // When
    const { res, payload } = roleShowJson(root, 'tester');
    c.cmd(res, 'orch role show tester --instance INST-001 --format json');
    c.evJson('payload', payload);

    // Then
    const view = payload?.roleInstance ?? {};
    c.eq("Then status === 'unavailable'", view.status, 'unavailable');
    c.eq("Then statusReason === 'escalated'", view.statusReason, 'escalated');
    c.eq('机检：roleInstanceId', view.roleInstanceId, 'RI-tester');

    c.note('隔离分支（`quarantined === true` → `statusReason === quarantined`）按需求原文不设独立 AC，'
      + '由 `test/wp11/role-instances.test.js` 的单测覆盖（D-9）；本条只判 escalated 分支。');

    return finish(c);
  }
}];
