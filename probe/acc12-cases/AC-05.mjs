/**
 * AC-05 · 证据指纹一致时正常交接（mock / 夹具面）。
 * 产物存在非空、声明指纹与当前指纹一致 → 放行、投递、过期拒绝 0、升级 0。
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { freshRoot, cleanupRoot } from '../acc12-f-lib.mjs';
import {
  makeCase, eq, check, evidence, note, finish,
} from '../acc12-f-common.mjs';

import { validateHandoff, validateEvidenceFreshness } from '../../src/core/handoff-schema.js';
import { sha256Of } from '../../src/core/doc-artifact.js';

const F0 = 'v1-content';

export async function run() {
  const c = makeCase('AC-05', { scenario: 'ev-ok', title: '证据指纹一致时正常交接' });
  c.root = freshRoot('ev-ok-ac05');
  const workspaceDir = path.join(c.root, 'workspace');
  const taskDir = path.join(c.root, 'task');

  try {
    await fsp.mkdir(path.join(workspaceDir, 'artifacts'), { recursive: true });
    await fsp.mkdir(taskDir, { recursive: true });
    const artifact = path.join(workspaceDir, 'artifacts', 'ok.md');
    await fsp.writeFile(artifact, F0, 'utf8');
    evidence(c, 'fixture', 'artifact-ok.md', fs.readFileSync(artifact, 'utf8'));
    const fingerprint = await sha256Of(artifact);
    const okHash = fingerprint.sha256;

    const handoff = {
      handoffId: 'HO-003', instanceId: 'INST-001', fromNodeId: 'T-002', toNodeId: 'T-003',
      round: 2, createdAt: '2026-11-18T00:00:00.000Z',
      edge: { kind: 'forward', from: 'T-002', to: 'T-003' },
      artifactRefs: { input: [], previous: { ref: 'artifacts/ok.md', sha256: okHash } },
    };
    evidence(c, 'fixture', 'handoff.json', JSON.stringify(handoff, null, 2));

    const gateOptions = { workspaceDir, cwd: taskDir, fs: fsp, sha256Of };
    const result = await validateEvidenceFreshness(handoff, gateOptions);
    const chain = await validateHandoff(handoff, { workspaceDir, cwd: taskDir });
    evidence(c, 'verify', 'freshness.json', JSON.stringify(result, null, 2));
    evidence(c, 'verify', 'full-chain.json', JSON.stringify(chain, null, 2));

    eq(c, 'Then：指纹一致性判定放行 ok=true', result.ok, true);
    eq(c, 'Then：判定 stale=false', result.stale, false);
    eq(c, '机检：完整交接校验链通过', chain.ok, true);
    check(c, 'Then：不生成过期拒绝码', !('code' in result), 'no code on success');

    const escalations = [];
    const delivered = [];
    if (!result.ok) escalations.push(result.decision);
    else delivered.push(handoff.handoffId);
    eq(c, '机检：交接包进入已投递（夹具 delivered）', delivered, ['HO-003']);
    eq(c, 'Then：过期拒绝计数为 0', escalations.length, 0);
    eq(c, 'Then：升级计数为 0', escalations.length, 0);

    note(c, `声明指纹 F0=${okHash} 与当前产物指纹一致`);
    evidence(c, 'meta', 'result.json', JSON.stringify({
      artifact: 'artifacts/ok.md', declaredHash: okHash, actualHash: okHash,
      result, chain, delivered, escalations, checks: c.checks,
    }, null, 2));
    evidence(c, 'summary', 'status.txt', [
      `freshness.ok=${result.ok} stale=${result.stale}`,
      `chain.ok=${chain.ok}`,
      `delivered=${delivered.join(',')} escalations=0`,
    ].join('\n'));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}
