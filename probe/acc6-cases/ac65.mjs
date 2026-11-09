// AC-65 校验顺序与错误排序固定（BR-40）（边界 + 机检）
// Given：bad-type.yaml（node_type: script）+ wake.yaml（forward 边源角色白名单不含目标角色），
//        内置三图按 D-7b 对齐后合法 → counts.assets === 5（内置 3 + 项目 2）。
// Then：文本首行 5 个：2 个不合法，两行按 文件名字典序 + 同文件内 C-09 顺序 固定；
//       两次 JSON 输出逐字节相同（sha256）。
import crypto from 'node:crypto';
import {
  makeCase, freshRoot, workflowValidate, writeWorkflow, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-65';
const EXPECTED_MAP = [
  'workflows/bad-type.yaml:WORKFLOW_NODE_TYPE_INVALID',
  'workflows/wake.yaml:WORKFLOW_WAKE_DENIED'
];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);

    // --- Given：两份坏工作流（id 与文件名一致；wake 用 researcher → editor，researcher 白名单 [writer] 不含 editor）---
    writeWorkflow(root, 'bad-type', [
      'schema: workflow/v1',
      'id: bad-type',
      'name: 坏类型',
      'entry: T-001',
      'terminal: T-001',
      'nodes:',
      '  - id: T-001',
      '    node_type: script',
      '    title: 坏类型',
      ''
    ].join('\n'));
    writeWorkflow(root, 'wake', [
      'schema: workflow/v1',
      'id: wake',
      'name: 唤醒越权',
      'entry: T-001',
      'terminal: T-002',
      'nodes:',
      '  - id: T-001',
      '    node_type: role',
      '    role: researcher',
      '    title: 源',
      '  - id: T-002',
      '    node_type: role',
      '    role: editor',
      '    title: 目标',
      'edges:',
      '  - from: T-001',
      '    to: T-002',
      ''
    ].join('\n'));
    c.noteFixture('预置 bad-type.yaml（node_type: script）与 wake.yaml（researcher → editor 的 forward 边，源角色白名单 [writer] 不含 editor）；节点上不补 wake_allow', '');

    // --- When：连续两次 JSON（sha256 逐字节比对），再文本 ---
    const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
    const j1 = c.cmd(workflowValidate(root, ['--format', 'json']), 'orch workflow validate --format json（第 1 次）');
    const j2 = c.cmd(workflowValidate(root, ['--format', 'json']), 'orch workflow validate --format json（第 2 次）');
    const h1 = sha(j1.stdout);
    const h2 = sha(j2.stdout);
    c.evText('json-run-1-sha256', `${h1}\n`);
    c.evText('json-run-2-sha256', `${h2}\n`);
    c.eq('机检：连续两次 JSON 输出经 sha256 逐字节相同', h2, h1);
    const payload = jsonOf(j1);
    c.evJson('payload', payload);
    const errors = payload?.errors ?? [];

    const txt = c.cmd(workflowValidate(root), 'orch workflow validate（文本）');
    const rows = nonEmptyLines(clean(text(txt)));
    c.evText('validate-text', text(txt));

    // --- Then：首行与两行逐字（文件名字典序 + 同文件内 C-09 顺序固定）---
    c.eq('Then 退出码 1', txt.exitCode, 1);
    c.lineEq('Then 首行逐字', rows[0], '校验工作流 5 个：2 个不合法');
    c.eq('Then 随后两行（共三行输出）', rows.length, 3);
    c.lineEq('Then 第一条逐字（bad-type 在前）', rows[1],
      '- workflows/bad-type.yaml：节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）');
    c.lineEq('Then 第二条逐字（wake.yaml，A-15 明细模板）', rows[2],
      '- workflows/wake.yaml：唤醒不在白名单内：researcher → editor（WORKFLOW_WAKE_DENIED）');

    // --- 机检 ---
    c.deepEq('机检：errors.map(file + \':\' + code) 逐字等于两元素数组', errors.map((e) => `${e.file}:${e.code}`), EXPECTED_MAP);
    c.eq('机检：errors[0].code === WORKFLOW_NODE_TYPE_INVALID', errors[0]?.code, 'WORKFLOW_NODE_TYPE_INVALID');
    c.eq('机检：counts.assets === 5（内置 3 + 项目 2）', payload?.counts?.assets, 5);
    c.eq('机检：counts.invalid === 2', payload?.counts?.invalid, 2);

    return finish(c);
  }
}];
