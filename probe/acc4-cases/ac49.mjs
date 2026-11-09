// AC-49 暂停停在下一次派发边界（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, pauseAtOutput, workflow, statusText, readState,
  readEvents, readStatusMd, reasonsOf, text, sleep, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-49';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：MAESTRO_TEST_PAUSE=after_output:T-001 在开发产出后停住
    const { h, paused } = await pauseAtOutput(root, 'T-001', { scenario: 'pass' });
    c.check('Given：项目根出现 .mock/paused（开发产出后停住）', paused, String(h.stdout).slice(-200));

    // When：workflow pause，然后放行接缝
    const pr = c.cmd(workflow(root, 'pause', 'INST-001'), 'orch workflow pause INST-001');
    h.release();
    await Promise.race([h.done, sleep(30000)]);
    c.keep('orch run（前台，暂停收尾）', h);
    const mid = readState(root);
    const ev = readEvents(root);
    const md = readStatusMd(root);
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');

    c.eq('Then：pause 退出码 0', pr.exitCode, 0);
    c.includes('Then：pause 输出实例行「运行中（已暂停）」', text(pr), '实例 INST-001 · 运行中（已暂停） · 模板 编码闭环');
    c.eq('Then：前台 orch run 以暂停收尾并退出 0', h.exitCode, 0);
    c.includes('Then：run 收尾只打印实例行与下一步', h.stdout, '下一步：恢复推进 orch workflow resume INST-001');
    c.notIncludes('机检：run 收尾不打印节点表', h.stdout.split('下一步：恢复推进')[0].split('\n').slice(-3).join('|'), '节点 T-001 开发 已完成');
    c.notIncludes('机检：run 收尾不打印交接包行与升级块', String(h.stdout).split('实例 INST-001 · 运行中（已暂停）')[1] ?? '', '交接包 HO-');

    c.eq('机检：磁盘快照 paused === true', mid?.paused, true);
    c.eq('机检：磁盘快照 halted === false', mid?.halted, false);
    c.eq('机检：state 仍为 running', mid?.state, 'running');
    c.eq('机检：开发节点 T-001 done', mid?.nodes?.find((n) => n.nodeId === 'T-001')?.state, 'done');
    c.eq('机检：counters.dispatchCount 仍为 1', mid?.counters?.dispatchCount, 1);
    c.eq('机检：测试 round === 0', mid?.nodes?.find((n) => n.nodeId === 'T-002')?.round, 0);
    c.check('机检：handoffs 中没有指向测试的包（不存在 created 孤儿包）',
      !(mid?.handoffs ?? []).some((x) => x.toNodeId === 'T-002'), JSON.stringify((mid?.handoffs ?? []).map((x) => [x.handoffId, x.state])));
    c.eq('机检：events.jsonl 中开发节点之后没有新的 node.dispatch', reasonsOf(ev).filter((r) => r === 'node.dispatch').length, 1);
    c.includes('Then：status 显示已暂停', text(st), '运行中（已暂停）');
    c.includes('机检：workspace/status.md 含「- 暂停：是」', String(md), '- 暂停：是');
    await h.stop();
    return conclude(c, root);
  },
}];
