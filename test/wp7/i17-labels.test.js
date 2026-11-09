/**
 * WP-5 / I1.7：labels.js 7 个新增 code-merge 可见性键契约测试。
 *
 * 断言要点（AC-01/AC-05/AC-08/AC-09/AC-12/AC-13/AC-14）：
 *   (a) 7 个新增键均存在且为非空中文字符串；
 *   (b) 既有键（任取代表）的数量与内容逐字不变（M-6 口径：既有表一个键都不加不改）。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CODE_ROLE_BRANCH,
  MERGE_PENDING,
  MERGE_MERGING,
  MERGE_MERGED,
  MERGE_CONFLICT,
  ESCALATION_REASON_MERGE_CONFLICT,
  ESCALATION_REASON_WORKTREE_INIT_FAILED,
  // 既有键代表（断言逐字不变）。
  INSTANCE_LABEL,
  NODE_LABEL,
  ROLE_LABEL,
} from '../../src/cli/labels.js';
import { renderNodeLines, renderEscalationBlock } from '../../src/cli/render.js';

const NEW_KEYS = {
  CODE_ROLE_BRANCH,
  MERGE_PENDING,
  MERGE_MERGING,
  MERGE_MERGED,
  MERGE_CONFLICT,
  ESCALATION_REASON_MERGE_CONFLICT,
  ESCALATION_REASON_WORKTREE_INIT_FAILED,
};

const isNonEmptyChinese = (value) =>
  typeof value === 'string' && value.length > 0 && /[一-鿿]/.test(value);

test('(a) 7 个新增键均存在且为非空中文字符串', () => {
  assert.equal(Object.keys(NEW_KEYS).length, 7, '新增键数量应为 7');
  for (const [name, value] of Object.entries(NEW_KEYS)) {
    assert.ok(isNonEmptyChinese(value), `${name} 应为非空的中文字符串，实际：${JSON.stringify(value)}`);
  }
});

test('(a) CODE_ROLE_BRANCH 为含 {role}/{branch} 占位的模板', () => {
  assert.ok(CODE_ROLE_BRANCH.includes('{role}'), 'CODE_ROLE_BRANCH 应含 {role} 占位');
  assert.ok(CODE_ROLE_BRANCH.includes('{branch}'), 'CODE_ROLE_BRANCH 应含 {branch} 占位');
  assert.ok(CODE_ROLE_BRANCH.includes('分支'), 'CODE_ROLE_BRANCH 应含「分支」二字');
});

test('(a) MERGE_* 四态文案逐字符合附录 A', () => {
  assert.equal(MERGE_PENDING, '合并待执行');
  assert.equal(MERGE_MERGING, '合并中');
  assert.equal(MERGE_MERGED, '已合并');
  assert.equal(MERGE_CONFLICT, '冲突待升级');
});

test('(a) ESCALATION_REASON_* 升级原因文案逐字符合附录 A', () => {
  assert.equal(ESCALATION_REASON_MERGE_CONFLICT, '合并冲突');
  assert.equal(ESCALATION_REASON_WORKTREE_INIT_FAILED, 'worktree/分支创建失败');
});

test('(b) 既有键数量逐字不变（INSTANCE_LABEL 七态）', () => {
  assert.deepEqual(
    Object.keys(INSTANCE_LABEL),
    ['created', 'running', 'completed', 'failed', 'cancelled', 'interrupted', 'suspended'],
  );
});

test('(b) 既有键内容逐字不变（任取代表）', () => {
  assert.equal(INSTANCE_LABEL.created, '已创建');
  assert.equal(INSTANCE_LABEL.suspended, '已挂起');
  assert.equal(NODE_LABEL.done, '已完成');
  assert.equal(NODE_LABEL.escalated, '已升级');
  assert.equal(ROLE_LABEL.developer, '开发');
  assert.equal(ROLE_LABEL.reviewer, '审核者');
});

// ---- #G-01 接线：includeBranch 开关只影响 instance status 视图，run 路径逐字不变 ----

const codeNodeSnapshot = {
  template: 'code-loop',
  state: 'completed',
  nodes: [
    {
      nodeId: 'T-001',
      roleId: 'developer',
      state: 'done',
      round: 1,
      branch: 'maestro/INST-001/developer',
      mergeStatus: 'merged',
    },
  ],
};

test('(c) renderNodeLines：默认（run 路径）不出现分支片段，code-loop 输出逐字不变', () => {
  const lines = renderNodeLines(codeNodeSnapshot, { template: 'code-loop' });
  assert.deepEqual(lines, ['节点 T-001 开发 已完成 · 第 1 轮']);
});

test('(c) renderNodeLines：includeBranch=true 透出分支名与合并状态（instance status 视图）', () => {
  const lines = renderNodeLines(codeNodeSnapshot, { template: 'code-loop', includeBranch: true });
  assert.equal(lines.length, 1);
  assert.ok(lines[0].includes('maestro/INST-001/developer'), '应含分支名');
  assert.ok(lines[0].includes('已合并'), '应含合并状态中文');
});

test('(c) renderEscalationBlock：includeBranch 把 merge_conflict 原因码映射为中文', () => {
  const snapshot = {
    template: 'code-loop',
    state: 'suspended',
    nodes: [{ nodeId: 'T-001', roleId: 'developer', state: 'escalated', round: 1 }],
    escalations: [
      {
        escalationId: 'ESC-001',
        nodeId: 'T-001',
        round: 1,
        reasonCode: 'merge_conflict',
        reasonDetail: '合并 maestro/INST-001/developer 入集成线时发生冲突',
        state: 'pending',
      },
    ],
  };
  const plain = renderEscalationBlock(snapshot, { template: 'code-loop' });
  const shown = renderEscalationBlock(snapshot, { template: 'code-loop', includeBranch: true });
  assert.ok(plain.some((line) => line.includes('合并 maestro/INST-001/developer 入集成线时发生冲突')));
  assert.ok(shown.some((line) => line.includes('合并冲突')));
});
