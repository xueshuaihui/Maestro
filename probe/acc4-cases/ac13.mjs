// AC-13 回流包缺缺陷或修改要求被拒绝（异常 / mock 夹具面）
// 回流边（edgeKind=backflow, round=2）两个子场景：backflow-empty-defects / empty-requirements。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, badHandoff, readState, workspacePath, ensureDir, seamJson,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-13';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const roots = [];
    for (const [mutate, keyword] of [['backflow-empty-defects', '回流缺少defects'], ['empty-requirements', '回流缺少requirements']]) {
      const root = freshRoot(`${AC}-${mutate}`); c.add(root); roots.push(root);
      const res = await badHandoff(root, mutate, {
        node: 'T-002', scenario: 'backflow',
        extraMutateArgs: { edgeKind: 'backflow', round: 2 },
        beforeRelease: (rt) => {
          const outside = path.join(workspacePath(rt), '..', 'outside.txt');
          ensureDir(path.dirname(outside));
          fs.writeFileSync(outside, 'secret data\n', 'utf8');
        },
      });
      c.keep(`orch run[${mutate}]（回流边坏包，前台挂起收尾）`, res.h);
      const seam = c.cmd(res.seamRes, `call-seam test.handoff --mutate ${mutate} --edge-kind backflow --round 2`);
      c.check(`夹具[${mutate}]：接缝注册成功`, seamJson(seam)?.ok === true, String(seamJson(seam)));

      const s = readState(root);
      const bad = (s?.handoffs ?? []).find((x) => x.handoffId === 'HO-002' || x.state === 'rejected');
      const esc = (s?.escalations ?? [])[0];
      c.eq(`机检[${mutate}]：回流包已拒绝`, bad?.state, 'rejected');
      c.eq(`机检[${mutate}]：rejectReason === 'invalid_payload'`, bad?.rejectReason, 'invalid_payload');
      c.eq(`机检[${mutate}]：reasonCode === 'handoff_invalid'`, esc?.reasonCode, 'handoff_invalid');
      c.includes(`Then[${mutate}]：升级原因指出${keyword}`, esc?.reasonDetail ?? '', keyword);
      c.check(`机检[${mutate}]：目标节点（撰写者/开发）没有被派发（sessions 只有 2 个）`,
        (s?.sessions ?? []).length === 2, String((s?.sessions ?? []).length));
      c.eq(`机检[${mutate}]：来源节点 escalated`, (s?.nodes ?? []).find((n) => n.nodeId === 'T-002')?.state, 'escalated');
    }
    return conclude(c, roots);
  },
}];
