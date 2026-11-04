#!/usr/bin/env node
/**
 * VP-3（真实宿主版）：真 DSH 上的多会话隔离。
 *
 * 与 mock 版的差别：不写 marker 文件（真 DSH 的 acp profile 未挂载可写的文件工具），
 * 改为验证协议层能观测到的四件事：
 *   A 并发会话的 session/update 路由归属（串台 = 收到他人 sessionId 的事件）
 *   B cancel 只终止目标会话
 *   C close 只释放目标会话
 *   D 每会话 cwd 独立注册（session/new 分配 + session/list 回读）
 *
 *   node run-real.mjs --host=dsh-real --sessions=5
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTransport, loadHostConfig, stopAllServers } from '../acp-harness/src/transport-factory.mjs';
import { FrameRecorder, writeJson } from '../acp-harness/src/recorder.mjs';
import { AcpClient } from '../acp-harness/src/client.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPIKE = path.resolve(HERE, '..');
const WORKSPACE = path.resolve(SPIKE, '..');
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split('=')[1] : d;
};

const HOST = arg('host', 'dsh-real');
const N = Number(arg('sessions', '5'));
const RUN_ID = arg('run', `real-${HOST}-${N}s-${Date.now()}`);
const RUN_DIR = path.resolve(WORKSPACE, '.orch-spike/runs/vp3-real', RUN_ID);
fs.mkdirSync(RUN_DIR, { recursive: true });

let seq = 0;
async function open(tag) {
  const raw = JSON.parse(fs.readFileSync(path.join(SPIKE, 'acp-harness/hosts', `${HOST}.json`), 'utf8'));
  const cfg = loadHostConfig(raw, { SPIKE, WORKSPACE, RUN_DIR, SESSION_ID: `vp3r-${Date.now()}` });
  const { transport, stop } = await createTransport(cfg, { recorder: null });
  const recorder = new FrameRecorder({ dir: RUN_DIR, runId: RUN_ID, transport: `${transport.kind}-${tag}-${++seq}` });
  transport.recorder = recorder;
  await transport.connect();
  const client = new AcpClient(transport, { recorder });
  await client.initialize({ name: 'maestro-iso', version: '0.1.0' });
  return { client, stop, recorder };
}

const report = { runId: RUN_ID, host: HOST, sessions: N, phases: {} };
const dirFor = (name) => {
  const d = path.join(RUN_DIR, 'workspaces', name);
  fs.mkdirSync(d, { recursive: true });
  return d;
};

// ---- A：并发 + 路由归属 ----
{
  const { client, stop, recorder } = await open('A');
  const sessions = [];
  for (let i = 0; i < N; i++) sessions.push({ ...(await client.newSession(dirFor(`A-${i + 1}`), [])), tag: `A-${i + 1}` });

  const seen = new Map(sessions.map((s) => [s.id, []]));
  const leaks = [];
  client.onUpdate((u, sid) => {
    if (seen.has(sid)) seen.get(sid).push(u.sessionUpdate);
    else leaks.push({ unknownSession: sid, update: u.sessionUpdate });
  });

  const t0 = Date.now();
  const outcomes = await Promise.all(
    sessions.map(async (s) => ({ tag: s.tag, id: s.id, stopReason: (await client.prompt(s.id, '请回复一句话确认收到')).stopReason })),
  );
  const elapsed = Date.now() - t0;

  const list = await client.listSessions();
  const cwdOf = new Map((list.sessions ?? []).map((s) => [s.sessionId, s.cwd]));

  report.phases.A = {
    elapsedMs: elapsed,
    outcomes,
    updateCounts: Object.fromEntries([...seen].map(([k, v]) => [k, v.length])),
    leaks,
    cwdRegistered: sessions.map((s) => ({ tag: s.tag, cwd: s.cwd ?? null, listedCwd: cwdOf.get(s.id) ?? null })),
    sessionListCount: list.sessions?.length ?? null,
    frames: recorder.file,
  };
  await client.close();
  await stop();
  recorder.close();
}

// ---- B：cancel 隔离（mock LLM 的 SLOW 脚本会挂住 5s）----
{
  const { client, stop, recorder } = await open('B');
  const sessions = [];
  for (let i = 0; i < Math.min(3, N); i++) sessions.push({ ...(await client.newSession(dirFor(`B-${i + 1}`), [])), tag: `B-${i + 1}` });

  const resolvedAt = {};
  const promises = sessions.map(async (s) => {
    const r = await client.prompt(s.id, 'SLOW 请慢慢输出').catch((err) => ({ stopReason: `error:${err.code}` }));
    resolvedAt[s.id] = Date.now();
    return { tag: s.tag, id: s.id, stopReason: r.stopReason };
  });

  await new Promise((r) => setTimeout(r, 800));
  const target = sessions[0];
  const cancelAt = Date.now();
  await client.cancel(target.id);
  const outcomes = await Promise.all(promises);

  report.phases.B = {
    cancelTarget: target.id,
    outcomes,
    targetStopped: outcomes.find((o) => o.id === target.id)?.stopReason === 'cancelled',
    cancelIsolated: outcomes.filter((o) => o.id !== target.id).every((o) => o.stopReason === 'end_turn'),
    targetCancelLatencyMs: resolvedAt[target.id] - cancelAt,
    frames: recorder.file,
  };
  await client.close();
  await stop();
  recorder.close();
}

// ---- C：close 隔离 ----
{
  const { client, stop, recorder } = await open('C');
  const a = await client.newSession(dirFor('C-1'), []);
  const b = await client.newSession(dirFor('C-2'), []);

  let closeError = null;
  try {
    await client.closeSession(a.id);
  } catch (err) {
    closeError = { code: err.code, message: err.message };
  }
  const survivor = await client.prompt(b.id, '关闭另一个会话后我仍应可用').catch((err) => ({ stopReason: `error:${err.code}` }));
  let closedPrompt = null;
  try {
    await client.prompt(a.id, '已关闭会话不应可用');
  } catch (err) {
    closedPrompt = { code: err.code, message: err.message };
  }

  report.phases.C = {
    closeError,
    closeSupported: closeError === null,
    survivorStopReason: survivor.stopReason,
    closedSessionError: closedPrompt,
    closeIsolated: closeError === null ? survivor.stopReason === 'end_turn' && !!closedPrompt : null,
    frames: recorder.file,
  };
  await client.close();
  await stop();
  recorder.close();
}

writeJson(path.join(RUN_DIR, 'report.json'), report);
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
await stopAllServers();
process.exit(0);
