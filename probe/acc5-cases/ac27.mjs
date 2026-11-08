// AC-27 实例结束后角色为已关闭且仍可查（边界 + 机检）
import {
  makeCase, freshRoot, roleShow, roleShowJson, readState, text, nonEmptyLines,
  requirementTitle, finish
} from '../acc5-f-common.mjs';
import { runSingleChain } from './_fixtures.mjs';

const AC = 'AC-27';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：single 主链跑完（实例 completed）
    const run = c.cmd(runSingleChain(root), 'orch run --cwd ./work --task 「写一段 200 字的产品说明，保存到 out/intro.md」（single）');
    c.evText('run', text(run));
    c.eq('Given 机检：single run 退出码 0', run.exitCode, 0);
    const st = readState(root);
    c.eq('Given 机检：实例 state === completed', st?.state, 'completed');

    // When
    const textRes = c.cmd(roleShow(root, 'worker', ['--instance', 'INST-001']),
      'orch role show worker --instance INST-001');
    const rows = nonEmptyLines(text(textRes));
    c.evText('show', text(textRes));
    c.eq('Then 退出码 0', textRes.exitCode, 0);
    const last = rows.at(-1) ?? '';
    c.includes('Then 状态显示「已关闭」', last, '已关闭');
    c.includes('Then 活跃会话 0', last, '活跃会话 0');
    c.includes('Then 服务节点 —', last, '服务节点 —');

    const { res, payload } = roleShowJson(root, 'worker');
    c.cmd(res, 'orch role show worker --instance INST-001 --format json');
    c.evJson('payload', payload);
    const view = payload?.roleInstance ?? {};
    c.eq("机检：status === 'retired'", view.status, 'retired');
    c.eq('机检：roleInstanceId', view.roleInstanceId, 'RI-worker');
    c.deepEq('机检：activeSessions 为空', view.activeSessions, []);
    c.deepEq('机检：servingNodes 为空', view.servingNodes, []);

    return finish(c);
  }
}];
