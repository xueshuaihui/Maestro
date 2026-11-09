// AC-02 文档闭环每个节点都有阶段区（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, readState, readStatusMd, nodeOf,
  requirementTitle, conclude, checkWorkspace, checkStatusMd, DOC_TASK,
} from '../acc4-f-common.mjs';

const AC = 'AC-02';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    c.cmd(runScene(root, { scenario: 'doc-pass', suite: 'task-loop', template: 'task-loop', task: DOC_TASK }),
      'orch run task-loop（夹具 doc-pass）');

    const { md } = checkWorkspace(c, root, { stages: ['T-001', 'T-002', 'T-003'] });
    checkStatusMd(c, md, { template: '通用任务闭环' });

    c.includes('机检：status.md 节点段落列出 T-001', md, '- T-001 研究员');
    c.includes('机检：status.md 节点段落列出 T-002', md, '- T-002 撰写者');
    c.includes('机检：status.md 节点段落列出 T-003', md, '- T-003 审核者');

    const s = readState(root);
    for (const id of ['T-001', 'T-002', 'T-003']) {
      c.eq(`机检：${id} state=done`, nodeOf(s, id)?.state, 'done');
    }
    c.eq('机检：template=task-loop', s?.template, 'task-loop');
    return conclude(c, root);
  },
}];
