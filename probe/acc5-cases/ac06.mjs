// AC-06 分组不在五组被拒绝（用户可见 + 机检）
import {
  makeCase, freshRoot, writeRole, roleValidate, jsonOf, text, requirementTitle, finish
} from '../acc5-f-common.mjs';
import { GROUPS } from './_baselines.mjs';

const AC = 'AC-06';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    const file = writeRole(root, 'bad-group', {
      id: 'bad-group',
      name: '坏分组',
      group: 'marketing',
      summary: '分组不在五组里',
      artifactType: 'report',
      sideEffect: 'read',
      skills: [],
      tools: ['read'],
      wakeAllow: [],
      max: 1
    });
    c.noteFixture('写 .orch/roles/bad-group.yaml（group: marketing）', file);

    const res = c.cmd(roleValidate(root), 'orch role validate');
    c.evText('validate', text(res));
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.includes('Then 原因码 ROLE_GROUP_INVALID', text(res), 'ROLE_GROUP_INVALID');

    const jsonRes = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    const err = payload?.errors?.[0] ?? {};
    c.eq('机检：errors[0].code === ROLE_GROUP_INVALID', err.code, 'ROLE_GROUP_INVALID');
    const detail = String(err.detail ?? '');
    for (const g of GROUPS) {
      c.includes(`机检：明细列出合法取值 ${g}`, detail, g);
    }
    c.eq('机检：明细逐字（五个取值依次列出）', detail,
      '分组取值非法：marketing；合法取值：coordinator / research / writing / coding / ops');

    return finish(c);
  }
}];
