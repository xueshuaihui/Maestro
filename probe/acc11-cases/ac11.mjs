// AC-11 升级「终止」二次确认后取消实例：机检 queue.test.js + ui-views.test.js + A-4 确认逐字 + 架构零命中。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-11';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '处置 / 确认 / 机检',
  async run() {
    const c = makeCase(AC, { face: '处置 / 确认 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['queue.test.js', 'ui-views.test.js'],
      arch: [{ cmd: `grep -REn "halted = true|state = 'cancelled'" src/daemon/queue.js`, expect: 1, note: 'AC-11 架构：终止走既有取消入口，不自写状态字面量，零命中（exit 1）' }],
      tmpdir: tmp
    });
    const q = c.testRuns.find((t) => t.file === 'queue.test.js');
    c.check('终止数据侧断言存在（实例级取消、升级作废、条目消失）',
      Boolean(q?.subtests?.some((x) => /升级·终止：实例级取消/.test(x))), (q?.subtests ?? []).filter((x) => /终止/.test(x)).join(' | ') || '（未找到）', '实例已取消 / 队列减 1');
    const u = c.testRuns.find((t) => t.file === 'ui-views.test.js');
    c.check('二次确认行为断言存在（先取消不改状态、再确认才取消，A-4 确认句逐字）',
      Boolean(u?.subtests?.some((x) => /AC-11: cancel confirm is two-step/.test(x))), (u?.subtests ?? []).filter((x) => /cancel confirm/.test(x)).join(' | ') || '（未找到）', '确认句「终止实例 INST-001？终止后该实例不再继续」逐字');
    c.check('两文件机检均通过（# fail 0）', Boolean(q?.v?.ok && u?.v?.ok), `queue fail=${q?.tap?.fail ?? 0} / ui fail=${u?.tap?.fail ?? 0}`, '# fail 0');
    thenChecks(c);
    c.note('数据侧由 queue.test.js「升级·终止」承载，二次确认交互由 ui-views.test.js「cancel confirm is two-step」承载；A-4 确认句逐字见该用例与附录 A-4。');
    return finish(c);
  }
}];
