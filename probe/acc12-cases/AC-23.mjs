/**
 * AC-23 · 与 I1.11 的边界：治理侧只产出判定结果，不定义 UI。
 * 判定结构含原因 + 关联节点、无 UI 文案、与 I1.11 文件零交集、可被消费。
 */
import fs from 'node:fs';
import path from 'node:path';

import { REPO, freshRoot, cleanupRoot, runCmd } from '../acc12-f-lib.mjs';
import { makeCase, evidence, check, verify, includes, eq, finish } from '../acc12-f-common.mjs';
import { validateHighRiskReview, reviewDecision } from '../../src/core/governance.js';
import { validateEvidenceFreshness } from '../../src/core/handoff-schema.js';
import { cli } from './AC-13.mjs';

export async function run() {
  const c = makeCase('AC-23', { scenario: 'boundary', title: '与 I1.11 的边界：治理侧只产出判定结果' });
  c.root = freshRoot('boundary-ac23');
  try {
    // 判定一：高风险终审（含原因 + 关联节点）。
    const review = validateHighRiskReview({
      workflow: { nodes: [
        { id: 'H1', side_effect: 'high', type: 'task' },
        { id: 'N2', type: 'task' },
      ] },
      graph: { edges: [{ from: 'H1', to: 'N2' }] },
      roles: [],
    });
    // 判定二：证据过期（含原因 + 关联节点）。用缺失证据触发判定，不依赖真实文件。
    const stale = await validateEvidenceFreshness(
      { handoffId: 'HO-9', instanceId: 'INST-9', fromNodeId: 'T-9',
        artifactRefs: { previous: { ref: 'artifacts/missing-v9.md', sha256: 'a'.repeat(64) } } },
      { cwd: c.root, workspaceDir: c.root }
    );
    // 判定三：可消费的逐节点副本。
    const decision = reviewDecision({ instanceId: 'INST-9', nodeId: 'H1',
      needsHumanReview: true, blocked: true, reason: 'missing_human_gate' });
    const decisions = { review, stale, decision };
    evidence(c, 'given', 'decisions.json', JSON.stringify(decisions, null, 2));

    // 结构含原因 + 关联节点。
    verify(c, 'Then：高风险终审判定含原因', review.reason, (x) => typeof x === 'string' && x.length > 0, 'reason 非空');
    check(c, 'Then：高风险终审判定含关联节点（nodeIds）',
      Array.isArray(review.nodeIds) && review.nodeIds.includes('H1'), 'nodeIds includes H1');
    verify(c, 'Then：证据过期判定含原因', stale.ok === false ? stale.decision?.reason : null,
      (x) => typeof x === 'string' && x.length > 0, 'decision.reason 非空');
    eq(c, 'Then：证据过期判定含关联节点 nodeId', stale.decision?.nodeId, 'T-9');
    eq(c, 'Then：可消费判定副本含关联节点 nodeId', decision.nodeId, 'H1');
    eq(c, 'Then：可消费判定副本含原因', decision.reason, 'missing_human_gate');
    check(c, 'Then：判定结果可被 I1.11 侧读取（纯 JSON 可序列化、无函数/循环）',
      (() => { try { JSON.parse(JSON.stringify(decisions)); return true; } catch { return false; } })(), 'JSON consumable');

    // 无 UI 文案落入判定产物：判定字段值不含中文。
    const allStrings = JSON.stringify(decisions);
    const hasCjk = /[\u4e00-\u9fff]/.test(allStrings);
    check(c, 'Then：判定结果无 UI 文案（字段值无中文）', !hasCjk, 'no CJK in decision values');
    const uiFields = ['label', 'text', 'view', 'button', 'icon', 'title', 'component', 'style', 'color', 'widget'];
    const hitUi = Object.keys(decision).filter((k) => uiFields.includes(k.toLowerCase()));
    eq(c, '架构检查：治理判定结构无界面字段', hitUi.length, 0);

    // 与 I1.11 文件零交集：基线 d17090f..HEAD 的改动清单按路径特征 grep 应零命中。
    const gitDiff = runCmd(['git', 'diff', '--name-only', 'd17090f..HEAD'], { cwd: REPO });
    evidence(c, 'then', 'git-diff.txt', `exitCode=${gitDiff.exitCode}\n${gitDiff.stdout}`);
    const changed = gitDiff.stdout.split(/\r?\n/).filter(Boolean);
    const i111Hits = changed.filter((f) => /i1\.11|notify|intervention|evidence-view/i.test(f));
    eq(c, '架构检查：改动清单与 I1.11 路径特征零交集', i111Hits.length, 0);
    check(c, '架构检查：本迭代未新增 UI 组件文件',
      !changed.some((f) => /\.(jsx|tsx|vue|svelte)$/i.test(f)), 'no UI component files');
    evidence(c, 'then', 'meta-diff.json', JSON.stringify({ changed, i111Hits }, null, 2));

    evidence(c, 'meta', 'result.json', JSON.stringify({ decisions, hasCjk, i111Hits, changedCount: changed.length, checks: c.checks }, null, 2));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}

cli('AC-23', run, import.meta.url);
