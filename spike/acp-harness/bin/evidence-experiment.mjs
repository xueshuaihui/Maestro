#!/usr/bin/env node
/**
 * VP-4 实验：非编码场景（撰写 → 审核）真实跑一轮，录制 raw session/update，
 * 尝试构造 Evidence 并逐字段标注来源。
 *
 *   node bin/evidence-experiment.mjs --host=mock-stdio
 *
 * 关键边界：本实验只验证「引用可否构造」，不验证真实性；
 * 但会额外做一件核心能做的事——用本地文件重算 sha256，检验「agent 声明的指纹是否可核对」。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
const hostName = argv.host ?? 'mock-stdio';
const runId = argv.run ?? `vp4/${hostName}`;
const runDir = path.resolve(WORKSPACE, '.orch-spike/runs', runId);
const cwd = path.join(runDir, 'workspace');
fs.mkdirSync(cwd, { recursive: true });

const raw = JSON.parse(fs.readFileSync(path.join(SPIKE, 'acp-harness/hosts', `${hostName}.json`), 'utf8'));
const host = loadHostConfig(raw, { SPIKE, WORKSPACE, RUN_DIR: runDir, SESSION_ID: `vp4-${Date.now()}` });

const { transport, stop } = await createTransport(host, { recorder: null });
const recorder = new FrameRecorder({ dir: runDir, runId, transport: transport.kind });
transport.recorder = recorder;
await transport.connect();

const client = new AcpClient(transport, { recorder });
await client.initialize({ name: 'maestro-evidence', version: '0.1.0' });

// 阶段一：撰写角色
const writer = await client.newSession(cwd, []);
const writerUpdates = [];
const offW = client.onUpdate((u) => writerUpdates.push(u));
const t1 = await client.prompt(writer.id, 'EVIDENCE: 撰写一份 200 字产品说明，输出到 artifacts/docs/draft.md');
offW();

const afterWrite = buildEvidence(writerUpdates);

// 阶段二：审核角色
const reviewer = await client.newSession(cwd, []);
const reviewerUpdates = [];
const offR = client.onUpdate((u) => reviewerUpdates.push(u));
const t2 = await client.prompt(reviewer.id, `REVIEW: 请审核 ${afterWrite.evidence.artifactRef ?? 'artifacts/docs/draft.md'}`);
offR();

const combined = buildEvidence([...writerUpdates, ...reviewerUpdates]);

// 核心可独立核对的项：文件存在性 + 指纹
let integrity = { fileExists: false, recomputed: null, matchesDeclared: null };
if (combined.evidence.artifactRef) {
  try {
    const buf = fs.readFileSync(combined.evidence.artifactRef);
    integrity.fileExists = true;
    integrity.recomputed = `sha256:${crypto.createHash('sha256').update(buf).digest('hex')}`;
    integrity.matchesDeclared = integrity.recomputed === combined.evidence.fingerprint;
    integrity.bytes = buf.length;
  } catch (err) {
    integrity.readError = err.message;
  }
}

const report = {
  runId,
  host: hostName,
  evidenceSource: host.evidence ?? 'real',
  turns: {
    writer: { stopReason: t1.stopReason, updates: writerUpdates.length },
    reviewer: { stopReason: t2.stopReason, updates: reviewerUpdates.length },
  },
  fieldSources: {
    artifactRef: afterWrite.sources.artifactRef,
    fingerprint: afterWrite.sources.fingerprint,
    producedAt: afterWrite.sources.producedAt,
    confirmedBy: combined.sources.confirmedBy,
    confirmedAt: combined.sources.confirmedAt,
  },
  evidence: combined.evidence,
  missingAfterWriter: afterWrite.missing,
  missingAfterReview: combined.missing,
  complete: isEvidenceComplete(combined),
  integrity,
  rawUpdateKinds: {
    writer: [...new Set(writerUpdates.map((u) => u.sessionUpdate))],
    reviewer: [...new Set(reviewerUpdates.map((u) => u.sessionUpdate))],
  },
  frames: recorder.file,
};

writeJson(path.join(runDir, 'evidence.json'), report);

// 原始帧样本：给出「一条 tool_call_update + 一条 agent_message_chunk」的样例
const frames = fs
  .readFileSync(recorder.file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((r) => r.dir === 'in' && r.method === 'session/update');
const sample = frames.filter((r) => ['tool_call_update', 'agent_message_chunk'].includes(r.frame?.params?.update?.sessionUpdate)).slice(-4);
writeJson(path.join(WORKSPACE, 'docs/iterations/iteration-0/evidence-samples/session-update-sample.json'), {
  note: 'VP-4 原始帧样本：tool_call_update（含 diff + rawOutput 指纹）与 agent_message_chunk（含机器可读审核清单）',
  source: { host: hostName, evidence: host.evidence ?? 'real', runId, frames: recorder.file },
  frames: sample,
});

process.stdout.write(JSON.stringify(report, null, 2) + '\n');
await client.close();
await stop();
recorder.close();
await stopAllServers();
process.exit(0);
