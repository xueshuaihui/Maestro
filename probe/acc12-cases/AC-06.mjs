/**
 * AC-06 · 证据过期后交接被拒绝（mock / 夹具面，治理侧判定）。
 * F0 声明 + F1 实际 / 缺失引用两对照均拒绝、升级各 1、判定含关联节点、零 UI。
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { freshRoot, cleanupRoot, loadLabels, appendixBlockFromRequirement } from '../acc12-f-lib.mjs';
import {
  makeCase, eq, check, evidence, note, finish,
} from '../acc12-f-common.mjs';

import { EVIDENCE_STALE, validateEvidenceFreshness } from '../../src/core/handoff-schema.js';
import { sha256Of } from '../../src/core/doc-artifact.js';

const REASON_MISMATCH = 'fingerprint_mismatch';
const REASON_MISSING = 'evidence_missing';
const NODE = 'T-002';

export async function run() {
  const labels = await loadLabels();
  const c = makeCase('AC-06', { scenario: 'ev-stale', title: '证据过期后交接被拒绝' });
  c.root = freshRoot('ev-stale-ac06');
  const workspaceDir = path.join(c.root, 'workspace');
  const taskDir = path.join(c.root, 'task');

  try {
    await fsp.mkdir(path.join(workspaceDir, 'artifacts'), { recursive: true });
    await fsp.mkdir(taskDir, { recursive: true });
    const okFile = path.join(workspaceDir, 'artifacts', 'ok.md');
    const staleFile = path.join(workspaceDir, 'artifacts', 'stale.md');
    await fsp.writeFile(okFile, 'v1-content', 'utf8');
    await fsp.writeFile(staleFile, 'v2-content', 'utf8');
    const F0 = (await sha256Of(okFile)).sha256;
    const F1 = (await sha256Of(staleFile)).sha256;
    evidence(c, 'fixture', 'artifact-F0.md', fs.readFileSync(okFile, 'utf8'));
    evidence(c, 'fixture', 'artifact-F1.md', fs.readFileSync(staleFile, 'utf8'));
    check(c, 'Given：F0 与 F1 实际指纹不同', F0 !== F1, 'F0 != F1');

    const makeHandoff = (ref) => ({
      handoffId: 'HO-003', instanceId: 'INST-001', fromNodeId: NODE, toNodeId: 'T-003',
      round: 2, createdAt: '2026-11-18T00:00:00.000Z',
      edge: { kind: 'forward', from: NODE, to: 'T-003' },
      artifactRefs: { input: [], previous: { ref, sha256: F0 } },
    });
    const staleHandoff = makeHandoff('artifacts/stale.md');
    const missingHandoff = makeHandoff('artifacts/absent.md');
    evidence(c, 'fixture', 'handoff-mismatch.json', JSON.stringify(staleHandoff, null, 2));
    evidence(c, 'fixture', 'handoff-missing.json', JSON.stringify(missingHandoff, null, 2));

    const gateOptions = { workspaceDir, cwd: taskDir, fs: fsp, sha256Of };
    const staleResult = await validateEvidenceFreshness(staleHandoff, gateOptions);
    const missingResult = await validateEvidenceFreshness(missingHandoff, gateOptions);
    evidence(c, 'verify', 'decision-mismatch.json', JSON.stringify(staleResult, null, 2));
    evidence(c, 'verify', 'decision-missing.json', JSON.stringify(missingResult, null, 2));

    for (const [name, result, reason] of [
      ['指纹不一致', staleResult, REASON_MISMATCH],
      ['引用缺失', missingResult, REASON_MISSING],
    ]) {
      eq(c, `Then：${name}拒绝交接 ok=false`, result.ok, false);
      eq(c, `机检：${name}拒绝码 EVIDENCE_STALE`, result.code, EVIDENCE_STALE);
      eq(c, `Then：${name}判定 reason=${reason}`, result.decision?.reason, reason);
      eq(c, `机检：${name}判定 stale=true`, result.decision?.stale, true);
      eq(c, `机检：${name}判定含关联节点 ${NODE}`, result.decision?.nodeId, NODE);
      eq(c, `机检：${name}判定含 handoffId`, result.decision?.handoffId, 'HO-003');
      eq(c, `机检：${name}判定含 instanceId`, result.decision?.instanceId, 'INST-001');
    }

    const escalations = [];
    const delivered = [];
    for (const result of [staleResult, missingResult]) {
      if (!result.ok) escalations.push(result.decision);
      else delivered.push('HO-003');
    }
    eq(c, 'Then：两份交接包均未投递', delivered, []);
    eq(c, '机检：两份拒绝各生成一次升级（共 2）', escalations.length, 2);

    const decisionKeys = Object.keys(staleResult.decision).sort();
    eq(c, 'Then：判定结果最小结构（供 I1.11 消费）', decisionKeys,
      ['handoffId', 'instanceId', 'nodeId', 'reason', 'stale']);
    check(c, 'Then：判定结果不含任何 UI 字段',
      decisionKeys.every((key) => !/label|text|button|view|message|title/i.test(key)), 'no view fields');
    check(c, 'Then：判定结果冻结不可变', Object.isFrozen(staleResult.decision), 'frozen');

    const a4 = appendixBlockFromRequirement('A-4');
    check(c, 'Then：不一致可见原因逐字见 A-4（取自 labels）',
      a4.includes(labels.I112_VOCAB.evidenceMismatch) && a4.includes(labels.I112_VOCAB.handoffRejected),
      'A-4 carries the frozen label literals');
    check(c, 'Then：缺失可见原因逐字见 A-4（取自 labels）',
      a4.includes(labels.I112_VOCAB.evidenceMissing) && a4.includes(labels.I112_VOCAB.handoffRejected),
      'A-4 carries the frozen label literals');
    check(c, '架构检查：本用例只写 evidence/，未产出 I1.11 界面文件',
      c.evidence.every((e) => /iteration-12[\\/]evidence[\\/]/.test(e.file)), 'all frames in evidence dir');

    note(c, `F0=${F0} F1=${F1}；缺失引用 artifacts/absent.md 不存在`);
    evidence(c, 'meta', 'result.json', JSON.stringify({
      F0, F1, staleResult, missingResult, escalations, delivered, decisionsKeys: decisionKeys, checks: c.checks,
    }, null, 2));
    evidence(c, 'summary', 'status.txt', [
      `mismatch=${staleResult.decision?.reason} missing=${missingResult.decision?.reason}`,
      `delivered=0 escalations=${escalations.length}`,
      'uiFields=0 decisionFrozen=true',
    ].join('\n'));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}
