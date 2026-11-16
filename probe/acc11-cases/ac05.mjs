// AC-05 通知开关：总开关与三类分项：机检 notify.test.js + ui-views.test.js + prefs.test.js + 架构零命中。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-05';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '设置 / 机检',
  async run() {
    const c = makeCase(AC, { face: '设置 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['notify.test.js', 'ui-views.test.js', 'prefs.test.js'],
      arch: [{ cmd: 'grep -REn "notify" src/daemon/queue.js', expect: 1, note: 'AC-05 架构检查：开关只影响是否显示通知，队列不依赖通知状态，零命中（exit 1）' }],
      tmpdir: tmp
    });
    const r = req(AC);
    const n = c.testRuns.find((t) => t.file === 'notify.test.js');
    c.check('AC-05 意图用例存在（关分项/重开/总开关三次触发 → 0/1/0）', Boolean(n?.subtests?.some((x) => /AC-05/.test(x))), (n?.subtests ?? []).filter((x) => /AC-05/.test(x)).join(' | ') || '（未找到）', 'notify 计数 0 / 1 / 0');
    const u = c.testRuns.find((t) => t.file === 'ui-views.test.js');
    c.check('A-2 开关固定顺序用例存在（通知/升级待处理/实例完成/实例异常 默认全开）', Boolean(u?.subtests?.some((x) => /A-2|toggles render in fixed order/i.test(x))), (u?.subtests ?? []).filter((x) => /A-2|toggle/i.test(x)).join(' | ') || '（未找到）', 'A-2 固定顺序');
    const p = c.testRuns.find((t) => t.file === 'prefs.test.js');
    c.check('prefs.json 只写四键、合并写不触碰其它文件（按本机记住）', Boolean(p?.v?.ok), `# pass ${p?.tap?.pass ?? 0} / # fail ${p?.tap?.fail ?? 0}`, '# fail 0');
    thenChecks(c);
    c.note('逐字断言由 notify.test.js 的 AC-05 两用例（意图计数 0/1/0）+ ui-views.test.js 的 A-2 开关顺序用例 + prefs.test.js（四键原子写）承载；本用例机检复核。');
    return finish(c);
  }
}];
