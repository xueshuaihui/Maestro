import assert from 'node:assert/strict';
import test from 'node:test';

import { ERROR_TEMPLATE } from '../../src/cli/labels.js';
import { classifyPromptError } from '../../src/core/error-map.js';
import { diskState, setup } from './helpers.js';

const INSTANCE = 'INST-001';

test('F-4 --host-error：失败收尾后会话必须是 idle（不得停在 thinking）', async () => {
  const env = await setup({ switches: ['--host-error'] });
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: '随便跑' });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'HOST_ERROR');

    const state = await diskState(env.store, INSTANCE);
    assert.equal(state.state, 'failed');
    assert.equal(state.node.state, 'failed');
    assert.equal(state.session.state, 'idle', '会话必须收敛到 idle');

    const events = (await env.store.readEvents(INSTANCE)).events;
    const sessionEvents = events.filter((ev) => ev.object === 'session' && ev.result === 'applied');
    if (sessionEvents.length > 0) {
      assert.equal(sessionEvents[sessionEvents.length - 1].to, 'idle', '最后一次会话迁移必须是 idle');
    }
  } finally {
    await env.teardown();
  }
});

test('F-4 --permission=deny：params.step 非空且渲染文案不含 null', async () => {
  const env = await setup({ switches: ['--permission=deny'] });
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: '写下 out/a.md' });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'PERMISSION_DENIED');
    assert.equal(typeof result.params.step, 'string');
    assert.equal(result.params.step.length > 0, true);
    assert.equal(result.params.step, 'write');

    const rendered = ERROR_TEMPLATE.PERMISSION_DENIED.replace('{step}', result.params.step);
    assert.equal(rendered.includes('null'), false);
    assert.equal(rendered, '审批被拒绝，任务中止于 write');

    const state = await diskState(env.store, INSTANCE);
    assert.equal(state.session.state, 'idle');
    assert.equal(state.node.state, 'failed');
    assert.equal(state.handoff.state, 'rejected');
    assert.equal(state.handoff.rejectReason, 'permission_denied');
  } finally {
    await env.teardown();
  }
});

test('F-4 VERIFY_FAILED：节点/实例 failed、会话 idle、交接包停在 accepted', async () => {
  const env = await setup({ switches: [] });
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: '写下说明，保存到 out/missing.md' });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'VERIFY_FAILED');

    const state = await diskState(env.store, INSTANCE);
    assert.equal(state.node.state, 'failed');
    assert.equal(state.state, 'failed');
    assert.equal(state.session.state, 'idle');
    assert.equal(state.handoff.state, 'accepted');
    assert.notEqual(state.handoff.state, 'consumed');
  } finally {
    await env.teardown();
  }
});

test('F-6 --session-missing：SESSION_INVALID，且与 NODE_BUSY 不是同一条文案', async () => {
  const env = await setup({ switches: ['--session-missing'] });
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: '随便跑' });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'SESSION_INVALID');

    const direct = classifyPromptError({ code: -32602, message: 'unknown session', sessionKnown: true });
    assert.equal(direct.code, 'SESSION_INVALID');
    assert.notEqual(ERROR_TEMPLATE.SESSION_INVALID, ERROR_TEMPLATE.NODE_BUSY);

    const state = await diskState(env.store, INSTANCE);
    assert.equal(state.session.state, 'idle');
    assert.equal(state.state, 'failed');
  } finally {
    await env.teardown();
  }
});
