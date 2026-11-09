// AC-12 证据越界或哈希不符被拒绝（异常 / mock 夹具面）
// 回流边（edgeKind=backflow, round=2）两个子场景：escape-ref / hash-mismatch。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, badHandoff, readState, workspacePath, ensureDir, exists, seamJson,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-12';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const roots = [];
    for (const [mutate, keyword] of [['escape-ref', '证据越界'], ['hash-mismatch', '证据哈希不符']]) {
      const root = freshRoot(`${AC}-${mutate}`); c.add(root); roots.push(root);
      const res = await badHandoff(root, mutate, {
        node: 'T-002', scenario: 'backflow',
        extraMutateArgs: { edgeKind: 'backflow', round: 2 },
        beforeRelease: (rt) => {
          // 在工作区外放一个同名可读文件（即使文件真实存在，越界引用仍须被拒绝）
          const outside = path.join(workspacePath(rt), '..', 'outside.txt');
          ensureDir(path.dirname(outside));
          fs.writeFileSync(outside, 'secret data\n', 'utf8');
        },
      });
      c.keep(`orch run[${mutate}]（回流边坏包，前台挂起收尾）`, res.h);
      const seam = c.cmd(res.seamRes, `call-seam test.handoff --mutate ${mutate} --edge-kind backflow --round 2`);
      c.check(`夹具[${mutate}]：接缝注册成功`, seamJson(seam)?.ok === true, String(seamJson(seam)));
      c.check(`夹具[${mutate}]：工作区外同名文件确实存在`, exists(path.join(workspacePath(root), '..', 'outside.txt')), 'outside.txt');

      const s = readState(root);
      const bad = (s?.handoffs ?? []).find((x) => x.state === 'rejected');
      const esc = (s?.escalations ?? [])[0];
      c.eq(`机检[${mutate}]：实例挂起 suspended`, s?.state, 'suspended');
      c.eq(`机检[${mutate}]：有交接包被拒绝`, bad?.state, 'rejected');
      c.eq(`机检[${mutate}]：rejectReason = invalid_payload`, bad?.rejectReason, 'invalid_payload');
      c.eq(`机检[${mutate}]：reasonCode = handoff_invalid`, esc?.reasonCode, 'handoff_invalid');
      c.includes(`Then[${mutate}]：升级原因指出${keyword}`, esc?.reasonDetail ?? '', keyword);
      c.eq(`机检[${mutate}]：目标节点 round 不增加`, (s?.nodes ?? []).find((n) => n.nodeId === 'T-001')?.round, 1);
    }
    return conclude(c, roots);
  },
}];
