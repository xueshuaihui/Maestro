import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { MOCK, currentSession, setup, sleep } from './helpers.js';

const run = promisify(execFile);
const PROBE = path.resolve('test/fixtures/probe-adapter.mjs');
const INSTANCE = 'INST-001';

async function probe(switches) {
  const { stdout } = await run(process.execPath, [
    PROBE,
    '--mock',
    MOCK,
    '--switches',
    switches,
    '--observe',
    'session-state',
    '--timeout-ms',
    '8000',
  ]);
  return JSON.parse(stdout.trim());
}

test('F-5 probe：--hold-session 下输出的是归一化器的真实观察（无帧 → idle）', async () => {
  const out = await probe('--hold-session');
  assert.equal(out.ok, true);
  assert.equal(out.session.state, 'idle');
  // 没有任何 turn 内帧：归一化器没有记录，探针如实报告 observedState=null。
  assert.equal(out.observedState, null);
});

test('F-5 产品：--hold-session 下建会话后不推进，status 会话行仍是 idle', async () => {
  const env = await setup({ switches: ['--hold-session'] });
  try {
    await env.orch.startRun({ cwd: env.cwd, task: '写下 out/a.md', earlyReturn: true });
    // 宿主不推进：没有 turn 内帧，会话不得自己跳到 thinking（BR-04 / BR-05）。
    await sleep(200);

    const status = await env.orch.getStatus({ instanceId: INSTANCE });
    assert.equal(status.ok, true);
    assert.equal(status.snapshot.state, 'running');
    assert.equal(currentSession(status.snapshot).state, 'idle', '会话建好但未开始处理时应为空闲');

    const events = (await env.store.readEvents(INSTANCE)).events;
    assert.equal(
      events.some((ev) => ev.object === 'session' && ev.to === 'thinking'),
      false,
      '宿主没动静时不得出现会话 → thinking',
    );

    const cancelled = await env.orch.cancel({ instanceId: INSTANCE });
    assert.equal(cancelled.ok, true);
  } finally {
    await env.teardown();
  }
});
