// AC-52 终止等同取消（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, liveScene, workflow, cancel, readState,
  normalizeVolatile, text, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-52';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const rAbort = freshRoot(`${AC}-abort`); c.add(rAbort);
    const rCancel = freshRoot(`${AC}-cancel`); c.add(rCancel);

    // Given：两个同口径的运行中实例（停在派发边界，稳定）
    const handles = [];
    const res = {};
    for (const [root, kind] of [[rAbort, 'abort'], [rCancel, 'cancel']]) {
      const h = liveScene(root, { scenario: 'pass', env: { MAESTRO_TEST_PAUSE: 'after_output:T-001' } });
      handles.push(h);
      await h.waitFile('.mock/paused', 30000);
      const cmd = kind === 'abort'
        ? workflow(root, 'abort', 'INST-001')
        : cancel(root);
      res[kind] = c.cmd(cmd, `orch workflow ${kind} INST-001 / orch cancel --instance INST-001`);
    }
    for (const h of handles) { c.keep('orch run（前台，停止在派发边界）', h); await h.stop(); }

    c.eq('Then：workflow abort 退出码 0', res.abort.exitCode, 0);
    c.eq('Then：cancel 退出码 0', res.cancel.exitCode, 0);
    c.eq('Then：输出与 orch cancel --instance 相同的结果行',
      normalizeVolatile(text(res.abort)), normalizeVolatile(text(res.cancel)));

    const s = readState(rAbort);
    c.eq('机检：实例 cancelled', s?.state, 'cancelled');
    c.check('机检：节点按取消规则收尾（全部 cancelled）',
      (s?.nodes ?? []).length > 0 && s.nodes.every((n) => n.state === 'cancelled'),
      JSON.stringify((s?.nodes ?? []).map((n) => n.state)));
    c.check('机检：会话按取消规则收尾（idle）',
      (s?.sessions ?? []).every((x) => x.state === 'idle'), JSON.stringify((s?.sessions ?? []).map((x) => x.state)));
    c.check('机检：没有遗留待投递交接包',
      !(s?.handoffs ?? []).some((x) => ['created', 'delivered', 'accepted'].includes(x.state)),
      JSON.stringify((s?.handoffs ?? []).map((x) => x.state)));
    c.check('机检：没有遗留待处理升级',
      !(s?.escalations ?? []).some((e) => e.state === 'pending'),
      JSON.stringify((s?.escalations ?? []).map((e) => e.state)));
    return conclude(c, [rAbort, rCancel]);
  },
}];
