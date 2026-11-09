// 用例模板：复制成 probe/acc5-cases/acNN.mjs 后填 AC 号与断言。
// 本文件以 _ 开头，runner 不会加载。
// 纪律（模板 §3.2）：makeCase → 构造 → 断言（一个 Then/And 至少一条）→ finally 清理 → return finish(c)。
import {
  makeCase, freshRoot, orch, roleList, roleShow, roleValidate, jsonOf,
  text, nonEmptyLines, requirementTitle, finish, forceKillCore, startDriver, waitPaused,
  roleListJson, viewOf, readState, nodeOf
} from '../acc5-f-common.mjs';
import { FULL_LIST, SHOW_DEVELOPER } from './_baselines.mjs';

const AC = 'AC-xx';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见', // 用户可见 / 机检 / 夹具 / 架构检查 / 混合
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    // --- Given：CLI 类直接建空根；夹具类用 prepareCodeLoop / writeHostConfig ---
    const res = c.cmd(roleList(root), 'orch role list');
    const rows = nonEmptyLines(text(res));

    // --- Then / And：一条原文一条核对项，期望值逐字照抄 _baselines.mjs ---
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.deepEq('And 17 行逐字（首行 + 16 行角色）', rows, FULL_LIST);

    const json = roleList(root, ['--format', 'json']);
    const payload = jsonOf(json);
    c.eq('机检：roles 数组长度 16', payload?.roles?.length, 16);

    // --- 额外证据（原始帧）---
    c.evText('list', text(res));
    c.evJson('payload', payload);

    // 观测不到时（真实宿主专属等）：
    // c.block('核对项', '原因：……；已尝试：……');

    return finish(c);
  }
}];
