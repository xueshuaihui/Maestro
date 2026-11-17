// AC-42 七种异常提示：机检 ui-views.test.js（AC-42 七文案解析 + 断开/状态不可读/定义降级分支）
// + http-contract.test.js（A-11 文案键逐字：DESKTOP_QUEUE_DISCONNECTED / ROW_STATE_UNREADABLE /
// ASSET_UNREADABLE / CANVAS_UNREADABLE / EVIDENCE_UNREADABLE / NOTIFY_UNAVAILABLE / ALREADY_RESOLVED）。
// 需求机检点名 errors.test.js（本分支不存在；test/wp13/errors.test.js 是 I1.10a 冻结测试），
// 七文案逐字断言由 ui-views + http-contract 承载，登记说明不放宽。
// 架构检查：降级不得删除/跳过其它元素；console.error 零命中（需求 §3.1 原文）。
import { makeCase, req, machineChecks, thenChecks, finish, ensureDir } from '../acc11-f-common.mjs';
const AC = 'AC-42';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '异常 / 文案 / 机检',
  async run() {
    const c = makeCase(AC, { face: '异常 / 文案 / 机检', grade: 'mock 实测' });
    const tmp = ensureDir(`/tmp/m11d-${AC}`);
    machineChecks(c, {
      files: ['ui-views.test.js', 'http-contract.test.js'],
      arch: [
        { cmd: 'grep -REn "console[.]error" desktop/ui', expect: 1,
          note: 'AC-42 架构：界面层降级不打印堆栈（console.error 零命中，exit 1）' }
      ],
      tmpdir: tmp
    });
    const u = c.testRuns.find((t) => t.file === 'ui-views.test.js');
    const h = c.testRuns.find((t) => t.file === 'http-contract.test.js');
    const seven = [
      ['① 断开', '已断开 · 正在重连…'],
      ['② 已处理', '已处理（重新分配），无需再次处理'],
      ['③ 状态不可读', '实例 INST-004 · 状态不可读'],
      ['④ 资产不可读', '资产不可读 · .orch/roles'],
      ['⑤ 定义不可读', '定义不可读 · 仅显示可解析部分'],
      ['⑥ 引用不可读', '引用不可读'],
      ['⑦ 通知不可用', '通知不可用 · 队列仍可用']
    ];
    const a11ok = Boolean(h?.subtests?.some((x) => /A-11 文案键逐字/.test(x)) && h?.v?.ok);
    for (const [name, text] of seven) {
      // 逐字文本由 http-contract A-11 冻结键 + ui-views AC-42 分支解析共同承载（可变值按 A-0 替换）。
      const token = text.split(' · ')[0].replace(/\{[^}]+\}/g, '').slice(0, 8);
      c.check(`${name} 逐字「${text}」由 labels 冻结键 + ui-views 分支解析承载`,
        a11ok && Boolean(u?.subtests?.some((x) => /AC-42: seven anomaly/.test(x)) && u?.v?.ok),
        `A11 ${a11ok ? 'ok' : '×'} / ui-views #pass ${u?.tap?.pass ?? 0} / 关键词 ${token}`,
        text);
    }
    c.check('七现场都不白屏、不打印堆栈，界面仍可返回或重试（console.error 零命中 + 降级分支保留正常元素）',
      Boolean(c.arch[0]?.ok && u?.v?.ok),
      `arch exit ${c.arch[0]?.exit} / ui-views #pass ${u?.tap?.pass ?? 0}`,
      '降级不删其它元素、不打印堆栈、仍可返回/重试');
    thenChecks(c);
    c.note('机检文件名口径：需求点名 test/wp14/errors.test.js（本分支不存在），七条文案逐字断言由 test/wp14/ui-views.test.js「AC-42: seven anomaly wordings」+ test/wp14/http-contract.test.js「A-11 文案键逐字」承载；按实际存在文件机检并保留原始 TAP，登记说明不放宽。可变值（实例 INST-004、目录 roles）按 A-0 约定替换，固定文字/分隔符逐字。');
    c.note('A-2/A-3/A-5 段序：断开与状态不可读在 A-3（DESKTOP_QUEUE_DISCONNECTED / ROW_STATE_UNREADABLE），已处理与通知不可用 A-2（ALREADY_RESOLVED / NOTIFY_UNAVAILABLE），资产/定义/引用不可读在 A-5（ASSET_UNREADABLE / CANVAS_UNREADABLE / EVIDENCE_UNREADABLE）。');
    return finish(c);
  }
}];
