// AC-13 权限闭环：工具集与副作用等级对不上（机检 + 用户可见）
import {
  makeCase, freshRoot, roleValidate, writeRole, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-13';
const SENTENCES = [
  '副作用等级为 read 的角色不能带写工具 write',
  '副作用等级为 exec 的角色必须带能执行命令的工具 bash',
  '副作用等级为 none 的角色不能带任何工具'
];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：r1（read + write 工具）、r2（exec + read 工具）、r3（none + read 工具），其余字段合法
    writeRole(root, 'r1', { id: 'r1', name: '读错写', sideEffect: 'read', tools: ['read', 'write'] });
    writeRole(root, 'r2', { id: 'r2', name: '执错器', sideEffect: 'exec', tools: ['read'] });
    writeRole(root, 'r3', { id: 'r3', name: '空手道', sideEffect: 'none', tools: ['read'] });
    c.noteFixture('预置 r1（read+write）/ r2（exec+read）/ r3（none+read），其余字段合法', '');

    // When：role validate（文本 + JSON）
    const res = c.cmd(roleValidate(root), 'orch role validate');
    const rows = nonEmptyLines(clean(text(res)));
    const errRows = rows.filter((l) => l.startsWith('- '));
    c.evText('validate-text', text(res));
    const jsonRes = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    const codes = (payload?.errors ?? []).map((e) => e.code);

    // Then：三条 ROLE_PERMISSION_MISMATCH，明细是三条固定句，退出 1
    //（文本首行是计数头「校验资产 29 个：3 个不合法」——I1.5 既有形态，「三条错误」按 `- ` 行计）
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.eq('Then 恰好三条错误（- 开头）', errRows.length, 3);
    for (const [i, s] of SENTENCES.entries()) {
      c.includes(`Then 第 ${i + 1} 条错误明细 = 固定句（${s.slice(0, 12)}…）`, errRows[i], s);
      c.includes(`Then 第 ${i + 1} 条错误带原因码 ROLE_PERMISSION_MISMATCH`, errRows[i], '（ROLE_PERMISSION_MISMATCH）');
    }

    // 机检：codes 全为 ROLE_PERMISSION_MISMATCH、长度 3、按文件名排序；counts.invalid === 3
    c.eq('机检：errors 长度 3', codes.length, 3);
    c.deepEq('机检：errors.map(code) 全为 ROLE_PERMISSION_MISMATCH', [...new Set(codes)], ['ROLE_PERMISSION_MISMATCH']);
    c.deepEq('机检：errors 按文件名排序', (payload?.errors ?? []).map((e) => e.file), ['roles/r1.yaml', 'roles/r2.yaml', 'roles/r3.yaml']);
    c.eq('机检：counts.invalid === 3', payload?.counts?.invalid, 3);

    return finish(c);
  }
}];
