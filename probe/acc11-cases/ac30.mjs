// AC-30 画布只读：机检 canvas.test.js（数据侧只读）+ canvas-interaction.test.js（D-57 补的
// 四条交互接缝：拖拽不改坐标/views 无新增文件、事件流无 node-detail·jump-host、单击选中恰 1、
// 双击不聚焦不下钻不跳转）；架构检查画布目录不得写视图偏好/写盘。
// D-57：初判 9/9 用源码锚点覆盖，但需求机检原文的四条交互断言未落；补交互接缝用例后重判。
// 缩放/平移/单击高亮/双击的「手感」按 U-13 留人工核验；机检四件事已由交互用例落，不放宽。
import { makeCase, req, machineChecks, thenChecks, caseTmp, runCmd, finish } from '../acc11-f-common.mjs';
const AC = 'AC-30';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '画布 / 只读 / 机检',
  async run() {
    const c = makeCase(AC, { face: '画布 / 只读 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['canvas.test.js', 'canvas-interaction.test.js'],
      arch: [
        { cmd: 'grep -REn "desktop/views|writeFile" desktop/ui/canvas/', expect: 1,
          note: 'AC-30 架构：画布不得写视图偏好（零命中，exit 1）' }
      ],
      tmpdir: tmp
    });
    const cv = c.testRuns.find((t) => t.file === 'canvas.test.js');
    c.check('调用前后 .orch 哈希不变：画布只读、不保存节点偏移',
      Boolean(cv?.subtests?.some((x) => /AC-30 数据侧：投影只读/.test(x)) && cv?.v?.ok),
      (cv?.subtests ?? []).filter((x) => /AC-30/.test(x)).join(' | ') || '（未找到）',
      '拖动不改变节点位置（画布不保存偏移）；视图偏好目录与实例状态哈希不变');
    c.check('投影无运行时字段，节点/边键集合固定（定义态，不混入状态色/会话数/异常角标）',
      Boolean(cv?.subtests?.some((x) => /AC-30 数据侧：投影无运行时字段/.test(x)) && cv?.v?.ok),
      (cv?.subtests ?? []).filter((x) => /AC-30 数据侧：投影无运行时字段/.test(x)).join(' | ') || '（未找到）',
      '点击只选中高亮、不进入聚焦/下钻/跳转；无 node-detail / jump-host 事件');
    // 源码锚点：画布渲染路径不含二次写入 / 下钻 / 跳转。
    const ro = runCmd('grep -REn "node-detail|jump-host|drilldown|focusNode|draggable|onDrag|contenteditable" desktop/ui/canvas/ || true', { tmpdir: tmp });
    c.cmd(ro, '源码锚点：画布模块无下钻/拖拽/可编辑接线');
    c.check('源码锚点：canvas 目录零 node-detail / jump-host / drilldown / focus / drag / 可编辑写法（只读投影）',
      /^\s*$/.test(ro.stdout), ro.stdout.trim() || '（零命中）',
      '双击不进入聚焦、不下钻、不跳转；拖动不改变节点位置');
    // D-57 闭环：机检说明按需求 AC-30 原文，核对四条交互接缝用例齐全且 # fail 0。
    const ci = c.testRuns.find((t) => t.file === 'canvas-interaction.test.js');
    const seam = [
      /AC-30 交互①：拖拽不改变节点位置/,
      /AC-30 交互②：交互事件流无 node-detail \/ jump-host 事件/,
      /AC-30 交互③：单击选中恰 1 个/,
      /AC-30 交互④：双击不聚焦、不下钻、不跳转/,
    ];
    const seamHit = seam.map((re) => Boolean(ci?.subtests?.some((x) => re.test(x))));
    c.check('交互接缝四用例齐全（①坐标/views ②事件名零出现 ③选中恰1 ④双击不跳转）且 # fail 0',
      seamHit.every(Boolean) && ci?.v?.ok === true && ci?.tap?.fail === 0,
      `命中 ${seamHit.filter(Boolean).length}/4；# pass ${ci?.tap?.pass ?? 0} / # fail ${ci?.tap?.fail ?? 0}`,
      req(AC)?.jijian || '断言拖拽前后坐标相同、views/ 目录无新增文件、探针无 node-detail / jump-host 事件、选中态有且仅有 1 个；# fail 0');
    thenChecks(c);
    c.note('D-57 闭环：需求 §3.1 AC-30 机检原文断言「拖拽前后坐标相同 / views/ 无新增文件 / 探针无 node-detail·jump-host 事件 / 选中态有且仅 1 个」。初判 9/9 仅以源码锚点覆盖、四条交互断言未落；现按 D-57 补 test/wp14/canvas-interaction.test.js——用 buildCanvas 投影 + graphEdges/computeLayout + nodeRow（与界面同一批纯模块，经 canvas-dump.mjs harness 驱动）搭最小交互状态模型，逐条落这四件事，# fail 0。旧 9/9 记录保留，按 §3.5 取本条为准。产品定义画布（desktop/ui/canvas/）本就只读、无写盘/下钻接线（架构检查 + 源码锚点双证），未发现与需求冲突；app.js 的 dragEnd→persistOffsets 与 dblclick→focusNode 属 I1.10a 运行态实例图，非本 AC 定义画布。缩放平移手感按 U-13 留人工核验，不属机检范围。证据分级 mock 实测。');
    return finish(c);
  }
}];
