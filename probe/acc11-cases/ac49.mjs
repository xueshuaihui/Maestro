// AC-49 点击通知时条目已被别处处理：机检 ui-views.test.js（A-2/AC-49 已处理提示逐字 +
// AC-04/AC-49 followNotification 停在队列并选中行）+ contract.test.js（D-52 open-queue 分支复用
// followNotification、不打开节点详情）+ notify.test.js（通知意图/投递探针序列）。
// 需求机检点名 notify.test.js（本分支存在但 AC-49 逐字断言落 ui-views/contract），登记说明不放宽。
// 架构检查：提示必须由核心「已处理」状态映射 labels 新键 DESKTOP_QUEUE_ALREADY_RESOLVED，
// 界面不得拼中文（desktop/ui 「无需再次处理」零命中，需求 §3.1 原文）。
// D-13/D-52 口径：新键不带 CLI 的「升级 {id} 」前缀（跨实例 ESC/APR 会重号），结论取中文状态词。
import { makeCase, req, machineChecks, thenChecks, runCmd, finish, ensureDir } from '../acc11-f-common.mjs';
const AC = 'AC-49';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '通知 / 异常 / 机检',
  async run() {
    const c = makeCase(AC, { face: '通知 / 异常 / 机检', grade: 'mock 实测' });
    const tmp = ensureDir(`/tmp/m11d-${AC}`);
    machineChecks(c, {
      files: ['ui-views.test.js', 'contract.test.js', 'notify.test.js'],
      arch: [
        { cmd: 'grep -REn "无需再次处理" desktop/ui/', expect: 1,
          note: 'AC-49 架构：界面零中文硬编码，提示由核心「已处理」状态映射 DESKTOP_QUEUE_ALREADY_RESOLVED（零命中，exit 1）' }
      ],
      tmpdir: tmp
    });
    const u = c.testRuns.find((t) => t.file === 'ui-views.test.js');
    const ct = c.testRuns.find((t) => t.file === 'contract.test.js');
    const n = c.testRuns.find((t) => t.file === 'notify.test.js');
    c.check('点已处置通知：主窗口唤到前台、停在人工干预队列，不跳别的视图、不开节点详情',
      Boolean(u?.subtests?.some((x) => /AC-04 \/ AC-49: followNotification/.test(x)) && u?.v?.ok &&
               ct?.subtests?.some((x) => /AC-43 行为级：open-queue/.test(x)) && ct?.v?.ok),
      (u?.subtests ?? []).filter((x) => /AC-49/.test(x)).join(' | ') || '（未找到）',
      '探针含 notify-open + nav(queue)，窗口 visible===true，无 node-detail 事件；view===queue');
    c.check('该条已不在待处理里，界面提示逐字「已处理（重新分配），无需再次处理」且不产生第二次裁决',
      Boolean(u?.subtests?.some((x) => /A-2 \/ AC-49: already-resolved/.test(x)) && u?.v?.ok && n?.v?.ok),
      `ui-views #pass ${u?.tap?.pass ?? 0} / notify #pass ${n?.tap?.pass ?? 0}`,
      "DESKTOP_QUEUE_ALREADY_RESOLVED 模板『已处理（{conclusion}），无需再次处理』；counters.resolve===1（只终端那次）");
    c.check('队列 2 秒内自动刷新为「待处理 无」并保留「查看实例列表」入口；无需点刷新',
      Boolean(u?.v?.ok && c.arch[0]?.ok),
      `# pass ui-views ${u?.tap?.pass ?? 0} / arch exit ${c.arch[0]?.exit}`,
      "rows.length===0；DESKTOP_QUEUE_EMPTY='待处理 无'；展开/选中不打开节点详情");
    thenChecks(c);
    // 语义复核：提示键来自 labels.js，经 /ui/labels 下发；D-52 open-queue 分发存在。
    const sem = runCmd('grep -rn -e DESKTOP_QUEUE_ALREADY_RESOLVED -e open-queue src/cli/labels.js src/daemon/http/labels.js desktop/ui/app.js', { tmpdir: tmp });
    c.cmd(sem, '语义复核：已处理提示键 + open-queue 分发的真实来源');
    c.check('语义复核：DESKTOP_QUEUE_ALREADY_RESOLVED 落 labels.js 并经 /ui/labels 下发，open-queue 分支复用 followNotification',
      /DESKTOP_QUEUE_ALREADY_RESOLVED/.test(sem.stdout) && /open-queue/.test(sem.stdout),
      sem.stdout.trim().split('\n').slice(0, 6).join(' | '),
      '新键不带 CLI「升级 {id} 」前缀；跨实例 ESC/APR 重号下仍可定位');
    c.note('机检文件名口径：需求点名 test/wp14/notify.test.js（本分支存在），AC-49 逐字断言实际落 test/wp14/ui-views.test.js「A-2 / AC-49: already-resolved notice」+「AC-04 / AC-49: followNotification navigates to queue and selects the row」+ test/wp14/contract.test.js「AC-43 行为级：open-queue 只展开本条（D-52 分支）」+ notify.test.js 探针序列；按实际存在文件机检并登记，不放宽。');
    c.note('D-13/D-32/A-2 口径：结论词表只取基线状态词（不含「已终止」，终止统一用「已取消」）；本现场终端 --decision retry → 结论「重新分配」，提示「已处理（重新分配），无需再次处理」。新键 DESKTOP_QUEUE_ALREADY_RESOLVED 在 labels.js:943、/ui/labels 白名单 labels.js:171 下发；界面零中文拼装（架构零命中）。面板刷新用轮询不用固定 sleep（§3.3）。');
    return finish(c);
  }
}];
