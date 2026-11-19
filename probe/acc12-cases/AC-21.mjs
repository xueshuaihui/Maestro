/**
 * AC-21 · 真实宿主性能证据分级（留本机）。裁决 A 第 3 条 / 483 行契约 / 484 行锚点。
 * 当前环境无 DSH 0.2.2-rc.1 真实宿主面 → 判「阻塞」，附 triedPaths；
 * 不得用 mock 顶替、不得伪通过。证据级别 PERF_LEVEL_PENDING / blocked:true。
 */
import fs from 'node:fs';
import path from 'node:path';

import { REPO, freshRoot, cleanupRoot, loadLabels } from '../acc12-f-lib.mjs';
import { makeCase, evidence, block, includes, eq, verify, finish } from '../acc12-f-common.mjs';
import { buildPerfReport, PERF_LEVELS, PERF_TARGETS } from '../../src/core/perf-baseline.js';
import { cli } from './AC-13.mjs';

export async function run() {
  const c = makeCase('AC-21', { scenario: 'perf-real', title: '真实宿主性能证据分级（留本机）' });
  c.root = freshRoot('perf-real-ac21');
  try {
    const labels = await loadLabels();

    // 尝试探测本机真实宿主面（不访问用户 ~/.dsh，不伪造取证）。
    const triedPaths = [];
    const candidates = [
      process.env.MAESTRO_DSH_EXE || '', process.env.MAESTRO_DSH_BIN || '',
      'C:/Program Files/DSH/dsh.exe', path.join(process.env.LOCALAPPDATA || '', 'DSH/dsh.exe'),
      path.join(process.env.HOME || '', '.dsh/bin/dsh'),
    ].filter(Boolean);
    for (const p of candidates) {
      const exists = (() => { try { fs.accessSync(p); return true; } catch { return false; } })();
      triedPaths.push({ path: p, exists });
    }
    triedPaths.push({ path: 'env:MAESTRO_DSH_EXE/MAESTRO_DSH_BIN', set: Boolean(process.env.MAESTRO_DSH_EXE || process.env.MAESTRO_DSH_BIN) });
    triedPaths.push({ path: '本机真实宿主 20 实例/50 会话 handoff 取证', status: 'not_collected' });

    // 真实宿主面未取证 → 报告级别为 PENDING，blocked=true。
    const report = buildPerfReport({ samples: [], evidenceLevel: PERF_LEVELS.pending, target: PERF_TARGETS });
    const perfCheck = {
      ac: 'AC-21',
      level: report.level,                 // PERF_LEVEL_PENDING
      levelLabel: labels[report.level],    // 待本机实测（逐字来自 labels）
      blocked: report.blocked,             // true
      ok: report.ok,
      realHostCollected: false,
      triedPaths,
      note: '真实宿主面未取证 → 判阻塞、不得用 mock 顶替、不得伪通过（裁决 A 第 3 条 / 483 行契约 / 484 行锚点）',
      ts: new Date().toISOString(),
    };
    // 任务指定证据文件名：AC-21.perf-check.stdout.json
    evidence(c, 'perf-check', 'stdout.json', JSON.stringify(perfCheck, null, 2));
    evidence(c, 'given', 'contract.json', [
      'Then 目标值（不变）：handoff <2s / ≥20 并发',
      '证据状态契约：真实宿主面未取证 → 阻塞 + 试过路径；不得 mock 顶替/伪通过',
      `机检锚点：证据级别 ${PERF_LEVELS.pending}（待本机实测）→ 阻塞`,
    ].join('\n'));

    eq(c, '报告级别 = PERF_LEVEL_PENDING（未取证）', report.level, PERF_LEVELS.pending);
    eq(c, 'blocked = true', report.blocked, true);
    includes(c, '级别中文逐字 = labels 待本机实测', labels[report.level], '待本机实测');
    eq(c, 'mock 结果未进入真实宿主判据（realHostCollected=false）', perfCheck.realHostCollected, false);
    verify(c, '附试过路径（triedPaths 非空）', triedPaths.length, (n) => n > 0, '> 0');

    evidence(c, 'meta', 'result.json', JSON.stringify({ perfCheck, report, checks: c.checks }, null, 2));
    evidence(c, 'summary', 'status.txt', [
      'AC-21 → 阻塞（真实宿主面未取证，不算失败）',
      `level=${report.level}/${labels[report.level]}`,
      `blocked=${report.blocked}`,
      '出口：裁决 A 第 3 条 / 483 行契约 / 484 行阻塞出口锚点',
      '不得用 AC-20 的 mock 实测顶替、不得伪通过',
    ].join('\n'));

    block(c, '真实宿主（DSH 0.2.2-rc.1）性能面本机未取证：level=PERF_LEVEL_PENDING、blocked=true；'
      + '按裁决 A 第 3 条判阻塞（不算失败），不得用 AC-20 的 mock 实测顶替、不得伪通过；'
      + '需主控安排本机取证窗口后补采 20 实例/50 会话 handoff。');
    const done = finish(c);
    done.grading = '阻塞';
    return done;
  } finally {
    cleanupRoot(c.root);
  }
}

cli('AC-21', run, import.meta.url);
