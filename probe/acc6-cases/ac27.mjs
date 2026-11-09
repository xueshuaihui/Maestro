// AC-27 并行 fan-out / fan-in 通过校验并在预演中成组（机检 + 用户可见）
// 夹具：writeDocFanout()（裁-15）。A-10 的并行组层行段尾固定带 ` · 汇合：all`（v4 口径）。
import {
  makeCase, freshRoot, workflowValidate, workflowDryRun, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';
import { writeDocFanout } from './_fixtures.mjs';

const AC = 'AC-27';
const PARALLEL_LINE = '2. 并行组 draft：T-002 撰写A（角色节点 writer）｜ T-003 撰写B（角色节点 editor） · 汇合：all';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);
    writeDocFanout(root);
    c.noteFixture('预置附录 A-13 的 doc-fanout（writeDocFanout）', '');

    // When：orch workflow validate doc-fanout（scoped，target-only 计数，裁-13）
    const val = c.cmd(workflowValidate(root, ['doc-fanout']), 'orch workflow validate doc-fanout');
    c.evText('validate', text(val));
    c.eq('Then 校验全部通过、退出 0', val.exitCode === 0 && clean(text(val)).includes('全部通过'), true);
    c.includes('Then 校验首行含 全部通过', clean(text(val)), '全部通过');

    // When：orch workflow dry-run doc-fanout
    const res = c.cmd(workflowDryRun(root, 'doc-fanout'), 'orch workflow dry-run doc-fanout');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('dry-run', text(res));

    // Then：并行组层行逐字，且两节点不在同一层之外的两行里分别出现
    c.eq('Then dry-run 退出码 0', res.exitCode, 0);
    c.includes('Then 层行逐字（含 · 汇合：all）', clean(text(res)), PARALLEL_LINE);
    const layerLines = rows.filter((l) => /^\d+\./.test(l));
    const withT002 = layerLines.filter((l) => l.includes('T-002'));
    const withT003 = layerLines.filter((l) => l.includes('T-003'));
    c.eq('Then T-002 只出现在一个层行', withT002.length, 1);
    c.eq('Then T-003 只出现在一个层行', withT003.length, 1);
    c.eq('Then 两个节点同属并行组那一行', withT002[0] === withT003[0] && withT002[0] === PARALLEL_LINE, true);

    // 机检：预演 JSON 的 layers / nodeCount / edgeCount
    const json = c.cmd(workflowDryRun(root, 'doc-fanout', ['--format', 'json']), 'orch workflow dry-run doc-fanout --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);
    c.eq('机检：layers[1].parallel === true', payload?.layers?.[1]?.parallel, true);
    c.deepEq('机检：layers[1].nodes', payload?.layers?.[1]?.nodes, ['T-002', 'T-003']);
    const layersWithT002 = (payload?.layers ?? []).filter((l) => (l.nodes ?? []).includes('T-002'));
    c.eq('机检：不存在第二个含 T-002 的层', layersWithT002.length, 1);
    c.eq('机检：nodeCount === 6', payload?.nodeCount, 6);
    c.eq('机检：edgeCount === 7', payload?.edgeCount, 7);

    return finish(c);
  }
}];
