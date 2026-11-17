// AC-32 证据视图按节点看五项：机检 evidence.test.js（两次尝试只取最近一次、五项齐全、轮次来自节点）
// + ui-views.test.js（A-8 五项 + 轮次逐字渲染、latest only）；架构检查证据只读摘要/引用、不读日志正文。
// D-7 数据源三处（artifactRefs + execution.summary + node.round）；A-8 逐字。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-32';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '证据 / 机检',
  async run() {
    const c = makeCase(AC, { face: '证据 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['evidence.test.js', 'ui-views.test.js'],
      arch: [
        { cmd: 'grep -REn "readFileSync|createReadStream" src/daemon/evidence.js', expect: 1,
          note: 'AC-32 架构：证据只读既有摘要与引用，不读日志正文（零命中，exit 1）' }
      ],
      tmpdir: tmp
    });
    const e = c.testRuns.find((t) => t.file === 'evidence.test.js');
    const u = c.testRuns.find((t) => t.file === 'ui-views.test.js');
    c.check('只展示最近一次（第 2 轮）五项：命令 npm test / 退出码 1 / 关键输出 12 行 / 日志 logs/T-003-2.txt / 产物 calc.js 带校验时间',
      Boolean(e?.subtests?.some((x) => /两次尝试只取最近一次，五项齐全/.test(x)) && e?.v?.ok),
      (e?.subtests ?? []).filter((x) => /AC-32/.test(x)).join(' | ') || '（未找到）',
      '五项逐字匹配 A-8：命令 npm test / 退出码 1 / 关键输出 12 行 / 日志 logs/T-003-2.txt / 产物 calc.js · 校验于 2026-11-15T10:30:00Z');
    c.check('round === 2、logRef === logs/T-003-2.txt；导出文本不含第 1 轮的 npm run lint 与 logs/T-003-1.txt',
      Boolean(e?.v?.ok), `# pass ${e?.tap?.pass ?? 0} / # fail ${e?.tap?.fail ?? 0}`,
      '不把两次尝试拼在一起；第 1 轮命令与日志引用不出现在界面');
    c.check('行首标注「节点 T-003 · 第 2 轮」；界面写明「完整日志留在宿主」',
      Boolean(u?.subtests?.some((x) => /A-8 \/ AC-32/.test(x)) && u?.v?.ok),
      (u?.subtests ?? []).filter((x) => /A-8 \/ AC-32/.test(x)).join(' | ') || '（未找到）',
      '五项 + 轮次逐字渲染，latest only');
    c.check('D-7 三数据源端到端：真实运行失败摘要四要素 + 产物引用带校验时间且真实可读',
      Boolean(e?.subtests?.some((x) => /真实运行·失败摘要/.test(x)) &&
               e?.subtests?.some((x) => /真实运行·产物引用/.test(x)) && e?.v?.ok),
      (e?.subtests ?? []).filter((x) => /真实运行/.test(x)).join(' | ') || '（未找到）',
      '① artifactRefs（含 verifiedAt）② execution.summary 四要素 ③ node.round');
    thenChecks(c);
    c.note('夹具：先起核再写盘，state.json 写节点与 artifactRefs，events.jsonl 追加两轮 execution.summary（第 2 轮在后）。A-0 样例值声明：T-003/第 2 轮为 code-loop 回流构造的示例，逐字取夹具实际值。');
    return finish(c);
  }
}];
