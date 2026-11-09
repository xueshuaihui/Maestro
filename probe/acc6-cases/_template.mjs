// 用例模板：复制成 probe/acc6-cases/acNN.mjs 后填 AC 号与断言。
// 本文件以 _ 开头，runner 不会加载。
// 纪律（模板 §3.2）：makeCase → 构造 → 断言（一个 Then/And 至少一条）→ return finish(c)。
// 证据命名 AC-XX.<阶段>.<类型>；空结果不产 0 字节文件；验收根在 %TEMP%/maestro-acc-p6/<AC>/。
import {
  makeCase, freshRoot, orch, roleList, roleShow, roleValidate, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';
import { DOC_FANOUT_YAML, writeDocFanout } from './_fixtures.mjs';

const AC = 'AC-xx';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见', // 用户可见 / 机检 / 夹具 / 架构检查 / 混合
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    // --- Given：全新项目根（无 .orch）；需要项目资产时用 writeRole/writeSkill/writeDocFanout ---
    const res = c.cmd(roleList(root), 'orch role list');
    const rows = nonEmptyLines(clean(text(res)));

    // --- Then / And：一条原文一条核对项，期望值逐字照抄附录 A ---
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.lineEq('Then 首行逐字', rows[0], '…');

    const json = c.cmd(roleList(root, ['--format', 'json']), 'orch role list --format json');
    const payload = jsonOf(json);
    c.eq('机检：…', payload?.counts?.total, 26);

    // --- 额外证据（原始帧）---
    c.evText('list', text(res));
    c.evJson('payload', payload);

    // 观测不到时（产品缺陷 / 环境限制）：
    // c.block('核对项', '原因：……；已尝试：……'); → 缺陷另记 probe/acc6-f-blockers.md

    return finish(c);
  }
}];
