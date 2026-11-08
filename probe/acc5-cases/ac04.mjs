// AC-04 缺必填字段被拒绝（用户可见 + 机检）
import {
  makeCase, freshRoot, writeRole, roleValidate, jsonOf, text, nonEmptyLines,
  requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-04';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    const file = writeRole(root, 'no-concurrency', {
      id: 'no-concurrency',
      name: '没并发',
      group: 'coding',
      summary: '只缺并发上限',
      artifactType: 'code',
      sideEffect: 'write',
      skills: [],
      tools: ['read'],
      wakeAllow: [],
      omit: ['max_concurrent_sessions']
    });
    c.noteFixture('写 .orch/roles/no-concurrency.yaml（省略 max_concurrent_sessions）', file);

    const res = c.cmd(roleValidate(root), 'orch role validate');
    const rows = nonEmptyLines(text(res));
    c.evText('validate', text(res));

    c.eq('Then 退出码 1', res.exitCode, 1);
    c.includes('Then 输出含「- roles/no-concurrency.yaml：缺少必填字段：max_concurrent_sessions（ROLE_SCHEMA_MISSING）」',
      text(res), '- roles/no-concurrency.yaml：缺少必填字段：max_concurrent_sessions（ROLE_SCHEMA_MISSING）');
    c.eq('Then 首行给出 27 个资产 1 个不合法', rows[0], '校验资产 27 个：1 个不合法');

    const jsonRes = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    c.eq('机检：counts.assets === 27', payload?.counts?.assets, 27);
    c.eq('机检：counts.invalid === 1', payload?.counts?.invalid, 1);
    c.eq('机检：counts.roles === 16', payload?.counts?.roles, 16);
    c.eq('机检：counts.skills === 10', payload?.counts?.skills, 10);
    c.eq('机检：errors 长度 1', payload?.errors?.length, 1);
    c.eq('机检：errors[0].code', payload?.errors?.[0]?.code, 'ROLE_SCHEMA_MISSING');
    c.eq('机检：errors[0].field', payload?.errors?.[0]?.field, 'max_concurrent_sessions');
    c.eq('机检：errors[0].file', payload?.errors?.[0]?.file, 'roles/no-concurrency.yaml');

    return finish(c);
  }
}];
