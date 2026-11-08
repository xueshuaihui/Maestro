// AC-03 项目角色覆盖内置并标来源（用户可见 + 机检）
import {
  makeCase, freshRoot, writeRole, roleList, roleShow, jsonOf, text, nonEmptyLines,
  requirementTitle, finish
} from '../acc5-f-common.mjs';
import { listHeader, LIST_ROWS } from './_baselines.mjs';

const AC = 'AC-03';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    const file = writeRole(root, 'researcher', {
      id: 'researcher',
      name: '研究员',
      group: 'research',
      summary: '按任务收集事实，交出研究笔记（项目版）',
      artifactType: 'report',
      sideEffect: 'write',
      skills: ['research-brief', 'fact-check'],
      tools: ['read', 'write'],
      wakeAllow: [],
      max: 1
    });
    c.noteFixture('写项目角色 .orch/roles/researcher.yaml', file);

    const list = c.cmd(roleList(root), 'orch role list');
    const rows = nonEmptyLines(text(list));
    c.evText('list', text(list));
    c.lineEq('Then list 首行变为「角色 16 个（内置 15 · 项目 1）」', rows[0], listHeader({ total: 16, builtin: 15, project: 1 }));
    const row = rows.find((line) => line.startsWith('- researcher '));
    c.eq('Then researcher 行的技能数为 2', row, '- researcher 研究员 · 研究分析 · report · write · 技能 2 · 并发 1');
    c.eq('机检：其它 15 行仍与 A-2 逐字一致（除 researcher 行）', rows.slice(1).filter((l) => !l.startsWith('- researcher ')).length, 15);

    const show = c.cmd(roleShow(root, 'researcher'), 'orch role show researcher');
    const showRows = nonEmptyLines(text(show));
    c.evText('show', text(show));
    c.eq('Then show 的来源行写「项目 .orch/roles/researcher.yaml」', showRows[5], '  来源：项目 .orch/roles/researcher.yaml');

    const jsonRes = c.cmd(roleList(root, ['--format', 'json']), 'orch role list --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    const researcher = (payload?.roles ?? []).find((r) => r.id === 'researcher');
    c.eq('机检：researcher.source === project', researcher?.source, 'project');
    c.eq('机检：researcher.skills.length === 2', researcher?.skills?.length, 2);
    c.eq('机检：counts.builtin === 15', payload?.counts?.builtin, 15);
    c.eq('机检：counts.project === 1', payload?.counts?.project, 1);
    const othersBuiltin = (payload?.roles ?? []).filter((r) => r.id !== 'researcher').every((r) => r.source === 'builtin');
    c.check('Then 其它 15 个角色来源仍是内置', othersBuiltin && (payload?.roles ?? []).length === 16,
      JSON.stringify((payload?.roles ?? []).map((r) => `${r.id}:${r.source}`)));
    c.eq('机检：researcher 的 file 带 .orch/ 前缀', researcher?.file, '.orch/roles/researcher.yaml');
    c.check('机检：内置 15 行未受覆盖影响', LIST_ROWS.filter((l) => !l.startsWith('- researcher ')).length === 15);

    return finish(c);
  }
}];
