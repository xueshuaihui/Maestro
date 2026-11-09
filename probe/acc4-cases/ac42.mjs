// AC-42 instance graph --format text 可读（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, instanceGraph, mutateState,
  text, lines, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-42';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    const paused = freshRoot(`${AC}-paused`); c.add(paused);

    c.cmd(runScene(root, { scenario: 'pass' }), 'orch run code-loop pass');
    const g = c.cmd(instanceGraph(root, 'INST-001'), 'orch instance graph INST-001（text）');
    const out = text(g);
    c.eq('Then：退出码 0', g.exitCode, 0);
    c.includes('Then：首行是实例、模板、状态', lines(out)[0], '实例 INST-001 · 编码闭环 · 已完成');
    c.includes('Then：每个节点一行（T-001）', out, 'T-001 开发 · 已完成 · 第 1 轮');
    c.includes('Then：每个节点一行（T-002）', out, 'T-002 测试 · 已完成 · 第 1 轮');
    c.includes('Then：末尾「边：」段落', out, '边：');
    c.includes('Then：边逐条列出方向（正向）', out, 'T-001 -> T-002 正向');
    c.includes('Then：边逐条列出方向（回流）', out, 'T-002 -> T-001 回流');
    c.includes('Then：边逐条列出方向（复测）', out, 'T-001 -> T-002 复测');
    // 机检：输出为纯 ASCII 结构字符（中文字符与中文标点、间隔号除外）
    const stripped = out.replace(/[　-〿一-鿿＀-￯·]/g, '');
    c.check('机检：输出为纯 ASCII 结构字符（中文字符与中文标点除外）', /^[\x20-\x7E\n]*$/.test(stripped),
      JSON.stringify(stripped.slice(0, 200)));

    // 暂停时首行带「（已暂停）」
    c.cmd(runScene(paused, { scenario: 'pass' }), 'orch run code-loop pass（暂停夹具母版）');
    mutateState(paused, 'INST-001', (s) => { s.state = 'running'; s.paused = true; });
    const gp = c.cmd(instanceGraph(paused, 'INST-001'), 'orch instance graph INST-001（暂停态 text）');
    c.includes('Then：暂停时首行带「（已暂停）」', lines(text(gp))[0], '实例 INST-001 · 编码闭环 · 运行中（已暂停）');
    return conclude(c, [root, paused]);
  },
}];
