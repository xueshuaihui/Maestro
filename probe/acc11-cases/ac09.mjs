// AC-09 升级「继续」两现场（D-39）：终态 pass→completed / 非终态 pass→running+下游唤醒；机检 queue.test.js。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-09';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '处置 / 机检（D-39 两现场）',
  async run() {
    const c = makeCase(AC, { face: '处置 / 机检（D-39 两现场）', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    // 需求机检原文点名 queue-actions.test.js；本分支合并进 queue.test.js，按实际文件名机检并在备注登记。
    machineChecks(c, {
      files: ['queue.test.js'],
      arch: [
        { cmd: 'grep -REn "orchestrator.resolveEscalation" src/daemon/queue.js', expect: 0, lines: 1, note: 'AC-09 架构：处置走既有裁决入口，恰好 1 条命中（exit 0）' },
        { cmd: 'grep -REn "escalations[.]push|resolution =" src/daemon/queue.js', expect: 1, note: 'AC-09 架构：不得直接改状态数组/自写决议，零命中（exit 1）' }
      ],
      tmpdir: tmp
    });
    const q = c.testRuns.find((t) => t.file === 'queue.test.js');
    c.check('D-39 现场一：终态节点 pass → 实例 completed（逐字断言由用例承载）',
      Boolean(q?.subtests?.some((x) => /终态节点判通过 → 实例已完成/.test(x))), (q?.subtests ?? []).filter((x) => /终态/.test(x)).join(' | ') || '（未找到）', 'INST-001 已完成 / T-001 已完成');
    c.check('D-39 现场二：非终态节点 pass → 保持 running + 下游 T-002 被唤醒',
      Boolean(q?.subtests?.some((x) => /非终态节点判通过 → 保持运行中且下游被唤醒/.test(x))), (q?.subtests ?? []).filter((x) => /非终态/.test(x)).join(' | ') || '（未找到）', 'INST-003 运行中 / T-002 新派发');
    c.check('两条 resolution === pass、结果行逐字 A-4、INST-002 对照不变、队列依次减 2',
      Boolean(q?.v?.ok), `# pass ${q?.tap?.pass ?? 0} / # fail ${q?.tap?.fail ?? 0}`, '两次 escalation.resolution === pass；# fail 0');
    thenChecks(c);
    c.note('机检文件名口径：需求 §3.1 写 test/wp14/queue-actions.test.js，本分支（HEAD 2732f86）该文件不存在，AC-09~12 的逐字断言合并进 test/wp14/queue.test.js；本用例按实际存在的文件机检并保留原始 TAP，不放宽断言。');
    return finish(c);
  }
}];
