// AC-23 · 升级已处理/未挂起两异常（J-2 stateLabel 逐字「升级 ESC-001 已处理 · 状态 已处理」+ 真守卫双 continue）
import { standardCase } from './_shared.mjs';
import { runCmd, NODE, REPO } from '../acc10b-f-common.mjs';

export const cases = [standardCase('AC-23', {
  testFile: 'escalation-continue.test.js',
  arch: [
    { label: '① 原始错误码不越界面层', pattern: 'ESCALATION_NOT_PENDING|INSTANCE_NOT_SUSPENDED', target: 'desktop/ui/', expect: 'zero' },
    { label: '②a DRILL_ESC_ALREADY 在 drill 层', pattern: 'DRILL_ESC_ALREADY', target: 'desktop/ui/drill/', expect: 'min1' },
    { label: '②b DRILL_ESC_NOT_SUSPENDED 在 drill 层', pattern: 'DRILL_ESC_NOT_SUSPENDED', target: 'desktop/ui/drill/', expect: 'min1' },
    { label: '③a ESCALATION_NOT_PENDING 在核心/daemon/CLI', pattern: 'ESCALATION_NOT_PENDING', target: 'src/core src/daemon src/cli', expect: 'min1' },
    { label: '③b INSTANCE_NOT_SUSPENDED 在核心/daemon/CLI', pattern: 'INSTANCE_NOT_SUSPENDED', target: 'src/core src/daemon src/cli', expect: 'min1' },
    { label: '④ 原始错误码不在探针层', pattern: 'ESCALATION_NOT_PENDING|INSTANCE_NOT_SUSPENDED', target: 'desktop/harness/', expect: 'zero' },
  ],
  literals: [
    "assert.equal(app.state().escalationNotice.text, '升级 ESC-001 已处理 · 状态 ' + ESCALATION_LABEL.resolved)",
    'stateLabel: ESCALATION_LABEL.resolved',
    'assert.equal(result.stateLabel, ESCALATION_LABEL.resolved)',
    "assert.equal(result.messageKey, 'DRILL_ESC_ALREADY')",
    "assert.equal(app.state().escalationNotice.text, '实例 未挂起 · 无法继续')",
    '连发两次第二次得 ALREADY（真实非桩）',
    "assert.equal(second.code, 'ESCALATION_NOT_PENDING')",
    "assert.equal(second.messageKey, 'DRILL_ESC_ALREADY')",
    'assert.equal(second.stateLabel, ESCALATION_LABEL.resolved)',
  ],
  extra(c) {
    // 裁决 J-2：真正 evaluate 文案，核对逐字 Then 行（不采信测试自述）。
    const script = [
      "import('./src/cli/labels.js').then(async cli=>{",
      "const ui=await import('./src/daemon/http/labels.js');",
      "const t=ui.UI_LABEL_KEYS['DRILL_ESC_ALREADY'];",
      "console.log('TPL='+t);",
      "console.log('STATE='+cli.ESCALATION_LABEL.resolved);",
      "console.log('LINE='+t.replaceAll('{id}','ESC-001').replaceAll('{state}',cli.ESCALATION_LABEL.resolved));",
      "})",
    ].join('');
    const r = runCmd([NODE, '-e', script], { cwd: REPO, label: 'evaluate DRILL_ESC_ALREADY + ESCALATION_LABEL.resolved' });
    c.cmd(r);
    c.frame('escalation-label', 'txt', `exit=${r.exitCode}\n${r.stdout}\n${r.stderr}`);
    c.includes('stateLabel 模板逐字（DRILL_ESC_ALREADY）', r.stdout, 'TPL=升级 {id} 已处理 · 状态 {state}');
    c.includes('状态词来自 CLI 唯一中文源（ESCALATION_LABEL.resolved）', r.stdout, 'STATE=已处理');
    c.includes('Then 逐字：升级 ESC-001 已处理 · 状态 已处理（J-2）', r.stdout, 'LINE=升级 ESC-001 已处理 · 状态 已处理');
  },
  notes: [
    'Then ①逐字「升级 ESC-001 已处理 · 状态 已处理」（裁决 J-2：daemon 新增结构字段 stateLabel 取 CLI ESCALATION_LABEL.resolved，不再靠注入文案键；63 键冻结、两处 147+63 精确断言不变，逐字行由 extra 真机 evaluate 核对）；②「实例 未挂起 · 无法继续」，面板不关闭，两次都不崩、状态不变、不新增裁决。',
    '机检内部断言：① 现场对同一实例连发两次 continue，第二次得 ESCALATION_NOT_PENDING 且提示与 ① 逐字一致（真守卫、非桩）；escalations[0].state 未被二次改写、events 中 escalation.resolved 计数不变。',
    'Given 纪律：现场由既有 test.escalate + escalate resolve 产出，不手写 suspended+escalations；② 只换注入的 io.continueEscalation 桩（形状与 daemon 真实返回一致），不改 state.json。',
  ],
})];
