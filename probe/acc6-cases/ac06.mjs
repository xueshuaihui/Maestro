// AC-06 派生链缺失与成环被拒（机检 + 用户可见）
import fs from 'node:fs';
import {
  makeCase, freshRoot, roleValidate, writeRole, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-06';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：.orch/roles/a1.yaml（derived_from: b1）与 b1.yaml（derived_from: a），其余字段合法
    writeRole(root, 'a1', { id: 'a1', name: '甲', derivedFrom: 'b1' });
    writeRole(root, 'b1', { id: 'b1', name: '乙', derivedFrom: 'a1' });
    c.noteFixture('预置 .orch/roles/a1.yaml（derived_from: b1）与 b1.yaml（derived_from: a），其余字段合法', '');

    // When：第一次 role validate
    const v1 = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json（第一次：环）');
    const p1 = jsonOf(v1);
    c.evJson('cycle-payload', p1);
    const codes1 = (p1?.errors ?? []).map((e) => e.code);

    // Then：两条 ROLE_DERIVE_CYCLE（环上每个文件各一条），退出 1
    c.eq('Then 第一次退出码 1', v1.exitCode, 1);
    c.eq('Then 第一次 errors 长度 2', (p1?.errors ?? []).length, 2);
    c.deepEq('机检：codes 全为 ROLE_DERIVE_CYCLE', [...new Set(codes1)], ['ROLE_DERIVE_CYCLE']);
    c.eq('机检：errors[0].file === roles/a1.yaml（按文件名字典序）', p1?.errors?.[0]?.file, 'roles/a1.yaml');
    c.includes('Then 明细给出环上的角色名', p1?.errors?.[0]?.detail ?? '', 'a');
    const text1 = c.cmd(roleValidate(root), 'orch role validate（文本，第一次）');
    c.evText('cycle-text', text(text1));
    c.matches('Then 文本含两条 ROLE_DERIVE_CYCLE', clean(text(text1)), /ROLE_DERIVE_CYCLE/g);

    // When：把 b1.yaml 的 derived_from 改成 ghost 再执行一次
    writeRole(root, 'b1', { id: 'b1', name: '乙', derivedFrom: 'ghost' });
    c.noteFixture('把 b1.yaml 的 derived_from 改成 ghost', '');
    const v2 = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json（第二次：ghost）');
    const p2 = jsonOf(v2);
    c.evJson('missing-payload', p2);
    const text2 = c.cmd(roleValidate(root), 'orch role validate（文本，第二次）');
    c.evText('missing-text', text(text2));

    // Then：只报一条 ROLE_DERIVE_MISSING，明细给出 ghost，退出 1
    c.eq('Then 第二次退出码 1', v2.exitCode, 1);
    c.eq('Then 第二次 errors 长度 1', (p2?.errors ?? []).length, 1);
    c.eq('机检：errors[0].code === ROLE_DERIVE_MISSING', p2?.errors?.[0]?.code, 'ROLE_DERIVE_MISSING');
    c.eq('机检：errors[0].file === roles/b1.yaml', p2?.errors?.[0]?.file, 'roles/b1.yaml');
    c.includes('Then 明细给出 ghost', p2?.errors?.[0]?.detail ?? '', 'ghost');

    return finish(c);
  }
}];
