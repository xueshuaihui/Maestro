// AC-24 已完成角色为冷却中（夹具 + 机检）
import {
  makeCase, freshRoot, roleShowJson, readState, requirementTitle, finish
} from '../acc5-f-common.mjs';
import { startCodeLoopRetest } from './_fixtures.mjs';

const AC = 'AC-24';

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'interrupted']);

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：code-loop 完成一次回流，T-001 已 done、T-002 正在 running（第 2 轮）
    const { h, state } = await startCodeLoopRetest(root);
    try {
      c.check('Given 夹具：T-001 已 done 且 T-002 正在第 2 轮执行', Boolean(state),
        state ? JSON.stringify((state.nodes ?? []).map((n) => [n.nodeId, n.state, n.round])) : '未等到中间态');

      // When
      const { res, payload } = roleShowJson(root, 'developer');
      c.cmd(res, 'orch role show developer --instance INST-001 --format json');
      c.evJson('payload', payload);

      // Then
      const view = payload?.roleInstance ?? {};
      c.eq("Then status === 'cooldown'", view.status, 'cooldown');
      c.deepEq('Then activeSessions 为空', view.activeSessions, []);
      c.deepEq('Then servingNodes 为空', view.servingNodes, []);
      c.eq('机检：statusReason 为 null', view.statusReason, null);

      const live = readState(root);
      c.check('机检：该实例 state 不是终态（不是 completed / failed / cancelled / interrupted）',
        live?.state !== undefined && !TERMINAL.has(live.state), String(live?.state));
    } finally {
      await h.stop();
      c.keep('driver --scenario retest-slow --keep（停在 T-002 第 2 轮执行中）', h);
    }

    return finish(c);
  }
}];
