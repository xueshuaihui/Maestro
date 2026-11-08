// AC-36 role validate 可只校验单个角色（用户可见 + 机检）
import {
  makeCase, freshRoot, writeRole, roleValidate, jsonOf, text, nonEmptyLines,
  requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-36';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：一个坏角色文件 + 一个好角色文件
    c.noteFixture('写坏角色 .orch/roles/ghost-skill.yaml（技能不存在）', writeRole(root, 'ghost-skill', {
      id: 'ghost-skill',
      name: '幽灵技能',
      group: 'coding',
      summary: '引用了不存在的技能',
      artifactType: 'code',
      sideEffect: 'write',
      skills: ['no-such-skill'],
      tools: ['read'],
      wakeAllow: [],
      max: 1
    }));
    c.noteFixture('写好角色 .orch/roles/researcher.yaml', writeRole(root, 'researcher', {
      id: 'researcher',
      name: '研究员',
      group: 'research',
      summary: '按任务收集事实',
      artifactType: 'report',
      sideEffect: 'write',
      skills: ['research-brief'],
      tools: ['read', 'write'],
      wakeAllow: [],
      max: 1
    }));

    // When
    const res = c.cmd(roleValidate(root, ['researcher']), 'orch role validate researcher');
    const rows = nonEmptyLines(text(res));
    c.evText('validate', text(res));

    // Then
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.eq('Then 只报「校验资产 1 个：全部通过（角色 1 · 技能 0）」', rows.length, 1);
    c.lineEq('Then 该行逐字', rows[0], '校验资产 1 个：全部通过（角色 1 · 技能 0）');
    c.notIncludes('机检：输出行不含坏文件名', text(res), 'ghost-skill');

    const jsonRes = c.cmd(roleValidate(root, ['researcher', '--format', 'json']), 'orch role validate researcher --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    c.eq('机检：counts.assets 为 1', payload?.counts?.assets, 1);
    c.eq('机检：counts.skills 为 0', payload?.counts?.skills, 0);
    c.deepEq('机检：errors 只含该角色文件（此处为空）', payload?.errors, []);

    return finish(c);
  }
}];
