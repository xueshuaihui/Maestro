import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { resolvePermissionPolicy } from '../../src/adapter/host-config.js';
import { diskState, setup, tmpDir, waitFor, writeHostConfig } from './helpers.js';

const INSTANCE = 'INST-001';

test('F-1 策略来自宿主配置：limits.permissionPolicy=reject（env 可覆盖）', async (t) => {
  const root = tmpDir('maestro-wp8-policy-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeHostConfig(root, [], { permissionPolicy: 'reject' });

  const fromConfig = await resolvePermissionPolicy({ root, env: {} });
  assert.deepEqual(fromConfig, { ok: true, policy: 'reject', source: 'config' });

  const fromEnv = await resolvePermissionPolicy({ root, env: { MAESTRO_PERMISSION_POLICY: 'hold' } });
  assert.deepEqual(fromEnv, { ok: true, policy: 'hold', source: 'env' });
});

test('F-1 宿主配置驱动：不传显式 policy 时，config=reject 也会走审批被拒', async () => {
  const env = await setup({ switches: ['--permission=ask'], configPolicy: 'reject' });
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: '写下 out/a.md' });
    assert.equal(result.code, 'PERMISSION_DENIED');
    assert.equal(result.params.step, 'write');
  } finally {
    await env.teardown();
  }
});

test('F-1 hold：--permission=ask → 会话 waiting_input 且节点仍 running；cancel 收尾', async () => {
  const env = await setup({ switches: ['--permission=ask'], permissionPolicy: 'hold' });
  try {
    await env.orch.startRun({ cwd: env.cwd, task: '写下 out/a.md', earlyReturn: true });

    await waitFor(async () => {
      const status = await env.orch.getStatus({ instanceId: INSTANCE });
      if (!(status.ok && status.snapshot.session?.state === 'waiting_input')) return false;
      const events = await env.store.readEvents(INSTANCE);
      return events.events.some((ev) => ev.object === 'session' && ev.to === 'waiting_input');
    });

    const status = await env.orch.getStatus({ instanceId: INSTANCE });
    assert.equal(status.snapshot.session.state, 'waiting_input');
    // BR-03：等待审批不改变节点
    assert.equal(status.snapshot.node.state, 'running');
    assert.equal(status.snapshot.state, 'running');

    const events = await env.store.readEvents(INSTANCE);
    const waiting = events.events.filter(
      (ev) => ev.object === 'session' && ev.to === 'waiting_input' && ev.result === 'applied',
    );
    assert.equal(waiting.length, 1);
    assert.equal(waiting[0].detail.action, 'write');

    // hold 的唯一外部决定：cancel → 回 cancelled 再收尾
    const cancelled = await env.orch.cancel({ instanceId: INSTANCE });
    assert.equal(cancelled.ok, true, JSON.stringify(cancelled));
    const after = await diskState(env.store, INSTANCE);
    assert.equal(after.state, 'cancelled');
    assert.equal(after.session.state, 'idle');
    assert.equal(after.node.state, 'cancelled');
  } finally {
    await env.teardown();
  }
});

test('F-1 reject：--permission=ask → PERMISSION_DENIED，params.step=write', async () => {
  const env = await setup({ switches: ['--permission=ask'], permissionPolicy: 'reject' });
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: '写下 out/a.md' });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'PERMISSION_DENIED');
    assert.equal(result.params.step, 'write');

    const state = await diskState(env.store, INSTANCE);
    assert.equal(state.state, 'failed');
    assert.equal(state.node.state, 'failed');
    assert.equal(state.session.state, 'idle');
    assert.equal(state.handoff.state, 'rejected');
    assert.equal(state.handoff.rejectReason, 'permission_denied');

    const events = await env.store.readEvents(INSTANCE);
    const asked = events.events.some((ev) => ev.object === 'session' && ev.to === 'waiting_input');
    assert.equal(asked, true);
  } finally {
    await env.teardown();
  }
});

test('F-1 allow：--permission=ask 跑完，事件里 waiting_input 有进有出', async () => {
  const env = await setup({
    switches: ['--permission=ask', '--write-ref', 'out/a.md'],
    permissionPolicy: 'allow',
  });
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: '写下说明，保存到 out/a.md' });
    assert.equal(result.ok, true, JSON.stringify(result));

    const state = await diskState(env.store, INSTANCE);
    assert.equal(state.state, 'completed');
    assert.equal(state.node.state, 'done');
    assert.equal(state.session.state, 'idle');

    const events = (await env.store.readEvents(INSTANCE)).events;
    const inIdx = events.findIndex((ev) => ev.object === 'session' && ev.to === 'waiting_input');
    const outIdx = events.findIndex(
      (ev) => ev.object === 'session' && ev.from === 'waiting_input' && ev.to === 'thinking',
    );
    assert.ok(inIdx >= 0, '应有 session → waiting_input');
    assert.ok(outIdx > inIdx, '应有 waiting_input → thinking');
    assert.equal(events[outIdx].reason, 'permission.allowed');
  } finally {
    await env.teardown();
  }
});
