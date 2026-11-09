// AC-41 instance graph --format json 稳定可回归（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, instanceGraph, graphJson, text,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const A4_KEYS = ['graphVersion', 'instanceId', 'template', 'state', 'paused',
  'nodes', 'edges', 'handoffs', 'escalations', 'approvals', 'current'];

const AC = 'AC-41';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    c.cmd(runScene(root, { scenario: 'pass' }), 'orch run code-loop pass（已完成的编码闭环）');

    const res = c.cmd(instanceGraph(root, 'INST-001', 'json'), 'orch instance graph INST-001 --format json');
    const g = graphJson(res);
    c.check('Then：输出可解析为 JSON 对象', Boolean(g) && typeof g === 'object', String(text(res)).slice(0, 300));
    c.eq('Then：退出码 0', res.exitCode, 0);
    c.eq('机检：键顺序与附录 A-4 一致', JSON.stringify(Object.keys(g ?? {})), JSON.stringify(A4_KEYS));
    c.eq('A-4：graphVersion === 1', g?.graphVersion, 1);
    c.eq('A-4：instanceId === INST-001', g?.instanceId, 'INST-001');
    c.eq('A-4：template === code-loop', g?.template, 'code-loop');
    c.eq('A-4：state === completed', g?.state, 'completed');
    c.eq('A-4：paused === false', g?.paused, false);
    c.check('A-4：nodes 含节点号/标题/角色/状态/轮次',
      (g?.nodes ?? []).length === 2 && g.nodes.every((n) => ['nodeId', 'title', 'roleId', 'state', 'round'].every((k) => k in n)),
      JSON.stringify(g?.nodes));
    c.eq('A-4：节点 title 保留中文标题', g?.nodes?.[0]?.title, '开发');
    c.eq('A-4：节点 roleId 保留英文标识', g?.nodes?.[0]?.roleId, 'developer');
    c.check('A-4：edges 含来源/目标/方向',
      (g?.edges ?? []).length === 3 && g.edges.every((e) => ['from', 'to', 'kind'].every((k) => k in e)),
      JSON.stringify(g?.edges));
    c.eq('A-4：边方向覆盖 forward / backflow / retest', JSON.stringify((g?.edges ?? []).map((e) => e.kind)), JSON.stringify(['forward', 'backflow', 'retest']));
    c.check('A-4：handoffs / escalations / approvals / current 都存在',
      Array.isArray(g?.handoffs) && Array.isArray(g?.escalations) && Array.isArray(g?.approvals) && 'current' in (g ?? {}),
      JSON.stringify({ h: g?.handoffs?.length, e: g?.escalations?.length, a: g?.approvals?.length }));

    const res2 = c.cmd(instanceGraph(root, 'INST-001', 'json'), 'orch instance graph INST-001 --format json（复跑）');
    c.eq('机检：两次执行输出逐字一致', text(res2), text(res));
    return conclude(c, root);
  },
}];
