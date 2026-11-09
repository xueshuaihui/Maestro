// AC-07 产物类型、副作用等级、并发上限越界被拒绝（用户可见 + 机检）
import {
  makeCase, freshRoot, writeRole, roleValidate, jsonOf, text, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-07';

const base = {
  name: '越界',
  group: 'coding',
  summary: '三个字段分别越界',
  artifactType: 'code',
  sideEffect: 'write',
  skills: [],
  tools: ['read'],
  wakeAllow: [],
  max: 1
};

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    // 文件名即排序键：bad-artifact < bad-max < bad-side-effect
    c.noteFixture('写 A（artifact_type: slides）', writeRole(root, 'bad-artifact', { ...base, id: 'bad-artifact', artifactType: 'slides' }));
    c.noteFixture('写 B（max_concurrent_sessions: 9）', writeRole(root, 'bad-max', { ...base, id: 'bad-max', max: 9 }));
    c.noteFixture('写 C（side_effect: admin）', writeRole(root, 'bad-side-effect', { ...base, id: 'bad-side-effect', sideEffect: 'admin' }));

    const res = c.cmd(roleValidate(root), 'orch role validate');
    const out = text(res);
    c.evText('validate', out);
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.eq('Then 三条错误', out.split('\n').filter((l) => l.startsWith('- roles/')).length, 3);

    const jsonRes = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    const codes = (payload?.errors ?? []).map((e) => e.code);
    c.deepEq('机检：三条错误的 code 集合与需求完全一致（顺序按文件名）', codes, [
      'ROLE_ARTIFACT_TYPE_INVALID',
      'ROLE_MAX_CONCURRENT_INVALID',
      'ROLE_SIDE_EFFECT_INVALID'
    ]);
    c.deepEq('机检：三份文件的 file 相对路径与文件名顺序一致', (payload?.errors ?? []).map((e) => e.file), [
      'roles/bad-artifact.yaml',
      'roles/bad-max.yaml',
      'roles/bad-side-effect.yaml'
    ]);
    c.eq('机检：并发上限的合法范围是 1~5 的整数', (payload?.errors ?? [])[1]?.detail,
      '并发上限取值非法：9；合法范围：1~5 的整数');
    c.eq('机检：counts.invalid === 3（按文件计）', payload?.counts?.invalid, 3);

    return finish(c);
  }
}];
