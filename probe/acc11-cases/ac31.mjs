// AC-31 画布降级三现场：机检 canvas.test.js（现场一整体不可解析→定义不可读原因；现场二文件不存在/无读权限→定义 空；
// 现场三悬空边照画+校验不通过）；架构检查不得整块清空、不得空 catch 吞解析错误。D-23/D-17 两种失败分工；B-1 三态。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-31';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '画布 / 降级 / 机检',
  async run() {
    const c = makeCase(AC, { face: '画布 / 降级 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['canvas.test.js'],
      arch: [
        { cmd: 'grep -REn "nodes = [][]" desktop/ui/canvas/', expect: 1,
          note: 'AC-31 架构①：降级不得整块清空画布（零命中，exit 1）' },
        { cmd: 'grep -REn "catch *[(][^)]*[)] *[{] *[}]" desktop/ui/canvas/', expect: 1,
          note: 'AC-31 架构②：不得用空 catch 吞掉解析错误（零命中，exit 1）' }
      ],
      tmpdir: tmp
    });
    const cv = c.testRuns.find((t) => t.file === 'canvas.test.js');
    c.check('现场一：文件存在但内容整体不可解析（{{{{）→「定义不可读 · 仅显示可解析部分」，无可解析节点时 nodes.length=0、保留返回入口',
      Boolean(cv?.subtests?.some((x) => /AC-31 现场一/.test(x)) && cv?.v?.ok),
      (cv?.subtests ?? []).filter((x) => /AC-31 现场一/.test(x)).join(' | ') || '（未找到）',
      '文案逐字「定义不可读 · 仅显示可解析部分」；nodes.length === 0');
    c.check('现场二：文件不存在 / 无读权限 →「定义 空」且 nodes.length=0（B-1：readable=true、零节点）',
      Boolean(cv?.subtests?.some((x) => /AC-31 现场二/.test(x)) && cv?.v?.ok),
      (cv?.subtests ?? []).filter((x) => /AC-31 现场二/.test(x)).join(' | ') || '（未找到）',
      '文案逐字「定义 空」；不显示「定义不可读」');
    c.check('现场三：悬空边结构可解析、校验失败 → 正常画出全部节点、valid=false、标题旁标「校验不通过」',
      Boolean(cv?.subtests?.some((x) => /AC-31 现场三/.test(x)) && cv?.v?.ok),
      (cv?.subtests ?? []).filter((x) => /AC-31 现场三/.test(x)).join(' | ') || '（未找到）',
      'valid === false 且 nodes.length === 定义节点数');
    c.check('三现场都不白屏、不打印堆栈，返回入口都在；stderr 无堆栈',
      Boolean(cv?.v?.ok), `# pass ${cv?.tap?.pass ?? 0} / # fail ${cv?.tap?.fail ?? 0}`,
      '三现场都能取到返回入口、stderr 无堆栈');
    thenChecks(c);
    c.note('D-23/D-17 分工固定：文件不存在 / 无读权限 / 内容为空 → 「定义 空」；文件在但结构整体不可解析 → 「定义不可读 · 仅显示可解析部分」；校验失败但结构可解析 → 照常画出并标「校验不通过」。B-1 三态：现场二按「取不到输入」readable=true、零节点处理；现场三 valid=false 时无论 readable 取哪态都标「校验不通过」。');
    return finish(c);
  }
}];
