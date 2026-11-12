/**
 * I1.10a WP-3：健康度悬停契约测试（`test/wp13/health-hover.test.js`）。
 *
 * 承担（拆分文档 §4 WP-3 + 需求判定口径）：
 * - AC-32：附录 A-7 八类原因句逐字（经 `GET /ui/labels` 下发的
 *   `HEALTH_LINE` / `HEALTH_REASON` 平铺键模板 + 接口返回的
 *   `health.reasons` 参数渲染，只透传不重算）；第 9 例（level: normal 且
 *   reasons 为空）只显「健康度 正常」，无自造句。
 * - 机检形态：`test -f` 先行、`# pass ≥ 1`、`# fail 0`。
 * - 架构检查锚点：原因句由模板键驱动（替换模板值即改变输出）、未知原因码
 *   不产生自造句、缺参占位符保留 `{xx}`。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHealthHover } from '../../desktop/ui/list/health-hover.js';
import { labelKeysPayload } from '../../src/daemon/http/labels.js';

const LABELS = labelKeysPayload().keys;

// 附录 A-7 八行逐字基线（可变值按 A-0 以夹具实参替换后断言）。
const A7_CASES = [
  {
    name: 'pending_escalation',
    health: { level: 'attention', reasons: [{ code: 'pending_escalation' }] },
    expected: '健康度 需关注 · 有待处理升级',
  },
  {
    name: 'node_timeout',
    health: { level: 'attention', reasons: [{ code: 'node_timeout', nodeId: 'T-001' }] },
    expected: '健康度 需关注 · 节点 T-001 执行超时',
  },
  {
    name: 'session_crash',
    health: {
      level: 'attention',
      reasons: [{ code: 'session_crash', sessionId: 'mock-sess-12345-1' }],
    },
    expected: '健康度 需关注 · 会话 mock-sess-12345-1 崩溃',
  },
  {
    name: 'role_unavailable',
    health: { level: 'attention', reasons: [{ code: 'role_unavailable', role: '开发' }] },
    expected: '健康度 需关注 · 角色 开发 不可用',
  },
  {
    name: 'connection_rejected',
    health: {
      level: 'attention',
      reasons: [{ code: 'connection_rejected', connection: '测试→开发' }],
    },
    expected: '健康度 需关注 · 连接线 测试→开发 已拒绝',
  },
  {
    name: 'connection_expired',
    health: {
      level: 'attention',
      reasons: [{ code: 'connection_expired', connection: '测试→开发' }],
    },
    expected: '健康度 需关注 · 连接线 测试→开发 已过期',
  },
  {
    name: 'p90_exceeded',
    health: { level: 'slow', reasons: [{ code: 'p90_exceeded', nodeId: 'T-006' }] },
    expected: '健康度 慢 · 节点 T-006 执行超过本实例 P90',
  },
  {
    name: 'handoff_ttl_half',
    health: { level: 'slow', reasons: [{ code: 'handoff_ttl_half', handoffId: 'HO-006' }] },
    expected: '健康度 慢 · 交接包 HO-006 待投递超过 TTL 一半',
  },
];

test('AC-32：八类原因悬停句与附录 A-7 逐字相等（模板 + reasons 参数渲染）', () => {
  assert.ok(A7_CASES.length === 8, 'the frozen reason set has exactly eight entries');
  for (const { name, health, expected } of A7_CASES) {
    assert.equal(renderHealthHover(health, LABELS), expected, `case ${name}`);
  }
});

test('AC-32：无原因只显「健康度 正常」，缺 level 降级 normal，无自造句', () => {
  assert.equal(renderHealthHover({ level: 'normal', reasons: [] }, LABELS), '健康度 正常');
  assert.equal(renderHealthHover({ level: 'normal' }, LABELS), '健康度 正常');
  assert.equal(renderHealthHover({}, LABELS), '健康度 正常');
  // reasons 里只有未知码时退回裸行，不产生自造句。
  assert.equal(
    renderHealthHover({ level: 'attention', reasons: ['made_up_code'] }, LABELS),
    '健康度 需关注',
  );
});

test('AC-32：原因句由 HEALTH_REASON 平铺键模板驱动（替换模板值即改变输出）', () => {
  const patched = { ...LABELS, HEALTH_REASON_NODE_TIMEOUT: '节点 {nodeId} 延迟' };
  assert.equal(
    renderHealthHover({ level: 'attention', reasons: [{ code: 'node_timeout', nodeId: 'T-009' }] }, patched),
    '健康度 需关注 · 节点 T-009 延迟',
  );
  // 档位词同样由 HEALTH_LABEL 平铺键驱动。
  const patchedLabel = { ...LABELS, HEALTH_LABEL_SLOW: '偏慢' };
  assert.equal(
    renderHealthHover({ level: 'slow', reasons: [] }, patchedLabel),
    '健康度 偏慢',
  );
});

test('AC-32：缺参占位符保留 {xx}；纯码串 reasons 同样经模板渲染', () => {
  // 纯码串（无实参）：占位符字面保留，不重算、不拼接。
  assert.equal(
    renderHealthHover({ level: 'attention', reasons: ['node_timeout'] }, LABELS),
    '健康度 需关注 · 节点 {nodeId} 执行超时',
  );
  // 混排：多原因按接口给定的顺序以 HEALTH_LINE_SEP 连接。
  assert.equal(
    renderHealthHover(
      {
        level: 'attention',
        reasons: [{ code: 'pending_escalation' }, { code: 'node_timeout', nodeId: 'T-002' }],
      },
      LABELS,
    ),
    '健康度 需关注 · 有待处理升级 · 节点 T-002 执行超时',
  );
});
