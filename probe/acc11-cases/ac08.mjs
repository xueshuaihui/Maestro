// AC-08 队列合并/排序/空态：机检 queue.test.js + A-3 八字段/排序/降级/空态 + 三条架构零命中。
import { makeCase, req, machineChecks, thenChecks, caseTmp, runCmd, finish } from '../acc11-f-common.mjs';
const AC = 'AC-08';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '队列 / 投影 / 机检 + 原始帧',
  async run() {
    const c = makeCase(AC, { face: '队列 / 投影 / 机检 + 原始帧', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['queue.test.js'],
      arch: [
        { cmd: 'grep -REn "saveState|appendEvent" src/daemon/queue.js', expect: 1, note: 'AC-08 架构：队列只读投影，不写状态，零命中（exit 1）' },
        { cmd: 'grep -REn "renderApprovalLine" desktop/ui/ src/daemon/queue.js', expect: 1, note: 'AC-08 架构：审批行由桌面自有模板，不复用 CLI renderApprovalLine，零命中（exit 1）' },
        { cmd: 'grep -REn "searchBox|filterBar|columnPicker|columnToggle" desktop/ui/queue/', expect: 1, note: 'AC-08 架构：不提供筛选/搜索/自定义列，零命中（exit 1）' }
      ],
      tmpdir: tmp
    });
    const dump = runCmd('NODE_ENV=test node probe/acc11-frame-dump.mjs queue ac08', { tmpdir: tmp });
    let frame = null;
    try { frame = JSON.parse(dump.stdout); } catch { /* 留 stdout 原文 */ }
    if (frame) { c.frame = frame; c.snap('frame', frame); }
    c.cmd(dump, 'frame-dump queue ac08');

    c.eq('排序逐字 [ESC-001, ESC-002, APR-001]（升级在审批前，同类按编号）', JSON.stringify(frame?.order), JSON.stringify(['ESC-001', 'ESC-002', 'APR-001']));
    c.eq('totals 逐字 {pendingEscalations:2, pendingApprovals:1}', JSON.stringify(frame?.totals), JSON.stringify({ pendingEscalations: 2, pendingApprovals: 1 }));
    const KEYS = ['type', 'id', 'instanceId', 'nodeId', 'role', 'round', 'stateWord', 'reasonSummary', 'createdAt'];
    c.eq('每行为同一套八字段模板（九字段含 type）', JSON.stringify(frame?.itemKeys?.[0]), JSON.stringify(KEYS));
    c.eq('审批行与升级行同模板（字段集合一致）', JSON.stringify(frame?.itemKeys?.[2]), JSON.stringify(KEYS));
    // A-3 逐字：逐字断言由 queue.test.js 的纯投影用例承载（stateWord/reasonSummary/createdAt 等）。
    const q = c.testRuns.find((t) => t.file === 'queue.test.js');
    c.check('A-3 三行逐字八字段（含审批行实例/轮次/动作/时间）由 queue.test.js 承载', Boolean(q?.v?.ok && q?.subtests?.some((x) => /buildQueue：跨实例合并/.test(x))), (q?.subtests ?? []).filter((x) => /buildQueue/.test(x)).join(' | ') || '（未找到）', '八字段模板逐字、排序 ESC-001/ESC-002/APR-001');
    c.check('降级断言：APR-009 无 nodeId 仍 7 段、节点 — / 第 — 轮、空态「待处理 无」', Boolean(q?.v?.ok && q?.subtests?.some((x) => /无节点审批行轮次为 null/.test(x))), (q?.subtests ?? []).filter((x) => /无节点审批行/.test(x)).join(' | ') || '（未找到）', '节点 — / 第 — 轮 / 待处理 无');
    c.eq('空态 items 空、totals 归零', JSON.stringify(frame?.empty?.items), '[]');
    c.eq('空态文案逐字 A-3', frame?.empty?.emptyText, '待处理 无');
    thenChecks(c);
    c.note('八字段逐字与降级/断线位由 test/wp14/queue.test.js 纯投影用例承载；本用例复跑取 buildQueue 原始投影帧，并用 desktop/harness/queue-dump.mjs 同模块渲染。');
    return finish(c);
  }
}];
