// AC-10 升级「重派」：轮次+1、绑定新会话、回运行中；机检 queue.test.js。
import { makeCase, req, machineChecks, thenChecks, caseTmp, runCmd, finish } from '../acc11-f-common.mjs';
const AC = 'AC-10';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '处置 / 机检',
  async run() {
    const c = makeCase(AC, { face: '处置 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['queue.test.js'],
      arch: [{ cmd: 'grep -REn "session/new|sessionNew" src/daemon/queue.js', expect: 1, note: 'AC-10 架构：重派复用既有派发路径，队列层不直接建会话，零命中（exit 1）' }],
      tmpdir: tmp
    });
    const q = c.testRuns.find((t) => t.file === 'queue.test.js');
    c.check('重派断言存在（resolution=retry / round=2 / sessionId 非空 / 实例运行中 / 队列消失）',
      Boolean(q?.subtests?.some((x) => /升级·重派：轮次 \+1/.test(x))), (q?.subtests ?? []).filter((x) => /重派/.test(x)).join(' | ') || '（未找到）', 'resolution retry / round 2 / session 非空');
    c.check('重派用例通过（# fail 0）', Boolean(q?.v?.ok), `# pass ${q?.tap?.pass ?? 0} / # fail ${q?.tap?.fail ?? 0}`, '# fail 0');
    thenChecks(c);
    c.note('逐字节流由 test/wp14/queue.test.js 的 AC-10「升级·重派」用例承载；需求机检原文点名 queue-actions.test.js，本分支合并进 queue.test.js。');
    return finish(c);
  }
}];
