// 共享夹具常量与写入器（以 `_` 开头，runner 不会当成用例加载）。
// 裁-15（decisions.md 第十三节）：所有用 A-13/doc-fanout 夹具的 AC（AC-24/27/28/30/31 等），
// 夹具在 T-001 节点补一行节点级 `wake_allow: [writer, editor]`——
// A-1 YAML 原文 + 此一行，其余逐字；登记为需求侧 R-11，S3 证据与 S4 报告披露。
import fs from 'node:fs';
import path from 'node:path';
import { WORKFLOW_DIR, ensureDir, writeWorkflow } from '../acc6-f-common.mjs';

/**
 * A-13 夹具工作流全文（`doc-fanout`）。
 * 逐字性说明：
 *  - 第 1~41 行 = requirement.md 附录 A-1 的 ```yaml 代码块逐字（schema/id/name/summary/
 *    entry/terminal/nodes/edges 全部键值、缩进、行序不变）；
 *  - 唯一差异 = T-001 节点在 `retry: 2` 与 `outputs: [research.notes]` 之间插入一行
 *    `    wake_allow: [writer, editor]`（裁-15 / R-11：节点级声明是 AC-37/AC-60 的需求
 *    先例，A-1 可选键清单漏列该键属附录笔误）；
 *  - 未补这一行时，D-3⑬ + D-7b 对齐后的内置 wake_allow 会让 `T-001 → T-002/T-003` 报
 *    WORKFLOW_WAKE_DENIED researcher → writer/editor，AC-24 等的「全部通过」不可达。
 */
export const DOC_FANOUT_WAKE_LINE = '    wake_allow: [writer, editor]';

export const DOC_FANOUT_YAML = [
  'schema: workflow/v1',
  'id: doc-fanout',
  'name: 文档并行版',
  'summary: 研究后两人并行撰写，汇总后人工确认',
  'entry: T-001',
  'terminal: T-006',
  'nodes:',
  '  - id: T-001',
  '    node_type: role',
  '    role: researcher',
  '    title: 研究',
  '    timeout: 600',
  '    retry: 2',
  DOC_FANOUT_WAKE_LINE,
  '    outputs: [research.notes]',
  '  - id: T-002',
  '    node_type: role',
  '    role: writer',
  '    title: 撰写A',
  '    parallel_scope: draft',
  '    scope: draft-a',
  '    inputs: [brief]',
  '  - id: T-003',
  '    node_type: role',
  '    role: editor',
  '    title: 撰写B',
  '    parallel_scope: draft',
  '    scope: draft-b',
  '    inputs: [brief]',
  '  - id: T-004',
  '    node_type: human',
  '    title: 人工确认',
  '  - id: T-005',
  '    node_type: escalate',
  '    title: 升级',
  '  - id: T-006',
  '    node_type: subworkflow',
  '    workflow: code-loop',
  '    title: 代码闭环',
  'edges:',
  '  - from: T-001',
  '    to: T-002',
  '    map:',
  '      - from: T-001.research.notes',
  '        to: brief',
  '  - from: T-001',
  '    to: T-003',
  '    map:',
  '      - from: T-001.research.notes',
  '        to: brief',
  '  - from: T-002',
  '    to: T-004',
  '  - from: T-003',
  '    to: T-004',
  '  - from: T-004',
  '    to: T-006',
  '    when: human_approved',
  '  - from: T-004',
  '    to: T-005',
  '    when: human_rejected',
  '  - from: T-006',
  '    to: T-005',
  '    when: failed',
  ''
].join('\n');

/** 写 `<root>/.orch/workflows/doc-fanout.yaml`（返回文件路径）。 */
export function writeDocFanout(root) {
  return writeWorkflow(root, 'doc-fanout', DOC_FANOUT_YAML);
}

/**
 * 机检自证（供验收复核）：DOC_FANOUT_YAML 与 A-1 原文逐行比对。
 * `base` 传 requirement.md 附录 A-1 代码块的原文数组（不含 ``` 围栏），
 * 返回 {same, missing:[A-1 有而夹具无], added:[夹具有而 A-1 无]}。
 * 预期：added 恰为 T-001 的 wake_allow 一行，missing 为空。
 */
export function diffAgainstA1(base) {
  const a = base.map((l) => l.replace(/\r$/, ''));
  const b = DOC_FANOUT_YAML.replace(/\n$/, '').split('\n');
  const missing = a.filter((l) => !b.includes(l));
  const added = b.filter((l) => !a.includes(l));
  return { same: missing.length === 0 && added.length === 1 && added[0] === DOC_FANOUT_WAKE_LINE, missing, added };
}

export { writeWorkflow, WORKFLOW_DIR, ensureDir, path };
