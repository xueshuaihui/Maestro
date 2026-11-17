// AC-26 全局角色占用跨实例聚合：机检 occupancy.test.js（AC-26 五字段+最忙状态序+D-48 hosts）
// + ui-views.test.js（A-6 占用行逐字）；D-40 夹具禁 pulse（手写 state.json + test.dispatch 真实派发）。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-26';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '占用 / 聚合 / 机检',
  async run() {
    const c = makeCase(AC, { face: '占用 / 聚合 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['occupancy.test.js', 'ui-views.test.js'],
      arch: [
        { cmd: 'grep -REn "roles/" src/daemon/occupancy.js', expect: 1, note: 'AC-26 架构：占用由各实例运行时投影聚合，不读注册表充当运行时，零命中（exit 1）' }
      ],
      tmpdir: tmp
    });
    const o = c.testRuns.find((t) => t.file === 'occupancy.test.js');
    const u = c.testRuns.find((t) => t.file === 'ui-views.test.js');
    c.check('AC-26 跨实例聚合用例存在：五字段模板（roleId/name/group/instances/activeSessions/servingNodes/status/hosts）',
      Boolean(o?.subtests?.some((x) => /buildOccupancy.*AC-26/.test(x)) && o?.v?.ok),
      (o?.subtests ?? []).filter((x) => /AC-26/.test(x)).join(' | ') || '（未找到）',
      '八字段键序逐字（D-48）；未绑定节点不缩字段');
    c.check('开发行：参与 2 实例 / 3 活跃会话（2+1）/ 服务 T-001,T-004 未折叠（≤2 逐个列出）/ 服务中 / 宿主 mock',
      Boolean(o?.v?.ok),
      `# pass ${o?.tap?.pass ?? 0} / # fail ${o?.tap?.fail ?? 0}`,
      'dev.instances===2 / activeSessions===3 / servingNodes=[T-001,T-004] / hosts=[mock]');
    c.check('审核者行：服务节点 3 个数组保留、文案折叠「服务 T-002 等 3 个」（阈值 2）/ 1 会话 / 服务中（D-48 hosts）',
      Boolean(o?.v?.ok),
      `# pass ${o?.tap?.pass ?? 0} / # fail ${o?.tap?.fail ?? 0}`,
      'rev.servingNodes.length===3 / 首个 T-002 / 折叠文案由 ui-views 渲染 / hosts=[mock]');
    c.check('测试行：参与 1 实例 / 0 会话 / 冷却中；排序服务中在前（开发<审核者）其次冷却中（A-6）',
      Boolean(o?.v?.ok),
      `# pass ${o?.tap?.pass ?? 0} / # fail ${o?.tap?.fail ?? 0}`,
      'tst.activeSessions=0 / status 冷却中；索引 developer<reviewer<tester');
    c.check('A-6 占用行逐字（含 hosts 段）由 ui-views.test.js 承载：「宿主 mock」/ 未参与行「宿主 —」',
      Boolean(u?.subtests?.some((x) => /A-6 \/ AC-26 AC-28/.test(x)) && u?.v?.ok),
      (u?.subtests ?? []).filter((x) => /A-6 \/ AC-26/.test(x)).join(' | ') || '（未找到）',
      '「角色 开发 · 服务中 · 参与 2 个实例 · 3 个活跃会话 · 服务 T-001, T-004 · 宿主 mock」逐字');
    c.check('同源断言：同一份 state.json 喂给 buildRoleInstances / buildGraph，运行时角色集合一致（D-40 禁 pulse）',
      Boolean(o?.v?.ok),
      `# pass ${o?.tap?.pass ?? 0} / # fail ${o?.tap?.fail ?? 0}`,
      "occupancyRuntimeRoleIds === runtimeRoleIds（含节点绑定的 reviewer）；夹具 nodes[].roleId=developer/reviewer/tester、sessions[].hostId=mock、template=code-loop");
    thenChecks(c);
    c.note('D-48 口径：行含 hosts 字段并逐字渲染宿主段；宿主并集取参与实例会话宿主（A-0 夹具一律 --host mock → 「宿主 mock」，未参与行无运行时 → 「宿主 —」）。折叠阈值 2：≤2 逐个列出、>2「首个 + 等 N 个」；数组始终保留全部节点，折叠是界面职责。');
    c.note('D-40 夹具红线：占用投影读实例 state.json，graph/pulse 只写 overlay 不写 state，全程禁 pulse；用例手写 state.json（先起核再写盘）+ test.dispatch 真实派发。template=code-loop 声明 coordinator 作「未参与」行属预期，本用例只断言开发/审核者/测试三行字段与相对顺序。逐字行由 ui-views.test.js「A-6 / AC-26 AC-28: occupancy row, empty, skipped, hosts are verbatim」承载。');
    return finish(c);
  }
}];
