// AC-07 审核第 1 轮驳回 → 自动回流，撰写者交出新版本（doc-backflow-once --stop-after 4 --keep）。
import {
  makeCase, freshRoot, startKeep, statusText, coreStop, forceKillCore,
  text, lines, readState, nodeOf, handoffOf, wsPath, fileInfo, sha256File,
  waitMarker, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-07';
const SCENARIO = 'doc-backflow-once';
const V2 = 'artifacts/docs/release-notes.v2.md';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '审核第 1 轮驳回 → 自动回流，撰写者交出新版本',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);
    let h = null;
    try {
      h = startKeep(root, SCENARIO, ['--stop-after', '4'], undefined, 60000);
      const marked = await waitMarker(root, 4, { timeout: 60000 });
      c.check('机检：`.mock/stopped-after-4` 存在（Given 定格点）', Boolean(marked), marked ? '存在' : '未出现');

      const st = c.cmd(statusText(root), 'orch status --instance INST-001');
      const t = text(st);
      c.includes('输出含「节点 T-003 审核者 失败（等待复审） · 第 1 轮」', t, '节点 T-003 审核者 失败（等待复审） · 第 1 轮');
      const nodeLines = lines(t).filter((l) => l.startsWith('节点 '));
      c.check('三行节点行里都不出现「等待复测」', nodeLines.length === 3 && nodeLines.every((l) => !l.includes('等待复测')),
        nodeLines.join(' | '));
      c.includes('输出含「审核 驳回 · 缺陷 2 条」', t, '审核 驳回 · 缺陷 2 条');
      c.includes('输出含「节点 T-002 撰写者 待校验（等待下游） · 第 2 轮」', t, '节点 T-002 撰写者 待校验（等待下游） · 第 2 轮');
      c.includes('输出含「交接包 HO-003  审核者→撰写者（回流）」', t, '交接包 HO-003  审核者→撰写者（回流）');

      // 机检：v2 落盘非空
      const v2 = fileInfo(wsPath(root, V2));
      c.check('机检：release-notes.v2.md 存在且非空', v2.exists && v2.bytes > 0, `${v2.exists} / ${v2.bytes} B`);

      // 机检：v1 的 sha256 与第 1 轮 artifactHistory 记录一致
      const s = readState(root);
      const t2 = nodeOf(s, 'T-002');
      const rec1 = (t2?.artifactHistory ?? []).find((x) => x.round === 1 && x.ref === 'artifacts/docs/release-notes.v1.md');
      const v1now = sha256File(wsPath(root, 'artifacts/docs/release-notes.v1.md'));
      c.check('机检：v1 的 sha256 与第 1 轮 artifactHistory 记录一致',
        Boolean(rec1?.sha256) && v1now === rec1.sha256, `now=${v1now} recorded=${rec1?.sha256 ?? '缺失'}`);

      // 机检：轮次与审核节点状态
      c.eq('机检：T-002 round = 2', t2?.round, 2);
      const t3 = nodeOf(s, 'T-003');
      c.eq('机检：T-003 round/state/note = 1/failed/等待复审', `${t3?.round}/${t3?.state}/${t3?.note}`, '1/failed/等待复审');
      c.eq('机检：HO-003 edge.kind = backflow', handoffOf(s, 'HO-003')?.edge?.kind, 'backflow');
      c.snap(root, 'state.live');
      c.note('`state.live.json` 是 --stop-after 4 定格时刻的快照（T-003 failed 第 1 轮、T-002 review(downstream) 第 2 轮、v1/v2 并存）。');
    } finally {
      if (h) await h.stop();
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
      if (h) c.keep('driver --scenario doc-backflow-once --stop-after 4 --keep 最终输出（长驻进程由脚手架终止）', h, h.argv);
    }
    return finish(c);
  }
}];
