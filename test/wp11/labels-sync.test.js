/**
 * WP-2 / BR-35 / D-11.3：核心状态词（status.md 生成器）与 CLI 文案逐词对照。
 *
 * CORE_TEXT 的六张状态表必须与 src/cli/labels.js 的对应导出逐字一致。
 * 两侧表名不同（例如 CORE_TEXT.instance 对应 INSTANCE_LABEL）、键名相同，
 * 映射见下方 MAP；比对一律取同一批键，缺字或错字即失败。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { CORE_TEXT } from '../../src/core/status-text.js';
import {
  APPROVAL_LABEL,
  ESCALATION_LABEL,
  HANDOFF_LABEL,
  INSTANCE_LABEL,
  NODE_LABEL,
  SESSION_LABEL
} from '../../src/cli/labels.js';

/** CORE_TEXT 子表名 → labels.js 导出（表名不同，键名相同）。 */
const MAP = Object.freeze([
  ['instance', INSTANCE_LABEL],
  ['node', NODE_LABEL],
  ['session', SESSION_LABEL],
  ['handoff', HANDOFF_LABEL],
  ['escalation', ESCALATION_LABEL],
  ['approval', APPROVAL_LABEL]
]);

test('映射关系：CORE_TEXT 的六张状态表与 labels.js 六个导出一一对应', () => {
  assert.deepEqual(
    MAP.map(([name]) => name),
    ['instance', 'node', 'session', 'handoff', 'escalation', 'approval']
  );
  for (const [name, labels] of MAP) {
    assert.ok(CORE_TEXT[name], `CORE_TEXT.${name} 不存在`);
    assert.ok(labels, `${name} 对应的 labels 导出不存在`);
    assert.equal(Object.keys(CORE_TEXT[name]).length > 0, true);
    assert.equal(Object.keys(labels).length > 0, true);
  }
});

test('两侧取同一批键：六张表的键集合逐表一致（缺键/多键即失败）', () => {
  for (const [name, labels] of MAP) {
    assert.deepEqual(
      Object.keys(CORE_TEXT[name]).sort(),
      Object.keys(labels).sort(),
      `CORE_TEXT.${name} 与 labels 键集合不一致`
    );
  }
});

test('逐词交叉比对（CORE_TEXT 到 labels）：每个状态键文案逐字一致', () => {
  for (const [name, labels] of MAP) {
    const core = CORE_TEXT[name];
    for (const key of Object.keys(labels)) {
      assert.equal(core[key], labels[key], `CORE_TEXT.${name}.${key} 与 labels 文案不一致`);
    }
  }
});

test('逐词交叉比对（labels 到 CORE_TEXT）：反向同样逐字一致', () => {
  for (const [name, labels] of MAP) {
    for (const key of Object.keys(CORE_TEXT[name])) {
      assert.equal(
        labels[key], CORE_TEXT[name][key],
        `labels 缺少 CORE_TEXT.${name}.${key} 的对应文案`
      );
    }
  }
});

test('六张状态表整对象深比较，且每个文案为非空中文字符串（BR-35 / D-11.3）', () => {
  for (const [name, labels] of MAP) {
    assert.deepEqual({ ...CORE_TEXT[name] }, { ...labels }, `${name} 整表不一致`);
    for (const [key, value] of Object.entries(CORE_TEXT[name])) {
      assert.equal(typeof value, 'string', `CORE_TEXT.${name}.${key} 不是字符串`);
      assert.ok(value.length > 0, `CORE_TEXT.${name}.${key} 为空`);
      assert.ok(/[\u3400-\u9FFF]/.test(value), `CORE_TEXT.${name}.${key} 不是中文文案`);
    }
  }
});
