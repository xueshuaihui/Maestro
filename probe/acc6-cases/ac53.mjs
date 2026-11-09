// AC-53 能力域 1 三项顺延落地：一次 role validate 全数报出且同文件多类各一行（异常路径 + 机检）
// Given：三份坏角色 c.yaml（inputs: [brief]，被 use-c.yaml 入口引用但无边给 brief）/
//        p.yaml（read + write 工具 + wake_allow: [ghost]）/ d.yaml（derived_from: d，自环），
//        均不缺必填键；一条工作流 use-c.yaml（id 与文件名一致）。
import {
  makeCase, freshRoot, roleValidate, writeRole, writeWorkflow, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-53';
const EXPECTED_CODES = ['ROLE_CONTRACT_UNBOUND', 'ROLE_PERMISSION_MISMATCH', 'ROLE_WAKE_UNKNOWN', 'ROLE_DERIVE_CYCLE'];

// Then 的四行逐字（明细照抄需求原文；文件名按裁-16a/R-12 用 2 字符 id）。
// 报出顺序 = 文件名字典序 + 同文件内 C-08 顺序（⑧权限 ⑨唤醒 ⑩派生 ⑪契约）；
// Then 原文的行序为枚举序，实际顺序由 C-08 固定（AC-53 Then 原文末句授权）。
const EXPECTED_ROWS = [
  '- roles/c1.yaml：契约不连通：brief 没有来源（ROLE_CONTRACT_UNBOUND）',
  '- roles/d1.yaml：派生链成环：d1（ROLE_DERIVE_CYCLE）',
  '- roles/p1.yaml：副作用等级为 read 的角色不能带写工具 write（ROLE_PERMISSION_MISMATCH）',
  '- roles/p1.yaml：唤醒白名单里的角色不存在：ghost（ROLE_WAKE_UNKNOWN）'
];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);

    // --- Given：三份坏角色（字段齐全、按 C-07 键序）+ 引用 c 的工作流 ---
    writeRole(root, 'c1', { id: 'c1', name: '契约断', inputs: ['brief'], outputs: [] });
    writeRole(root, 'p1', { id: 'p1', name: '权限与唤醒坏', sideEffect: 'read', tools: ['write'], wakeAllow: ['ghost'] });
    writeRole(root, 'd1', { id: 'd1', name: '派生自环', derivedFrom: 'd1' });
    writeWorkflow(root, 'use-c', [
      'schema: workflow/v1',
      'id: use-c',
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
    c.noteFixture('预置三份坏角色 c1/p1/d1 + 工作流 use-c.yaml（入口 T-001 引用 c1，没有任何边给它 brief）', '');
    c.note('裁-16a/R-12（AC-11 先例）：Given 的单字符 id 与 C-01 互斥，本用例按 2 字符 id（c1/p1/d1）取证，Then 的明细语义逐字不变。');
    c.note('use-c 的 T-001 写节点级 wake_allow: [reviewer]（AC-11/AC-37 先例）：否则该工作流被 WAKE_DENIED 剔出 workflowMap，契约连通检查看不到 c1 的引用、ROLE_CONTRACT_UNBOUND 造不出来。');

    // --- When：orch role validate，再 --format json ---
    const res = c.cmd(roleValidate(root), 'orch role validate');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('validate-text', text(res));
    const resJson = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(resJson);
    c.evJson('payload', payload);

    // --- Then：首行口径与 I1.5 一致；四行逐字；退出 1 ---
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.lineEq('Then 首行（计数口径与 I1.5 一致：16 角色 + 10 技能 + 3 坏文件）', rows[0], '校验资产 29 个：3 个不合法');
    c.deepEq('Then 错误行恰好四条且逐字（同文件 p.yaml 多类各一行、顺序由 C-08 固定）', rows.slice(1, 5), EXPECTED_ROWS);
    c.eq('Then 输出恰为首行 + 四条错误行', rows.length, 5);

    // --- 机检 ---
    const codes = (payload?.errors ?? []).map((e) => e.code);
    c.deepEq('机检：errors.map(code) 排序后与四个原因码逐字相同', [...codes].sort(), [...EXPECTED_CODES].sort());
    c.eq('机检：errors.filter(file === roles/p1.yaml).length === 2（同文件两类各一行、互不吞并）',
      (payload?.errors ?? []).filter((e) => e.file === 'roles/p1.yaml').length, 2);
    c.eq('机检：counts.invalid === 3', payload?.counts?.invalid, 3);
    c.eq('机检：counts.assets === 29', payload?.counts?.assets, 29);

    return finish(c);
  }
}];
