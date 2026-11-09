// AC-07 多节点提示词带工作区上下文段（夹具 / mock 夹具面 + 架构检查）
// 9 个多节点提示词：code-loop backflow 4 个 + task-loop doc-backflow-once 5 个。
import fs from 'node:fs';
import path from 'node:path';
import { promptFor } from '../../src/templates/index.js';
import {
  makeCase, freshRoot, runScene, readPrompts, workspacePath, REPO,
  requirementTitle, conclude, checkA6, DOC_TASK, SINGLE_TASK,
} from '../acc4-f-common.mjs';

const AC = 'AC-07';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const rootA = freshRoot(AC); c.add(rootA);
    const rootB = freshRoot(`${AC}-task`); c.add(rootB);
    const rootC = freshRoot(`${AC}-single`); c.add(rootC);

    // code-loop：入口 T-001 / forward T-002 / backflow T-001(r2) / retest T-002(r2)
    c.cmd(runScene(rootA, { scenario: 'backflow' }), 'orch run code-loop（含 1 次回流与 1 次复测）');
    const pA = readPrompts(rootA);
    checkA6(c, 'code-loop 入口 T-001', pA, '1.json', { root: rootA, nodeId: 'T-001', entry: true });
    checkA6(c, 'code-loop forward T-002', pA, '2.json', { root: rootA, nodeId: 'T-002', upstream: 'T-001' });
    checkA6(c, 'code-loop backflow T-001 第 2 轮', pA, '3.json', { root: rootA, nodeId: 'T-001', upstream: 'T-002' });
    checkA6(c, 'code-loop retest T-002 第 2 轮', pA, '4.json', { root: rootA, nodeId: 'T-002', upstream: 'T-001' });

    // task-loop：研究 T-001 / 撰写 T-002 / 审核 T-003 / 撰写回流 T-002(r2) / 复测审核 T-003(r2)
    c.cmd(runScene(rootB, { scenario: 'doc-backflow-once', suite: 'task-loop', template: 'task-loop', task: DOC_TASK }),
      'orch run task-loop（含 1 次驳回回流）');
    const pB = readPrompts(rootB);
    checkA6(c, 'task-loop 研究 T-001', pB, '1.json', { root: rootB, nodeId: 'T-001', entry: true });
    checkA6(c, 'task-loop 撰写 T-002', pB, '2.json', { root: rootB, nodeId: 'T-002', upstream: 'T-001' });
    checkA6(c, 'task-loop 审核 T-003 第 1 轮', pB, '3.json', { root: rootB, nodeId: 'T-003', upstream: 'T-002', bodyHasWorkspace: true });
    checkA6(c, 'task-loop 撰写回流 T-002 第 2 轮', pB, '4.json', { root: rootB, nodeId: 'T-002', upstream: 'T-003' });
    checkA6(c, 'task-loop 复测审核 T-003 第 2 轮', pB, '5.json', { root: rootB, nodeId: 'T-003', upstream: 'T-002', bodyHasWorkspace: true });

    c.eq('夹具：9 个多节点提示词（4 + 5）', Object.keys(pA).length + Object.keys(pB).length, 9);

    // 单节点提示词不出现该段
    c.cmd(runScene(rootC, { scenario: 'pass', template: null, task: SINGLE_TASK }), 'orch run single（不带 --template）');
    const single = readPrompts(rootC)['1.json'];
    c.check('夹具：单节点提示词存在', Boolean(single) && typeof single.task === 'string', JSON.stringify(Object.keys(readPrompts(rootC))));
    c.notIncludes('Then：单节点提示词不出现工作区上下文段', String(single?.task ?? ''), '工作区：');
    c.notIncludes('Then：单节点提示词不出现共享区只读行', String(single?.task ?? ''), '共享区（只读）');

    // 机检：promptFor 单元调用（只传 node 不带 graph / 单节点图 / 多节点图）
    const baseNode = { id: 'T-001', nodeId: 'T-001', prompt: 'single' };
    const unitNoGraph = promptFor({ node: baseNode, task: 'x', workspaceDir: '/tmp/ws' });
    c.notIncludes('机检：只传 node 不带 graph 的 promptFor 单元调用不追加该段', unitNoGraph, '工作区：');
    const unitSingleGraph = promptFor({ node: baseNode, task: 'x', workspaceDir: '/tmp/ws', graph: { nodes: [baseNode] } });
    c.notIncludes('机检：single 图只有 1 个节点，因而不追加', unitSingleGraph, '共享区（只读）');
    const unitMultiGraph = promptFor({ node: baseNode, task: 'x', workspaceDir: '/tmp/ws', graph: { nodes: [baseNode, { id: 'T-002', nodeId: 'T-002' }] } });
    c.includes('机检：graph.nodes.length > 1 时追加工作区上下文段', unitMultiGraph, '共享区（只读）：/tmp/ws/shared');

    // 架构检查：判定只按节点数、不按模板名；生产派发调用都带 graph
    const tplSrc = fs.readFileSync(path.join(REPO, 'src', 'templates', 'index.js'), 'utf8');
    const fnAt = tplSrc.indexOf('function workspaceContextLines');
    const fnBody = tplSrc.slice(fnAt, fnAt + 1200);
    c.includes('架构检查：追加条件按节点数 graph.nodes.length <= 1', fnBody, 'graph.nodes.length <= 1');
    c.notIncludes('架构检查：判定不含模板名字面量分支', fnBody, "'single'");
    c.notIncludes('架构检查：判定不含 template 分支', fnBody, 'template !==');
    const prodSrc = ['src/core/advance.js', 'src/core/orchestrator.js']
      .map((f) => fs.readFileSync(path.join(REPO, f), 'utf8')).join('\n');
    const calls = prodSrc.split('promptFor({').slice(1).map((ch) => ch.slice(0, 420));
    const withGraph = calls.filter((ch) => /\bgraph\s*[,:]/.test(ch)).length;
    const withoutGraph = calls.filter((ch) => !/\bgraph\s*[,:]/.test(ch)).length;
    c.eq('架构检查：生产派发 6 处 promptFor 调用都带 graph', withGraph, 6);
    c.eq('架构检查：不带 graph 的仅纯构造器 buildBackflowHandoff（单元调用）1 处', withoutGraph, 1);
    return conclude(c, [rootA, rootB, rootC]);
  },
}];
