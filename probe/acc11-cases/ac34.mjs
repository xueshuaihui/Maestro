// AC-34 证据不展示正文、不泄露会话内容：机检 evidence.test.js（不含日志首尾行/会话文本、≤65536 字节、
// 动作清单不含 export/preview/openLog）+ ui-views.test.js（A-8 不可读/截断标记 + 64KB 闸门 + 无正文泄露）；
// 架构检查证据投影不读事件正文（session/update|delta 零命中）。D-7 只 stat 不读正文。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-34';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '证据 / 边界 / 机检',
  async run() {
    const c = makeCase(AC, { face: '证据 / 边界 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['evidence.test.js', 'ui-views.test.js'],
      arch: [
        { cmd: 'grep -REn "session/update|delta" src/daemon/evidence.js', expect: 1,
          note: 'AC-34 架构：证据投影不得读事件正文，只读 execution.summary 四要素（零命中，exit 1）' }
      ],
      tmpdir: tmp
    });
    const e = c.testRuns.find((t) => t.file === 'evidence.test.js');
    const u = c.testRuns.find((t) => t.file === 'ui-views.test.js');
    c.check('导出文本不含 5000 行日志第 1 行与第 5000 行内容、不含会话对话文本片段',
      Boolean(e?.subtests?.some((x) => /不泄露日志正文与会话对话文本/.test(x)) && e?.v?.ok),
      (e?.subtests ?? []).filter((x) => /AC-34/.test(x)).join(' | ') || '（未找到）',
      '界面只出现引用路径与「完整日志留在宿主」，不出现日志正文任意一行/会话文本');
    c.check('界面单次渲染文本长度 ≤ 65536 字节（64 KB 终检）',
      Boolean(e?.v?.ok), `# pass ${e?.tap?.pass ?? 0} / # fail ${e?.tap?.fail ?? 0}`,
      '总长度 ≤ 65536 字节');
    c.check('导出的可用动作清单不含 export / preview / openLog 键；加载 ≤ 1 秒',
      Boolean(e?.v?.ok), `# pass ${e?.tap?.pass ?? 0} / # fail ${e?.tap?.fail ?? 0}`,
      '界面上没有「导出」「预览产物内容」「查看完整日志」入口（属 I1.12 范围外）');
    c.check('A-8 不可读/截断标记、64 KB 闸门、无正文泄露由 ui-views.test.js 承载',
      Boolean(u?.subtests?.some((x) => /A-8 \/ AC-34/.test(x)) && u?.v?.ok),
      (u?.subtests ?? []).filter((x) => /A-8 \/ AC-34/.test(x)).join(' | ') || '（未找到）',
      '「完整日志留在宿主」逐字；无日志正文与会话文本');
    thenChecks(c);
    c.note('夹具：5000 行日志文件；state.json 带一条含对话文本的会话事件。D-7 只 stat 不读正文：日志引用只做存在性统计，绝不 readFile；会话事件只读 execution.summary 四要素，不读消息内容。');
    return finish(c);
  }
}];
