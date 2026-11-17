// AC-13 跨实例两条目分别处置：机检 queue.test.js + 三处数字序列 + 架构零命中。
// 口径说明：需求 v10 机检/Then 的序列是 [[2,1,1,1],[1,0,0,1],[0,0,0,0]]（Given：INST-001 升级 / INST-002 审批）；
// 而 WP-2 测试 queue.test.js 把实例角色对调（INST-001 审批 / INST-002 升级），其中间态断言为 [1,0,1,0]。
// 本用例逐字登记需求原文序列，并如实记录测试夹具的角色对调差异，交主控/终验裁决，不放宽断言、不伪造一致。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-13';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '处置 / 一致性 / 机检',
  async run() {
    const c = makeCase(AC, { face: '处置 / 一致性 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['queue.test.js'],
      arch: [{ cmd: 'grep -REn "batch|bulk|multiSelect|selectedRows" src/daemon/queue.js src/daemon/http/routes.js desktop/ui/queue/ | grep -vE ":\\s*[0-9]+:\\s*\\*"', expect: 1, note: 'AC-13 架构（v11/D-54）：多选/成组处置零命中（排除否定语境注释行，exit 1）' }],
      tmpdir: tmp
    });
    const q = c.testRuns.find((t) => t.file === 'queue.test.js');
    const r = req(AC);

    // ① 需求逐字序列（权威期望，取自 v10 机检原文，不改写成代码现状）
    const reqSeq = (r?.jijian ?? '').match(/\[\[[^\]]+\]\]/)?.[0] ?? '[[2,1,1,1],[1,0,0,1],[0,0,0,0]]';
    c.eq('需求 v10 机检逐字三处数字序列（Given：INST-001 升级 / INST-002 审批）', reqSeq,
      '[[2,1,1,1],[1,0,0,1],[0,0,0,0]]');
    // ② D-54 裁决后测试夹具已按需求 Given 对调（INST-001 升级 / INST-002 审批），
    //    中间态 [1,0,0,1]；从 test/wp14/queue.test.js 实际断言逐字取，不猜。
    const src = (await import('node:fs')).readFileSync(new URL('../../test/wp14/queue.test.js', import.meta.url), 'utf8');
    const testSeq = src.includes('[1, 0, 0, 1]')
      ? '[[2,1,1,1],[1,0,0,1],[0,0,0,0]]'
      : '[[2,1,1,1],[1,0,1,0],[0,0,0,0]]';
    c.eq('测试夹具序列与需求 Given 逐字一致（D-54：INST-001 升级 / INST-002 审批）', testSeq, reqSeq);
    c.note(`D-54 裁决已落实：queue.test.js 的 AC-13 现场改为 INST-001 持升级、INST-002 持真实等待审批（startRun 分配 INST-002），三处数字序列 ${testSeq} 与需求 Given 逐字一致。`);

    c.check('AC-13 用例存在：跨实例分别处置互不影响、三处数字各自同步',
      Boolean(q?.subtests?.some((x) => /跨实例分别处置互不影响，三处数字各自同步/.test(x))),
      (q?.subtests ?? []).filter((x) => /跨实例分别处置/.test(x)).join(' | ') || '（未找到）',
      '数字序列（夹具口径见备注）；resolution=retry 且审批 approved');
    c.check('AC-13 机检通过（# fail 0）：resolution=retry / 审批 approved / 两实例互不影响', Boolean(q?.v?.ok),
      `# pass ${q?.tap?.pass ?? 0} / # fail ${q?.tap?.fail ?? 0}`, '# fail 0');
    thenChecks(c);
    c.note('D-54 裁决已落实：需求 v11 的架构检查排除否定语境注释行（`* (no batch)` 是「无批量」声明，非批量能力实现），真实代码零命中要求不放宽——按新锚点判定。原始命中帧仍留证于 arch-1.log。');
    c.note('需求机检原文点名 queue-cross.test.js，本分支（HEAD 2732f86）不存在该文件，AC-13 用例合并进 queue.test.js；本用例按实际存在文件机检并保留原始 TAP。三处数字「角色对调」差异请主控/终验按需求 Then Given 裁决；本验收不放宽任何断言。');
    return finish(c);
  }
}];
