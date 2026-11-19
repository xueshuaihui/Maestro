// AC-47 断线保留旧内容并标注，恢复后自动补全：机检 ui-views.test.js（AC-47 队列快照帧替换内容、
// 断线保留最后 rows + A-3「已断开 · 正在重连…」与托盘 disconnected 文案）+ queue.test.js（断线文案 +
// 状态不可读标注）+ http-contract.test.js（DESKTOP_QUEUE_DISCONNECTED / TRAY_STATUS_DISCONNECTED 逐字）。
// 需求机检点名 queue-reconnect.test.js（本分支不存在），逐字断言合并进上述三文件，登记说明不放宽。
// 架构检查：断线不清空队列、不把旧内容标为最新（「已断开」文案硬编码零命中、rows=[]/clearRows 零命中）。
// BR-36/D-10 口径：断线保留最后一次成功取到的内容并标注，恢复后自动补全，不需要点刷新。
import { makeCase, req, machineChecks, thenChecks, finish, ensureDir } from '../acc11-f-common.mjs';
const AC = 'AC-47';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '队列 / 异常 / 机检',
  async run() {
    const c = makeCase(AC, { face: '队列 / 异常 / 机检', grade: 'mock 实测' });
    const tmp = ensureDir(`/tmp/m11d-${AC}`);
    machineChecks(c, {
      files: ['ui-views.test.js', 'queue.test.js', 'http-contract.test.js'],
      arch: [
        { cmd: 'grep -REn "已断开" desktop/ui/queue/', expect: 1,
          note: 'AC-47 架构①：断线文案不硬编码，来自 labels（UI queue 目录零命中，exit 1）' },
        { cmd: 'grep -REn "rows = \\[\\]|clearRows" desktop/ui/queue/', expect: 1,
          note: 'AC-47 架构②：断线不清空队列（rows=[]/clearRows 零命中，exit 1）' }
      ],
      tmpdir: tmp
    });
    const u = c.testRuns.find((t) => t.file === 'ui-views.test.js');
    const q = c.testRuns.find((t) => t.file === 'queue.test.js');
    const h = c.testRuns.find((t) => t.file === 'http-contract.test.js');
    c.check('断线时队列保留最后 2 行（ESC-001 升级 + APR-001 审批），显示「已断开 · 正在重连…」',
      Boolean(u?.subtests?.some((x) => /AC-47: queue snapshot frame/.test(x)) && u?.v?.ok &&
               h?.subtests?.some((x) => /A-11 文案键逐字/.test(x)) && h?.v?.ok),
      (u?.subtests ?? []).filter((x) => /AC-47/.test(x)).join(' | ') || '（未找到）',
      "rows.length===2 && disconnectedText==='已断开 · 正在重连…'（DESKTOP_QUEUE_DISCONNECTED）");
    c.check('断线时数字不再声称最新：托盘信息行显示「—」（instances===null / DESKTOP_TRAY_STATUS_DISCONNECTED）',
      Boolean(u?.v?.ok && h?.subtests?.some((x) => /A-11 文案键逐字/.test(x))),
      `# pass ui-views ${u?.tap?.pass ?? 0} / http ${h?.tap?.pass ?? 0}`,
      "tray.instances===null；DESKTOP_TRAY_STATUS_DISCONNECTED='实例 — · 待处理升级 —'");
    c.check('恢复后 2 秒内提示消失、队列补齐 3 行（离线新增 ESC-002 出现）、托盘待处理升级变 2，无需刷新',
      Boolean(u?.v?.ok && q?.v?.ok && c.arch.every((a) => a.ok)),
      `# pass ui-views ${u?.tap?.pass ?? 0} / queue ${q?.tap?.pass ?? 0}`,
      't_restore - t_restart ≤ 2000；rows.length===3；tray.pendingEscalations===2；提示已消失');
    thenChecks(c);
    c.note('机检文件名口径：需求点名 test/wp14/queue-reconnect.test.js（本分支不存在），逐字断言合并进 test/wp14/ui-views.test.js「AC-47: queue snapshot frame replaces content; disconnect keeps last rows」+ test/wp14/queue.test.js（断线文案）+ test/wp14/http-contract.test.js（A-11 文案键逐字）；按实际存在文件机检并登记，不放宽。');
    c.note('D-10/BR-36/G-08 口径：断线保留最后成功内容、不把旧数字当最新（托盘「—」）、恢复自动补全；无需「刷新」按钮。A-3 补「已断开 · 正在重连…」（队列级标注，条目保留）与「实例 INST-004 · 状态不可读」（单行级标注），两者不互相替代。轮询判定用「条件成立即继续」，不用固定 sleep（§3.3）。');
    return finish(c);
  }
}];
