// AC-30 角色实例是派生视图，改状态即变且不回写（边界 + 机检）
import fs from 'node:fs';
import {
  makeCase, freshRoot, codeDriver, orch, roleShow, roleShowJson, readState, statePath, text,
  nonEmptyLines, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-30';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：实例已挂起（T-002 升级）
    c.cmd(codeDriver(root, ['--scenario', 'rounds-exceeded'], { timeout: 120000 }),
      'driver --scenario rounds-exceeded（T-002 升级 → 实例 suspended）');
    const before = readState(root);
    c.eq('Given 机检：实例 state === suspended', before?.state, 'suspended');
    c.eq('Given 机检：T-002 会话 quarantined === true',
      (before?.sessions ?? []).filter((s) => s.nodeId === 'T-002').at(-1)?.quarantined, true);

    const firstText = c.cmd(roleShow(root, 'tester', ['--instance', 'INST-001']),
      'orch role show tester --instance INST-001（挂起态，文本）');
    c.evText('show-before', text(firstText));
    c.includes('Given role show tester --instance 显示「不可用」', nonEmptyLines(text(firstText)).at(-1), '不可用');

    const first = roleShowJson(root, 'tester');
    c.cmd(first.res, 'orch role show tester --instance INST-001 --format json（挂起态）');
    c.evJson('payload-before', first.payload);
    c.eq("Given status === 'unavailable'", first.payload?.roleInstance?.status, 'unavailable');

    // When：手工把 T-002 的会话同时改成 state=idle 与 quarantined=false（升级路径会同时置这两个字段）
    c.cmd(orch(root, ['core', 'stop']), 'orch core stop（先停核心，确保下一次读走磁盘）');
    const file = statePath(root);
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const session of doc.sessions ?? []) {
      if (session.nodeId !== 'T-002') continue;
      session.state = 'idle';
      session.quarantined = false;
    }
    fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    c.noteFixture('手工改 state.json：T-002 的会话 state=idle、quarantined=false', file);
    const edited = readState(root);
    c.evJson('state-edited', {
      state: edited?.state,
      rev: edited?.rev,
      updatedAt: edited?.updatedAt,
      sessions: (edited?.sessions ?? []).map((s) => ({ sessionId: s.sessionId, nodeId: s.nodeId, state: s.state, quarantined: s.quarantined }))
    });

    const second = roleShowJson(root, 'tester');
    c.cmd(second.res, 'orch role show tester --instance INST-001 --format json（改完状态后）');
    c.evJson('payload-after', second.payload);

    // Then
    c.eq("Then 状态变为 'available'", second.payload?.roleInstance?.status, 'available');
    c.eq('机检：statusReason 前后为 escalated → null',
      `${first.payload?.roleInstance?.statusReason}→${second.payload?.roleInstance?.statusReason}`, 'escalated→null');
    const after = readState(root);
    c.eq('机检：两次读的 rev 相同（读命令没有回写）', after?.rev, edited?.rev);
    c.eq('机检：state.json 的 updatedAt 未变', after?.updatedAt, edited?.updatedAt);
    c.eq('机检：state.json 里 T-002 节点仍是 escalated（派生视图不改节点）',
      (after?.nodes ?? []).find((n) => n.nodeId === 'T-002')?.state, 'escalated');

    return finish(c);
  }
}];
