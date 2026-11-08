// AC-28 活跃会话数与并发上限同时展示，且上限来自注册表（夹具 + 机检）
import {
  makeCase, freshRoot, roleShow, roleShowJson, writeRole, readState, text, nonEmptyLines,
  requirementTitle, finish
} from '../acc5-f-common.mjs';
import { startTaskLoopWriter } from './_fixtures.mjs';

const AC = 'AC-28';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：task-loop 停在撰写执行中（内置 writer 上限 2）
    const { h, paused } = await startTaskLoopWriter(root);
    try {
      c.check('Given 夹具：.mock/paused 存在（撰写回合在飞行）', Boolean(paused), paused ? 'paused 存在' : '未等到 paused');

      const first = c.cmd(roleShow(root, 'writer', ['--instance', 'INST-001']), 'orch role show writer --instance INST-001（内置上限）');
      const firstRows = nonEmptyLines(text(first));
      c.evText('show-builtin', text(first));
      const firstLine = firstRows.at(-1) ?? '';
      c.includes('Then 第一次显示「活跃会话 1/2」', firstLine, '活跃会话 1/2');

      const firstJson = roleShowJson(root, 'writer');
      c.cmd(firstJson.res, 'orch role show writer --instance INST-001 --format json（内置上限）');
      c.evJson('payload-builtin', firstJson.payload);
      c.eq('机检：maxConcurrentSessions 前为 2', firstJson.payload?.roleInstance?.maxConcurrentSessions, 2);
      c.eq('机检：activeSessions.length 为 1', firstJson.payload?.roleInstance?.activeSessions?.length, 1);
      const revBefore = readState(root)?.rev;

      // When：放一份上限为 3 的合法覆盖定义，重读同一份实例状态
      const file = writeRole(root, 'writer', {
        id: 'writer',
        name: '撰写者',
        group: 'writing',
        summary: '按大纲写初稿（项目版上限 3）',
        artifactType: 'document',
        sideEffect: 'write',
        skills: ['doc-draft'],
        tools: ['read', 'write'],
        wakeAllow: [],
        max: 3
      });
      c.noteFixture('写 .orch/roles/writer.yaml（max_concurrent_sessions: 3）', file);

      const second = c.cmd(roleShow(root, 'writer', ['--instance', 'INST-001']), 'orch role show writer --instance INST-001（项目覆盖上限 3）');
      const secondLine = nonEmptyLines(text(second)).at(-1) ?? '';
      c.evText('show-project', text(second));
      c.includes('Then 覆盖后显示「活跃会话 1/3」（同一份实例状态，只有上限变了）', secondLine, '活跃会话 1/3');

      const secondJson = roleShowJson(root, 'writer');
      c.cmd(secondJson.res, 'orch role show writer --instance INST-001 --format json（项目覆盖上限 3）');
      c.evJson('payload-project', secondJson.payload);
      c.eq('机检：maxConcurrentSessions 后为 3', secondJson.payload?.roleInstance?.maxConcurrentSessions, 3);
      c.eq('机检：activeSessions.length 始终为 1', secondJson.payload?.roleInstance?.activeSessions?.length, 1);
      c.deepEq('机检：两次的 activeSessions 是同一批会话',
        secondJson.payload?.roleInstance?.activeSessions, firstJson.payload?.roleInstance?.activeSessions);
      c.eq('机检：实例状态未被读命令改变（rev 相同）', readState(root)?.rev, revBefore);
      c.eq('机检：覆盖后角色来源变为项目', secondJson.payload?.role?.source, 'project');
    } finally {
      await h.stop();
      c.keep('driver --scenario doc-pass --keep（MAESTRO_TEST_PAUSE=after_accepted:T-002）', h);
    }

    return finish(c);
  }
}];
