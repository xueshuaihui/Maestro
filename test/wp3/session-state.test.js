import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NOISE_UPDATES,
  SESSION_STATES,
  TURN_UPDATES,
  createNormalizer,
  isTurnEvent,
} from '../../src/adapter/session-state.js';

test('常量：6 状态与两类噪声白名单', () => {
  assert.deepEqual(SESSION_STATES, [
    'idle',
    'thinking',
    'tool_running',
    'waiting_input',
    'waiting_dependency',
    'escalated',
  ]);
  assert.equal(NOISE_UPDATES.has('usage_update'), true);
  assert.equal(NOISE_UPDATES.has('available_commands_update'), true);
  assert.equal(TURN_UPDATES.size, 6);
  for (const name of [
    'agent_thought_chunk',
    'agent_message_chunk',
    'tool_call',
    'tool_call_update',
    'plan',
    'user_message_chunk',
  ]) {
    assert.equal(TURN_UPDATES.has(name), true, name);
  }
});

test('6 类 turn 内事件逐判别值映射', () => {
  const n = createNormalizer({ clock: () => 1000 });

  const toolCall = n.reduce('idle', {
    sessionUpdate: 'tool_call',
    toolCallId: 'call_1',
    title: 'write',
    status: 'in_progress',
  });
  assert.equal(toolCall.state, 'tool_running');
  assert.equal(toolCall.toolName, 'write');
  assert.equal(toolCall.progress, true);
  assert.equal(toolCall.noise, false);

  const toolCallNoTitle = n.reduce('idle', { sessionUpdate: 'tool_call', toolCallId: 'call_2' });
  assert.equal(toolCallNoTitle.state, 'tool_running');
  assert.equal(toolCallNoTitle.toolName, 'call_2');

  const toolUpdate = n.reduce('thinking', { sessionUpdate: 'tool_call_update', status: 'completed' }, {
    toolName: 'write',
  });
  assert.equal(toolUpdate.state, 'tool_running');
  assert.equal(toolUpdate.toolName, 'write');

  for (const name of ['agent_thought_chunk', 'agent_message_chunk', 'plan', 'user_message_chunk']) {
    const r = n.reduce('tool_running', { sessionUpdate: name });
    assert.equal(r.state, 'thinking', name);
    assert.equal(r.progress, true, name);
    assert.equal(r.toolName, undefined, `${name} 不应带工具名`);
  }
});

test('两种噪声帧不改状态、不算进展；未知判别值同理并计数', () => {
  const n = createNormalizer({ clock: () => 1000 });

  for (const name of ['usage_update', 'available_commands_update']) {
    const r = n.reduce('thinking', { sessionUpdate: name });
    assert.equal(r.state, 'thinking', name);
    assert.equal(r.noise, true, name);
    assert.equal(r.progress, false, name);
  }

  const unknown = n.reduce('tool_running', { sessionUpdate: 'hologram_update' });
  assert.equal(unknown.state, 'tool_running');
  assert.equal(unknown.noise, true);
  assert.equal(unknown.progress, false);
  assert.equal(unknown.unknown, true);
  assert.equal(unknown.unknownUpdate, 1);

  const counters = n.snapshot().counters;
  assert.equal(counters.noise, 2);
  assert.equal(counters.unknownUpdate, 1);
  assert.equal(counters.turnEvents, 0);
});

test('isTurnEvent 严格白名单', () => {
  assert.equal(isTurnEvent({ sessionUpdate: 'agent_thought_chunk' }), true);
  assert.equal(isTurnEvent('tool_call'), true);
  assert.equal(isTurnEvent({ sessionUpdate: 'usage_update' }), false);
  assert.equal(isTurnEvent({ sessionUpdate: 'available_commands_update' }), false);
  assert.equal(isTurnEvent({ sessionUpdate: 'agent_plan_delta' }), false);
  assert.equal(isTurnEvent(null), false);
});

test('onPromptSent / onPromptSettled / onOutputSubmitted / onCancelled / onEscalated', () => {
  const n = createNormalizer({ clock: () => 1000 });
  assert.deepEqual(n.onPromptSent('s1', 'turn-1'), { state: 'thinking' });
  assert.equal(n.stateOf('s1'), 'thinking');

  assert.deepEqual(n.onOutputSubmitted('s1'), { state: 'waiting_dependency' });
  assert.equal(n.stateOf('s1'), 'waiting_dependency');

  assert.deepEqual(n.onPromptSettled('s1', { stopReason: 'end_turn' }), {
    state: 'idle',
    stopReason: 'end_turn',
  });
  assert.equal(n.stateOf('s1'), 'idle');

  n.onCancelled('s1');
  assert.equal(n.stateOf('s1'), 'idle');
  assert.equal(n.getSession('s1').quarantined, true);

  n.onEscalated('s2');
  assert.equal(n.stateOf('s2'), 'escalated');
});

test('onCancelled 之后 turnId 不匹配的 update 被丢弃', () => {
  const n = createNormalizer({ clock: () => 1000 });
  n.onPromptSent('s1', 'turn-1');
  n.onCancelled('s1');

  const late = n.reduce('idle', { sessionUpdate: 'agent_thought_chunk' }, {
    sessionId: 's1',
    turnId: 'turn-2',
  });
  assert.equal(late.dropped, true);
  assert.equal(late.reason, 'quarantined_turn_mismatch');
  assert.equal(late.state, 'idle');
  assert.equal(late.progress, false);

  // 同 turn 的收尾帧同样丢弃（cancel 实测 13~56ms 后才收敛，否则会翻回执行中）
  const sameTurn = n.reduce('idle', { sessionUpdate: 'tool_call_update', status: 'failed' }, {
    sessionId: 's1',
    turnId: 'turn-1',
  });
  assert.equal(sameTurn.dropped, true);
  assert.equal(sameTurn.state, 'idle');

  // 新 turn 开始后解除隔离
  n.onPromptSent('s1', 'turn-2');
  const next = n.reduce('thinking', { sessionUpdate: 'agent_message_chunk' }, {
    sessionId: 's1',
    turnId: 'turn-2',
  });
  assert.equal(next.dropped, undefined);
  assert.equal(next.state, 'thinking');
});
