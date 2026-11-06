// 用例模板：复制成 probe/acc3-cases/acNN.mjs 后填 AC 号与断言。
// 本文件以 _ 开头，runner 不会加载。
import {
  makeCase, freshRoot, runSync, prepareOnly, startKeep, statusText, cancel, coreStop,
  readState, readEvents, nodeOf, text, lines, requirementTitle, finish, forceKillCore
} from '../acc3-f-common.mjs';

const AC = 'AC-xx';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '夹具', // 夹具 / 混合 / 用户可见 / 架构检查 / 真实面
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    // --- Given / When：选一种构造方式 ---
    // 1) 整场景跑完：c.cmd(runSync(root, 'doc-pass'), '夹具 doc-pass 跑完');
    // 2) 停在中间态：
    //    const h = startKeep(root, 'doc-backflow-once', ['--stop-after', '4']);
    //    try { const hit = await h.waitMarker(4); c.check('.mock/stopped-after-4 存在', Boolean(hit), String(hit)); ... }
    //    finally { await h.stop(); c.cmd(coreStop(root)); await forceKillCore(root); }
    c.cmd(runSync(root, 'doc-pass'), '夹具场景 doc-pass 完整跑完');

    // --- Then / And：一条原文一条核对项 ---
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    const t = text(st);
    c.includes('输出含「……」（照抄需求原文）', t, '……');

    const s = readState(root);
    c.eq('机检：state 为 completed', s?.state, 'completed');
    c.eq('机检：T-003 state=done', nodeOf(s, 'T-003')?.state, 'done');

    // 观测不到时（真实宿主专属等）：
    // c.block('核对项', '原因：……；已尝试：……');

    return finish(c);
  }
}];
