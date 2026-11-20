/**
 * AC-51 · 角色配置可见，非法值被拒（BR-41 / A-5 / A-10）。
 *
 * Given：项目角色文件分别写 session_policy: reuse / always。
 * When：orch role show <角色>、orch role validate、orch role edit --set/--unset session_policy。
 * Then：合法角色多一行「  会话复用：复用（reuse）」（在「可唤醒」后、「来源」前）；
 *   非法角色报 ROLE_SESSION_POLICY_INVALID，退出码 1；默认 developer 无该行。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import { REPO, freshRoot, cleanupRoot, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import { ROLE_SESSION_POLICY_INVALID } from '../../src/cli/labels.js';
import { SESSION_POLICIES } from '../../src/registry/role-schema.js';

const REUSE_LINE = '  会话复用：复用（reuse）';

export async function run() {
  const c = makeCase('AC-51', {
    scenario: 'role-session-policy-visible-and-rejected',
    title: '角色配置可见，非法值被拒',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-51');
  c.root = root;
  try {
    const builtin = fs.readFileSync(path.join(REPO, 'assets', 'roles', 'developer.yaml'), 'utf8');
    const showDefault = orch(root, ['role', 'show', 'developer']);
    evidence(c, 'given', 'role-show-default.txt', showDefault.stdout);
    excludes(c, 'Then：默认 developer 不出现会话复用行', showDefault.stdout, '会话复用');

    const dir = path.join(root, '.orch', 'roles');
    fs.mkdirSync(dir, { recursive: true });
    const good = path.join(dir, 'developer.yaml');
    fs.writeFileSync(good, `${builtin.trimEnd()}\nsession_policy: reuse\n`, 'utf8');
    const bad = path.join(dir, 'dev-bad.yaml');
    fs.writeFileSync(bad, `${builtin.trimEnd()}\nsession_policy: always\n`
      .replace('id: developer', 'id: dev-bad')
      .replace('name: 开发', 'name: 坏策略角色'), 'utf8');
    evidence(c, 'given', 'developer.yaml', fs.readFileSync(good, 'utf8'));
    evidence(c, 'given', 'dev-bad.yaml', fs.readFileSync(bad, 'utf8'));

    const showReuse = orch(root, ['role', 'show', 'developer']);
    const validate = orch(root, ['role', 'validate', '--format', 'json']);
    // 用合法的项目角色 developer 做 edit：dev-bad 因策略非法未进 roleMap，edit 会先报「找不到角色」，
    // 取不到 A-10 的原因码；合法角色上写入非法值才是 A-10 的判定面。
    const editReject = orch(root, ['role', 'edit', 'developer', '--set', 'session_policy=always']);
    evidence(c, 'then', 'role-show-reuse.txt', showReuse.stdout);
    evidence(c, 'then', 'role-validate.json', validate.stdout);
    evidence(c, 'then', 'role-edit-reject.txt', editReject.stdout + editReject.stderr);

    const lines = showReuse.stdout.trimEnd().split(/\r?\n/);
    const policyIdx = lines.findIndex((line) => line === REUSE_LINE);
    const wakeIdx = lines.findIndex((line) => line.includes('可唤醒'));
    const sourceIdx = lines.findIndex((line) => line.includes('来源'));
    eq(c, 'Then：合法角色多一行逐字「  会话复用：复用（reuse）」', lines[policyIdx], REUSE_LINE);
    check(c, '机检：复用行位置在「可唤醒」之后、「来源」之前',
      wakeIdx >= 0 && policyIdx === wakeIdx + 1 && sourceIdx === policyIdx + 1,
      JSON.stringify({ wakeIdx, policyIdx, sourceIdx }));
    eq(c, 'Then：只有一行会话复用配置', lines.filter((line) => line.includes('会话复用')).length, 1);

    let payload = null;
    try { payload = JSON.parse(validate.stdout); } catch { /* 证据已落 */ }
    const codes = (payload?.errors ?? []).map((e) => e.code);
    check(c, "机检：role validate --format json 的 errors 含 ROLE_SESSION_POLICY_INVALID",
      codes.includes('ROLE_SESSION_POLICY_INVALID'), JSON.stringify(codes));
    check(c, '机检：错误项带原值 always',
      JSON.stringify(payload?.errors ?? []).includes('always'), JSON.stringify(payload?.errors ?? []));
    eq(c, 'Then：非法角色校验退出码 1', validate.exitCode, 1);
    eq(c, '夹具：SESSION_POLICIES 只含 reuse / fresh', JSON.stringify(SESSION_POLICIES), JSON.stringify(['reuse', 'fresh']));
    eq(c, '夹具：A-10 文案来自 labels.js 唯一来源', ROLE_SESSION_POLICY_INVALID, '会话复用策略不合法：{value}（可选 reuse / fresh）');

    eq(c, 'Then：role edit --set session_policy=always 退出码 1', editReject.exitCode, 1);
    includes(c, "Then：role edit 报 ROLE_SESSION_POLICY_INVALID（含原值）", editReject.stdout,
      '会话复用策略不合法：always（可选 reuse / fresh）');
    includes(c, 'Then：role edit 输出原因码', editReject.stdout, 'ROLE_SESSION_POLICY_INVALID');
    includes(c, '夹具：编辑被拒后 developer.yaml 未写入非法值（原值 reuse 保留）',
      fs.readFileSync(good, 'utf8'), 'session_policy: reuse');

    const unset = orch(root, ['role', 'edit', 'developer', '--unset', 'session_policy']);
    const showAfterUnset = orch(root, ['role', 'show', 'developer']);
    evidence(c, 'then', 'role-edit-unset.txt', unset.stdout + unset.stderr);
    evidence(c, 'then', 'role-show-after-unset.txt', showAfterUnset.stdout);
    eq(c, '夹具：role edit --unset session_policy 退出码 0', unset.exitCode, 0);
    excludes(c, 'Then：unset 后 role show 不再显示复用行', showAfterUnset.stdout, '会话复用');
    excludes(c, '夹具：unset 后文件不再写 session_policy', fs.readFileSync(good, 'utf8'), 'session_policy');

    note(c, 'A-5 冻结文案：复用行由 render.js 固定在「可唤醒」与「来源」之间；'
      + '默认（未声明策略）保持 I1.6 六行输出。');
    note(c, 'A-10 原因码由 role-schema.checkRoleShape 产出，中文明细由 labels.js 的'
      + ' ROLE_SESSION_POLICY_INVALID 模板填充，CLI 不另造文案。');
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
