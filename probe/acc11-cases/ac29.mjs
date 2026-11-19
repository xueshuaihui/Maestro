// AC-29 工作流画布定义态角色图：机检 canvas.test.js（7 节点 8 边 / 回流弧线 / 层号 / 双开坐标一致 /
// 部分可解析不整块降级）；架构检查布局复用既有 computeLayout（F-02 锚点），画布目录不得自带第二套。
// D-49 内置回退；D-6/B-1 画布三态；D-31 同一份 release-flow。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-29';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '画布 / 定义态 / 机检',
  async run() {
    const c = makeCase(AC, { face: '画布 / 定义态 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['canvas.test.js'],
      arch: [
        { cmd: 'grep -REn "export function computeLayout" desktop/ui/graph/layout.js', expect: 0, lines: 1,
          note: 'AC-29 架构①：既有布局纯函数 export function computeLayout 恰好 1 条命中（exit 0，基线实跑 1 条）' },
        { cmd: 'grep -REn "function .*ayout" desktop/ui/canvas/', expect: 1,
          note: 'AC-29 架构②：画布目录不得自带第二套布局实现（零命中，exit 1）' },
        { cmd: 'grep -REn "computeLayout" desktop/ui/canvas/', expect: 0,
          note: 'AC-29 架构③：画布模块必须从既有布局模块引入 computeLayout（≥1 命中，exit 0）' }
      ],
      tmpdir: tmp
    });
    const cv = c.testRuns.find((t) => t.file === 'canvas.test.js');
    c.check('release-flow：7 节点 8 边齐全，2 条回流反向弧线、dangling=0、无 statusColor',
      Boolean(cv?.subtests?.some((x) => /AC-29 release-flow：7 节点 8 边/.test(x)) && cv?.v?.ok),
      (cv?.subtests ?? []).filter((x) => /AC-29 release-flow/.test(x)).join(' | ') || '（未找到）',
      '标题「工作流 release-flow · 定义态 · 7 节点 · 8 条边」逐字（A-7）');
    c.check('层号映射 T-001=0,T-002=1,T-003=1,H-001=2,S-001=3,T-004=4,T-005=5',
      Boolean(cv?.v?.ok), `# pass ${cv?.tap?.pass ?? 0} / # fail ${cv?.tap?.fail ?? 0}`,
      '布局是纯函数，不引入随机/时间因素');
    c.check('同一份定义两次打开，每个节点坐标逐值相等（两次导出 deepEqual）',
      Boolean(cv?.v?.ok), `# pass ${cv?.tap?.pass ?? 0} / # fail ${cv?.tap?.fail ?? 0}`,
      '两次导出的节点坐标数组 deepEqual');
    c.check('partial-flow：4 节点都画、unknownTypeFallback=1、readable=false/valid=false、emptyText=null、标「校验不通过」、不出现「定义不可读」',
      Boolean(cv?.subtests?.some((x) => /AC-29 部分可解析/.test(x)) && cv?.v?.ok),
      (cv?.subtests ?? []).filter((x) => /部分可解析/.test(x)).join(' | ') || '（未找到）',
      'B-1 三态：readable=false && nodes.length>0 = 部分可解析，不显示「定义不可读」');
    c.check('两处画布都没有状态色、活跃会话数、异常角标（定义态字段齐全）',
      Boolean(cv?.v?.ok), `# pass ${cv?.tap?.pass ?? 0} / # fail ${cv?.tap?.fail ?? 0}`,
      '画布节点不带运行时字段');
    c.check('D-49：项目文件缺失且 id 命中内置图时按内置定义投影（readable=true），不由「文件缺失→定义 空」一刀切',
      Boolean(cv?.subtests?.some((x) => /AC-29 真实内置工作流/.test(x)) && cv?.v?.ok),
      (cv?.subtests ?? []).filter((x) => /内置工作流/.test(x)).join(' | ') || '（未找到）',
      '内置 single/code-loop/task-loop 命中时投影出定义态画布');
    thenChecks(c);
    c.note('F-02 锚点：布局复用既有 export function computeLayout（layout.js:45），画布目录不得自带第二套；三处架构检查按需求 v12 §3.1 原文逐条执行。D-31 同一份 release-flow = A-5/AC-22/AC-29 的 7 节点/8 边/2 回流，改一处须同步四处。');
    return finish(c);
  }
}];
