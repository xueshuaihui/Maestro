// AC-44 「继续」只对轮次超限可用：机检 queue.test.js（AC-44/U-5 数据侧：执行失败升级返回
// ACTION_NOT_SUPPORTED 不生效、仅轮次超限可 pass、counters.pass=1）。需求机检点名
// queue-actions.test.js（本分支不存在，逐字断言合并进 queue.test.js），登记说明不放宽。
// 架构检查两条：置灰由核心返回的「该升级可选动作」驱动（界面不靠原因文案猜 rounds_exceeded），
// 悬停文案不硬编码（来自 labels DESKTOP_QUEUE_DISABLED_HINT），均零命中（需求 §3.1 原文）。
import { makeCase, req, machineChecks, thenChecks, runCmd, finish, ensureDir } from '../acc11-f-common.mjs';
const AC = 'AC-44';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '处置 / 边界 / 机检',
  async run() {
    const c = makeCase(AC, { face: '处置 / 边界 / 机检', grade: 'mock 实测' });
    const tmp = ensureDir(`/tmp/m11d-${AC}`);
    machineChecks(c, {
      files: ['queue.test.js'],
      arch: [
        { cmd: 'grep -REn "rounds_exceeded" desktop/ui/queue/', expect: 1,
          note: 'AC-44 架构①：界面不靠原因文案猜置灰（rounds_exceeded 零命中，exit 1）' },
        { cmd: 'grep -REn "该升级只能重派或终止" desktop/ui/', expect: 1,
          note: 'AC-44 架构②：悬停文案不硬编码，来自 labels（零命中，exit 1）' }
      ],
      tmpdir: tmp
    });
    const q = c.testRuns.find((t) => t.file === 'queue.test.js');
    c.check('执行失败升级 ESC-001 的「继续」置灰不可点：返回 ACTION_NOT_SUPPORTED，强行点击无结果行',
      Boolean(q?.subtests?.some((x) => /AC-44 \/ U-5 数据侧/.test(x)) && q?.v?.ok),
      (q?.subtests ?? []).filter((x) => /AC-44/.test(x)).join(' | ') || '（未找到）',
      'ESC-001.resolution 仍 pending、INST-001 仍「已挂起」、无结果行、continue.disabled===true');
    c.check('置灰悬停文案逐字「该升级只能重派或终止」，由核心返回可选动作驱动、非界面猜测',
      Boolean(c.arch.every((a) => a.ok) && q?.v?.ok),
      `arch① exit ${c.arch[0]?.exit} / arch② exit ${c.arch[1]?.exit}`,
      'continue.tooltip === 该升级只能重派或终止；rounds_exceeded 与文案字面在 UI 零命中');
    c.check('仅轮次超限 ESC-002 点「继续」显示「已处理（通过）」；counters.pass===1 且只发生在 ESC-002',
      Boolean(q?.v?.ok),
      `# pass queue ${q?.tap?.pass ?? 0} / # fail ${q?.tap?.fail ?? 0}`,
      'counters.pass === 1；整条队列里判通过只发生在轮次超限那条');
    thenChecks(c);
    // 语义复核：置灰文案来自 labels DESKTOP_QUEUE_DISABLED_HINT，核心返回可选动作列表。
    const sem = runCmd('grep -rn -e DESKTOP_QUEUE_DISABLED_HINT -e ACTION_NOT_SUPPORTED src/cli/labels.js test/wp14/queue.test.js', { tmpdir: tmp });
    c.cmd(sem, '语义复核：置灰文案/动作支持的真实来源');
    c.check('语义复核：tooltip 来自 labels DESKTOP_QUEUE_DISABLED_HINT，可点性来自核心动作列表（非原因文案）',
      /DESKTOP_QUEUE_DISABLED_HINT/.test(sem.stdout),
      sem.stdout.trim().split('\n').slice(0, 6).join(' | '),
      '界面消费下发文案 + 核心可选动作，不硬编码');
    c.note('机检文件名口径：需求点名 test/wp14/queue-actions.test.js（本分支不存在），AC-44 逐字断言合并进 test/wp14/queue.test.js「继续只对轮次超限可用：其它升级返回 ACTION_NOT_SUPPORTED 且不生效（AC-44 / U-5 数据侧）」；按实际存在文件机检并登记，不放宽。');
    c.note('H-14 口径：ESC-001 用 reasonCode execution_failed、ESC-002 用 rounds_exceeded，与 AC-15 共用同一组约定；置灰由核心返回的「该升级可选动作」驱动，界面不解析原因文案。');
    return finish(c);
  }
}];
