/**
 * AC-10 · 恢复摘要一行说清「从哪来、跳过多少、第几轮」。
 *
 * 恢复面用自控制 backflow + killAfter=2500（实测恢复行「轮次 2/2」）；
 * 对照面用独立 root 跑一次干净的 pass 场景（非恢复实例）。断言恢复行只出现 1 次、
 * graph 文本顶部同款一行、非恢复实例不出现该行。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import { REPO, NODE, ORCH_BIN, baseEnv, freshRoot, cleanupRoot, orch, runCmd } from '../acc8-f-lib.mjs';
import { driveRecovery } from './AC-01.mjs';

const CODE_DRIVER = path.join(REPO, 'test', 'fixtures', 'code-loop-driver.mjs');

export async function run() {
  const c = makeCase('AC-10', { scenario: 'recovery-summary-once', title: '恢复摘要一行说清「从哪来、跳过多少、第几轮」' });
  const root = freshRoot('AC-10');
  const plainRoot = freshRoot('AC-10-plain');
  c.root = root;
  try {
    const d = await driveRecovery(root, 2500);
    evidence(c, 'given', 'recovery.json', JSON.stringify(
      { ok: d.ok, kill: d.kill, boots: d.boots, recoveryStatus: d.status }, null, 2));
    check(c, 'Given：恢复现场构造成功（recoveredAt 落盘）', d.ok === true,
      JSON.stringify({ kill: d.kill, boots: d.boots }));

    const status = orch(root, ['status', '--instance', 'INST-001']);
    const graphT = orch(root, ['instance', 'graph', '--instance', 'INST-001', '--format', 'text']);
    evidence(c, 'then', 'recovery-status.txt', status.stdout);
    evidence(c, 'then', 'recovery-graph.txt', graphT.stdout);
    const line = (status.stdout.match(/恢复：检查点[^\n]*/) || [])[0] || '';
    check(c, 'Then：恢复行含来源/跳过数/轮次四要素', /^恢复：检查点 \d{2}:\d{2}:\d{2} · 跳过 \d+ 个已完成节点 · 轮次 \d+\/\d+$/.test(line), line);
    eq(c, '机检：该行在 status --instance 中只出现 1 次', (status.stdout.match(/恢复：检查点/g) || []).length, 1);
    includes(c, '机检：graph --format text 顶部同样有一行', graphT.stdout, '恢复：检查点');
    eq(c, '机检：graph 中该行也只出现 1 次', (graphT.stdout.match(/恢复：检查点/g) || []).length, 1);
    const graphLine = (graphT.stdout.match(/恢复：检查点[^\n]*/) || [])[0] || '';
    eq(c, 'graph 与 status 的恢复行逐字一致', graphLine, line);

    // 对照组：独立 root、非恢复实例
    const cwd = path.join(plainRoot, 'demo-code-pass');
    fs.mkdirSync(cwd, { recursive: true });
    runCmd([NODE, CODE_DRIVER, '--root', plainRoot, '--scenario', 'pass', '--cwd', cwd, '--prepare-only'], { cwd: REPO, env: baseEnv() });
    const run = runCmd([NODE, ORCH_BIN, 'run', '--cwd', cwd,
      '--task', '给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js',
      '--template', 'code-loop', '--host', 'mock'], { cwd: plainRoot, env: baseEnv(), timeout: 120_000 });
    const plainStatus = orch(plainRoot, ['status', '--instance', 'INST-001']);
    const plainGraph = orch(plainRoot, ['instance', 'graph', '--instance', 'INST-001', '--format', 'text']);
    evidence(c, 'then', 'plain-status.txt', plainStatus.stdout);
    evidence(c, 'then', 'plain-graph.txt', plainGraph.stdout);
    evidence(c, 'given', 'plain-run.txt', `exit=${run.exitCode}\n${run.stdout.slice(-800)}`);
    excludes(c, '机检：非恢复实例 status 不出现恢复行', plainStatus.stdout, '恢复：检查点');
    excludes(c, '机检：非恢复实例 graph 不出现恢复行', plainGraph.stdout, '恢复：检查点');
    check(c, '对照组实例确实是非恢复（无 recoveredAt 恢复行）',
      !/恢复：检查点/.test(plainStatus.stdout) && !/恢复：检查点/.test(plainGraph.stdout), '两处均无');
    note(c, '恢复摘要时间/数量/轮次取实际值（本机为 轮次 2/2），需求示例「轮次 2/3」未硬编码。');
    try { orch(root, ['core', 'stop']); } catch { /* 清理 */ }
    try { orch(plainRoot, ['core', 'stop']); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root); cleanupRoot(plainRoot);
  }
  return finish(c);
}
