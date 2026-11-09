// AC-04 从内置派生：继承、覆盖与「派生自」（用户可见 + 机检 + 机操）
// 裁-11 相关：本条不涉用法块；机检含 test/wp11/cli-role.test.js 全绿（timeoutMs 已放宽）。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, roleCreate, roleShow, roleList, jsonOf, nodeTest,
  text, nonEmptyLines, clean, requirementTitle, finish, REPO
} from '../acc6-f-common.mjs';

const AC = 'AC-04';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  timeoutMs: 180000, // 机检里要跑 test/wp11/cli-role.test.js 全量，90s 不够
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（无 .orch）', root);

    // When：不写 --name / --group / --artifact-type / --side-effect
    const res = c.cmd(roleCreate(root, 'lead-dev', ['--from', 'developer', '--skills', 'test-run']),
      'orch role create lead-dev --from developer --skills test-run');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('create', text(res));

    // Then：成功、退出码 0（不因缺四个必填退 2，BR-38）
    c.eq('Then 退出码 0（缺四个必填不退 2）', res.exitCode, 0);
    c.eq('Then 输出恰好三行', rows.length, 3);
    c.lineEq('Then 第 1 行逐字', rows[0], '已创建项目角色：.orch/roles/lead-dev.yaml');
    c.lineEq('Then 契约行（中文名默认 开发（派生））', rows[1], '- lead-dev 开发（派生） · 编码工程 · code · write · 技能 1 · 并发 1');
    c.lineEq('Then 第 3 行逐字', rows[2], '校验：通过');

    // 机检：文件里写下 derived_from: developer；继承字段全对
    const file = path.join(root, '.orch', 'roles', 'lead-dev.yaml');
    const content = fs.readFileSync(file, 'utf8');
    c.evText('lead-dev.yaml', content);
    c.includes('机检：文件含 derived_from: developer', content, 'derived_from: developer');
    for (const needle of ['skills: [test-run]', 'tools: [read, write, edit, bash]', 'wake_allow: [tester]',
      'artifact_type: code', 'group: coding', 'max_concurrent_sessions: 1']) {
      c.includes(`机检：文件含 ${needle}（继承/覆盖）`, content, needle);
    }

    // Then：role show 在来源行之后多一行 派生自：developer
    const show = c.cmd(roleShow(root, 'lead-dev'), 'orch role show lead-dev');
    const showRows = nonEmptyLines(clean(text(show)));
    c.evText('show', text(show));
    c.eq('Then role show 退出码 0', show.exitCode, 0);
    c.lineEq('Then role show 来源行', showRows[5], '  来源：项目 .orch/roles/lead-dev.yaml');
    c.lineEq('Then role show 第 7 行 = 派生自：developer', showRows[6], '  派生自：developer');

    // 机检：--format json 的 role 对象仍是 10 个键（派生信息不进 JSON）
    const showJson = c.cmd(roleShow(root, 'lead-dev', ['--format', 'json']), 'orch role show lead-dev --format json');
    const payload = jsonOf(showJson);
    c.evJson('show-payload', payload);
    c.eq('机检：role 对象仍是 10 个键', Object.keys(payload?.role ?? {}).length, 10);
    c.eq('机检：role 对象不含派生信息键', ['derivedFrom', 'derived_from', 'wake'].filter((k) => k in (payload?.role ?? {})).length, 0);

    // 机操：role list --format json 的字段
    const listJson = c.cmd(roleList(root, ['--format', 'json']), 'orch role list --format json');
    const lp = jsonOf(listJson);
    c.evJson('list-payload', lp);
    const lead = (lp?.roles ?? []).find((r) => r.id === 'lead-dev');
    c.eq('机操：maxConcurrentSessions === 1', lead?.maxConcurrentSessions, 1);
    c.eq('机操：artifactType === code', lead?.artifactType, 'code');
    c.deepEq('机操：skills === [test-run]', lead?.skills, ['test-run']);

    // 机检：test/wp11/cli-role.test.js 全绿（内置角色的 6 行基线不变）
    const t = c.cmd(nodeTest(['test/wp11/cli-role.test.js'], { timeout: 150000 }), 'node --test test/wp11/cli-role.test.js');
    const tail = clean(text(t)).split('\n').filter(Boolean).slice(-8).join('\n');
    c.evText('wp11-test', tail);
    c.matches('机检：test/wp11/cli-role.test.js 全绿（# fail 0）', tail, /# fail 0\b/);
    c.matches('机检：wp11 有通过用例（# pass N>0）', tail, /# pass [1-9]\d*/);

    return finish(c);
  }
}];
