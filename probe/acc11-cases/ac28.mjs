// AC-28 占用随运行时变化且与流程图同源：机检 occupancy.test.js（AC-28 真实派发 + 同源）
// + ui-views.test.js（A-6 逐字行）；架构检查 3 条（复用既有 buildRoleInstances 投影，禁第二套派生）。
// D-40 夹具：手写 state.json + test.dispatch 真实派发，禁 graph/pulse；D-48 hosts；同源用 buildRoleInstances（D-28）。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-28';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '占用 / 实时 / 同源 / 机检',
  async run() {
    const c = makeCase(AC, { face: '占用 / 实时 / 同源 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['occupancy.test.js', 'ui-views.test.js'],
      arch: [
        { cmd: 'grep -REl "buildRoleInstances" src/daemon/', expect: 0, contains: 'src/daemon/graph.js',
          note: 'AC-28 架构①：既有导出来源是 buildRoleInstances（基线 1 文件 graph.js；按架构②实现后 occupancy.js 引入同一投影，实测 2 文件，未派生第二套）' },
        { cmd: 'grep -REn "buildRoleInstances|role-instances" src/daemon/occupancy.js', expect: 0,
          note: 'AC-28 架构②：占用投影必须引入同一份既有投影（≥1 命中，exit 0）' },
        { cmd: 'grep -REn "function .*[Rr]oleInstances" src/daemon/occupancy.js src/daemon/canvas.js', expect: 1,
          note: 'AC-28 架构③：占用层与画布层不得自带第二套派生（零命中，exit 1）' }
      ],
      tmpdir: tmp
    });
    const o = c.testRuns.find((t) => t.file === 'occupancy.test.js');
    const u = c.testRuns.find((t) => t.file === 'ui-views.test.js');
    c.check('两处导出状态词在同一时点相等；servingNodes 含 T-001、activeSessions 增量为 1',
      Boolean(o?.subtests?.some((x) => /占用随真实派发更新且与流程图同源/.test(x)) && o?.v?.ok),
      (o?.subtests ?? []).filter((x) => /AC-28/.test(x)).join(' | ') || '（未找到）',
      '2 秒内占用视图该行变「服务中」、活跃会话 +1；流程图「开发」也是「服务中」');
    c.check('两次变化各自 t_update - t_change ≤ 2000；第二阶段两处均为「冷却中」、状态词仍相同',
      Boolean(o?.v?.ok),
      `# pass ${o?.tap?.pass ?? 0} / # fail ${o?.tap?.fail ?? 0}`,
      'T-001 完成后两处同时由「服务中」变「冷却中」，状态词相同');
    c.check('D-40 夹具：手写 state.json + test.dispatch 真实派发（methods[test.dispatch] → dispatchInState 写盘），未用 graph/pulse',
      Boolean(o?.v?.ok),
      `# pass ${o?.tap?.pass ?? 0} / # fail ${o?.tap?.fail ?? 0}`,
      '不许用 POST /__test__/graph/pulse 造占用数据');
    c.check('同源断言：占用与流程图共用 buildRoleInstances 投影；宿主 mock（D-48）',
      Boolean(o?.v?.ok && c.arch.every((a) => a.ok)),
      c.arch.map((a) => `#${a.index}:exit ${a.exit}`).join(' / '),
      '两处不各算一套；graph.js 与 occupancy.js 同引 src/registry/role-instances.js');
    c.check('A-6 占用行逐字（含 hosts 段）由 ui-views.test.js 承载',
      Boolean(u?.subtests?.some((x) => /A-6 \/ AC-26 AC-28/.test(x)) && u?.v?.ok),
      (u?.subtests ?? []).filter((x) => /A-6/.test(x)).join(' | ') || '（未找到）',
      '「角色 开发 · 服务中 · 参与 2 个实例 · 3 个活跃会话 · 服务 T-001, T-004 · 宿主 mock」逐字');
    thenChecks(c);
    c.note('D-40 夹具红线：占用投影读实例 state.json，graph/pulse 只写 overlay 不写 state（读不到）；本用例手写 state.json（先起核再写盘）+ test.dispatch 真实派发，全程禁 pulse。D-28 口径：同源 = 两处同引 buildRoleInstances，禁第二套派生；架构①实测 2 文件（graph.js + occupancy.js）符合架构②「占用引入同一投影」要求，基线 1 文件是实现前状态，非回归。');
    c.note('BR-37 2 秒时效：t_update - t_change ≤ 2000 由行为断言承载；CJK 中文只在 labels.js（BR-26）。');
    return finish(c);
  }
}];
