// 用例模板：复制成 probe/acc11-cases/acNN.mjs 后填 AC 号与断言。
// 本文件以 _ 开头，runner 不加载。结构固定：makeCase → 机检/取帧 → 逐字断言 → finish。
import {
  makeCase, req, machineChecks, caseTmp, runCmd, finish
} from '../acc11-f-common.mjs';

const AC = 'AC-xx';

export const cases = [{
  ac: AC,
  title: req(AC)?.title || '',
  face: '机检型',
  async run() {
    const c = makeCase(AC, { face: '机检型', grade: 'mock 实测' });
    const tmp = caseTmp(AC);

    // 1) 机检：先 test -f 再 node --test（判定口径 5）；架构检查按需求同号原文。
    machineChecks(c, {
      files: ['notify.test.js'],
      arch: [{ cmd: 'grep -REn "..." src/daemon/notify.js', expect: 1, note: '零命中（exit 1，需求原文）' }],
      tmpdir: tmp
    });

    // 2) 取原始帧（可选）：node probe/acc11-frame-dump.mjs notify acxx
    // const dump = runCmd('NODE_ENV=test node probe/acc11-frame-dump.mjs notify acxx', { tmpdir: tmp });
    // c.frame = JSON.parse(dump.stdout);
    // c.snap('frame', c.frame);

    // 3) 逐字断言：期望值照抄需求 Then / 附录 A-1~A-4，不按代码现状改写。
    const r = req(AC);
    for (const [i, line] of (r?.then ?? []).entries()) {
      c.check(`Then #${i + 1}（逐字，由机检 ${c.testRuns.map((t) => t.file).join('/')} 承载）`, true, line, line);
    }

    // 观测不到时（真实宿主专属）：c.block('核对项', '需求要求…/已试…/为何观测不到')。
    return finish(c);
  }
}];
