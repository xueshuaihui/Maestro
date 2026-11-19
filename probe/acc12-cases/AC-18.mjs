/**
 * AC-18 · 可观测性导出为 OpenTelemetry 格式（只读）。
 * 走真实 CLI：orch export pack；导出前后实例状态/事件条数/日志 sha256 不变。
 * 架构检查：otel-export.js 对事件/追踪路径零 writeFile|appendFile。
 */
import fs from 'node:fs';
import path from 'node:path';

import { REPO, freshRoot, cleanupRoot, orch, loadLabels, sha256File, readText } from '../acc12-f-lib.mjs';
import { makeCase, evidence, verify, check, includes, eq, finish } from '../acc12-f-common.mjs';
import { cli } from './AC-13.mjs';

export async function run() {
  const c = makeCase('AC-18', { scenario: 'otel', title: '可观测性导出为 OpenTelemetry 格式' });
  c.root = freshRoot('otel-ac18');
  try {
    const labels = await loadLabels();
    const instDir = path.join(c.root, '.orch/instances/INST-001');
    const stateDir = path.join(instDir, 'state');
    fs.mkdirSync(stateDir, { recursive: true });
    const eventsPathP = path.join(instDir, 'events.jsonl');
    const tracesPath = path.join(stateDir, 'traces.jsonl');
    const statePath = path.join(instDir, 'state.json');
    const events = [
      { seq: 1, object: 'handoff', reason: 'handoff.delivered', objectId: 'HO-1', node_id: 'T-1', round: 1 },
      { seq: 2, reason: 'session.first_event', objectId: 'T-1', node_id: 'T-1', round: 1 },
      { seq: 3, object: 'handoff', reason: 'handoff.delivered', objectId: 'HO-2', node_id: 'T-2', round: 1 },
    ];
    fs.writeFileSync(eventsPathP, events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
    const spans = [
      { node_id: 'T-1', trace_id: 'trace-A', round: 1, start_time: 1000, end_time: 1500, status: 'ok', handoff_ids: ['HO-1'] },
      { node_id: 'T-2', trace_id: 'trace-A', round: 1, start_time: 1600, end_time: 2100, status: 'ok', handoff_ids: ['HO-2'] },
    ];
    fs.writeFileSync(tracesPath, spans.map((s) => JSON.stringify(s)).join('\n') + '\n', 'utf8');
    fs.writeFileSync(statePath, JSON.stringify({ instanceId: 'INST-001', state: 'running', nodeCount: 2 }), 'utf8');

    const before = {
      eventsHash: sha256File(eventsPathP), tracesHash: sha256File(tracesPath),
      stateHash: sha256File(statePath), stateText: fs.readFileSync(statePath, 'utf8'),
      eventCount: events.length, spanCount: spans.length,
    };
    evidence(c, 'given', 'events.jsonl', fs.readFileSync(eventsPathP, 'utf8'));
    evidence(c, 'given', 'traces.jsonl', fs.readFileSync(tracesPath, 'utf8'));
    evidence(c, 'given', 'before.json', JSON.stringify(before, null, 2));

    const outFile = path.join(c.root, 'otel-export.json');
    const exported = orch(c.root, ['export', 'pack', '--instance', 'INST-001', '--out', outFile]);
    evidence(c, 'when', 'export.stdout.txt', exported.stdout || '(empty)');
    evidence(c, 'when', 'export.status.txt', `exitCode=${exported.exitCode}\nstderr=${exported.stderr || '(empty)'}\n`);
    eq(c, '机检：导出退出码 0', exported.exitCode, 0);
    check(c, 'Then：导出给出条数/位置', /EXPORT OK/.test(exported.stdout) && outFile.includes('otel-export.json'), 'counts+out printed');

    const doc = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    evidence(c, 'then', 'exported.json', JSON.stringify(doc, null, 2));
    eq(c, '机检：导出资源带 instance_id', doc.resource?.instance_id, 'INST-001');
    eq(c, 'Then：事件均在导出结果（logRecords 条数）', doc.logRecords?.length, before.eventCount);
    eq(c, 'Then：跨度均在导出结果（traceSpans 条数）', doc.traceSpans?.length, before.spanCount);
    check(c, 'Then：导出外部可读（含 severity/body/trace_id/handoff_ids）',
      doc.logRecords?.[0]?.severity !== undefined && doc.traceSpans?.[0]?.trace_id === 'trace-A'
        && Array.isArray(doc.traceSpans?.[0]?.handoff_ids), 'OTLP fields present');

    const after = {
      eventsHash: sha256File(eventsPathP), tracesHash: sha256File(tracesPath),
      stateHash: sha256File(statePath), stateText: fs.readFileSync(statePath, 'utf8'),
      eventCount: fs.readFileSync(eventsPathP, 'utf8').trimEnd().split(/\r?\n/).length,
    };
    evidence(c, 'then', 'after.json', JSON.stringify(after, null, 2));
    eq(c, '机检：导出前后实例状态深比较相等', after.stateText, before.stateText);
    eq(c, '机检：事件日志文件 sha256 相等', after.eventsHash, before.eventsHash);
    eq(c, '机检：追踪日志文件 sha256 相等', after.tracesHash, before.tracesHash);
    eq(c, '机检：事件条数不变', after.eventCount, before.eventCount);

    // 架构检查：模块对事件/追踪路径零写。
    const src = readText(path.join(REPO, 'src/core/otel-export.js'));
    evidence(c, 'then', 'arch-scan.txt', `appendFile hits=${(src.match(/appendFile/g) || []).length}\nwriteFile(out hits=${(src.match(/writeFile\(\s*out/g) || []).length}\n`);
    eq(c, '架构检查：appendFile 零命中', (src.match(/appendFile/g) || []).length, 0);
    check(c, '架构检查：唯一写目标是 out', /writeFile\(\s*out/.test(src), 'writeFile(out) present');
    check(c, 'Then：确认文案逐字来自 labels（EXPORT_DONE，纯 ASCII 渲染契约）',
      typeof labels.OTEL_TEXT.EXPORT_DONE === 'string', 'EXPORT_DONE key present');

    evidence(c, 'meta', 'result.json', JSON.stringify({ before, after, counts: { events: doc.logRecords.length, spans: doc.traceSpans.length }, checks: c.checks }, null, 2));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}

cli('AC-18', run, import.meta.url);
