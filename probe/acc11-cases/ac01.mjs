// AC-01 升级待处理时托盘通知：机检 notify.test.js + A-1 五段段序逐字 + 架构零命中。
import { makeCase, req, machineChecks, thenChecks, caseTmp, runCmd, finish } from '../acc11-f-common.mjs';
const AC = 'AC-01';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '通知 / 机检 + 原始帧',
  async run() {
    const c = makeCase(AC, { face: '通知 / 机检 + 原始帧', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['notify.test.js'],
      arch: [{ cmd: 'grep -REn "new EventEmitter|setInterval" src/daemon/notify.js', expect: 1, note: 'AC-01 架构检查：notify.js 无定时器/事件总线直调，零命中（exit 1）' }],
      tmpdir: tmp
    });
    // 原始帧：与 notify.test.js 同模块同夹具，取真实意图输出
    const dump = runCmd('NODE_ENV=test node probe/acc11-frame-dump.mjs notify ac01', { tmpdir: tmp });
    let frame = null;
    try { frame = JSON.parse(dump.stdout); } catch { /* 留 stdout 原文 */ }
    if (frame) { c.frame = frame; c.snap('frame', frame); }
    c.cmd(dump, 'frame-dump notify ac01');

    const it = frame?.intents?.[0] ?? {};
    c.eq('意图 kind=escalation（逐字）', it.kind, 'escalation');
    c.eq('意图 instanceId=INST-001（逐字）', it.instanceId, 'INST-001');
    c.eq('标题逐字 A-1 升级标题', it.title, '通知 升级待处理 · INST-001');
    c.eq('正文逐字 A-1 五段（single：T-001 执行者 / 第 1 轮 / reasonDetail）', it.body,
      '实例 INST-001 · 升级 ESC-001 · 节点 T-001 执行者 · 第 1 轮 · 执行失败：测试未通过');
    c.eq('正文按 " · " 切分恰为 5 段', String(it.body ?? '').split(' · ').length, 5);
    c.eq('第 1 段逐字 实例 INST-001', String(it.body ?? '').split(' · ')[0], '实例 INST-001');
    c.eq('第 2 段逐字 升级 ESC-001', String(it.body ?? '').split(' · ')[1], '升级 ESC-001');
    c.eq('第 3 段逐字 节点 T-001 执行者', String(it.body ?? '').split(' · ')[2], '节点 T-001 执行者');
    c.eq('第 4 段逐字 第 1 轮', String(it.body ?? '').split(' · ')[3], '第 1 轮');
    c.eq('意图计数 1（单条升级）', frame?.intentCountRaw, 1);
    c.eq('去重组计数 1', frame?.dedupeGroupCount, 1);
    c.eq('mergedCount=1', it.mergedCount, 1);
    thenChecks(c);
    c.note('逐字断言由 test/wp14/notify.test.js 的 AC-01 / AC-01 变体用例承载（五段段序、缺段渲染 —）；本用例复跑取原始意图帧。');
    return finish(c);
  }
}];
