// AC-02 实例完成时托盘通知：机检 notify.test.js + A-1 完成正文逐字 + 架构零命中。
import { makeCase, req, machineChecks, thenChecks, caseTmp, runCmd, finish } from '../acc11-f-common.mjs';
const AC = 'AC-02';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '通知 / 机检 + 原始帧',
  async run() {
    const c = makeCase(AC, { face: '通知 / 机检 + 原始帧', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['notify.test.js'],
      arch: [{ cmd: 'grep -REn "saveState" src/daemon/notify.js', expect: 1, note: 'AC-02 架构检查：完成通知检测点只读状态不写盘，零命中（exit 1）' }],
      tmpdir: tmp
    });
    const dump = runCmd('NODE_ENV=test node probe/acc11-frame-dump.mjs notify ac02', { tmpdir: tmp });
    let frame = null;
    try { frame = JSON.parse(dump.stdout); } catch { /* 留 stdout 原文 */ }
    if (frame) { c.frame = frame; c.snap('frame', frame); }
    c.cmd(dump, 'frame-dump notify ac02');

    const it = frame?.intents?.[0] ?? {};
    c.eq('意图 kind=completed（逐字）', it.kind, 'completed');
    c.eq('标题逐字 A-1 完成标题', it.title, '通知 实例完成 · INST-001');
    c.eq('正文逐字 A-1 完成五段（single：升级 — / T-001 执行者 / 第 1 轮 / 已完成，单节点 1/1）', it.body,
      '实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已完成，单节点 1/1');
    const seg = String(it.body ?? '').split(' · ');
    c.eq('正文按 " · " 切分恰为 5 段', seg.length, 5);
    c.eq('第 2 段逐字 升级 —（缺段不省略）', seg[1], '升级 —');
    c.includes('第 5 段含 已完成 与工作流名 单节点', seg[4] ?? '', '已完成');
    c.includes('第 5 段含 1/1', seg[4] ?? '', '1/1');
    c.eq('同一实例完成通知只 1 条（生命周期一次）', frame?.intentCountRaw, 1);
    thenChecks(c);
    c.note('逐字断言由 test/wp14/notify.test.js 的 AC-02 / AC-02 变体用例承载（完成意图只一次、缺段 —）；本用例复跑取原始意图帧。');
    return finish(c);
  }
}];
