// AC-36 节点状态转换合法性（机检 + 用户可见）
// 两段：① doc-fanout 追加 T-005 → T-006 的 forward 边（升级节点不得有正向出边）；
// ② 还原夹具后把 T-004 两条出边的 when 去掉（人工节点出边必须写人工条件）。
import fs from 'node:fs';
import {
  makeCase, freshRoot, workflowValidate, jsonOf,
  text, clean, requirementTitle, finish, readText
} from '../acc6-f-common.mjs';
import { writeDocFanout } from './_fixtures.mjs';

const AC = 'AC-36';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);
    const file = writeDocFanout(root);
    c.noteFixture('预置附录 A-13 的 doc-fanout（writeDocFanout）', '');

    // 第一段：追加 T-005 → T-006 的 forward 边
    const escalateOut = (readText(file) ?? '') + '  - from: T-005\n    to: T-006\n';
    fs.writeFileSync(file, escalateOut, 'utf8');
    c.noteFixture('追加边 T-005 → T-006（forward，升级节点不得有正向出边）', '');

    const res = c.cmd(workflowValidate(root, ['doc-fanout']), 'orch workflow validate doc-fanout（升级出边）');
    c.evText('validate-escalate', text(res));
    c.eq('Then 第一段退出码 1', res.exitCode, 1);
    c.includes('Then 报 WORKFLOW_TRANSITION_ILLEGAL', text(res), '（WORKFLOW_TRANSITION_ILLEGAL）');
    c.includes('Then 明细含 T-005', clean(text(res)), '升级节点 T-005 不能有正向出边');

    const json1 = c.cmd(workflowValidate(root, ['doc-fanout', '--format', 'json']), 'orch workflow validate doc-fanout --format json（升级出边）');
    const payload1 = jsonOf(json1);
    c.evJson('payload-escalate', payload1);
    c.eq('机检：第一段 errors[0].code', payload1?.errors?.[0]?.code, 'WORKFLOW_TRANSITION_ILLEGAL');
    c.includes('机检：第一段 detail 含 T-005', payload1?.errors?.[0]?.detail ?? '', 'T-005');

    // 第二段：还原夹具后把 T-004 两条出边的 when 去掉
    writeDocFanout(root);
    const noWhen = (readText(file) ?? '')
      .replace('    when: human_approved\n', '')
      .replace('    when: human_rejected\n', '');
    c.check('夹具自检：T-004 两条出边的 when 已去掉', !noWhen.includes('human_approved') && !noWhen.includes('human_rejected'), 'replace applied');
    fs.writeFileSync(file, noWhen, 'utf8');
    c.noteFixture('去掉 T-004 两条出边的 when（缺省 always，人工节点出边必须写人工条件）', '');

    const res2 = c.cmd(workflowValidate(root, ['doc-fanout']), 'orch workflow validate doc-fanout（人工出边无条件）');
    c.evText('validate-human', text(res2));
    c.eq('Then 第二段退出码 1', res2.exitCode, 1);
    c.includes('Then 改报 WORKFLOW_TRANSITION_ILLEGAL', text(res2), '（WORKFLOW_TRANSITION_ILLEGAL）');
    c.includes('Then 明细含 人工条件', clean(text(res2)), '人工节点 T-004 的出边必须写人工条件');

    const json2 = c.cmd(workflowValidate(root, ['doc-fanout', '--format', 'json']), 'orch workflow validate doc-fanout --format json（人工出边无条件）');
    const payload2 = jsonOf(json2);
    c.evJson('payload-human', payload2);
    c.eq('机检：第二段 errors[0].code', payload2?.errors?.[0]?.code, 'WORKFLOW_TRANSITION_ILLEGAL');
    c.includes('机检：第二段 detail 含 人工条件', payload2?.errors?.[0]?.detail ?? '', '人工条件');

    return finish(c);
  }
}];
