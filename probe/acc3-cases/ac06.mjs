// AC-06 审核通过后闭环完成（夹具：doc-pass 完整跑完 + 产品 status）。
import {
  makeCase, freshRoot, runSync, statusText, coreStop, forceKillCore,
  text, readState, nodeOf, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-06';
const SCENARIO = 'doc-pass';
const DUR = String.raw`(?:\d+(?:\.\d+)?(?:ms|s|m|h))+`;

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '审核通过后闭环完成',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);
    try {
      const run = c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（完整跑完）`);
      const out = text(run);

      c.eq('命令退出码是 0', run.exitCode, 0);
      c.matches('输出含「节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 <d> · 产物 artifacts/reports/research-notes.v1.md」', out,
        new RegExp(`节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 ${DUR} · 产物 artifacts/reports/research-notes\\.v1\\.md`));
      c.matches('输出含「节点 T-002 撰写者 已完成 · 第 1 轮 · 耗时 <d> · 产物 artifacts/docs/release-notes.v1.md」', out,
        new RegExp(`节点 T-002 撰写者 已完成 · 第 1 轮 · 耗时 ${DUR} · 产物 artifacts/docs/release-notes\\.v1\\.md`));
      c.matches('输出含「节点 T-003 审核者 已完成 · 第 1 轮 · 耗时 <d> · 审核 通过」', out,
        new RegExp(`节点 T-003 审核者 已完成 · 第 1 轮 · 耗时 ${DUR} · 审核 通过`));
      c.includes('输出含「升级 —」', out, '升级 —');
      c.check('A-1：成功路径全文不出现「核对失败」/「执行失败」/「未知错误」',
        !out.includes('核对失败') && !out.includes('执行失败') && !out.includes('未知错误'),
        ['核对失败', '执行失败', '未知错误'].filter((w) => out.includes(w)).join(',') || '三种词都不出现');

      // When：orch status --instance INST-001
      const st = c.cmd(statusText(root), 'orch status --instance INST-001');
      c.includes('输出含「实例 INST-001 · 已完成 · 模板 通用任务闭环」', text(st), '实例 INST-001 · 已完成 · 模板 通用任务闭环');

      // 机检
      const s = readState(root);
      c.eq('机检：实例 state = completed', s?.state, 'completed');
      const nodeStates = (s?.nodes ?? []).map((n) => `${n.nodeId}=${n.state}`).join(',');
      c.eq('机检：三个节点 state 都是 done', nodeStates, 'T-001=done,T-002=done,T-003=done');

      const sessions = s?.sessions ?? [];
      const notIdle = sessions.filter((x) => x.state !== 'idle');
      c.check('机检：sessions 中每一轮派发的会话 state 最终都是 idle', sessions.length > 0 && notIdle.length === 0,
        `${sessions.length} 个会话：${sessions.map((x) => `${x.nodeId}#${x.round}=${x.state}`).join(',')}`);

      const handoffs = s?.handoffs ?? [];
      const notConsumed = handoffs.filter((h) => h.state !== 'consumed');
      const noConsumedAt = handoffs.filter((h) => !h.consumedAt);
      c.check('机检：handoffs 全部 state=consumed 且 consumedAt 非空',
        handoffs.length > 0 && notConsumed.length === 0 && noConsumedAt.length === 0,
        handoffs.map((h) => `${h.handoffId}=${h.state}/${h.consumedAt ?? 'null'}`).join(','));
      c.check('机检：终态无升级', (s?.escalations ?? []).length === 0, JSON.stringify(s?.escalations ?? []));
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
