// AC-03 单节点工作区新增但不改旧输出（回归 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, readState, readEvents, readStatusMd, readInbox,
  reasonsOf, workspacePath, exists, text, SINGLE_TASK,
  requirementTitle, conclude, checkWorkspace, checkStatusMd,
} from '../acc4-f-common.mjs';

const AC = 'AC-03';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    // 不带 --template single
    const r = c.cmd(runScene(root, { scenario: 'pass', template: null, task: SINGLE_TASK }),
      'orch run --cwd ./demo --task「写下说明」（不带 --template）');

    // Then：终端前三行与 I1.1 基线逐字一致（会话号由宿主给出，按 A-3 归一化）
    const ls = r.stdout.split('\n');
    c.eq('Then：第 1 行逐字', ls[0].trim(), '实例 INST-001 · 运行中');
    c.matches('Then：第 2 行「会话已创建 <宿主会话号>」', ls[1].trim(), /^会话已创建 mock-sess-\d+-\d+$/);
    c.eq('Then：第 3 行逐字', ls[2].trim(), '任务已投递');

    const { md } = checkWorkspace(c, root, { single: true });
    checkStatusMd(c, md, { template: '单节点', single: true });
    c.includes('Then：status.md 含实例行', md, '# INST-001 单节点');
    c.includes('Then：status.md 含状态行', md, '- 状态：已完成');
    c.notIncludes('Then：status.md 不含 ## 节点 段', md, '## 节点');

    // 机检：stage 目录不存在；handoffs 只有引导包且没有 handoff.rejected
    c.eq('机检：stage 目录不存在', exists(`${workspacePath(root)}/stage`), false);
    const s = readState(root);
    c.eq('机检：handoffs 只有引导包', (s?.handoffs ?? []).length, 1);
    c.eq('机检：引导包号 HO-001', s?.handoffs?.[0]?.handoffId, 'HO-001');
    c.notIncludes('机检：没有 handoff.rejected 事件', reasonsOf(readEvents(root)).join(','), 'handoff.rejected');
    c.includes('机检：引导包不参与 schema 校验（state=consumed，无 rejectReason）',
      `${s?.handoffs?.[0]?.state}|${s?.handoffs?.[0]?.rejectReason ?? 'null'}`, 'consumed|null');
    return conclude(c, root);
  },
}];
