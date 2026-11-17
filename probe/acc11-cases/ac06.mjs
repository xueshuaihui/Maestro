// AC-06 去重与合并：机检 notify.test.js + D-46 意图组去重计数 1 / mergedCount [1,2,3,4] 单调递增 + 架构零命中。
import { makeCase, req, machineChecks, thenChecks, caseTmp, runCmd, finish } from '../acc11-f-common.mjs';
const AC = 'AC-06';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '通知 / 节流 / 机检 + 原始帧',
  async run() {
    const c = makeCase(AC, { face: '通知 / 节流 / 机检 + 原始帧', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['notify.test.js'],
      arch: [{ cmd: 'grep -REn "setTimeout" src/daemon/notify.js', expect: 1, note: 'AC-06 架构检查：合并窗口可注入时钟（now/schedule），无 setTimeout 直调，零命中（exit 1）' }],
      tmpdir: tmp
    });
    const dump = runCmd('NODE_ENV=test node probe/acc11-frame-dump.mjs notify ac06', { tmpdir: tmp });
    let frame = null;
    try { frame = JSON.parse(dump.stdout); } catch { /* 留 stdout 原文 */ }
    if (frame) { c.frame = frame; c.snap('frame', frame); }
    c.cmd(dump, 'frame-dump notify ac06');

    const n = c.testRuns.find((t) => t.file === 'notify.test.js');
    c.check('升级通知计数 2（10s 内 1 条 + 11s 后 1 条，由注入时钟单测 AC-06 覆盖）',
      Boolean(n?.v?.ok && n?.subtests?.some((x) => /AC-06: 同一升级 9999ms/.test(x))),
      (n?.subtests ?? []).filter((x) => /AC-06/.test(x)).join(' | ') || '（未找到）',
      '升级 9999ms 抑制 / 10001ms 放行 → 共 2 条');
    c.eq('异常意图组（kind,instanceId）去重后计数 1（D-46）', frame?.dedupeGroupCount, 1);
    c.eq('mergedCount 单调递增 [1,2,3,4]（逐字）', JSON.stringify(frame?.mergedCounts), JSON.stringify([1, 2, 3, 4]));
    const last = frame?.intents?.[frame.intents.length - 1] ?? {};
    c.eq('末条 mergedCount === 4', last.mergedCount, 4);
    c.includes('末条正文含 "共 4 次"（A-1 合并形态）', last.body ?? '', '共 4 次');
    c.eq('合并形态正文按 " · " 切分仍为 5 段', String(last.body ?? '').split(' · ').length, 5);
    c.check('首条异常即发（at < 2000ms，对齐 AC-03/BR-01 的 2 秒时效）', Number(frame?.intents?.[0]?.at) < 2000, String(frame?.intents?.[0]?.at), '< 2000');
    thenChecks(c);
    c.note('D-46 判读：异常首条立即发（mergedCount 1），窗口内后续同类按 (kind,instanceId) 并入并重发更新意图（mergedCount 递增、正文合并形态），壳层替换呈现 → 用户视角只 1 条。升级 10s 边界（9999/10001ms）由注入时钟单测覆盖。');
    return finish(c);
  }
}];
