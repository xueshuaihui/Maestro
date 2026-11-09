// AC-25 失败处理升级 → 实例失败（异常 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, escalateResolve, readState, readEvents,
  reasonsOf, text,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-25';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    c.cmd(runScene(root, { scenario: 'rounds-exceeded' }), 'orch run code-loop rounds-exceeded（待处理升级，实例挂起）');
    const before = readState(root);
    const dispatchBefore = before?.counters?.dispatchCount;
    const dispatchEventsBefore = reasonsOf(readEvents(root)).filter((r) => r === 'node.dispatch').length;

    const res = c.cmd(escalateResolve(root, 'ESC-001', 'fail', 'INST-001'),
      'orch escalate resolve ESC-001 --instance INST-001 --decision fail');
    c.includes('Then：输出「升级 ESC-001 已处理（失败）」', text(res), '升级 ESC-001 已处理（失败）');
    c.includes('Then：输出实例失败行「实例 INST-001 · 失败 · 模板 编码闭环」', text(res), '实例 INST-001 · 失败 · 模板 编码闭环');

    const after = readState(root);
    c.eq('机检：实例 failed', after?.state, 'failed');
    c.check('机检：节点 failed', (after?.nodes ?? []).some((n) => n.state === 'failed'), (after?.nodes ?? []).map((n) => n.state).join(','));
    c.eq('Then：没有新的下游派发（dispatchCount 不再增加）', after?.counters?.dispatchCount, dispatchBefore);
    c.eq('机检：events.jsonl 没有新增 node.dispatch（失败处理不派发下游）',
      reasonsOf(readEvents(root)).filter((r) => r === 'node.dispatch').length, dispatchEventsBefore);
    return conclude(c, root);
  },
}];
