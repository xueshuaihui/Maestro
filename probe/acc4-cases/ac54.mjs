// AC-54 旧命令基线不回归（回归 / mock 夹具面）
import {
  makeCase, freshRoot, prepareScene, runProduct, runScene, statusAll,
  cancel, coreStop, liveScene, readState, normalizeVolatile, SINGLE_TASK,
  DOC_TASK, text, lines, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-54';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const r1 = freshRoot(`${AC}-implicit`); c.add(r1);
    const r2 = freshRoot(`${AC}-explicit`); c.add(r2);
    const r3 = freshRoot(`${AC}-code`); c.add(r3);
    const r4 = freshRoot(`${AC}-doc`); c.add(r4);
    const r5 = freshRoot(`${AC}-cancel`); c.add(r5);

    // I1.1 单节点：一次不带 --template、一次显式 --template single
    prepareScene(r1, { scenario: null });
    const a = c.cmd(runProduct(r1, { task: SINGLE_TASK, template: null }), 'orch run --cwd ./demo --task ...（不带 --template）');
    prepareScene(r2, { scenario: null });
    const b = c.cmd(runProduct(r2, { task: SINGLE_TASK, template: 'single' }), 'orch run --cwd ./demo --task ... --template single');
    c.eq('Then：显式 --template single 与不带该参数的输出逐字相同', normalizeVolatile(text(a)), normalizeVolatile(text(b)));
    c.eq('机检：两次单节点运行的首行 diff 为空', lines(text(a))[0], lines(text(b))[0]);
    c.includes('Then：实例行不带「· 模板 …」后缀', lines(text(a))[0], '实例 INST-001 · 运行中');
    c.notIncludes('机检：single 实例行不含模板后缀', lines(text(a))[0], '· 模板');
    c.eq('机检：不带 --template 退出码 0', a.exitCode, 0);
    c.eq('机检：显式 --template single 退出码 0', b.exitCode, 0);

    // I1.2 编码闭环 / I1.3 文档闭环成功路径
    const code = c.cmd(runScene(r3, { scenario: 'pass' }), 'orch run code-loop pass（I1.2 成功路径）');
    c.eq('Then：I1.2 编码闭环成功（退出码 0）', code.exitCode, 0);
    c.eq('机检：I1.2 实例 completed', readState(r3)?.state, 'completed');
    const doc = c.cmd(runScene(r4, { scenario: 'doc-pass', suite: 'task-loop', template: 'task-loop', task: DOC_TASK }),
      'orch run task-loop doc-pass（I1.3 成功路径）');
    c.eq('Then：I1.3 文档闭环成功（退出码 0）', doc.exitCode, 0);
    c.eq('机检：I1.3 实例 completed', readState(r4)?.state, 'completed');

    // I1.1 status 列表（无审批/暂停时不出现新行）
    const st = c.cmd(statusAll(r1), 'orch status（I1.1 列表）');
    c.eq('Then：status 列表退出码 0', st.exitCode, 0);
    c.notIncludes('机检：status 无审批时不出现「待处理审批」', text(st), '待处理审批');
    c.notIncludes('机检：status 无暂停时不出现「（已暂停）」', text(st), '（已暂停）');

    // I1.1 cancel / core stop
    const h = liveScene(r5, { scenario: 'pass', env: { MAESTRO_TEST_PAUSE: 'after_output:T-001' } });
    await h.waitFile('.mock/paused', 30000);
    const cc = c.cmd(cancel(r5), 'orch cancel --instance INST-001（I1.1 cancel）');
    c.eq('Then：cancel 退出码 0', cc.exitCode, 0);
    c.keep('orch run（前台，停止在派发边界）', h);
    await h.stop();
    const stop = c.cmd(coreStop(r3), 'orch core stop（I1.1 core stop）');
    c.eq('Then：core stop 退出码 0', stop.exitCode, 0);
    c.includes('Then：core stop 输出「核心已停止」', text(stop), '核心已停止');
    return conclude(c, [r1, r2, r3, r4, r5]);
  },
}];
