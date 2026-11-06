// AC-04 待校验的两种限定词与会话等待行（混合：after_output 暂停 + --stop-after 2 定格）。
import {
  makeCase, freshRoot, startKeep, statusText, coreStop, forceKillCore, baseEnv,
  text, lines, readState, nodeOf, waitMarker, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-04';
const SCENARIO = 'doc-pass';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '待校验的两种限定词与会话等待行',
  face: '混合',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '混合' });

    // ---------------------------------------------------------------- 根 A：核对证据
    const rootA = freshRoot(`${AC}-a`);
    c.add(rootA);
    let hA = null;
    try {
      // Given：全新根 A，MAESTRO_TEST_PAUSE=after_output:T-002 --keep 启动
      hA = startKeep(rootA, SCENARIO, [], baseEnv({ MAESTRO_TEST_PAUSE: 'after_output:T-002' }), 60000);
      const paused = await hA.waitFile('paused', 60000);
      c.check('根 A：`.mock/paused` 出现（Given 定格点）', Boolean(paused), paused ? '存在' : '未出现');

      // When：orch status --instance INST-001
      const stA = c.cmd(statusText(rootA), '根 A：orch status --instance INST-001（停在 after_output:T-002）');
      const tA = text(stA);
      c.includes('根 A：输出含「节点 T-002 撰写者 待校验（核对证据） · 第 1 轮」', tA,
        '节点 T-002 撰写者 待校验（核对证据） · 第 1 轮');
      c.notIncludes('根 A：输出不含「待校验（等待下游）」', tA, '待校验（等待下游）');
      c.includes('根 A：输出含「会话 等待下游」', tA, '会话 等待下游');
      c.notIncludes('根 A：status 的会话行不带「· 产出已提交」', tA, '· 产出已提交');

      const sA = readState(rootA);
      c.eq('根 A 机检：T-002 state/reviewReason = review/evidence',
        `${nodeOf(sA, 'T-002')?.state}/${nodeOf(sA, 'T-002')?.reviewReason}`, 'review/evidence');
      c.snap(rootA, 'state.a-evidence');
    } finally {
      if (hA) await hA.stop();
      c.cmd(coreStop(rootA), '根 A：orch core stop');
      await forceKillCore(rootA);
      if (hA) c.keep('根 A：driver --scenario doc-pass --keep（MAESTRO_TEST_PAUSE=after_output:T-002）最终输出', hA, hA.argv);
    }

    // ---------------------------------------------------------------- 根 B：等待下游
    const rootB = freshRoot(`${AC}-b`);
    c.add(rootB);
    let hB = null;
    try {
      // Given：另起全新根 B，--stop-after 2 --keep
      hB = startKeep(rootB, SCENARIO, ['--stop-after', '2'], undefined, 60000);
      const marked = await waitMarker(rootB, 2, { timeout: 60000 });
      const streamed = hB.stdout.includes('会话 等待下游 · 产出已提交');
      c.check('根 B：`.mock/stopped-after-2` 出现（Given 定格点）', Boolean(marked), marked ? '存在' : '未出现');

      // Then（流式输出，驱动透传 orch run）
      c.check('根 B：`orch run` 流式输出含「会话 等待下游 · 产出已提交」', streamed,
        lines(hB.stdout).filter((l) => l.includes('会话')).join(' / '));

      // When：orch status
      const stB = c.cmd(statusText(rootB), '根 B：orch status --instance INST-001（停在 --stop-after 2）');
      const tB = text(stB);
      c.includes('根 B：输出含「节点 T-002 撰写者 待校验（等待下游） · 第 1 轮」', tB,
        '节点 T-002 撰写者 待校验（等待下游） · 第 1 轮');
      const sessionLine = lines(tB).find((l) => l.trim().startsWith('会话 ')) ?? '';
      c.eq('根 B：status 的会话行是「会话 等待下游」（第 4 段不加后缀）', sessionLine.trim(), '会话 等待下游');

      const sB = readState(rootB);
      c.eq('根 B 机检：T-002 state/reviewReason = review/downstream',
        `${nodeOf(sB, 'T-002')?.state}/${nodeOf(sB, 'T-002')?.reviewReason}`, 'review/downstream');
      c.eq('根 B 机检：T-001 state = done', nodeOf(sB, 'T-001')?.state, 'done');
      c.snap(rootB, 'state.b-downstream');
      c.note('根 A 的 `state.a-evidence.json` 与根 B 的 `state.b-downstream.json` 分别是两个定格时刻的原始快照；收尾 `state.json` 是 core stop 之后的多根快照。');
    } finally {
      if (hB) await hB.stop();
      c.cmd(coreStop(rootB), '根 B：orch core stop');
      await forceKillCore(rootB);
      if (hB) c.keep('根 B：driver --scenario doc-pass --stop-after 2 --keep 最终输出', hB, hB.argv);
    }

    return finish(c);
  }
}];
