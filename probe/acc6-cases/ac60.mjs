// AC-60 工作流校验器补充面：变量引用 / 状态转换 / 唤醒权限（异常路径 + 机检）
// Given：task-var（map from: task.brief，任务输入恒合法）/ backflow-target（backflow 指向 human 节点，
// 非法目标）/ wake-empty（源角色 wake_allow: []，forward 边指向 role 节点，节点上不补白名单）/
// retest-ok（retest 指向 role 节点，合法）。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, workflowValidate, writeRole, writeWorkflow, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-60';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);

    // --- Given：四条工作流（id 与文件名一致）+ wake-empty/retest-ok 的源角色 ---
    writeRole(root, 'r-src', { id: 'r-src', name: '空白名单源', wakeAllow: [] });

    writeWorkflow(root, 'task-var', [
      'schema: workflow/v1',
      'id: task-var',
      'name: 任务变量',
      'entry: T-001',
      'terminal: T-002',
      'nodes:',
      '  - id: T-001',
      '    node_type: role',
      '    role: researcher',
      '    title: 研究',
      '    outputs: [research.notes]',
      '  - id: T-002',
      '    node_type: role',
      '    role: writer',
      '    title: 撰写',
      '    inputs: [brief]',
      'edges:',
      '  - from: T-001',
      '    to: T-002',
      '    map:',
      '      - from: task.brief',
      '        to: brief',
      ''
    ].join('\n'));

    writeWorkflow(root, 'backflow-target', [
      'schema: workflow/v1',
      'id: backflow-target',
      'name: 回流指人',
      'entry: T-001',
      'terminal: T-002',
      'nodes:',
      '  - id: T-001',
      '    node_type: role',
      '    role: researcher',
      '    title: 研究',
      '  - id: T-002',
      '    node_type: role',
      '    role: writer',
      '    title: 撰写',
      '  - id: T-H',
      '    node_type: human',
      '    title: 人工确认',
      '    max_rounds: 2',
      'edges:',
      '  - from: T-001',
      '    to: T-002',
      '  - from: T-002',
      '    to: T-H',
      '    kind: backflow',
      ''
    ].join('\n'));

    writeWorkflow(root, 'wake-empty', [
      'schema: workflow/v1',
      'id: wake-empty',
      'name: 空白名单',
      'entry: T-001',
      'terminal: T-002',
      'nodes:',
      '  - id: T-001',
      '    node_type: role',
      '    role: r-src',
      '    title: 源',
      '  - id: T-002',
      '    node_type: role',
      '    role: developer',
      '    title: 目标',
      'edges:',
      '  - from: T-001',
      '    to: T-002',
      ''
    ].join('\n'));

    writeWorkflow(root, 'retest-ok', [
      'schema: workflow/v1',
      'id: retest-ok',
      'name: 复测合法',
      'entry: T-001',
      'terminal: T-002',
      'nodes:',
      '  - id: T-001',
      '    node_type: role',
      '    role: r-src',
      '    title: 源',
      '  - id: T-002',
      '    node_type: role',
      '    role: developer',
      '    title: 目标',
      'edges:',
      '  - from: T-001',
      '    to: T-002',
      '    kind: retest',
      ''
    ].join('\n'));
    c.noteFixture('预置四条工作流 task-var / backflow-target / wake-empty / retest-ok + 源角色 r-src（wake_allow: []）；wake-empty 与 retest-ok 节点上都不补 wake_allow：forward 边才受白名单约束（retest 由核心回流触发、不受白名单约束），因此 retest-ok 只留一条 retest 边', '');

    // --- When：逐条 validate（文本 + json）---
    const runs = [
      { id: 'task-var', expectOk: true, label: '第一次' },
      { id: 'backflow-target', expectOk: false, label: '第二次' },
      { id: 'wake-empty', expectOk: false, label: '第三次' },
      { id: 'retest-ok', expectOk: true, label: '第四次' }
    ];
    const payloads = {};
    for (const item of runs) {
      const res = c.cmd(workflowValidate(root, [item.id]), `orch workflow validate ${item.id}`);
      const rows = nonEmptyLines(clean(text(res)));
      c.evText(`validate-${item.id}`, text(res));
      const jsonRes = c.cmd(workflowValidate(root, [item.id, '--format', 'json']), `orch workflow validate ${item.id} --format json`);
      payloads[item.id] = jsonOf(jsonRes);
      c.evJson(`payload-${item.id}`, payloads[item.id]);

      if (item.expectOk) {
        c.eq(`Then ${item.label}（${item.id}）退出码 0`, res.exitCode, 0);
        c.lineEq(`Then ${item.label}（${item.id}）首行逐字`, rows[0], '校验工作流 1 个：全部通过');
        c.eq(`机检：${item.id} counts.invalid === 0`, payloads[item.id]?.counts?.invalid, 0);
      } else {
        c.eq(`Then ${item.label}（${item.id}）退出码 1`, res.exitCode, 1);
        c.eq(`机检：${item.id} counts.invalid === 1`, payloads[item.id]?.counts?.invalid, 1);
        c.eq(`机检：${item.id} errors[0].code`, payloads[item.id]?.errors?.[0]?.code,
          item.id === 'backflow-target' ? 'WORKFLOW_TRANSITION_ILLEGAL' : 'WORKFLOW_WAKE_DENIED');
      }
    }

    // --- Then：明细句式（需求原文钉死的关键词）---
    const btText = clean(text(c.cmd(workflowValidate(root, ['backflow-target']), 'orch workflow validate backflow-target（复跑取文本）')));
    c.eq('Then 第二次明细为 {node} 不能成为回流目标（含 回流目标）', btText.includes('不能成为回流目标'), true);
    const btErr = payloads['backflow-target']?.errors?.[0] ?? {};
    c.includes('机检：backflow-target errors[0].detail 含 回流目标', btErr.detail ?? '', '回流目标');

    const weText = clean(text(c.cmd(workflowValidate(root, ['wake-empty']), 'orch workflow validate wake-empty（复跑取文本）')));
    c.eq('Then 第三次报 WORKFLOW_WAKE_DENIED（wake_allow: [] = 不允许主动唤醒任何角色）',
      weText.includes('（WORKFLOW_WAKE_DENIED）'), true);
    const weErr = payloads['wake-empty']?.errors?.[0] ?? {};
    c.includes('机检：wake-empty errors[0].detail 含 白名单', weErr.detail ?? '', '白名单');
    c.eq('机检：wake-empty 明细为 唤醒不在白名单内：r-src → developer', weErr.detail, '唤醒不在白名单内：r-src → developer');

    // --- 机检补充：retest 的白名单豁免（源角色白名单为空仍全通过）---
    c.deepEq('机检：retest-ok 的 errors 为空', payloads['retest-ok']?.errors ?? [], []);

    return finish(c);
  }
}];
