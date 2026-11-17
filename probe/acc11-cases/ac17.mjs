// AC-17 队列与 CLI 同源：机检 queue.test.js（AC-17 各按本侧分隔符拆、只比字段值）+ CLI 基线事实锚点。
// D-22/D-37：两侧按各自分隔符拆（CLI 升级行两空格、桌面行 · ；审批行只比 {编号,状态词,动作}），不比整行字符串。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-17';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '一致性 / 机检',
  async run() {
    const c = makeCase(AC, { face: '一致性 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['queue.test.js'],
      arch: [
        { cmd: 'grep -REn "ESC-|APR-" src/daemon/queue.js', expect: 1, note: 'AC-17 架构：不得用编号格式推断状态，零命中（exit 1）' },
        { cmd: `sed -n '1256,1280p' src/cli/render.js | grep -Ec "join\\('  '\\)"`, expect: 0, contains: '1', note: 'AC-17 CLI 基线①：renderEscalationListRow 两个空格拼接恰好 1 处（exit 0）' },
        { cmd: `grep -REn "parts.join\\(' · '\\)" src/cli/render.js`, expect: 0, lines: 4, note: 'AC-17 CLI 基线②：parts.join( · ) 命中 4 处，含 1155 renderApprovalLine（exit 0）' }
      ],
      tmpdir: tmp
    });
    const q = c.testRuns.find((t) => t.file === 'queue.test.js');
    c.check('AC-17 同源用例存在：条目编号集合相等、字段值逐项相等',
      Boolean(q?.subtests?.some((x) => /队列与 CLI 同源.*AC-17/.test(x)) && q?.v?.ok),
      (q?.subtests ?? []).filter((x) => /同源/.test(x)).join(' | ') || '（未找到）',
      '两侧编号集合 [ESC-001, APR-001] 相等；六字段逐项相等');
    c.check('D-37 两侧按本侧分隔符拆：CLI 升级行两空格 5 段 / 桌面 · 7 段，归一化为六元组逐项相等',
      Boolean(q?.v?.ok),
      `# pass ${q?.tap?.pass ?? 0} / # fail ${q?.tap?.fail ?? 0}`,
      'CLI escParts.length===5；queue 条目逐项 deepEqual');
    c.check('审批行只比字段值不比字符串：CLI 审批 3 段只比 {编号,状态词,动作}；桌面多出实例/轮次/时间三字段但不参与相等',
      Boolean(q?.v?.ok),
      `# pass ${q?.tap?.pass ?? 0} / # fail ${q?.tap?.fail ?? 0}`,
      'aprParts.length===3；assert.notEqual(cliApproval, queueReasonSummary)；桌面三字段非空');
    c.check('不存在「某条目只在面板出现、CLI 查不到」或反之',
      Boolean(q?.v?.ok),
      `# pass ${q?.tap?.pass ?? 0} / # fail ${q?.tap?.fail ?? 0}`,
      '编号集合相等；# fail 0');
    thenChecks(c);
    c.note('机检文件名口径：需求点名 test/wp14/queue-consistency.test.js（本分支不存在），AC-17 逐字断言合并进 test/wp14/queue.test.js「队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）」用例。按实际文件机检并登记说明，不放宽。');
    c.note('D-22/D-37 口径：不比整行字符串——CLI 升级行按两个空格（\\s{2,}）拆 5 段，桌面升级行按 · 拆 7 段，先归一化为 {编号,实例号,节点号,轮次,状态词,原因摘要} 再逐项相等；CLI 审批行按 · 拆只比 {编号,状态词,动作}，桌面审批行多出的实例/轮次/时间三字段须存在非空但不参与相等。CLI 分隔符基线由本用例两条 arch 锚点复核，未出现字符串相等断言。');
    return finish(c);
  }
}];
