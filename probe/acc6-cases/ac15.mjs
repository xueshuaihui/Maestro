// AC-15 26 个内置资产仍然全通过（I1.5 基线不变）（回归 + 机检）
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, roleValidate, jsonOf, diffLines,
  text, nonEmptyLines, clean, requirementTitle, finish, REPO
} from '../acc6-f-common.mjs';

const AC = 'AC-15';
// I1.5 收口提交 0cd113b 的同一条命令输出基线（全新项目根、干净全通过形态）。
const BASELINE_FILE = path.join(REPO, 'docs', 'iterations', 'iteration-5', 'evidence', 'AC-12.validate.txt');

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '回归',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '回归' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（没有任何项目资产、也没有工作流）', root);

    // When：role validate 与 role validate --format json
    const res = c.cmd(roleValidate(root), 'orch role validate');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('validate', text(res));
    const jsonRes = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);

    // Then：文本恰好一行 校验资产 26 个：全部通过（角色 16 · 技能 10），退出码 0
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.eq('Then 文本输出恰好一行', rows.length, 1);
    c.lineEq('Then 该行逐字', rows[0], '校验资产 26 个：全部通过（角色 16 · 技能 10）');

    // Then：JSON 的 counts 仍是 6 键，四个计数逐项
    c.eq('Then JSON counts 仍是 6 键', Object.keys(payload?.counts ?? {}).length, 6);
    c.eq('Then counts.assets === 26', payload?.counts?.assets, 26);
    c.eq('Then counts.roles === 16', payload?.counts?.roles, 16);
    c.eq('Then counts.skills === 10', payload?.counts?.skills, 10);
    c.eq('Then counts.invalid === 0', payload?.counts?.invalid, 0);
    c.deepEq('Then errors 为空', payload?.errors ?? [], []);

    // 机检：与 I1.5 收口提交 0cd113b 的同一条命令输出逐字节 diff 为空
    //（基线文本：docs/iterations/iteration-5/evidence/AC-12.validate.txt，0cd113b 留痕的干净全通过形态）
    const baseline = fs.readFileSync(BASELINE_FILE, 'utf8');
    const d = diffLines(clean(text(res)), clean(baseline));
    c.evText('baseline-diff', d.same ? '（逐字节相同）' : d.diffs.map((x) => `L${x.i + 1}: ${JSON.stringify(x.a)} != ${JSON.stringify(x.b)}`).join('\n'));
    c.check('机检：与 0cd113b 基线（iteration-5 evidence/AC-12.validate.txt）逐字节 diff 为空', d.same,
      d.same ? 'diff 为空' : `${d.diffs.length} 行差异`);

    return finish(c);
  }
}];
