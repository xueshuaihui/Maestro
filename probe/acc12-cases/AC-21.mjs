/**
 * AC-21 · 真实宿主性能证据分级（留本机）。裁决 A 第 3 条 / 483 行契约 / 484 行锚点。
 *
 * 取证来源修正（用户 2026-11-21 书面裁决：跑满 20/50 真实取证解除阻塞）：
 *  - 不再硬编码 samples:[] + PERF_LEVEL_PENDING；改为读正式取证帧
 *    docs/iterations/iteration-12/evidence/AC-21.perf-real-50-20.json 的真实样本与级别，
 *    经产品 buildPerfReport / statsOf 复算。
 *  - 阻塞出口逻辑保留：帧缺失 / 级别 pending / 不达标（实例<20、会话<50、p95>=2s、
 *    归属串台、error）→ 仍判阻塞，不得 mock 顶替、不得伪通过。
 *  - 全部新证据写入独立证据根（默认 evidence/acc21-real/，可用 ACC12_EVID_ROOT 覆盖），
 *    不覆盖 S3 冻结的 4 份 v3 阻塞帧，也不改 probe/acc12-f-results-b.jsonl 的旧 AC-21 行。
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  freshRoot, cleanupRoot, loadLabels, EVID, readJson, ensureDir, writeText, sha256,
  acBlockFromRequirement,
} from '../acc12-f-lib.mjs';
import { makeCase, block, eq, verify, check, finish, snap } from '../acc12-f-common.mjs';
import { buildPerfReport, statsOf, PERF_LEVELS, PERF_TARGETS } from '../../src/core/perf-baseline.js';
import { isMain } from './AC-13.mjs';

const REAL_FRAME = path.join(EVID, 'AC-21.perf-real-50-20.json');
const REAL_EVID = process.env.ACC12_EVID_ROOT
  ? path.resolve(process.env.ACC12_EVID_ROOT)
  : path.join(EVID, 'acc21-real');

/** 落证据到独立根（不写 EVID 顶层，避免覆盖冻结的 v3 帧）。 */
function realEvidence(c, phase, type, content) {
  ensureDir(REAL_EVID);
  const file = path.join(REAL_EVID, `${c.ac}.${phase}.${type}`);
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : String(content ?? '');
  if (!text.length) throw new Error(`realEvidence: empty evidence ${file}`);
  writeText(file, text);
  const item = { file, bytes: Buffer.byteLength(text, 'utf8'), sha256: sha256(text) };
  c.evidence.push(item);
  return item;
}

/** 核对表写到独立证据根，不覆盖 probe/acc12-f-parts/AC-21.md。 */
function writeRealChecklist(c) {
  ensureDir(REAL_EVID);
  const rows = c.checks.map((item) =>
    `| ${item.id} | ${item.label} | \`${item.expected}\` | \`${item.actual}\` | ${item.ok ? '✓' : '✗'} |`
  ).join('\n');
  const evRows = c.evidence.map((item) =>
    `- \`${item.file}\`（${item.bytes} bytes, sha256 \`${item.sha256}\`）`
  ).join('\n');
  const noteRows = c.notes.map((n) => `- ${n}`).join('\n') || '- （无）';
  const rec = c.snapshots.recomputed || {};
  const md = [
    `# ${c.ac} · ${c.title}（真实宿主重判 · 独立证据根）`,
    '',
    `- 判定：**${c.verdict}**`,
    `- 证据分级：**${c.grading}**`,
    `- 独立证据根：\`${REAL_EVID}\``,
    `- 取证来源帧：\`${REAL_FRAME}\`（sha256 \`${c.snapshots.sourceFrameSha256 || 'N/A'}\`）`,
    `- 核对项：${c.checksPassed}/${c.checksTotal} 通过，${c.checksFailed} 未通过`,
    `- 起止：${c.startedAt} → ${c.endedAt}`,
    '',
    '## 复算摘要',
    '',
    `- 取证宿主：${c.snapshots.hostVersion || 'N/A'}（source=${c.snapshots.hostDiscoverySource || 'N/A'}）`,
    `- 原始帧会话 ${rec.sessionsCount ?? 'N/A'} 条 / 产品样本 ${rec.samplesCount ?? 'N/A'} 条`,
    `- 级别 ${rec.level ?? 'N/A'} / blocked=${rec.blocked ?? 'N/A'} / ok=${rec.ok ?? 'N/A'} / bottleneck=${rec.bottleneck ?? 'N/A'}`,
    `- distinctInstances=${rec.distinctInstances ?? 'N/A'} / distinctSessions=${rec.distinctSessions ?? 'N/A'}`,
    `- stats(median/p95/max)=${rec.median ?? 'N/A'} / ${rec.p95 ?? 'N/A'} / ${rec.max ?? 'N/A'} ms`,
    `- 归属串台=${rec.attributionMismatch ?? 'N/A'} / error=${rec.errorCount ?? 'N/A'} / latency 不一致=${rec.latencyMismatch ?? 'N/A'}`,
    '',
    '## 核对项',
    '',
    '| ID | 核对点 | 期望值（逐字） | 实测值 | 结果 |',
    '|---|---|---|---|---|',
    rows || '| — | — | — | — | — |',
    '',
    '## 原始证据',
    '',
    evRows || '- （无）',
    '',
    '## 备注',
    '',
    noteRows,
    '',
    '<details><summary>需求 AC 原文（from requirement.md）</summary>',
    '',
    '```text',
    acBlockFromRequirement(c.ac),
    '```',
    '',
    '</details>',
    '',
  ].join('\n');
  const file = path.join(REAL_EVID, `${c.ac}.checklist.md`);
  writeText(file, md);
  c.part = file;
  return file;
}

/** 新证据根内的重判结果行；格式参照 acc12-f-results-b.jsonl 的 AC-21 行。 */
function writeRealResult(c) {
  ensureDir(REAL_EVID);
  const record = {
    ac: c.ac,
    batch: 'b-reverify',
    title: c.title,
    scenario: c.scenario,
    verdict: c.verdict,
    grading: c.grading,
    checksTotal: c.checksTotal,
    checksPassed: c.checksPassed,
    checksFailed: c.checksFailed,
    failedChecks: c.checks.filter((item) => !item.ok).map((item) => ({
      id: item.id, label: item.label, expected: item.expected, actual: item.actual,
    })),
    evidenceFiles: c.evidence.map((item) => item.file),
    evidenceCount: c.evidence.length,
    evidenceRoot: REAL_EVID,
    sourceFrame: REAL_FRAME,
    sourceFrameSha256: c.snapshots.sourceFrameSha256 || null,
    blocker: c.blocker,
    notes: c.notes,
    root: c.root,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    part: c.part,
  };
  const file = path.join(REAL_EVID, 'results.jsonl');
  writeText(file, `${JSON.stringify(record)}\n`);
  return { file, record };
}

export async function run() {
  const c = makeCase('AC-21', { scenario: 'perf-real', title: '真实宿主性能证据分级（留本机）' });
  c.root = freshRoot('perf-real-ac21');
  try {
    const labels = await loadLabels();

    // 读正式取证帧（缺失即阻塞出口，不伪造样本）。
    const frameBuf = (() => { try { return fs.readFileSync(REAL_FRAME); } catch { return null; } })();
    const frame = frameBuf ? readJson(REAL_FRAME) : null;
    const frameSha = frameBuf ? sha256(frameBuf) : null;
    snap(c, 'sourceFrame', REAL_FRAME);
    snap(c, 'sourceFrameSha256', frameSha);
    snap(c, 'hostVersion', frame?.hostVersion ?? null);
    snap(c, 'hostDiscoverySource', frame?.hostDiscovery?.source ?? null);

    const sessions = frame?.sessions ?? [];
    const samples = frame?.samples ?? [];
    const levelFromFrame = frame?.summary?.perfLevel ?? PERF_LEVELS.pending;

    // 逐条复核归属与数值：raw 首事件 sessionId 必须等于该记录 sessionId；
    // latencyMs 必须与 firstEventMs 一致；无 error / -32603。
    let attributionMismatch = 0;
    let badFirstEventMs = 0;
    let latencyMismatch = 0;
    let errorCount = 0;
    let rpcErrorCount = 0;
    let nonUpdateFirst = 0;
    const bySession = new Map(samples.map((s) => [String(s.sessionId), s]));
    for (const r of sessions) {
      const rawSid = r.firstEventRaw?.params?.sessionId ?? r.firstEventRaw?.sessionId ?? null;
      if (String(rawSid) !== String(r.sessionId)) attributionMismatch += 1;
      if (!(Number.isFinite(r.firstEventMs) && r.firstEventMs >= 0)) badFirstEventMs += 1;
      if (r.firstEventRaw?.method !== 'session/update') nonUpdateFirst += 1;
      const s = bySession.get(String(r.sessionId));
      if (!s || s.latencyMs !== Math.round(r.firstEventMs)) latencyMismatch += 1;
      if (r.error) errorCount += 1;
      if (JSON.stringify(r.firstEventRaw ?? {}).includes('-32603')) rpcErrorCount += 1;
    }

    // 产品口径复算：statsOf + buildPerfReport（不自行实现分位数）。
    const stats = statsOf(samples.map((s) => Number(s.latencyMs)));
    const report = buildPerfReport({ samples, evidenceLevel: levelFromFrame, target: PERF_TARGETS });
    const distinctInstances = new Set(samples.map((s) => s.instanceId).filter(Boolean)).size;
    const distinctSessions = new Set(samples.map((s) => s.sessionId).filter(Boolean)).size;
    const recomputed = {
      sessionsCount: sessions.length,
      samplesCount: samples.length,
      level: report.level,
      blocked: report.blocked,
      ok: report.ok,
      bottleneck: report.bottleneck,
      distinctInstances,
      distinctSessions,
      median: stats.median,
      p95: stats.p95,
      max: stats.max,
      attributionMismatch,
      errorCount,
      latencyMismatch,
    };
    snap(c, 'recomputed', recomputed);

    // 阻塞出口：帧缺失 / 级别 pending / 不达标 → 仍阻塞；不删样本、不写伪通过。
    const collected = Boolean(frame)
      && levelFromFrame === PERF_LEVELS.real
      && report.level === PERF_LEVELS.real
      && report.ok === true
      && report.blocked === false
      && report.bottleneck === null
      && frame.conclusion === 'MEASURED_REAL_HOST'
      && frame.hostDiscovery?.ok === true
      && sessions.length >= PERF_TARGETS.activeSessions
      && distinctInstances >= PERF_TARGETS.concurrentInstances
      && distinctSessions >= PERF_TARGETS.activeSessions
      && attributionMismatch === 0 && badFirstEventMs === 0 && latencyMismatch === 0
      && errorCount === 0 && rpcErrorCount === 0 && nonUpdateFirst === 0
      && stats.p95 !== null && stats.p95 < PERF_TARGETS.handoffBudgetMs;
    if (!collected) {
      block(c, `真实宿主正式取证帧不满足达标条件（frame=${Boolean(frame)} level=${levelFromFrame} `
        + `blocked=${report.blocked} ok=${report.ok} instances=${distinctInstances} sessions=${distinctSessions} `
        + `p95=${stats.p95} mismatch=${attributionMismatch} errors=${errorCount}）；按 483 行契约判阻塞，`
        + '不得用 AC-20 的 mock 实测顶替、不得伪通过。');
    }

    // 机检核对项（比原 5 条更严：覆盖级别/阻塞/实例/会话/p95/归属/原始帧/无 error）。
    eq(c, '取证来源帧级别 = PERF_LEVEL_REAL', levelFromFrame, PERF_LEVELS.real);
    eq(c, '产品 buildPerfReport 复算级别 = PERF_LEVEL_REAL', report.level, PERF_LEVELS.real);
    eq(c, 'blocked = false', report.blocked, false);
    eq(c, '报告 ok = true（无瓶颈）', report.ok, true);
    eq(c, 'bottleneck = null', report.bottleneck, null);
    verify(c, 'distinctInstances ≥ 20', distinctInstances,
      (n) => n >= PERF_TARGETS.concurrentInstances, '>= 20');
    verify(c, 'distinctSessions ≥ 50', distinctSessions,
      (n) => n >= PERF_TARGETS.activeSessions, '>= 50');
    verify(c, 'p95 < 2000ms（D-11 建议分位）', stats.p95,
      (v) => Number.isFinite(v) && v < PERF_TARGETS.handoffBudgetMs, '< 2000');
    check(c, '报告含逐档延迟数据（median/p95/max 均有限）',
      Number.isFinite(stats.median) && Number.isFinite(stats.p95) && Number.isFinite(stats.max),
      'median/p95/max finite');
    eq(c, '归属 0 串台（raw 首事件 sessionId 与记录一致）', attributionMismatch, 0);
    eq(c, '原始取证帧会话记录 50 条', sessions.length, PERF_TARGETS.activeSessions);
    eq(c, '产品样本 50 条', samples.length, PERF_TARGETS.activeSessions);
    eq(c, '无 error / -32603', errorCount + rpcErrorCount, 0);
    eq(c, '每条 firstEventMs 有限且 ≥ 0', badFirstEventMs, 0);
    eq(c, '每条 latencyMs 与 firstEventMs 一致', latencyMismatch, 0);
    eq(c, '每条首事件均为 session/update（可归属）', nonUpdateFirst, 0);
    eq(c, 'mock 级别未顶替真实宿主级别', report.level === PERF_LEVELS.mock, false);
    check(c, 'mock 与真实宿主中文级别逐字不混用',
      labels[PERF_LEVELS.mock] !== labels[PERF_LEVELS.real],
      `${labels[PERF_LEVELS.mock]} != ${labels[PERF_LEVELS.real]}`);
    eq(c, '级别中文逐字取 labels 真实宿主值', labels[report.level], labels[PERF_LEVELS.real]);
    eq(c, '帧结论 = MEASURED_REAL_HOST', frame?.conclusion ?? null, 'MEASURED_REAL_HOST');
    eq(c, '宿主发现走产品发现逻辑（source=default）', frame?.hostDiscovery?.source ?? null, 'default');

    const perfCheck = {
      ac: 'AC-21',
      level: report.level,
      levelLabel: labels[report.level],
      blocked: report.blocked,
      ok: report.ok,
      bottleneck: report.bottleneck,
      realHostCollected: collected,
      sourceFrame: REAL_FRAME,
      sourceFrameSha256: frameSha,
      hostVersion: frame?.hostVersion ?? null,
      sessionsCount: sessions.length,
      samplesCount: samples.length,
      distinctInstances,
      distinctSessions,
      stats,
      attributionMismatch,
      errorCount,
      rpcErrorCount,
      latencyMismatch,
      mockLevel: PERF_LEVELS.mock,
      mockLevelLabel: labels[PERF_LEVELS.mock],
      triedPaths: [
        ...['C:/Program Files/DSH/dsh.exe',
          path.join(process.env.LOCALAPPDATA || '', 'DSH/dsh.exe'),
          path.join(process.env.HOME || '', '.dsh/bin/dsh')].map((p) => {
          let exists = false;
          try { fs.accessSync(p); exists = true; } catch { /* absent */ }
          return { path: p, exists };
        }),
        { path: 'env:MAESTRO_DSH_EXE/MAESTRO_DSH_BIN', set: Boolean(process.env.MAESTRO_DSH_EXE || process.env.MAESTRO_DSH_BIN) },
        { path: REAL_FRAME, status: frame ? 'collected' : 'missing' },
      ],
      note: '用户 2026-11-21 书面裁决：跑满 20/50 真实取证解除阻塞；帧缺失/级别 pending/不达标仍判阻塞，'
        + '不得 mock 顶替、不得伪通过（裁决 A 第 3 条 / 483 行契约 / 484 行锚点）',
      ts: new Date().toISOString(),
    };

    realEvidence(c, 'perf-check', 'stdout.json', JSON.stringify(perfCheck, null, 2));
    realEvidence(c, 'given', 'contract.json', [
      'Then 目标值（不变）：handoff <2s / ≥20 并发',
      '证据状态契约：真实宿主面未取证 → 阻塞 + 试过路径；不得 mock 顶替/伪通过',
      `机检锚点：证据级别 ${PERF_LEVELS.pending}（待本机实测）→ 阻塞`,
      `重判锚点：证据级别 ${PERF_LEVELS.real}（已实测（真实宿主面））→ 解除阻塞`,
      `负载口径（D-11）：${PERF_TARGETS.concurrentInstances} 实例 / ${PERF_TARGETS.activeSessions} 会话 / p95 < ${PERF_TARGETS.handoffBudgetMs}ms`,
    ].join('\n'));

    realEvidence(c, 'meta', 'result.json', JSON.stringify({
      perfCheck, report, sourceFrame: REAL_FRAME, sourceFrameSha256: frameSha,
      recomputed, checks: c.checks,
    }, null, 2));
    realEvidence(c, 'summary', 'status.txt', [
      `AC-21 → ${collected ? '通过' : '阻塞'}（真实宿主面${collected ? '已取证' : '未取证'}，不算失败）`,
      `level=${report.level}/${labels[report.level]}`,
      `blocked=${report.blocked} ok=${report.ok} bottleneck=${report.bottleneck}`,
      `instances=${distinctInstances} sessions=${distinctSessions} p95=${stats.p95}ms`,
      `mismatch=${attributionMismatch} error=${errorCount} samples=${samples.length}`,
      `出口：裁决 A 第 3 条 / 483 行契约 / 484 行阻塞出口锚点 / 用户 2026-11-21 书面裁决`,
      '不得用 AC-20 的 mock 实测顶替、不得伪通过；新证据独立于 S3 冻结的 4 份 v3 帧',
    ].join('\n'));

    const done = finish(c);
    done.grading = collected ? labels[PERF_LEVELS.real] : '阻塞';
    return done;
  } finally {
    cleanupRoot(c.root);
  }
}

async function reverifyMain() {
  const started = Date.now();
  let c;
  try {
    c = await run();
  } catch (err) {
    c = makeCase('AC-21', { scenario: 'perf-real', title: '真实宿主性能证据分级（留本机）' });
    block(c, `用例执行异常：${err?.message || String(err)}`);
    c = finish(c);
    try { realEvidence(c, 'error', 'stack.txt', String(err?.stack || err)); } catch { /* 不掩盖 */ }
  }
  c.durationMs = Date.now() - started;
  writeRealChecklist(c);
  writeRealResult(c);
  process.stdout.write(`${c.ac} → ${c.verdict}（核对 ${c.checksPassed ?? 0}/${c.checksTotal ?? 0}，`
    + `证据 ${c.evidence.length}，分级 ${c.grading}）\n`);
}

if (isMain(import.meta.url)) {
  reverifyMain().catch((err) => {
    process.stderr.write(`AC-21 reverify runner failed: ${err?.stack || err}\n`);
    process.exitCode = 1;
  });
}
