// AC-37 角色对唤醒权限（机检 + 用户可见）
// Given：wake.yaml：T-001（role: writer，节点级 wake_allow: [editor]）→ T-002（role: reviewer），
// terminal: T-002。节点级声明优先于角色资产（AC-37 / AC-60 的需求先例，裁-15）。
import fs from 'node:fs';
import {
  makeCase, freshRoot, workflowValidate, jsonOf, writeWorkflow,
  text, clean, requirementTitle, finish, readText
} from '../acc6-f-common.mjs';

const AC = 'AC-37';
const WAKE_YAML = [
  'schema: workflow/v1',
  'id: wake',
  'name: 唤醒',
  'entry: T-001',
  'terminal: T-002',
  'nodes:',
  '  - id: T-001',
  '    node_type: role',
  '    role: writer',
  '    title: 上游',
  '    wake_allow: [editor]',
  '  - id: T-002',
  '    node_type: role',
  '    role: reviewer',
  '    title: 下游',
  'edges:',
  '  - from: T-001',
  '    to: T-002',
  ''
].join('\n');

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);
    const file = writeWorkflow(root, 'wake', WAKE_YAML);
    c.noteFixture('预置 wake.yaml（T-001 role: writer 节点级 wake_allow: [editor] → T-002 role: reviewer）', WAKE_YAML);

    // When：orch workflow validate wake
    const res = c.cmd(workflowValidate(root, ['wake']), 'orch workflow validate wake');
    c.evText('validate-denied', text(res));
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.includes('Then 报 WORKFLOW_WAKE_DENIED', text(res), '（WORKFLOW_WAKE_DENIED）');
    c.includes('Then 明细含 writer', clean(text(res)), 'writer');
    c.includes('Then 明细含 reviewer', clean(text(res)), '唤醒不在白名单内：writer → reviewer');

    // 机检：失败时 errors[0]
    const bad = c.cmd(workflowValidate(root, ['wake', '--format', 'json']), 'orch workflow validate wake --format json');
    const badPayload = jsonOf(bad);
    c.evJson('payload-denied', badPayload);
    c.eq('机检：errors[0].code === WORKFLOW_WAKE_DENIED', badPayload?.errors?.[0]?.code, 'WORKFLOW_WAKE_DENIED');

    // Then（后半）：把下游换成 editor 后同一命令通过
    const fixed = (readText(file) ?? '').replace('    role: reviewer', '    role: editor');
    c.check('夹具自检：下游角色已换成 editor', fixed.includes('role: editor'), 'replace applied');
    fs.writeFileSync(file, fixed, 'utf8');
    c.noteFixture('把 T-002 的 role 换成 editor（writer 的节点级白名单含 editor）', '');
    const fix = c.cmd(workflowValidate(root, ['wake']), 'orch workflow validate wake（下游换 editor 后）');
    c.evText('validate-fixed', text(fix));
    c.eq('Then 换成 editor 后退出 0', fix.exitCode, 0);
    c.includes('Then 换成 editor 后全部通过', clean(text(fix)), '全部通过');

    // 机检：换成 editor 后 counts.invalid === 0
    const good = c.cmd(workflowValidate(root, ['wake', '--format', 'json']), 'orch workflow validate wake --format json（下游换 editor 后）');
    const goodPayload = jsonOf(good);
    c.evJson('payload-fixed', goodPayload);
    c.eq('机检：换成 editor 后 counts.invalid === 0', goodPayload?.counts?.invalid, 0);

    return finish(c);
  }
}];
