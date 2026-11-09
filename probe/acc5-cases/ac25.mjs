// AC-25 声明未绑定角色为未参与（夹具 + 机检）
import {
  makeCase, freshRoot, roleShow, roleShowJson, text, nonEmptyLines, requirementTitle, finish
} from '../acc5-f-common.mjs';
import { startCodeLoopRetest } from './_fixtures.mjs';

const AC = 'AC-25';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：code-loop 停在 T-002 执行中
    const { h, state } = await startCodeLoopRetest(root);
    try {
      c.eq('Given 机检：T-002 running', (state?.nodes ?? []).find((n) => n.nodeId === 'T-002')?.state, 'running');

      // When
      const textRes = c.cmd(roleShow(root, 'coordinator', ['--instance', 'INST-001']),
        'orch role show coordinator --instance INST-001');
      const rows = nonEmptyLines(text(textRes));
      c.evText('show', text(textRes));
      const last = rows.at(-1) ?? '';
      c.includes('Then 文本输出为「未参与」', last, '未参与');
      c.includes('机检：末行形如「实例 INST-001：未参与 …」', last, '实例 INST-001：未参与');

      const { res, payload } = roleShowJson(root, 'coordinator');
      c.cmd(res, 'orch role show coordinator --instance INST-001 --format json');
      c.evJson('payload', payload);
      const view = payload?.roleInstance ?? {};
      c.eq("Then status === 'inactive'", view.status, 'inactive');
      c.deepEq('Then servingNodes 为空', view.servingNodes, []);
      c.deepEq('Then activeSessions 为空', view.activeSessions, []);
      c.check('Then roleToSessions 里没有 coordinator 键',
        !Object.prototype.hasOwnProperty.call(payload?.instance?.roleToSessions ?? {}, 'coordinator'),
        JSON.stringify(payload?.instance?.roleToSessions));
      c.eq('机检：同一实例里 coordinator 的实例 id 为 RI-coordinator', view.roleInstanceId, 'RI-coordinator');
    } finally {
      await h.stop();
      c.keep('driver --scenario retest-slow --keep（停在 T-002 第 2 轮执行中）', h);
    }

    return finish(c);
  }
}];
