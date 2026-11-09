// AC-11 证据文件不存在或为空被拒绝（异常 / mock 夹具面）
// 两个子场景：删除 calc.js / 把 calc.js 写成 0 字节，各自独立项目根。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, pauseAtOutput, readState, taskDir, sleep,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-11';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const roots = [];
    for (const [tag, op] of [['删除文件', 'rm'], ['写成 0 字节', 'zero']]) {
      const root = freshRoot(`${AC}-${op}`); c.add(root); roots.push(root);
      const { h, paused } = await pauseAtOutput(root, 'T-001', { scenario: 'pass' });
      const f = path.join(taskDir(root), 'calc.js');
      c.check(`夹具[${tag}]：投递前 calc.js 存在`, fs.existsSync(f), f);
      if (op === 'rm') fs.rmSync(f, { force: true }); else fs.writeFileSync(f, '', 'utf8');
      h.release();
      await Promise.race([h.done, sleep(30000)]);
      c.keep(`orch run[${tag}]（放行前台收尾）`, h);
      await h.stop();

      const s = readState(root);
      const h1 = (s?.handoffs ?? []).find((x) => x.handoffId === 'HO-001');
      const esc = (s?.escalations ?? [])[0];
      c.eq(`机检[${tag}]：实例挂起 suspended`, s?.state, 'suspended');
      c.eq(`机检[${tag}]：交接包已拒绝`, h1?.state, 'rejected');
      c.eq(`机检[${tag}]：rejectReason = invalid_payload`, h1?.rejectReason, 'invalid_payload');
      c.eq(`机检[${tag}]：reasonCode = handoff_invalid`, esc?.reasonCode, 'handoff_invalid');
      c.includes(`Then[${tag}]：升级原因指出 calc.js 不存在或为空`, esc?.reasonDetail ?? '', 'calc.js');
      c.eq(`机检[${tag}]：下游节点 T-002 round 不变（仍为 0）`, (s?.nodes ?? []).find((n) => n.nodeId === 'T-002')?.round, 0);
    }
    return conclude(c, roots);
  },
}];
