// AC-14 权限闭环：白名单悬空与自唤醒（机检 + 用户可见）
import {
  makeCase, freshRoot, roleValidate, writeRole, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-14';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：w1（wake_allow: [ghost]）与 w2（wake_allow: [w2]），其余字段合法
    writeRole(root, 'w1', { id: 'w1', name: '唤空', wakeAllow: ['ghost'] });
    writeRole(root, 'w2', { id: 'w2', name: '唤己', wakeAllow: ['w2'] });
    c.noteFixture('预置 w1（wake_allow: [ghost]）与 w2（wake_allow: [w2]），其余字段合法', '');

    // When：role validate（文本 + JSON）
    const res = c.cmd(roleValidate(root), 'orch role validate');
    const rows = nonEmptyLines(clean(text(res)));
    const errRows = rows.filter((l) => l.startsWith('- '));
    c.evText('validate-text', text(res));
    const jsonRes = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    const codes = (payload?.errors ?? []).map((e) => e.code);

    // Then：两条错误：ROLE_WAKE_UNKNOWN（明细含 ghost）与 ROLE_WAKE_SELF（明细含 w2），退出 1
    //（文本首行是计数头——I1.5 既有形态，「两条错误」按 `- ` 行计）
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.eq('Then 恰好两条错误（- 开头）', errRows.length, 2);
    const unknown = rows.find((l) => l.includes('ROLE_WAKE_UNKNOWN'));
    const self = rows.find((l) => l.includes('ROLE_WAKE_SELF'));
    c.check('Then 有 ROLE_WAKE_UNKNOWN 一行', Boolean(unknown), unknown);
    c.check('Then 有 ROLE_WAKE_SELF 一行', Boolean(self), self);
    c.includes('Then ROLE_WAKE_UNKNOWN 明细含 ghost', unknown ?? '', 'ghost');
    c.includes('Then ROLE_WAKE_SELF 明细含 w2', self ?? '', 'w2');

    // 机检：codes 排序后等于 [ROLE_WAKE_SELF, ROLE_WAKE_UNKNOWN]
    c.deepEq('机检：codes 排序后等于 [ROLE_WAKE_SELF, ROLE_WAKE_UNKNOWN]', [...codes].sort(), ['ROLE_WAKE_SELF', 'ROLE_WAKE_UNKNOWN']);

    return finish(c);
  }
}];
