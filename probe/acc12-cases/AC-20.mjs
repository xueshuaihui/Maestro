/**
 * AC-20 · 性能基线 mock 压测达标，证据分级 `mock 实测`（不碰 ~/.dsh）。
 * 用 collectHandoffLatency/buildPerfReport 真实计算 20 实例 / 50 会话样本。
 */
import path from 'node:path';

import { freshRoot, cleanupRoot, loadLabels } from '../acc12-f-lib.mjs';
import { makeCase, evidence, verify, check, includes, eq, finish } from '../acc12-f-common.mjs';
import {
  collectHandoffLatency, buildPerfReport, statsOf,
  PERF_LEVELS, PERF_TARGETS, PERF_BOTTLENECKS,
} from '../../src/core/perf-baseline.js';
import { cli } from './AC-13.mjs';

/** 构造 20 实例 / 50 会话的 mock 交接事件与首事件（墙钟 ms）。 */
function buildMockEvents() {
  const events = [];
  const base = Date.UTC(2026, 0, 1, 0, 0, 0);
  for (let i = 0; i < 50; i += 1) {
    const instanceId = `INST-${String((i % 20) + 1).padStart(3, '0')}`;
    const sessionId = `SES-${String(i + 1).padStart(3, '0')}`;
    const handoffId = `HO-${String(i + 1).padStart(3, '0')}`;
    const deliveredAt = base + i * 100;
    const latency = 400 + (i % 17) * 20; // 400..720 ms，< 2000
    events.push({ reason: 'handoff.delivered', ts: deliveredAt, instanceId, sessionId, objectId: handoffId, round: 1 });
    events.push({ reason: 'session.first_event', ts: deliveredAt + latency, instanceId, sessionId, objectId: `T-${i}`, round: 1 });
  }
  return events;
}

export async function run() {
  const c = makeCase('AC-20', { scenario: 'perf-mock', title: '性能基线 mock 压测达标（mock 实测）' });
  c.root = freshRoot('perf-mock-ac20');
  try {
    const labels = await loadLabels();
    const events = buildMockEvents();
    evidence(c, 'given', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));

    const { samples, stats } = collectHandoffLatency({ events, spans: [], round: 1 });
    evidence(c, 'when', 'samples.json', JSON.stringify(samples, null, 2));
    const instances = new Set(samples.map((s) => s.instanceId)).size;
    const sessions = new Set(samples.map((s) => s.sessionId)).size;
    eq(c, '机检：并发实例数 = 20', instances, 20);
    verify(c, '机检：活跃会话数 ≥ 50', sessions, (n) => n >= 50, '>= 50');
    verify(c, '机检：handoff 延迟统计 < 2s（P95）', stats.p95, (n) => n !== null && n < 2000, '< 2000');

    const report = buildPerfReport({ samples, evidenceLevel: PERF_LEVELS.mock, target: PERF_TARGETS });
    evidence(c, 'then', 'report.json', JSON.stringify(report, null, 2));
    verify(c, 'Then：mock 报告达标（ok=true）', report.ok, (x) => x === true, 'ok === true');
    eq(c, 'Then：证据级别 = mock 机检键', report.level, PERF_LEVELS.mock);
    eq(c, 'Then：mock 面不阻塞', report.blocked, false);
    eq(c, 'Then：无瓶颈', report.bottleneck, null);

    // 逐档数据：中位 / P95 / 最大，且级别中文逐字来自 labels。
    const levelLabel = labels[PERF_LEVEL_LABEL_KEYS_KEY(report.level)];
    evidence(c, 'then', 'tiers.txt', [
      `median=${report.stats.median}`, `p95=${report.stats.p95}`, `max=${report.stats.max}`,
      `evidenceLevelKey=${report.level}`, `evidenceLevelLabel=${levelLabel}`,
      `瓶颈点=${report.bottleneck ?? '无'}`,
    ].join('\n'));
    check(c, 'Then：报告含逐档延迟数据（中位/P95/最大）',
      report.stats.median !== null && report.stats.p95 !== null && report.stats.max !== null, 'tiers present');
    check(c, '机检：未达标时才有瓶颈点（本例达标，瓶颈为空或仅提示）',
      report.bottleneck === null || typeof report.bottleneck === 'string', 'bottleneck field present');
    includes(c, 'Then：证据级别中文逐字 = labels 的 mock 实测', levelLabel, 'mock 实测');
    check(c, 'Then：不标注为真实宿主达标', report.level !== PERF_LEVELS.real && report.level !== '已实测（真实宿主面）', 'not real');

    // 不碰用户 ~/.dsh：夹具在 %TEMP%，且本用例无宿主访问调用。
    check(c, '架构检查：压测不接真实宿主、不碰 ~/.dsh', c.root.includes('maestro-i112-perf-mock'), 'fixture under TEMP');

    evidence(c, 'summary', 'status.txt', [
      `verdict=${c.verdict || 'pending'}`, `level=${report.level}/${levelLabel}`,
      `instances=${instances}`, `sessions=${sessions}`,
      `median=${report.stats.median}`, `p95=${report.stats.p95}`, `max=${report.stats.max}`,
    ].join('\n'));
    evidence(c, 'meta', 'result.json', JSON.stringify({
      instances, sessions, stats, report, samplesCount: samples.length, checks: c.checks,
    }, null, 2));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}

// perf-baseline 的机检键与 labels 键名一致（PERF_LEVEL_*.mjs）；这里从报告 level 反查 labels。
function PERF_LEVEL_LABEL_KEYS_KEY(level) {
  return level; // PERF_LEVEL_MOCK / PERF_LEVEL_REAL / PERF_LEVEL_PENDING 同名导出于 labels.js
}

cli('AC-20', run, import.meta.url);
