// AC-36 status 显示审批与暂停（正常路径 / mock 夹具面）
// A/B/C/D 四类 Given 以真实跑出的状态为母版克隆改写；全部断言落在真实 CLI 输出。
import {
  makeCase, freshRoot, runScene, statusText, statusAll, installLegacyV1,
  cloneState, mutateState, approvalRow, readState, instanceIds,
  text, lines, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-36';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // 母版：真实完成的编码闭环
    c.cmd(runScene(root, { scenario: 'pass' }), 'orch run code-loop pass（母版）');
    // A：已暂停
    mutateState(root, 'INST-001', (s) => { s.state = 'running'; s.paused = true; });
    // B：hold 待处理审批且未暂停
    cloneState(root, 'INST-001', 'INST-002', (s) => {
      s.state = 'running'; s.paused = false;
      s.approvals = [approvalRow('APR-001', 'INST-002')];
    });
    // C：I1.3 的无审批旧实例（v1 单对象）
    installLegacyV1(root, 'OLD-001');
    // D：三条已处理审批（已通过 / 已拒绝 / 已作废）
    cloneState(root, 'INST-001', 'INST-004', (s) => {
      s.state = 'completed'; s.paused = false;
      s.approvals = [
        approvalRow('APR-001', 'INST-004', { state: 'approved', resolution: 'allow', resolvedAt: '2026-11-08T19:00:00.000Z' }),
        approvalRow('APR-002', 'INST-004', { state: 'denied', resolution: 'deny', resolvedAt: '2026-11-08T19:00:01.000Z' }),
        approvalRow('APR-003', 'INST-004', { state: 'withdrawn', resolution: null }),
      ];
    });
    c.check('夹具：A/B/C/D 四类实例齐全', instanceIds(root).length === 4, instanceIds(root).join(','));
    c.note('Given 的暂停/审批/旧格式以真实状态为母版克隆改写或安装 legacy-v1 夹具；视图 RPC 逐字段渲染，构造 Given 不等于伪造结论。');

    const A = c.cmd(statusText(root, 'INST-001'), 'orch status --instance INST-001（A 已暂停）');
    const B = c.cmd(statusText(root, 'INST-002'), 'orch status --instance INST-002（B 待处理审批）');
    const C = c.cmd(statusText(root, 'OLD-001'), 'orch status --instance OLD-001（C 旧实例）');
    const D = c.cmd(statusText(root, 'INST-004'), 'orch status --instance INST-004（D 三条已处理审批）');
    const all = c.cmd(statusAll(root), 'orch status（不带参数）');

    c.includes('Then：A 的实例行显示「运行中（已暂停）」', lines(text(A))[0], '实例 INST-001 · 运行中（已暂停）');
    c.includes('Then：B 在升级块之后出现待处理审批行', text(B), '升级 —');
    c.includes('Then：B 待处理审批行含审批号/节点/角色/动作', text(B), '审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write');
    c.check('机检：B 的审批行位于升级块之后', text(B).indexOf('审批 APR-001') > text(B).indexOf('升级 —'), '升级块在前');
    c.notIncludes('Then：C 不出现审批行', text(C), '审批');
    c.includes('机检：C 的实例输出与 I1.3 A-2 一致（无审批段、单节点显示）', text(C), '实例 OLD-001 · 已完成');
    c.includes('机检：C 仍显示会话与交接包（旧字段可读）', text(C), '节点 已完成');
    c.includes('Then：D 逐条显示「已通过」', text(D), '审批 APR-001 已通过 · 节点 T-001 开发 · 动作 write');
    c.includes('Then：D 逐条显示「已拒绝」', text(D), '审批 APR-002 已拒绝 · 节点 T-001 开发 · 动作 write');
    c.includes('Then：D 逐条显示「已作废」', text(D), '审批 APR-003 已作废 · 节点 T-001 开发 · 动作 write');

    const listRows = lines(text(all)).filter((l) => l.startsWith('实例 '));
    c.check('机检：列表行中 A 带「（已暂停）」', listRows.some((l) => l.includes('实例 INST-001') && l.includes('运行中（已暂停）')), listRows.join('|'));
    c.check('机检：列表行中 B 带「待处理审批 1」', listRows.some((l) => l.includes('实例 INST-002') && l.includes('待处理审批 1')), listRows.join('|'));
    return conclude(c, root);
  },
}];
