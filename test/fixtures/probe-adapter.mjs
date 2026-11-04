#!/usr/bin/env node
// 适配器层夹具：拉起 mock ACP agent，走真实 createStdioTransport + createAcpClient。
//
// 用途：AC-15 / AC-16 / AC-19 这类“观察窗口”太窄的场景 —— 状态必须在某一刻被采样，
// 而产品命令会把窗口盖掉。
//
// 用法：
//   node test/fixtures/probe-adapter.mjs --mock test/fixtures/mock-acp-agent.js \
//        --switches "--hold-session" --observe session-state
//
//   --observe session-state | tool-name | handoff   （idle 是 session-state 的别名）
//
// 输出：单行 JSON（便于验收脚本断言），字段名与 state.json 的 session / handoff 段一致。

import path from 'node:path';

import { createAcpClient } from '../../src/adapter/acp-client.js';
import { createHandoffTracker } from '../../src/adapter/handoff-tracker.js';
import { NOISE_UPDATES, TURN_UPDATES, createNormalizer } from '../../src/adapter/session-state.js';
import { createStdioTransport } from '../../src/adapter/stdio-transport.js';

function parseArgv(argv) {
  const out = { mock: null, switches: '', observe: 'session-state', timeoutMs: 20_000, waitAccept: false, cwd: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const key = eq >= 0 ? arg.slice(0, eq) : arg;
    const inline = eq >= 0 ? arg.slice(eq + 1) : undefined;
    const value = () => {
      if (inline !== undefined) return inline;
      const v = argv[i + 1];
      i += 1;
      return v;
    };
    switch (key) {
      case '--mock':
        out.mock = value();
        break;
      case '--switches':
        out.switches = value() ?? '';
        break;
      case '--observe':
        out.observe = value() ?? 'session-state';
        break;
      case '--timeout-ms':
        out.timeoutMs = Number(value()) || out.timeoutMs;
        break;
      case '--wait-accept':
        out.waitAccept = true;
        break;
      case '--cwd':
        out.cwd = value();
        break;
      default:
        break;
    }
  }
  return out;
}

const args = parseArgv(process.argv.slice(2));
const mode = args.observe === 'idle' ? 'session-state' : args.observe;

function splitSwitches(raw) {
  // 支持简单引号分组，避免路径含空格时被拆坏
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(raw)) !== null) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

function emit(payload, code = 0) {
  process.stdout.write(JSON.stringify(payload) + '\n');
  process.exitCode = code;
}

async function main() {
  if (!args.mock) {
    emit({ ok: false, code: 'USAGE', message: '--mock <path-to-mock-agent> 必填' }, 2);
    return;
  }
  if (!['session-state', 'tool-name', 'handoff'].includes(mode)) {
    emit({ ok: false, code: 'USAGE', message: '--observe 只支持 session-state | tool-name | handoff' }, 2);
    return;
  }

  const mockPath = path.resolve(args.mock);
  const switches = splitSwitches(args.switches);
  if (mode === 'handoff') {
    if (!switches.some((s) => s.startsWith('--noise'))) switches.push('--noise-on-prompt');
    if (!switches.includes('--accept-delay-ms')) switches.push('--accept-delay-ms', '250');
  }

  const transport = createStdioTransport({
    command: process.execPath,
    args: [mockPath, ...switches],
    env: process.env,
    cwd: args.cwd ?? process.cwd(),
  });

  const spawned = await transport.spawn();
  if (!spawned.ok) {
    emit({ ok: false, code: spawned.code, params: spawned.params }, 1);
    return;
  }

  const client = createAcpClient({
    transport,
    limits: { promptTimeoutMs: args.timeoutMs, requestTimeoutMs: args.timeoutMs },
  });
  const normalizer = createNormalizer();
  const tracker = createHandoffTracker({ handoffId: 'HO-001', startedAt: Date.now() });

  const session = {
    sessionId: null,
    hostId: 'mock',
    // 初值只表示“归一化器尚未观察到任何 turn 内帧”，真正输出时一律回读 normalizer。
    state: null,
    stateSince: new Date().toISOString(),
    toolName: null,
    turnId: null,
    quarantined: false,
  };
  let noiseCount = 0;
  let turnEventCount = 0;
  let turnEventSeen = false;
  let stateAtFirstNoise = null;
  let handoffAtFirstNoise = null;
  let observedTool = null;
  let stopReason = null;
  let promptError = null;
  let handoffSnapshot = null;

  client.onUpdate(({ sessionId, update }) => {
    const name = update?.sessionUpdate;
    const isNoise = typeof name === 'string' && NOISE_UPDATES.has(name);
    const isTurn = typeof name === 'string' && TURN_UPDATES.has(name);
    if (isNoise) noiseCount += 1;
    if (isTurn) turnEventCount += 1;

    const reduced = normalizer.reduce(session.state ?? 'idle', update, {
      sessionId,
      turnId: session.turnId,
      toolName: session.toolName,
    });
    if (!reduced.dropped) {
      session.state = reduced.state;
      session.toolName = reduced.toolName ?? (reduced.state === 'tool_running' ? session.toolName : null);
      session.quarantined = Boolean(normalizer.getSession(sessionId)?.quarantined);
      if (reduced.state === 'tool_running') {
        observedTool = { state: 'tool_running', toolName: reduced.toolName ?? session.toolName };
      }
    }

    const observed = tracker.observeTurnEvent({ name, atMs: Date.now() });
    if (isNoise && stateAtFirstNoise === null && tracker.state() === 'delivered') {
      stateAtFirstNoise = observed.state;
      handoffAtFirstNoise = tracker.snapshot();
    }
    if (isTurn) turnEventSeen = true;
  });

  try {
    const init = await client.initialize();
    if (!init.ok) {
      emit({ ok: false, code: init.error?.code, message: init.error?.message, stage: 'initialize' }, 1);
      return;
    }

    const created = await client.newSession({ cwd: args.cwd ?? process.cwd(), mcpServers: [] });
    if (!created.ok) {
      emit({ ok: false, code: created.error?.code, message: created.error?.message, stage: 'session/new' }, 1);
      return;
    }
    session.sessionId = created.result.sessionId;
    tracker.created({ atMs: Date.now() });

    if (mode === 'session-state') {
      // 建会话后不投递：等一小段窗口，把 --noise-on-session-new 的噪声也收进来。
      await new Promise((resolve) => setTimeout(resolve, 120));
      // 必须回读归一化器的真实观察结果，不得在探针里写死期望值。
      const observed = normalizer.getSession(session.sessionId);
      emit({
        ok: true,
        mode,
        session: {
          ...session,
          state: observed?.state ?? 'idle',
          toolName: observed?.toolName ?? null,
          quarantined: Boolean(observed?.quarantined),
        },
        observedState: observed?.state ?? null,
        handoff: null,
        noiseCount,
        turnEventCount,
        stopReason,
      });
      return;
    }

    session.turnId = 'turn-1';
    normalizer.onPromptSent(session.sessionId, session.turnId);
    session.state = 'thinking';
    tracker.delivered({ atMs: Date.now() });

    const prompted = await client.prompt(session.sessionId, [{ type: 'text', text: 'probe: run the tool' }]);
    if (prompted.ok) stopReason = prompted.result.stopReason;
    else promptError = prompted.error;

    handoffSnapshot = tracker.snapshot();
    normalizer.onPromptSettled(session.sessionId, { stopReason });
    const finalState = handoffSnapshot.state;

    if (mode === 'tool-name') {
      emit({
        ok: true,
        mode,
        session: {
          ...session,
          state: observedTool?.state ?? session.state,
          toolName: observedTool?.toolName ?? session.toolName,
        },
        handoff: null,
        noiseCount,
        turnEventCount,
        stopReason,
        promptError,
      });
      return;
    }

    // handoff：报告“第一条噪声到达时”的状态（应为 delivered），同时给出最终状态
    emit({
      ok: true,
      mode,
      session: { ...session },
      handoff: {
        ...(handoffAtFirstNoise ?? handoffSnapshot),
        state: stateAtFirstNoise ?? finalState,
        stateAfterTurn: finalState,
      },
      turnEventSeen,
      noiseCount,
      turnEventCount,
      stopReason,
      promptError,
    });
  } finally {
    await client.dispose();
  }
}

main().catch(async (err) => {
  emit({ ok: false, code: 'PROBE_FAILED', message: String(err?.stack ?? err) }, 1);
});
