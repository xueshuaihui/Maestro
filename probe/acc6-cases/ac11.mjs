// AC-11 角色校验器的五项各有专属原因码（机检 + 用户可见）
// 裁-16a：Given 原文单字符 id 与 C-01 互斥（R-12），按 WP-6 先例改用 2 字符 id（m1/s1/c1/p1/d1）。


import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, roleValidate, writeRole, writeWorkflow, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-11';
const EXPECTED_CODES = ['ROLE_SCHEMA_MISSING', 'ROLE_SKILL_NOT_FOUND', 'ROLE_CONTRACT_UNBOUND',
  'ROLE_PERMISSION_MISMATCH', 'ROLE_DERIVE_CYCLE'];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：五份坏角色（其余字段合法、按 C-07 键序）
    writeRole(root, 'm1', { id: 'm1', name: '缺并发', omit: ['max_concurrent_sessions'] });
    writeRole(root, 's1', { id: 's1', name: '坏技能', skills: ['no-such'] });
    writeRole(root, 'c1', { id: 'c1', name: '缺输入来源', inputs: ['brief'], outputs: [] });
    writeRole(root, 'p1', { id: 'p1', name: '权限错', sideEffect: 'read', tools: ['write'] });
    writeRole(root, 'd1', { id: 'd1', name: '自环', derivedFrom: 'd1' });
    // 一条引用它们的工作流：T-001（c，入口）→ T-002（reviewer），terminal: T-002
    writeWorkflow(root, 'use-c1', [
      'schema: workflow/v1',
      'id: use-c1',
      'name: 用 c',
      'entry: T-001',
      'terminal: T-002',
      'nodes:',
      '  - id: T-001',
      '    node_type: role',
      '    role: c1',
      '    wake_allow: [reviewer]',
      '    title: 入口',
      '  - id: T-002',
      '    node_type: role',
      '    role: reviewer',
      '    title: 终点',
      'edges:',
      '  - from: T-001',
      '    to: T-002',
      ''
    ].join('\n'));
    c.noteFixture('预置五份坏角色 m1/s1/c1/p1/d1 + 工作流 use-c1.yaml（c1 只作入口，没有任何边给它 brief）', '');

    // When：role validate --format json
    const res = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(res);
    c.evJson('payload', payload);
    const textRes = c.cmd(roleValidate(root), 'orch role validate');
    c.evText('validate-text', text(textRes));
    const codes = (payload?.errors ?? []).map((e) => e.code);

    // Then：五条错误，原因码恰好五个专属码；退出码 1
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.eq('Then 恰好五条错误', (payload?.errors ?? []).length, 5);
    c.deepEq('机检：errors.map(code) 排序后与五个专属码逐字相同', [...codes].sort(), [...EXPECTED_CODES].sort());

    // 机检：counts 四项 + errors[] 每条 6 键
    c.eq('机检：counts.assets === 31（16 角色 + 10 技能 + 5 个坏文件）', payload?.counts?.assets, 31);
    c.eq('机检：counts.roles === 16', payload?.counts?.roles, 16);
    c.eq('机检：counts.skills === 10', payload?.counts?.skills, 10);
    c.eq('机检：counts.invalid === 5', payload?.counts?.invalid, 5);
    const keySets = (payload?.errors ?? []).map((e) => Object.keys(e).sort().join(','));
    c.eq('机检：每条 errors[] 仍只有 6 个键', [...new Set(keySets)].join('|'), 'code,detail,field,file,line,scope');

    c.note('裁-16a/R-12：Given 单字符 id 与 C-01 互斥，本用例按 2 字符 id（m1/s1/c1/p1/d1）取证，Then 语义不变。');

    return finish(c);
  }
}];
