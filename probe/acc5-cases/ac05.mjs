// AC-05 角色 id 与文件名不一致被拒绝（用户可见 + 机检）
import {
  makeCase, freshRoot, writeRole, roleValidate, jsonOf, text, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-05';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    const file = writeRole(root, 'writer', {
      id: 'wordsmith',
      name: '撰写者',
      group: 'writing',
      summary: '按大纲写初稿',
      artifactType: 'document',
      sideEffect: 'write',
      skills: ['doc-draft'],
      tools: ['read', 'write'],
      wakeAllow: [],
      max: 1
    });
    c.noteFixture('写 .orch/roles/writer.yaml（内容 id: wordsmith）', file);

    const res = c.cmd(roleValidate(root), 'orch role validate');
    const out = text(res);
    c.evText('validate', out);

    c.eq('Then 退出码 1', res.exitCode, 1);
    c.includes('Then 输出含 roles/writer.yaml', out, 'roles/writer.yaml');
    c.includes('Then 原因码 ROLE_ID_MISMATCH', out, 'ROLE_ID_MISMATCH');

    const jsonRes = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    const err = payload?.errors?.[0] ?? {};
    c.eq('机检：errors[0].code === ROLE_ID_MISMATCH', err.code, 'ROLE_ID_MISMATCH');
    c.check('机检：errors[0].detail 同时含 writer 与 wordsmith',
      String(err.detail ?? '').includes('writer') && String(err.detail ?? '').includes('wordsmith'),
      String(err.detail));
    c.eq('机检：明细同时给出文件名推出的 id 与内容声明的 id', err.detail, '角色 id 与文件名不一致：文件 writer / 声明 wordsmith');

    return finish(c);
  }
}];
