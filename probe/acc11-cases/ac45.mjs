// AC-45 空定义：机检 canvas.test.js（AC-45 现场一 nodes:[] 语法合法零节点、现场二 0 字节内容空，
// 都按「定义 空」投影）+ ui-views.test.js（A-7/AC-45 文案与降级分支逐字）。
// 架构检查：空定义不得被当成不可读（desktop/ui/canvas/ 内「定义不可读」零命中，需求 §3.1 原文）。
// B-1/D-17/D-23 口径：文件在但无可读输入（0 字节/nodes:[]）→「定义 空」；文件在但整体不可解析
// 才→「定义不可读」；显示分支由 {readable, nodes.length} 共同选择（D-57 同源模块）。
import { makeCase, req, machineChecks, thenChecks, finish, ensureDir } from '../acc11-f-common.mjs';
const AC = 'AC-45';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '画布 / 边界 / 机检',
  async run() {
    const c = makeCase(AC, { face: '画布 / 边界 / 机检', grade: 'mock 实测' });
    const tmp = ensureDir(`/tmp/m11d-${AC}`);
    machineChecks(c, {
      files: ['canvas.test.js', 'ui-views.test.js'],
      arch: [
        { cmd: 'grep -REn "定义不可读" desktop/ui/canvas/', expect: 1,
          note: 'AC-45 架构：画布目录零「定义不可读」硬编码（零命中，exit 1；文案只来自 labels，分支由 readable+nodes.length 选）' }
      ],
      tmpdir: tmp
    });
    const cv = c.testRuns.find((t) => t.file === 'canvas.test.js');
    const u = c.testRuns.find((t) => t.file === 'ui-views.test.js');
    c.check('现场一 empty-flow（nodes:[]/edges:[] 语法合法）显示「定义 空」，nodes=0/edges=0、readable=true、无节点块',
      Boolean(cv?.subtests?.some((x) => /AC-45 空定义/.test(x)) && cv?.v?.ok),
      (cv?.subtests ?? []).filter((x) => /AC-45/.test(x)).join(' | ') || '（未找到）',
      "现场一 nodes.length===0 && edges.length===0 && emptyText==='定义 空' && readable===true");
    c.check('现场二 blank-flow（0 字节内容空）按 B-1 三态同样显示「定义 空」，不出现「定义不可读」',
      Boolean(cv?.v?.ok && c.arch[0]?.ok),
      `# pass canvas ${cv?.tap?.pass ?? 0} / arch exit ${c.arch[0]?.exit}`,
      "现场二 emptyText==='定义 空' 且不出现『定义不可读』，nodes.length===0");
    c.check('两处都无堆栈、不白屏，返回入口都在；A-7 文案逐字由 ui-views 承载',
      Boolean(u?.subtests?.some((x) => /A-7 \/ AC-29 AC-31 AC-45/.test(x)) && u?.v?.ok && cv?.v?.ok),
      `ui-views #pass ${u?.tap?.pass ?? 0} / canvas #pass ${cv?.tap?.pass ?? 0}`,
      "stderr 无堆栈、返回入口存在；DESKTOP_CANVAS_EMPTY='定义 空'，DESKTOP_CANVAS_UNREADABLE='定义不可读 · 仅显示可解析部分' 分工明确");
    thenChecks(c);
    c.note('机检文件名口径：需求点名 test/wp14/canvas.test.js（本分支存在），A-7 文案逐字由 test/wp14/ui-views.test.js「A-7 / AC-29 AC-31 AC-45」承载；按实际文件机检并登记，不放宽。');
    c.note('H-11/D-23 口径：AC-45 增 0 字节现场；BR-19/§2.7/A-7 同步「内容为空→定义 空」。现场一语法成功零节点 readable=true、现场二按 B-1 三态（readable 缺省但 nodes.length=0）也走「定义 空」，两处都不显示「定义不可读」、不白屏、返回入口在。先起核再写盘（snapshot 启动顺序），夹具在 /tmp/m11d-AC-45 独立根。');
    return finish(c);
  }
}];
