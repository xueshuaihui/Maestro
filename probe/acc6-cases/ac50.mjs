// AC-50 全量测试全绿且不低于 611（回归 / 门禁）
// When：node --test --test-concurrency=4 "test/**/*.test.js"（cwd=仓库根）
// Then：TAP 尾部 summary 满足 fail === 0 && pass === tests && tests >= 611（TEST_MIN，不写死条数）。
import {
  makeCase, nodeTest, TEST_MIN, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-50';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  timeoutMs: 600_000,
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    c.note('整跑约几分钟：用例限时 600s，runCmd 超时 540s；TAP summary 取 stdout 尾部 `# tests / # pass / # fail` 行。');

    // When
    const res = c.cmd(nodeTest(['test/**/*.test.js'], { timeout: 540000 }),
      'node --test --test-concurrency=4 test/**/*.test.js');
    const tail = nonEmptyLines(clean(res.stdout)).slice(-16).join('\n');
    c.evText('tap-tail', tail);

    // Then / 机检：fail === 0 && pass === tests && tests >= 611
    const mTests = /^# tests (\d+)$/m.exec(res.stdout);
    const mPass = /^# pass (\d+)$/m.exec(res.stdout);
    const mFail = /^# fail (\d+)$/m.exec(res.stdout);
    const mCancelled = /^# cancelled (\d+)$/m.exec(res.stdout);
    const mSkipped = /^# skipped (\d+)$/m.exec(res.stdout);
    c.check('机检：TAP 尾部 summary 行齐全（tests/pass/fail/cancelled/skipped）',
      Boolean(mTests && mPass && mFail && mCancelled && mSkipped), tail.slice(-400));
    const tests = mTests ? Number(mTests[1]) : null;
    const pass = mPass ? Number(mPass[1]) : null;
    const fail = mFail ? Number(mFail[1]) : null;
    c.eq('机检：fail === 0', fail, 0);
    c.eq('机检：cancelled === 0', mCancelled ? Number(mCancelled[1]) : null, 0);
    c.eq('机检：pass === tests', pass, tests);
    c.check(`机检：tests >= ${TEST_MIN}（下限断言，不写死条数）`,
      tests !== null && tests >= TEST_MIN, `tests=${tests}`);
    c.eq('Then 退出码 0', res.exitCode, 0);

    return finish(c);
  }
}];
