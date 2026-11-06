// AC-02 研究完成后，撰写者收到研究笔记与写作路径（夹具：doc-pass --stop-after 2 --keep）。
import {
  makeCase, freshRoot, startKeep, statusText, coreStop, forceKillCore,
  text, readState, nodeOf, handoffOf, promptOf, wsPath, fileInfo,
  waitMarker, requirementTitle, finish, exists
} from '../acc3-f-common.mjs';

const AC = 'AC-02';
const SCENARIO = 'doc-pass';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '研究完成后，撰写者收到研究笔记与写作路径',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);
    let h = null;
    try {
      // When：--stop-after 2 --keep（第 2 次派发完成核对、审核者尚未派发）
      h = startKeep(root, SCENARIO, ['--stop-after', '2'], undefined, 60000);
      const marked = await waitMarker(root, 2, { timeout: 60000 });
      c.check('机检：`.mock/stopped-after-2` 存在（Given 定格点）', Boolean(marked), exists(`${root}/.mock/stopped-after-2`));

      // When：orch status --instance INST-001
      const st = c.cmd(statusText(root), 'orch status --instance INST-001');
      const t = text(st);
      c.includes('输出含「节点 T-001 研究员 已完成 · 第 1 轮」', t, '节点 T-001 研究员 已完成 · 第 1 轮');
      c.includes('输出含「产物 artifacts/reports/research-notes.v1.md」', t, '产物 artifacts/reports/research-notes.v1.md');
      c.includes('输出含「节点 T-002 撰写者 待校验（等待下游） · 第 1 轮」', t, '节点 T-002 撰写者 待校验（等待下游） · 第 1 轮');
      c.includes('输出含「交接包 HO-001  研究员→撰写者  已完成」', t, '交接包 HO-001  研究员→撰写者  已完成');

      // 机检：撰写者第 1 轮提示词（第 2 次派发）
      const p2 = promptOf(root, 2);
      const task = p2?.task ?? '';
      c.check('机检：`.mock/prompts/2.json` 存在且是 T-002 第 1 轮', Boolean(p2) && p2.nodeId === 'T-002' && p2.round === 1,
        p2 ? `nodeId=${p2.nodeId} round=${p2.round}` : '缺失');
      c.includes('提示词含「研究笔记：artifacts/reports/research-notes.v1.md」', task, '研究笔记：artifacts/reports/research-notes.v1.md');
      c.includes('提示词含「本轮文档引用：artifacts/docs/release-notes.v1.md」', task, '本轮文档引用：artifacts/docs/release-notes.v1.md');
      c.includes('提示词含写入路径「.orch/instances/INST-001/workspace/artifacts/docs/release-notes.v1.md」', task,
        '.orch/instances/INST-001/workspace/artifacts/docs/release-notes.v1.md');

      // 机检：研究笔记落盘且非空
      const notes = fileInfo(wsPath(root, 'artifacts/reports/research-notes.v1.md'));
      c.check('机检：研究笔记存在且非空', notes.exists && notes.bytes > 0, `${notes.exists} / ${notes.bytes} B`);

      // 补充：状态字段与交接包（佐证 status 的行）
      const s = readState(root);
      const t2 = nodeOf(s, 'T-002');
      c.eq('机检：T-002 state/reviewReason/round = review/downstream/1', `${t2?.state}/${t2?.reviewReason}/${t2?.round}`,
        'review/downstream/1');
      c.eq('机检：T-001 state = done', nodeOf(s, 'T-001')?.state, 'done');
      c.eq('机检：HO-001 state = consumed', handoffOf(s, 'HO-001')?.state, 'consumed');
      c.snap(root, 'state.live');
      c.note('`state.live.json` 是 --stop-after 2 定格时刻的快照（T-001 done / T-002 review(downstream) / T-003 pending、dispatchCount=2）；收尾 `state.json` 是 core stop 之后的快照。');
    } finally {
      if (h) await h.stop();
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
      if (h) c.keep('driver --scenario doc-pass --stop-after 2 --keep 最终输出（长驻进程由脚手架终止，exit 不作产品退出码）', h, h.argv);
    }
    return finish(c);
  }
}];
