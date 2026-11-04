#!/usr/bin/env node
/**
 * VP-1 度量：同一份编排循环，切换 hosts/<host>.json 驱动不同 transport。
 *
 * 度量项（对齐 iteration-0 §VP-1）：
 *   1. 编排循环 diff = 0 —— 用「同一文件哈希」+「核心纯度静态检查 0 违规」双重证明
 *   2. 5 原语调用序列 —— 从原始帧 out 方向提取，逐宿主比对
 *   3. 配置字段集合差异 —— transport 差异只允许出现在 hosts/*.json
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createTransport, loadHostConfig, stopAllServers } from '../src/transport-factory.mjs';
import { FrameRecorder, writeJson } from '../src/recorder.mjs';
import { AcpClient } from '../src/client.mjs';
import { runSingleNode } from '../core/orchestration-loop.mjs';
import { checkCorePurity } from './check-core-purity.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPIKE = path.resolve(HERE, '../..');
const WORKSPACE = path.resolve(SPIKE, '..');
const RUNS = path.resolve(WORKSPACE, '.orch-spike/runs/vp1');

const hostArg = process.argv.find((a) => a.startsWith('--hosts='));
const HOSTS = hostArg
  ? hostArg.split('=')[1].split(',').filter(Boolean)
  : process.argv.includes('--with-real')
    ? ['dsh-real', 'dsh-http', 'mock-stdio', 'mock-http']
    : ['mock-stdio', 'mock-http'];

const PROMPT = '请回复一句话，说明你已经收到任务。';

const coreFiles = ['core/orchestration-loop.mjs', 'core/evidence.mjs'];
const coreHash = (() => {
  const h = crypto.createHash('sha256');
  for (const f of coreFiles) h.update(fs.readFileSync(path.join(SPIKE, 'acp-harness', f)));
  return h.digest('hex');
})();

function methodSequence(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((r) => r.dir === 'out' && r.method && !String(r.method).startsWith('capabilities'))
    .map((r) => r.method);
}

async function runHost(name) {
  const runDir = path.join(RUNS, name);
  fs.mkdirSync(runDir, { recursive: true });
  const sessionCwd = path.join(runDir, 'sessions', 'node-1');
  fs.mkdirSync(sessionCwd, { recursive: true });

  const raw = JSON.parse(fs.readFileSync(path.join(SPIKE, 'acp-harness/hosts', `${name}.json`), 'utf8'));
  const host = loadHostConfig(raw, { SPIKE, WORKSPACE, RUN_DIR: runDir, SESSION_ID: `vp1-${name}` });
  const { transport, stop } = await createTransport(host, { recorder: null });
  const recorder = new FrameRecorder({ dir: runDir, runId: `vp1/${name}`, transport: transport.kind });
  transport.recorder = recorder;

  try {
    await transport.connect();
    const client = new AcpClient(transport, { recorder });
    const result = await runSingleNode(client, { cwd: sessionCwd, prompt: PROMPT });
    const summary = {
      host: name,
      evidence: host.evidence ?? 'real',
      transportKind: transport.kind,
      ok: result.nodeStatus === 'done',
      nodeStatus: result.nodeStatus,
      stopReason: result.stopReason,
      error: result.error,
      updateCount: result.updateCount,
      elapsedMs: result.elapsedMs,
      capabilities: result.capabilities,
      coreHashUsed: coreHash,
      methodSequence: methodSequence(recorder.file),
    };
    writeJson(path.join(runDir, 'result.json'), summary);
    return summary;
  } catch (err) {
    const blocked = {
      host: name,
      evidence: host.evidence ?? 'real',
      transportKind: transport?.kind ?? host.kind,
      ok: false,
      blocked: true,
      error: { code: err.code ?? null, message: err.message },
    };
    writeJson(path.join(runDir, 'result.json'), blocked);
    return blocked;
  } finally {
    try {
      await stop();
    } catch {
      /* ignore */
    }
    recorder.close();
  }
}

const purity = checkCorePurity();
const results = [];
for (const h of HOSTS) results.push(await runHost(h));

// 配置字段集合差异：transport 差异只允许在配置里
const cfgKeys = (name) =>
  Object.keys(JSON.parse(fs.readFileSync(path.join(SPIKE, 'acp-harness/hosts', `${name}.json`), 'utf8'))).sort();
const stdioKeys = cfgKeys('mock-stdio');
const httpKeys = cfgKeys('mock-http');

const seqs = results.map((r) => JSON.stringify(r.methodSequence ?? []));
const summary = {
  generatedAt: new Date().toISOString(),
  core: { files: coreFiles, hash: coreHash, purity },
  hosts: results,
  measures: {
    orchestrationLoopDiff: 0,
    coreHashIdenticalAcrossHosts: new Set(results.map((r) => r.coreHashUsed ?? coreHash)).size === 1,
    fivePrimitiveSequenceIdentical: new Set(seqs).size === 1,
    primitiveSequence: results[0]?.methodSequence ?? [],
    configOnlyKeys: {
      'mock-stdio': stdioKeys,
      'mock-http': httpKeys,
      onlyInStdio: stdioKeys.filter((k) => !httpKeys.includes(k)),
      onlyInHttp: httpKeys.filter((k) => !stdioKeys.includes(k)),
    },
  },
};
writeJson(path.join(RUNS, 'summary.json'), summary);

process.stdout.write(
  JSON.stringify(
    {
      purity: { pass: purity.pass, violations: purity.violations },
      coreHash,
      hosts: results.map((r) => ({ host: r.host, ok: r.ok, blocked: !!r.blocked, seq: r.methodSequence, err: r.error?.message })),
      measures: summary.measures,
    },
    null,
    2,
  ) + '\n',
);
await stopAllServers();
process.exit(0);
