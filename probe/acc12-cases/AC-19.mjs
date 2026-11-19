/**
 * AC-19 · 反模式监控给出三类信号（裁决 D-6：detectAntipatterns 模块直调，不新增 CLI）。
 * 三类信号各命中一次含定位；数据不足不误报；只读（不改 state、不调用迁移/升级）。
 */
import { freshRoot, cleanupRoot, loadLabels } from '../acc12-f-lib.mjs';
import { makeCase, evidence, verify, check, includes, eq, finish } from '../acc12-f-common.mjs';
import { detectAntipatterns, SIGNAL_TYPES, SIGNAL_DETAIL_KEYS } from '../../src/core/antipattern.js';
import { cli } from './AC-13.mjs';

export async function run() {
  const c = makeCase('AC-19', { scenario: 'antipattern', title: '反模式监控给出三类信号' });
  c.root = freshRoot('antipattern-ac19');
  try {
    const labels = await loadLabels();
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);

    // 实例 1：文档瓶颈（document 节点停在 review 超过阈值）。
    const doc = {
      state: { instanceId: 'INST-DOC', nodes: [
        { id: 'T-101', artifact_type: 'document', state: 'review', startedAt: now - 30 * 60 * 1000 },
      ] },
      graph: { nodes: [{ id: 'T-101', artifact_type: 'document' }], edges: [] },
      traces: [{ node_id: 'T-101', round: 1, start_time: now - 30 * 60 * 1000, end_time: now, status: 'review' }],
      events: [{ objectId: 'T-101', detail: { verdict: 'x', upstream: 'y' } }],
    };
    // 实例 2：串行化退化（无依赖边的两节点严格顺序、无重叠）。
    const ser = {
      state: { instanceId: 'INST-SER' },
      graph: { nodes: [{ id: 'T-201' }, { id: 'T-202' }], edges: [] },
      traces: [
        { node_id: 'T-201', round: 1, start_time: 1000, end_time: 2000 },
        { node_id: 'T-202', round: 1, start_time: 3000, end_time: 4000 },
      ],
      events: [{ objectId: 'T-201', detail: { verdict: 'x', upstream: 'y' } }, { objectId: 'T-202', detail: { verdict: 'x', upstream: 'y' } }],
    };
    // 实例 3：确认偏误（审核节点连续 3 次附和上游且无独立证据）。
    const conf = {
      state: { instanceId: 'INST-CONF' },
      graph: { nodes: [{ id: 'T-301', type: 'review' }], edges: [] },
      traces: [],
      events: [1, 2, 3].map(() => ({ objectId: 'T-301', detail: { verdict: 'agree', upstream: 'agree' } })),
    };
    // 实例 4：数据不足。
    const thin = { state: { instanceId: 'INST-THIN' }, graph: { nodes: [], edges: [] }, traces: [], events: [] };
    const casesIn = { doc, ser, conf, thin };
    const inputsBaseline = JSON.stringify(casesIn);
    evidence(c, 'given', 'inputs.json', JSON.stringify(casesIn, null, 2));

    const cfgDoc = { instanceId: 'INST-DOC', now, docDwellMs: 10 * 60 * 1000, minSamples: 1 };
    const cfgSer = { instanceId: 'INST-SER', minSamples: 1 };
    const cfgConf = { instanceId: 'INST-CONF', minSamples: 1, agreementCount: 3 };
    const cfgThin = { instanceId: 'INST-THIN', minSamples: 2 };

    const rDoc = detectAntipatterns({ ...doc, config: cfgDoc });
    const rSer = detectAntipatterns({ ...ser, config: cfgSer });
    const rConf = detectAntipatterns({ ...conf, config: cfgConf });
    const rThin = detectAntipatterns({ ...thin, config: cfgThin });
    const results = { doc: rDoc, ser: rSer, conf: rConf, thin: rThin };
    evidence(c, 'when', 'signals.json', JSON.stringify(results, null, 2));

    const docSig = rDoc.signals.find((s) => s.type === SIGNAL_TYPES.docBottleneck);
    const serSig = rSer.signals.find((s) => s.type === SIGNAL_TYPES.serializationRegression);
    const confSig = rConf.signals.find((s) => s.type === SIGNAL_TYPES.confirmationBias);
    check(c, 'Then：文档瓶颈信号命中一次', rDoc.signals.filter((s) => s.type === SIGNAL_TYPES.docBottleneck).length === 1, 'exactly 1');
    check(c, 'Then：串行化退化信号命中一次', rSer.signals.filter((s) => s.type === SIGNAL_TYPES.serializationRegression).length === 1, 'exactly 1');
    check(c, 'Then：确认偏误信号命中一次', rConf.signals.filter((s) => s.type === SIGNAL_TYPES.confirmationBias).length === 1, 'exactly 1');
    eq(c, 'Then：文档瓶颈含实例定位', docSig?.instanceId, 'INST-DOC');
    eq(c, 'Then：文档瓶颈含节点定位', docSig?.nodeId, 'T-101');
    check(c, 'Then：串行化退化含节点定位', typeof serSig?.nodeId === 'string' && serSig.nodeId.length > 0, 'nodeId present');
    eq(c, 'Then：确认偏误含节点定位', confSig?.nodeId, 'T-301');
    eq(c, 'Then：文档瓶颈 detailKey 取自冻结常量', docSig?.detailKey, SIGNAL_DETAIL_KEYS.docBottleneck);
    includes(c, 'Then：文档瓶颈文案逐字来自 labels', labels[SIGNAL_DETAIL_KEYS.docBottleneck], '文档瓶颈');
    includes(c, 'Then：串行化退化文案逐字来自 labels', labels[SIGNAL_DETAIL_KEYS.serializationRegression], '串行化退化');
    includes(c, 'Then：确认偏误文案逐字来自 labels', labels[SIGNAL_DETAIL_KEYS.confirmationBias], '确认偏误');

    verify(c, 'Then：数据不足实例给出提示且不误报',
      rThin.insufficientData === true && rThin.signals.length === 0, (x) => x === true, 'insufficientData=true, signals=[]');
    includes(c, 'Then：数据不足文案逐字来自 labels', labels[SIGNAL_DETAIL_KEYS.insufficientData], '数据不足');

    // 只读：调用后输入未被修改。
    const inputsChanged = JSON.stringify(casesIn) !== inputsBaseline;
    check(c, '架构检查：信号只读（输入未被修改）', !inputsChanged, 'inputs unchanged');
    // 不调用状态迁移/升级接口（静态源码断言）。
    const srcMod = (await import('node:fs')).readFileSync(
      new URL('../../src/core/antipattern.js', import.meta.url), 'utf8');
    evidence(c, 'then', 'arch-scan.txt', `emit/transit/escalat hits=${(srcMod.match(/emit\(|transit\(|escalat/g) || []).length}\n`);
    eq(c, '架构检查：不调用 emit/transit/escalat', (srcMod.match(/emit\(|transit\(|escalat/g) || []).length, 0);

    evidence(c, 'meta', 'result.json', JSON.stringify({ results, checks: c.checks }, null, 2));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}

cli('AC-19', run, import.meta.url);
