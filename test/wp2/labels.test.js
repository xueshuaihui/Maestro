import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INSTANCE_LABEL,
  NODE_LABEL,
  SESSION_LABEL,
  HANDOFF_LABEL,
  ERROR_TEMPLATE,
  formatDuration
} from '../../src/cli/labels.js';

test('nine failure texts match requirement 2.6 verbatim', () => {
  // Expected values are copied from docs/iterations/iteration-1/requirement.md 2.6,
  // with the angle-bracket slots turned into named placeholders.
  assert.equal(ERROR_TEMPLATE.DSH_SPAWN_FAILED, '无法启动 DSH：{cause}');
  assert.equal(ERROR_TEMPLATE.CWD_NOT_WRITABLE, '工作目录不可写：{path}');
  assert.equal(ERROR_TEMPLATE.CORE_START_FAILED, '核心进程启动失败：{cause}');
  assert.equal(ERROR_TEMPLATE.NODE_BUSY, '该节点正在执行，本次未发起');
  assert.equal(ERROR_TEMPLATE.SESSION_INVALID, '会话已失效，需要重新创建');
  assert.equal(ERROR_TEMPLATE.PERMISSION_DENIED, '审批被拒绝，任务中止于 {step}');
  assert.equal(ERROR_TEMPLATE.HOST_ERROR, '执行失败：{raw}');
  assert.equal(ERROR_TEMPLATE.VERIFY_FAILED, '核对失败：{reason}');
  assert.equal(ERROR_TEMPLATE.UNKNOWN_ERROR, '未知错误：{raw}');
});

test('store-level texts', () => {
  assert.equal(ERROR_TEMPLATE.STATE_CORRUPT, '状态不可读，已备份为 state.json.corrupt');
  assert.equal(
    ERROR_TEMPLATE.INSTANCE_TERMINAL,
    '实例已结束（{state}），本迭代不支持重跑'
  );
});

test('formatDuration samples', () => {
  assert.equal(formatDuration(3000), '3s');
  assert.equal(formatDuration(72000), '1m12s');
  assert.equal(formatDuration(120000), '2m');
});

test('formatDuration edge values', () => {
  assert.equal(formatDuration(0), '0s');
  assert.equal(formatDuration(500), '1s');
  assert.equal(formatDuration(59999), '1m');
  assert.equal(formatDuration(60000), '1m');
  assert.equal(formatDuration(65000), '1m5s');
  assert.equal(formatDuration(-5), '0s');
  assert.equal(formatDuration('bad'), '0s');
});

test('instance labels match the display table', () => {
  assert.deepEqual({ ...INSTANCE_LABEL }, {
    created: '已创建',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
    interrupted: '已中断'
  });
});

test('node labels match the display table and hide escalated', () => {
  assert.deepEqual({ ...NODE_LABEL }, {
    pending: '待执行',
    running: '执行中',
    review: '待校验',
    done: '已完成',
    failed: '失败',
    cancelled: '已取消'
  });
  assert.equal('escalated' in NODE_LABEL, false);
});

test('session labels match the display table', () => {
  assert.equal(SESSION_LABEL.idle, '空闲');
  assert.equal(SESSION_LABEL.thinking, '执行中');
  assert.equal(SESSION_LABEL.tool_running, '执行中');
  assert.equal(SESSION_LABEL.waiting_input, '等待审批');
  assert.equal(SESSION_LABEL.waiting_dependency, '等待下游');
  assert.equal(SESSION_LABEL.escalated, '已升级');
});

test('handoff labels cover all seven states', () => {
  assert.deepEqual({ ...HANDOFF_LABEL }, {
    created: '已构造',
    delivered: '已投递',
    pending: '待投递',
    accepted: '已接受',
    consumed: '已完成',
    rejected: '已拒绝',
    expired: '已过期'
  });
});
