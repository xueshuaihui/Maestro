// AC-33 回流边必须有轮次上限（机检 + 用户可见）
// Given：doc-fanout 追加 T-003 → T-002 的 backflow 边（kind: backflow、when: failed；
// 源 T-003 是 role 节点，符合 BR-25/BR-36；只加边、不改 scope）。T-002 无 max_rounds。
import fs from 'node:fs';
import {
  makeCase, freshRoot, workflowValidate, jsonOf,
  text, clean, requirementTitle, finish, readText
} from '../acc6-f-common.mjs';
import { writeDocFanout } from './_fixtures.mjs';

const AC = 'AC-33';
const BACKFLOW_EDGE = '  - from: T-003\n    to: T-002\n    kind: backflow\n    when: failed\n';

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

    // Given：追加 T-003 → T-002 的 backflow 边（T-002 仍是回边目标且没有 max_rounds）
    const broken = (readText(file) ?? '') + BACKFLOW_EDGE;
    fs.writeFileSync(file, broken, 'utf8');
    c.noteFixture('追加边 T-003 → T-002（kind: backflow、when: failed）', BACKFLOW_EDGE);

    // When：orch workflow validate doc-fanout
    const res = c.cmd(workflowValidate(root, ['doc-fanout']), 'orch workflow validate doc-fanout');
    c.evText('validate-broken', text(res));
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.includes('Then 报 WORKFLOW_BACKFLOW_NO_LIMIT', text(res), '（WORKFLOW_BACKFLOW_NO_LIMIT）');
    c.includes('Then 明细含 T-002', clean(text(res)), '回流目标缺少轮次上限：T-002');

    // 机检：失败时 errors[0]
    const bad = c.cmd(workflowValidate(root, ['doc-fanout', '--format', 'json']), 'orch workflow validate doc-fanout --format json');
    const badPayload = jsonOf(bad);
    c.evJson('payload-broken', badPayload);
    c.eq('机检：errors[0].code === WORKFLOW_BACKFLOW_NO_LIMIT', badPayload?.errors?.[0]?.code, 'WORKFLOW_BACKFLOW_NO_LIMIT');

    // Then（后半）：给 T-002 补上 max_rounds: 2 后同一命令通过
    const fixed = (readText(file) ?? '').replace('    title: 撰写A', '    title: 撰写A\n    max_rounds: 2');
    c.check('夹具自检：T-002 已补 max_rounds: 2', fixed.includes('max_rounds: 2'), 'replace applied');
    fs.writeFileSync(file, fixed, 'utf8');
    c.noteFixture('给 T-002 补上 max_rounds: 2', '');
    const fix = c.cmd(workflowValidate(root, ['doc-fanout']), 'orch workflow validate doc-fanout（补 max_rounds 后）');
    c.evText('validate-fixed', text(fix));
    c.eq('Then 补上后退出 0', fix.exitCode, 0);
    c.includes('Then 补上后全部通过', clean(text(fix)), '全部通过');

    // 机检：补上后 counts.invalid === 0
    const good = c.cmd(workflowValidate(root, ['doc-fanout', '--format', 'json']), 'orch workflow validate doc-fanout --format json（补 max_rounds 后）');
    const goodPayload = jsonOf(good);
    c.evJson('payload-fixed', goodPayload);
    c.eq('机检：补上后 counts.invalid === 0', goodPayload?.counts?.invalid, 0);

    return finish(c);
  }
}];
