// AC-39 instance log 文本按顺序输出事件（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, escalateResolve, instanceLog, badHandoff,
  cloneState, readEvents, text, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-39';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    const rej = freshRoot(`${AC}-reject`); c.add(rej);
    const empty = freshRoot(`${AC}-empty`); c.add(empty);

    // Given：一个完成过回流与升级、并已处理升级的实例
    c.cmd(runScene(root, { scenario: 'rounds-exceeded' }), 'orch run code-loop rounds-exceeded（回流 + 升级）');
    c.cmd(escalateResolve(root, 'ESC-001', 'pass', 'INST-001'), 'orch escalate resolve ESC-001 --decision pass（处理升级）');
    const log = c.cmd(instanceLog(root, 'INST-001'), 'orch instance log INST-001');
    const ev = readEvents(root);
    const seqs = [...text(log).matchAll(/\[#(\d+)\]/g)].map((m) => Number(m[1]));

    c.eq('Then：事件按发生顺序逐行输出（[#n] 行数 == events.jsonl 行数）', seqs.length, ev.length);
    c.eq('机检：行序与 events.jsonl 的 seq 一致', JSON.stringify(seqs), JSON.stringify(ev.map((e) => e.seq)));
    c.includes('Then：含升级事件', text(log), '原因 创建升级');
    c.includes('Then：含处理升级事件', text(log), '原因 处理升级');
    c.includes('Then：含回流事件', text(log), '原因 构造回流');

    // 拒绝事件（坏包子场景，A-3 沿用 status --events 事件行格式）
    await badHandoff(rej, 'no-evidence');
    const log2 = c.cmd(instanceLog(rej, 'INST-001'), 'orch instance log INST-001（含拒绝事件）');
    c.includes('Then：含拒绝事件', text(log2), '拒绝');

    // 没有事件时输出「事件 —」（cloneState 清空 events.jsonl）
    c.cmd(runScene(empty, { scenario: 'pass' }), 'orch run code-loop pass（母版）');
    cloneState(empty, 'INST-001', 'INST-002', () => {});
    const log3 = c.cmd(instanceLog(empty, 'INST-002'), 'orch instance log INST-002（空事件）');
    c.eq('Then：没有事件时输出「事件 —」', text(log3).trim(), '事件 —');
    return conclude(c, [root, rej, empty]);
  },
}];
