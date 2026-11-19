// AC-07 通知不可用：只提示一次不阻断：机检 notify.test.js + shell-notify.test.js + A-2 提示逐字 + 架构零命中。
import { makeCase, req, machineChecks, thenChecks, caseTmp, runCmd, finish } from '../acc11-f-common.mjs';
const AC = 'AC-07';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '通知 / 异常 / 机检 + 原始帧',
  async run() {
    const c = makeCase(AC, { face: '通知 / 异常 / 机检 + 原始帧', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['notify.test.js', 'shell-notify.test.js'],
      arch: [{ cmd: 'grep -REn "throw new Error" src/daemon/notify.js', expect: 1, note: 'AC-07 架构检查：投递失败不重试/不抛到主流程，零命中（exit 1；S2 新建文件）' }],
      tmpdir: tmp
    });
    const dump = runCmd('NODE_ENV=test node probe/acc11-frame-dump.mjs notify ac07', { tmpdir: tmp });
    let frame = null;
    try { frame = JSON.parse(dump.stdout); } catch { /* 留 stdout 原文 */ }
    if (frame) { c.frame = frame; c.snap('frame', frame); }
    c.cmd(dump, 'frame-dump notify ac07');

    c.eq('3 个不同 escalationId → 3 条 notify 意图（去重组 3）', frame?.dedupeGroupCount, 3);
    c.eq('raw 意图计数 3（3 个不同编号，非同条目去重）', frame?.intentCountRaw, 3);
    const ids = (frame?.intents ?? []).map((i) => i.ids?.[0]).sort();
    c.eq('3 个编号互不相同 ESC-001/002/003', JSON.stringify(ids), JSON.stringify(['ESC-001', 'ESC-002', 'ESC-003']));
    // A-2 提示逐字 + 只出现一次：由 shell-notify.test.js 的 config.rs 锚点 + notify.test.js 行为兜底承载。
    const sh = c.testRuns.find((t) => t.file === 'shell-notify.test.js');
    c.check('壳层提示锚点存在：config.rs 通知不可用提示 + --no-notify 只关投递层', Boolean(sh?.v?.ok && sh?.subtests?.some((x) => /config\.rs|--no-notify/.test(x))), (sh?.subtests ?? []).filter((x) => /config|--no-notify/.test(x)).join(' | ') || '（未找到）', '提示「通知不可用 · 队列仍可用」逐字、首次投递失败只提示一次');
    const n = c.testRuns.find((t) => t.file === 'notify.test.js');
    c.check('行为兜底：状态读失败/偏好读失败不阻断后续意图、3 条逐条产生', Boolean(n?.v?.ok && (n?.subtests ?? []).filter((x) => /AC-07/.test(x)).length >= 3), (n?.subtests ?? []).filter((x) => /AC-07/.test(x)).join(' | ') || '（未找到）', '3 条 delivered=false 且实例继续推进');
    thenChecks(c);
    c.note('A-2 提示「通知不可用 · 队列仍可用」逐字见 config.rs（shell-notify.test.js 锚点）；无头环境系统通知投递失败属预期，判定只看意图已产生且流程未受阻。同条目 10s 内重复去重属 BR-04，由 AC-06 注入时钟单测覆盖，不在本 AC 混计。');
    return finish(c);
  }
}];
