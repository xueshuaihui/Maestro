// AC-08 回流内容带齐缺陷、证据、修改要求与上一版引用（doc-backflow-once --stop-after 4 --keep）。
import {
  makeCase, freshRoot, startKeep, coreStop, forceKillCore,
  readState, handoffOf, promptOf, waitMarker, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-08';
const SCENARIO = 'doc-backflow-once';
const V1 = 'artifacts/docs/release-notes.v1.md';
const V2 = 'artifacts/docs/release-notes.v2.md';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '回流内容带齐缺陷、证据、修改要求与上一版引用',
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

      const s = readState(root);
      const ho = handoffOf(s, 'HO-003');
      const defects = ho?.defects ?? [];

      c.eq('机检：HO-003 edge.kind = backflow', ho?.edge?.kind, 'backflow');
      c.eq('机检：HO-003 defects 恰好 2 条', defects.length, 2);
      c.check('机检：每条 defect 的 summary 与 evidence 都非空',
        defects.length === 2 && defects.every((d) => String(d?.summary ?? '').trim() && String(d?.evidence ?? '').trim()),
        JSON.stringify(defects));
      c.check('机检：每条 defect 的 evidence 指向 v1',
        defects.length === 2 && defects.every((d) => String(d?.evidence ?? '').startsWith(V1)),
        defects.map((d) => d?.evidence).join(' / '));
      c.check('机检：HO-003 revisionRequirement 非空', Boolean(String(ho?.revisionRequirement ?? '').trim()),
        JSON.stringify(ho?.revisionRequirement ?? null));

      const prev = ho?.artifactRefs?.previous;
      c.check('机检：artifactRefs.previous = {ref:v1, sha256:非空}',
        prev?.ref === V1 && typeof prev?.sha256 === 'string' && prev.sha256.length > 0,
        JSON.stringify(prev ?? null));
      c.eq('机检：artifactRefs.output = ' + V2, ho?.artifactRefs?.output, V2);

      // 撰写者第 2 轮提示词（第 4 次派发）
      const p4 = promptOf(root, 4);
      const task = p4?.task ?? '';
      c.check('机检：`.mock/prompts/4.json` 存在且是 T-002 第 2 轮',
        Boolean(p4) && p4.nodeId === 'T-002' && p4.round === 2, p4 ? `nodeId=${p4.nodeId} round=${p4.round}` : '缺失');

      const d1 = defects[0] ?? {};
      const d2 = defects[1] ?? {};
      const line1 = `缺陷 1：${d1.summary}（证据 ${d1.evidence}）`;
      const line2 = `缺陷 2：${d2.summary}（证据 ${d2.evidence}）`;
      c.check('机检：task 含逐字「缺陷 1：…（证据 …）」（summary/evidence 取 HO-003 第 1 条）', task.includes(line1), line1);
      c.check('机检：task 含逐字「缺陷 2：…（证据 …）」（summary/evidence 取 HO-003 第 2 条）', task.includes(line2), line2);
      const count = (needleValue) => task.split(needleValue).length - 1;
      c.check('机检：「缺陷 1：」「缺陷 2：」各只出现一次',
        count('缺陷 1：') === 1 && count('缺陷 2：') === 1, `缺陷 1：x${count('缺陷 1：')} 缺陷 2：x${count('缺陷 2：')}`);
      c.includes('机检：task 含「修改要求：」', task, '修改要求：');
      c.includes('机检：task 含「上一版文档引用：' + V1 + '」', task, `上一版文档引用：${V1}`);
      c.includes('机检：task 含「本轮文档引用：' + V2 + '」', task, `本轮文档引用：${V2}`);
      c.snap(root, 'state.live');
      c.note('`state.live.json` 是 --stop-after 4 定格时刻的快照；提示词原文见检查项实测值。');
    } finally {
      if (h) await h.stop();
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
      if (h) c.keep('driver --scenario doc-backflow-once --stop-after 4 --keep 最终输出（长驻进程由脚手架终止）', h, h.argv);
    }
    return finish(c);
  }
}];
