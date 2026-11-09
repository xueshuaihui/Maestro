// AC-59 status.md 刷新失败不回滚状态（异常 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, statusText, instanceLog, readState,
  readEvents, readStatusMd, reasonsOf, text, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-59';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given/When：MAESTRO_FAULT=workspace_status_write:fail，实例发生多次节点状态变化
    const r = c.cmd(runScene(root, { scenario: 'pass', env: { MAESTRO_FAULT: 'workspace_status_write:fail' } }),
      'MAESTRO_FAULT=workspace_status_write:fail orch run code-loop pass');
    const s = readState(root);
    const ev = readEvents(root);
    const reasons = reasonsOf(ev);
    const md = readStatusMd(root);
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    const lg = c.cmd(instanceLog(root, 'INST-001'), 'orch instance log INST-001');

    c.eq('Then：实例继续推进（run 退出码 0）', r.exitCode, 0);
    c.eq('Then：实例状态 completed', s?.state, 'completed');
    c.eq('机检：state.json 的节点状态已更新（不回滚）', s?.nodes?.[0]?.state, 'done');
    c.check('机检：events.jsonl 含 workspace.status_write_failed', reasons.includes('workspace.status_write_failed'), reasons.join(','));
    c.check('机检：后续状态变化仍会尝试刷新（失败事件多次）',
      reasons.filter((x) => x === 'workspace.status_write_failed').length >= 2,
      String(reasons.filter((x) => x === 'workspace.status_write_failed').length));
    c.includes('Then：status 仍显示新状态', text(st), '实例 INST-001 · 已完成');
    c.includes('Then：instance log 能看到一次状态页写入失败事件（reason=workspace.status_write_failed）', text(lg), 'workspace.status_write_failed');
    c.includes('机检：instance log 将该原因渲染为「状态页写入失败」', text(lg), '状态页写入失败');
    c.note('需求 AC-59 Then 的「工作区状态写入失败」为事件措辞；产品 labels.js 将其逐字渲染为「状态页写入失败」，事件 reason 仍为 workspace.status_write_failed（A-5 未登记该文案为逐字基线，按机检口径判定）。');
    c.check('机检：status.md 仍存在（写入被尝试但失败，不影响状态）', typeof md === 'string' && md.startsWith('# '), String(md).slice(0, 80));
    return conclude(c, root);
  },
}];
