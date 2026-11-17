// AC-33 缺项「未提供」与引用不可读：机检 evidence.test.js（从未执行/产物缺失/日志缺失三现场，
// 缺项 null、单项不可读不牵连）+ ui-views.test.js（A-8 缺项渲染 unprovided）；架构检查 return null 留证（行为兜底）。
// D-7 只读且只 stat：引用不存在时单项标 unreadable，不影响其它项。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-33';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '证据 / 异常 / 机检',
  async run() {
    const c = makeCase(AC, { face: '证据 / 异常 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['evidence.test.js', 'ui-views.test.js'],
      arch: [
        { cmd: 'grep -REn "return null" src/daemon/evidence.js', expect: null,
          note: 'AC-33 架构（留证不判）：return null 命中不得导致整体响应失败，由「其余四项仍返回」行为断言兜底' }
      ],
      tmpdir: tmp
    });
    const e = c.testRuns.find((t) => t.file === 'evidence.test.js');
    const u = c.testRuns.find((t) => t.file === 'ui-views.test.js');
    c.check('现场①从未执行：五项都显示「未提供」且行不省略（出现 5 次）',
      Boolean(e?.subtests?.some((x) => /从未执行 \/ 产物缺失 \/ 日志缺失三现场/.test(x)) && e?.v?.ok),
      (e?.subtests ?? []).filter((x) => /AC-33/.test(x)).join(' | ') || '（未找到）',
      '五项都显示「未提供」且行不省略；缺项 null');
    c.check('现场②产物路径不存在：产物项显示「引用不可读」，其余四项照常',
      Boolean(e?.v?.ok), `# pass ${e?.tap?.pass ?? 0} / # fail ${e?.tap?.fail ?? 0}`,
      '产物项 unreadable；其余四项仍返回');
    c.check('现场③日志引用不可读：日志项显示「引用不可读」，其余四项照常；三次都可切到别的节点不崩溃',
      Boolean(e?.v?.ok), `# pass ${e?.tap?.pass ?? 0} / # fail ${e?.tap?.fail ?? 0}`,
      '日志项 unreadable；切换后内容正确');
    c.check('A-8 缺项渲染逐字（unprovided）由 ui-views.test.js 承载',
      Boolean(u?.subtests?.some((x) => /A-8 \/ AC-33/.test(x)) && u?.v?.ok),
      (u?.subtests ?? []).filter((x) => /A-8 \/ AC-33/.test(x)).join(' | ') || '（未找到）',
      '「命令 未提供 / 退出码 未提供 / 关键输出 未提供 / 日志 未提供 / 产物 未提供」逐字');
    thenChecks(c);
    c.note('夹具：三个节点在同一份 state.json 构造；不存在的产物路径指向 /tmp/maestro-i11-evidence-missing/nope.js。架构 return null 命中按需求留证不判（expect null），整体响应由机检行为断言兜底，不放宽。');
    return finish(c);
  }
}];
