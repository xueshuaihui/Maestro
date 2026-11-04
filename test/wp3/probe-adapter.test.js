import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const run = promisify(execFile);
const PROBE = path.resolve('test/fixtures/probe-adapter.mjs');
const MOCK = path.resolve('test/fixtures/mock-acp-agent.js');

async function probe(mode, switches) {
  const { stdout } = await run(process.execPath, [
    PROBE,
    '--mock',
    MOCK,
    '--switches',
    switches,
    '--observe',
    mode,
    '--timeout-ms',
    '8000',
  ]);
  const lines = stdout.trim().split('\n').filter(Boolean);
  assert.equal(lines.length, 1, `必须输出单行 JSON，实际：${stdout}`);
  return JSON.parse(lines[0]);
}

test('probe --observe session-state：建会话不投递 → idle（AC-15）', async () => {
  const out = await probe('session-state', '--hold-session');
  assert.equal(out.ok, true);
  assert.equal(out.mode, 'session-state');
  assert.equal(out.session.state, 'idle');
  assert.equal(out.session.toolName, null);
  assert.equal(out.noiseCount, 0);
  assert.equal(out.turnEventCount, 0);
});

test('probe --observe session-state：噪声帧不改状态（AC-19 前置）', async () => {
  const out = await probe('session-state', '--hold-session --noise-on-session-new');
  assert.equal(out.ok, true);
  assert.equal(out.session.state, 'idle');
  assert.equal(out.noiseCount >= 1, true);
});

test('probe --observe tool-name：工具名可观测（AC-16）', async () => {
  const out = await probe('tool-name', '--slow-tool write');
  assert.equal(out.ok, true);
  assert.equal(out.session.state, 'tool_running');
  assert.equal(out.session.toolName, 'write');
  assert.equal(out.stopReason, 'end_turn');
  assert.equal(out.turnEventCount >= 4, true);
});

test('probe --observe handoff：噪声先到仍为 delivered（AC-19）', async () => {
  const out = await probe('handoff', '--noise-on-prompt --accept-delay-ms 250');
  assert.equal(out.ok, true);
  assert.equal(out.handoff.state, 'delivered');
  assert.equal(out.turnEventSeen, true);
  assert.equal(out.handoff.stateAfterTurn, 'accepted');
  assert.equal(out.handoff.acceptedSignal, null);
  assert.equal(out.handoff.ambiguityWindowMs, null);
  assert.equal(out.noiseCount >= 1, true);
});
