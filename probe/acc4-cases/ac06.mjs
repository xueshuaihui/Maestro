// AC-06 工作区建不出来时发起前停住（异常 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, readEvents, reasonsOf, instanceIds, statePath, exists, text,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-06';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    const r = c.cmd(runScene(root, { scenario: 'pass', env: { MAESTRO_FAULT: 'workspace_init:fail' } }),
      'orch run code-loop（MAESTRO_FAULT=workspace_init:fail）');

    c.includes('Then：终端出现「无法创建工作区：…」', text(r), '无法创建工作区：');
    c.eq('Then：退出码 3', r.exitCode, 3);
    c.eq('Then：没有留下半个实例目录', instanceIds(root).length, 0);
    c.eq('机检：.orch/instances/INST-001 不存在', exists(statePath(root)), false);
    c.notIncludes('机检：events.jsonl 没有 node.dispatch', reasonsOf(readEvents(root)).join(','), 'node.dispatch');
    c.eq('机检：没有会话记录', (readEvents(root) ?? []).filter((e) => e.reason === 'session.state').length, 0);
    c.note('「没有会话」以 events 无 session.state 事件 + 无实例目录取证；退出码 3 对齐 A-5 WORKSPACE_INIT_FAILED。');
    return conclude(c, root);
  },
}];
