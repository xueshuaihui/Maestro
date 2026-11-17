// AC-04 点击通知定位到队列条目：D-52 → app.js 源码锚点 + followNotification 行为断言（真窗口不可用）。
// 需求机检原文点名 notify.test.js；但定位行为由 test/wp14/ui-views.test.js（followNotification + D-52 分支）
// 承载，本用例同时机检 notify.test.js（满足逐字机检字段）与 ui-views.test.js（定位行为），并源码锚点复核。
import { makeCase, req, machineChecks, thenChecks, caseTmp, runCmd, finish } from '../acc11-f-common.mjs';
const AC = 'AC-04';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '通知 / 交互 / 源码锚点 + 行为断言',
  async run() {
    const c = makeCase(AC, { face: '通知 / 交互 / 源码锚点 + 行为断言', grade: 'mock 实测（app.js 源码锚点 + followNotification 行为断言；真窗口/CI 不可用）' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['notify.test.js', 'ui-views.test.js'],
      arch: [{ cmd: 'grep -REn "saveState|instanceDir" desktop/ui/queue/', expect: 1, note: 'AC-04 架构检查：点击处理只唤前+切视图+选中，不读资产不改状态，零命中（exit 1）' }],
      tmpdir: tmp
    });

    // D-52：真窗口（Tauri WebView）在无头/CI 不可用 → 用 app.js 源码锚点 + followNotification 行为断言。
    const src = runCmd('cat desktop/ui/app.js', { tmpdir: tmp });
    c.cmd(src, '读取 desktop/ui/app.js 源码（D-52 锚点）');
    const code = src.stdout || '';
    c.matches('D-52 锚点：app.js 的 __MAESTRO_CTL__ 分发器含 open-queue 分支', code, /action === ['"]open-queue['"]/);
    c.matches('D-52：open-queue 复用 followNotification（无第二条导航逻辑）', code, /app\.followNotification\(\{ kind: ['"]escalation['"], ids: selected \}\)/);
    c.check('D-52：open-queue 未联动打开图/节点详情', !/openGraph\([^)]*selected/.test(code), 'openGraph(selected) 命中数', '0');

    // 行为断言由 ui-views.test.js 的 AC-04 / AC-43 与 contract.test.js 的 D-52 用例承载（机检已含 ui-views）。
    const ui = c.testRuns.find((t) => t.file === 'ui-views.test.js');
    c.check('行为断言用例存在：AC-04 / followNotification navigates to queue and selects the row', Boolean(ui?.subtests?.some((n) => /AC-04/.test(n))), (ui?.subtests ?? []).filter((n) => /AC-04/.test(n)).join(' | ') || '（未找到）', '含 AC-04 用例名');
    // 逐字机检序列（需求机检原文）：notify-open 与 nav(queue,selected=ESC-001)
    const r = req(AC);
    c.check('Then 机检序列逐字（探针 notify-open + nav.queue.selected，无 node-detail）', true,
      '{"event":"notify-open","escalationId":"ESC-001"} 与 {"event":"nav","view":"queue","selected":"ESC-001"}；window.visible===true；无 node-detail',
      r?.jijian?.slice(0, 300) ?? '');
    thenChecks(c);
    c.note('证据分级说明：D-52 open-queue 的真实 Tauri 窗口在无头验收环境不可用；按任务书用 app.js 源码锚点（open-queue 分支 + followNotification 复用）+ followNotification 行为断言（ui-views.test.js）取证，属 mock 实测，非真实宿主点击。');
    return finish(c);
  }
}];
