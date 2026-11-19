// AC-14 处理后续跑与计数同步：机检 e2e.test.js（AC-38 真链路）+ queue.test.js（AC-10 重派回运行）
// + ui-views.test.js（A-4 结果行）；D-39/D-36 口径，三处数字同源按投影字段不重算。
// 需求机检原文点名 queue-follow.test.js，本分支不存在，逐字断言合并进 e2e.test.js AC-38
// （重派→队列计数 0→实例回运行→列表待处理 0→托盘「实例 1 · 待处理升级 0」）+ queue.test.js AC-10；
// 按实际存在文件机检并登记说明，不放宽断言（含 t_resume - t_action ≤ 5000 时效由 AC-38 真链路承载）。
import { makeCase, req, machineChecks, thenChecks, finish, ensureDir } from '../acc11-f-common.mjs';
const AC = 'AC-14';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '处置 / 续跑 / 机检',
  async run() {
    const c = makeCase(AC, { face: '处置 / 续跑 / 机检', grade: 'mock 实测' });
    // e2e.test.js 走真实 server.listen() 绑定 <root>/.orch/core.sock（macOS sun_path 上限 104 字节）；
    // 本机 os.tmpdir() 为长 /var/folders/... 路径，经 caseTmp 叠加后 119 字节触发截断 + EADDRINUSE（假阴性）。
    // 本用例机检改用短 TMPDIR（/tmp/m11b-<AC>），断言不变。
    const tmp = ensureDir(`/tmp/m11b-${AC}`);
    machineChecks(c, {
      files: ['e2e.test.js', 'queue.test.js', 'ui-views.test.js'],
      arch: [
        { cmd: 'grep -REn "workflow.resume" src/daemon/queue.js', expect: 1, note: 'AC-14 架构：续跑只由既有裁决路径触发，队列层不再调一次恢复，零命中（exit 1）' }
      ],
      tmpdir: tmp
    });
    const e2e = c.testRuns.find((t) => t.file === 'e2e.test.js');
    const q = c.testRuns.find((t) => t.file === 'queue.test.js');
    const u = c.testRuns.find((t) => t.file === 'ui-views.test.js');

    // 真链路 AC-38：升级事件 → 重派 → 条目消失 + 回运行 + 三处数字同步（承载 D-39 后续跑收尾条件）。
    c.check('续跑真链路存在：AC-38 通知→队列处置→后续跑+三处数字同步',
      Boolean(e2e?.subtests?.some((x) => /AC-38.*后续跑.*三处数字同步/.test(x))),
      (e2e?.subtests ?? []).filter((x) => /AC-38/.test(x)).join(' | ') || '（未找到）',
      '含 AC-38 真链路用例');
    c.check('重派后实例自动继续推进（disk.state=running / resolution=retry / 无需点恢复）',
      Boolean(e2e?.v?.ok),
      `# pass ${e2e?.tap?.pass ?? 0} / # fail ${e2e?.tap?.fail ?? 0}`,
      'disk.state === running；resolution === retry；无额外恢复动作');
    c.check('三处数字同源：处置后队列计数 0 / 列表待处理 0 / 托盘「实例 1 · 待处理升级 0」',
      Boolean(e2e?.v?.ok),
      `# pass ${e2e?.tap?.pass ?? 0} / # fail ${e2e?.tap?.fail ?? 0}`,
      '队列 pendingEscalations=0；item.pending.escalations=0；托盘「实例 1 · 待处理升级 0」');
    // D-39 两现场的「重派回运行」数据侧：AC-10 retry 用例（轮次 +1、绑定新会话、实例回运行、队列消失）。
    c.check('D-39 重派数据侧：AC-10 retry 轮次+1 / 新会话 / 回运行中 / 队列条目消失',
      Boolean(q?.subtests?.some((x) => /升级·重派：轮次 \+1/.test(x)) && q?.v?.ok),
      (q?.subtests ?? []).filter((x) => /重派/.test(x)).join(' | ') || '（未找到）',
      'resolution retry / round 2 / sessionId 非空 / state running / items 空');
    // A-4 结果行逐字由 ui-views.test.js A-4/AC-14 用例承载。
    c.check('A-4 结果行逐字由 daemon 结论词（ui-views A-4/AC-14 用例承载）',
      Boolean(u?.subtests?.some((x) => /A-4 \/ AC-14/.test(x)) && u?.v?.ok),
      (u?.subtests ?? []).filter((x) => /AC-14/.test(x)).join(' | ') || '（未找到）',
      '「升级 E-1 已处理（通过）」逐字，复用 RESOLUTION_LABEL');
    // 逐字 Then：期望值照抄需求 Then（续跑≤5s、状态运行中、托盘 0、列表待处理 0、三处相等），绑定机检+架构复核。
    thenChecks(c);
    c.note('机检文件名口径：需求点名 test/wp14/queue-follow.test.js（本分支不存在）；续跑真链路逐字断言合并进 test/wp14/e2e.test.js 的「AC-38：通知 → 队列处置 → 后续跑 + 三处数字同步」，重派数据侧在 test/wp14/queue.test.js 的「升级·重派」用例，A-4 结果行在 ui-views.test.js。按实际存在文件机检并保留原始 TAP，登记说明但不放宽。');
    c.note('D-36 数字口径：三处数字按投影字段读取（tray.pending / item.pending.escalations / queue.totals.pendingEscalations），不在界面重算；本用例逐字登记三处相等，机检由 AC-38 与 AC-13 两用例承载。t_resume - t_action ≤ 5000 时效由 AC-38 真链路（≤5s SSE + 重派后立即回运行）承载，未另设独立秒表断言，如实登记。');
    return finish(c);
  }
}];
