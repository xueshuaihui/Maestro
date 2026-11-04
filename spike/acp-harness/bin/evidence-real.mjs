#!/usr/bin/env node
/**
 * VP-4（真实宿主）：在真 DSH 上触发一次工具调用，录制真实 session/update，
 * 逐字段判断 Evidence 三要素能否构造。
 *
 * mock LLM 的 CALL_TOOL 脚本会发起 bash 工具调用（dsh-acp-server 官方 e2e 同款），
 * 因此这里拿到的是 DSH 真实的事件翻译结果，不是 mock 宿主的自造字段。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTransport, loadHostConfig, stopAllServers } from '../src/transport-factory.mjs';
import { FrameRecorder, writeJson } from '../src/recorder.mjs';
import { AcpClient } from '../src/client.mjs';
import { buildEvidence, isEvidenceComplete } from '../core/evidence.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPIKE = path.resolve(HERE, '../..');
const WORKSPACE = path.resolve(SPIKE, '..');
const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?([\s\S]*)$/);
    return [m[1], m[2] || 'true'];
  }),
);

const hostName = argv.host ?? 'dsh-real';
const runId = argv.run ?? `vp4/${hostName}-real`;
const runDir = path.resolve(WORKSPACE, '.orch-spike/runs', runId);
const cwd = path.join(runDir, 'workspace');
fs.mkdirSync(cwd, { recursive: true });

const raw = JSON.parse(fs.readFileSync(path.join(SPIKE, 'acp-harness/hosts', `${hostName}.json`), 'utf8'));
const host = loadHostConfig(raw, { SPIKE, WORKSPACE, RUN_DIR: runDir, SESSION_ID: `vp4r-${Date.now()}` });

const { transport, stop } = await createTransport(host, { recorder: null });
const recorder = new FrameRecorder({ dir: runDir, runId, transport: transport.kind });
transport.recorder = recorder;
await transport.connect();

const client = new AcpClient(transport, { recorder });
await client.initialize({ name: 'maestro-evidence', version: '0.1.0' });

const session = await client.newSession(cwd, []);
const updates = [];
client.onUpdate((u) => updates.push(u));

const result = await client.prompt(session.id, 'CALL_TOOL 请执行一次命令');

const toolCalls = updates.filter((u) => u.sessionUpdate === 'tool_call');
const toolUpdates = updates.filter((u) => u.sessionUpdate === 'tool_call_update');
const built = buildEvidence(updates);

const report = {
  runId,
  host: hostName,
  evidenceSource: 'real',
  stopReason: result.stopReason,
  updateKinds: [...new Set(updates.map((u) => u.sessionUpdate))],
  toolCallShape: toolCalls.map((t) => ({ keys: Object.keys(t), toolCallId: t.toolCallId, kind: t.kind, title: t.title, status: t.status })),
  toolUpdateShape: toolUpdates.map((t) => ({ keys: Object.keys(t), status: t.status, hasDiff: (t.content ?? []).some((c) => c.type === 'diff'), hasRawOutput: t.rawOutput !== undefined })),
  evidence: built.evidence,
  fieldSources: built.sources,
  missing: built.missing,
  complete: isEvidenceComplete(built),
  verdict: built.missing.length === 0 ? '可用' : '受限（需适配器/角色约定补充）',
  frames: recorder.file,
};

writeJson(path.join(runDir, 'evidence.json'), report);
process.stdout.write(JSON.stringify(report, null, 2) + '\n');

await client.close();
await stop();
recorder.close();
await stopAllServers();
process.exit(0);
