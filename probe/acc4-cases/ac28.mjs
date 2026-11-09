// AC-28 不允许的决策被拒绝（异常 / mock 夹具面）
// 四种升级原因（交接包不合规/派发失败/执行失败/投递耗尽）各执行一次 resolve pass。
import {
  makeCase, freshRoot, runScene, escalateResolve, readState, cloneState, mutateState,
  text, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const REASONS = ['handoff_invalid', 'dispatch_failed', 'execution_failed', 'delivery_failed'];

const AC = 'AC-28';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    // 以真实挂起 state 为母版，构造四种原因的升级各占一个实例（视图/RPC 静态前置）
    c.cmd(runScene(root, { scenario: 'rounds-exceeded', cwd: 'demo1' }), 'orch run code-loop rounds-exceeded（母版 INST-001）');
    mutateState(root, 'INST-001', (s) => { s.escalations[0].reasonCode = REASONS[0]; });
    for (let i = 1; i < REASONS.length; i += 1) {
      const id = `INST-00${i + 1}`;
      cloneState(root, 'INST-001', id, (s) => { s.escalations[0].reasonCode = REASONS[i]; });
    }
    c.note('四种升级原因以真实挂起 state.json 为母版、仅改写 reasonCode 后克隆到四个实例；决策拒绝判定由真实 RPC 产出。');

    for (let i = 0; i < REASONS.length; i += 1) {
      const id = `INST-00${i + 1}`;
      const res = c.cmd(escalateResolve(root, 'ESC-001', 'pass', id),
        `orch escalate resolve ESC-001 --instance ${id} --decision pass（${REASONS[i]}）`);
      c.includes(`Then[${REASONS[i]}]：提示该升级不支持「通过」`, text(res), '不支持「pass」');
      c.includes(`Then[${REASONS[i]}]：给出可选决策 fail|retry`, text(res), '可选：fail|retry');
      c.eq(`Then[${REASONS[i]}]：退出码 1`, res.exitCode, 1);
      const s = readState(root, id);
      c.eq(`机检[${REASONS[i]}]：实例仍挂起`, s?.state, 'suspended');
      c.eq(`机检[${REASONS[i]}]：升级仍是待处理`, s?.escalations?.[0]?.state, 'pending');
      c.check(`机检[${REASONS[i]}]：节点仍未完成`, (s?.nodes ?? []).some((n) => n.state === 'escalated'),
        (s?.nodes ?? []).map((n) => n.state).join(','));
    }
    return conclude(c, root);
  },
}];
