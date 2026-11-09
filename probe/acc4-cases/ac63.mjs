// AC-63 单节点投递失败不进入信箱重试（回归 / mock 夹具面）
import path from 'node:path';
import {
  makeCase, freshRoot, prepareScene, runProduct, readState, readEvents,
  readInboxAll, readAttemptFiles, taskDir, reasonsOf, requirementTitle,
  conclude, SINGLE_TASK,
} from '../acc4-f-common.mjs';

const AC = 'AC-63';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：--template single 发起，mock --host-error 对所有 prompt 返回失败（单节点无重试）
    prepareScene(root, { scenario: null, mockArgs: ['--host-error'] });
    const r = c.cmd(runProduct(root, { task: SINGLE_TASK, template: 'single' }),
      'orch run single（mock --host-error 对所有 prompt 返回失败）');
    c.note('D-10 非场景模式基准：单节点没有重试；host-error 在早返回前写一次 <任务 cwd>/.mock/prompt-attempts-<sessionId>.json。');
    const s = readState(root);
    const ev = readEvents(root);
    const inbox = readInboxAll(root);
    // 计数文件落在「任务 cwd」的 .mock 下（不是项目根的 .mock）。
    const attempts = readAttemptFiles(root, path.join(taskDir(root), '.mock'));
    const vals = Object.values(attempts).map((v) => v?.attempts);

    c.eq('机检：CLI 退出码 1', r.exitCode, 1);
    c.eq('机检：<任务 cwd>/.mock/prompt-attempts-<sessionId>.json 的 attempts === 1',
      vals.length === 1 ? vals[0] : null, 1);
    c.check('机检：events.jsonl 没有 handoff.pending', !reasonsOf(ev).includes('handoff.pending'), reasonsOf(ev).join(','));
    c.check('Then：不出现「待投递」、不重试（无 handoff.pending / handoff.inboxed）',
      !reasonsOf(ev).includes('handoff.pending') && !reasonsOf(ev).includes('handoff.inboxed'), reasonsOf(ev).join(','));
    c.check('机检：.orch/inbox/INST-001/HO-001.json 不存在',
      !Object.keys(inbox).some((k) => k.includes('HO-001')), Object.keys(inbox).join(','));
    c.eq('机检：实例 failed', s?.state, 'failed');
    c.eq('机检：节点 failed', s?.nodes?.[0]?.state, 'failed');
    c.eq('机检：会话 idle', s?.sessions?.[0]?.state, 'idle');
    c.eq('机检：nodes[0].failure.code === HOST_ERROR', s?.nodes?.[0]?.failure?.code, 'HOST_ERROR');
    return conclude(c, root);
  },
}];
