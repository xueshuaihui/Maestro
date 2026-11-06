// AC-41 同一节点被重复投递时被拒（NODE_BUSY）。
import {
  makeCase, freshRoot, startKeep, waitMarker, runCmd, NODE, SEAM,
  readState, nodeOf, coreStop, forceKillCore, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-41';
const SCENARIO = 'doc-pass';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '同一节点被重复投递时被拒',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    const h = startKeep(root, SCENARIO, ['--stop-after', '2'], undefined, 60000);
    try {
      // Given 停在「撰写者 review(downstream)」
      const marker = await waitMarker(root, 2, { timeout: 40000 });
      c.check('Given 机检：.mock/stopped-after-2 存在（停在撰写者待校验）', Boolean(marker), `${Date.now() - h.startedAt}ms`);
      const before = readState(root);
      const t2 = nodeOf(before, 'T-002');
      c.eq("Given 机检：T-002 state='review'", t2?.state, 'review');
      c.eq("Given 机检：T-002 reviewReason='downstream'", t2?.reviewReason, 'downstream');
      c.eq('Given 机检：T-002 round=1', t2?.round, 1);
      c.eq('Given 机检：counters.dispatchCount=2', before?.counters?.dispatchCount, 2);

      // When 我执行 node test/fixtures/call-seam.mjs … --call dispatch --node T-002
      const seam = runCmd(
        [NODE, SEAM, '--root', root, '--instance', 'INST-001', '--call', 'dispatch', '--node', 'T-002'],
        { cwd: root, label: 'call-seam --call dispatch --node T-002' }
      );
      c.cmd(seam, 'node test/fixtures/call-seam.mjs --root <根> --instance INST-001 --call dispatch --node T-002');
      const out = `${seam.stdout}${seam.stderr}`.trim();
      const outLines = out.split('\n').filter((l) => l.trim().length > 0);
      c.eq('Then 输出是单行 JSON', outLines.length, 1);
      let payload = null;
      try { payload = JSON.parse(outLines[0] ?? '{}'); } catch { payload = null; }
      c.check('Then 输出是合法 JSON', Boolean(payload), out.slice(0, 300));
      c.eq('Then 含 "ok":false', payload?.ok, false);
      c.eq('Then 含 "code":"NODE_BUSY"', payload?.code, 'NODE_BUSY');

      // And 机检：T-002 仍是 'review'，round 仍为 1
      const after = readState(root);
      c.eq("And 机检：T-002 仍是 'review'", nodeOf(after, 'T-002')?.state, 'review');
      c.eq('And 机检：T-002 round 仍为 1', nodeOf(after, 'T-002')?.round, 1);
      c.eq("And 机检：T-002 reviewReason 仍为 'downstream'", nodeOf(after, 'T-002')?.reviewReason, 'downstream');

      // And 机检：counters.dispatchCount 仍为 2
      c.eq('And 机检：counters.dispatchCount 仍为 2', after?.counters?.dispatchCount, 2);
    } finally {
      await h.stop();
      c.keep('driver --scenario doc-pass --stop-after 2 --keep（长驻进程由脚手架终止）', h, h.argv);
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
