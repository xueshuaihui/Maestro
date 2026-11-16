// AC-03 实例异常时托盘通知：机检 notify.test.js + A-1 异常正文逐字 + D-46 首条即发 + 架构零命中。
import { makeCase, req, machineChecks, thenChecks, caseTmp, runCmd, finish } from '../acc11-f-common.mjs';
const AC = 'AC-03';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '通知 / 异常 / 机检 + 原始帧',
  async run() {
    const c = makeCase(AC, { face: '通知 / 异常 / 机检 + 原始帧', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['notify.test.js'],
      arch: [{ cmd: 'grep -REn "P90|TTL" src/daemon/notify.js', expect: 1, note: 'AC-03 架构检查：异常判定复用既有 health，不在通知层重算，零命中（exit 1）' }],
      tmpdir: tmp
    });
    const dump = runCmd('NODE_ENV=test node probe/acc11-frame-dump.mjs notify ac03', { tmpdir: tmp });
    let frame = null;
    try { frame = JSON.parse(dump.stdout); } catch { /* 留 stdout 原文 */ }
    if (frame) { c.frame = frame; c.snap('frame', frame); }
    c.cmd(dump, 'frame-dump notify ac03');

    const it = frame?.intents?.[0] ?? {};
    c.eq('意图 kind=anomaly（逐字）', it.kind, 'anomaly');
    c.eq('标题逐字 A-1 异常标题', it.title, '通知 实例异常 · INST-001');
    c.eq('正文逐字 A-1 异常五段（single：升级 — / T-001 执行者 / 第 1 轮 / 已中断，需关注）', it.body,
      '实例 INST-001 · 升级 — · 节点 T-001 执行者 · 第 1 轮 · 已中断，需关注');
    const seg = String(it.body ?? '').split(' · ');
    c.eq('正文按 " · " 切分恰为 5 段', seg.length, 5);
    c.eq('第 2 段逐字 升级 —', seg[1], '升级 —');
    c.check('第 5 段以 已中断 开头且含 需关注', String(seg[4] ?? '').startsWith('已中断') && String(seg[4] ?? '').includes('需关注'),
      seg[4] ?? '', '已中断，需关注');
    c.eq('同类通知计数为 1（D-46 首条即发、单异常天然 1 条）', frame?.intentCountRaw, 1);
    c.eq('去重组计数 1', frame?.dedupeGroupCount, 1);
    c.eq('mergedCount=1（首条即发满足 2 秒时效）', it.mergedCount, 1);
    c.check('首条意图 at < 2000ms（2 秒时效，注入时钟下延迟 0）', Number(it.at) < 2000, String(it.at), '< 2000');
    thenChecks(c);
    c.note('逐字断言由 test/wp14/notify.test.js 的 AC-03 主用例 + 3 个变体承载；D-46 口径：异常首条即发、窗口内更新意图去重后仍算一条。');
    return finish(c);
  }
}];
