/**
 * I1.12 S3 验收脚手架 · 动作与断言辅助（批次 A）。
 *
 * 一个 Then/And 至少一条核对项；期望值逐字照需求（中文取自 labels.js /
 * requirement.md，脚本不硬编码中文期望）。一个 case 的结构固定：
 *   makeCase → 构造（含 saveEvidence 原始帧）→ 断言 → finish → writePart + appendResult。
 */
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import {
  ACC12_PATHS,
  GRADING_MOCK,
  VERDICT_PASS,
  VERDICT_FAIL,
  VERDICT_BLOCK,
  ensureDir,
  appendLine,
  iso,
  saveEvidence as saveEvidenceFrame,
  acBlockFromRequirement,
} from './acc12-f-lib.mjs';

const safe = (v) => {
  if (v === undefined) return '<undefined>';
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
};

export function makeCase(ac, { scenario = '', title = '' } = {}) {
  return {
    ac,
    scenario,
    title,
    root: null,
    startedAt: iso(),
    endedAt: null,
    checks: [],
    evidence: [],
    snapshots: {},
    notes: [],
    blocker: null,
    verdict: null,
    grading: GRADING_MOCK,
    durationMs: null,
  };
}

function push(c, label, expected, actual, ok) {
  const item = {
    id: `C${String(c.checks.length + 1).padStart(2, '0')}`,
    label,
    expected: safe(expected),
    actual: safe(actual),
    ok: ok === true,
  };
  c.checks.push(item);
  return item;
}

/** 深度相等核对（对象 / 数组按结构比）。 */
export function eq(c, label, actual, expected) {
  return push(c, label, expected, actual, isDeepStrictEqual(actual, expected));
}

/** 包含核对：actual 文本包含 needle。 */
export function includes(c, label, actual, needle) {
  return push(c, label, needle, actual, typeof actual === 'string' && actual.includes(String(needle)));
}

/** 正则核对：actual 文本匹配 regex。 */
export function matches(c, label, actual, regex) {
  let ok = false;
  try { ok = regex.test(String(actual)); } catch { ok = false; }
  return push(c, label, String(regex), actual, ok);
}

/** 通用布尔核对。 */
export function check(c, label, ok, detail = '') {
  return push(c, label, detail === '' ? 'true' : detail, ok === true ? 'true' : `false (${safe(detail)})`, ok === true);
}

/** 数量 / 区间核对：actual 满足 predicate。 */
export function verify(c, label, actual, predicate, expectedText) {
  let ok = false;
  try { ok = predicate(actual) === true; } catch { ok = false; }
  return push(c, label, expectedText, actual, ok);
}

/** 记录一个命名快照（供回溯 / meta 证据）。 */
export function snap(c, name, value) {
  c.snapshots[name] = value;
  return value;
}

/** 登记阻塞：需求要求什么 / 试过什么 / 为何观测不到。 */
export function block(c, reason) {
  c.blocker = String(reason ?? '');
  c.notes.push(`阻塞：${c.blocker}`);
  return c;
}

/** 落一份原始证据并登记到 case 清单。 */
export function evidence(c, phase, type, content) {
  const saved = saveEvidenceFrame(c.ac, phase, type, content);
  c.evidence.push(saved);
  return saved;
}

export function note(c, text) {
  c.notes.push(String(text ?? ''));
  return c;
}

/** 计算判定；三档，证据分级固定 mock 实测（本批次不碰真实宿主）。 */
export function finish(c) {
  c.endedAt = iso();
  const failed = c.checks.filter((item) => !item.ok);
  if (c.blocker) {
    c.verdict = VERDICT_BLOCK;
  } else if (c.checks.length === 0 || failed.length > 0) {
    c.verdict = VERDICT_FAIL;
  } else {
    c.verdict = VERDICT_PASS;
  }
  c.checksTotal = c.checks.length;
  c.checksPassed = c.checks.filter((item) => item.ok).length;
  c.checksFailed = failed.length;
  c.grading = GRADING_MOCK;
  return c;
}

/** 写 parts/AC-XX.md 核对表。 */
export function writePart(c) {
  ensureDir(ACC12_PATHS.PARTS);
  const rows = c.checks.map((item) =>
    `| ${item.id} | ${item.label} | \`${item.expected}\` | \`${item.actual}\` | ${item.ok ? '✓' : '✗'} |`
  ).join('\n');
  const evRows = c.evidence.map((item) =>
    `- \`${item.file}\`（${item.bytes} bytes, sha256 \`${item.sha256}\`）`
  ).join('\n');
  const noteRows = c.notes.map((n) => `- ${n}`).join('\n') || '- （无）';
  const req = acBlockFromRequirement(c.ac);
  const md = [
    `# ${c.ac} · ${c.title || c.scenario}`,
    '',
    `- 判定：**${c.verdict}**`,
    `- 证据分级：**${c.grading}**`,
    `- 夹具根：\`${c.root || '(未使用独立 root)'}\``,
    `- 场景：\`${c.scenario}\``,
    `- 核对项：${c.checksPassed}/${c.checksTotal} 通过，${c.checksFailed} 未通过`,
    `- 起止：${c.startedAt} → ${c.endedAt}`,
    '',
    '## 核对项',
    '',
    '| ID | 核对点 | 期望值（逐字） | 实测值 | 结果 |',
    '|---|---|---|---|---|',
    rows || '| — | — | — | — | — |',
    '',
    '## 原始证据',
    '',
    evRows || '- （无）',
    '',
    '## 备注',
    '',
    noteRows,
    '',
    '<details><summary>需求 AC 原文（from requirement.md）</summary>',
    '',
    '```text',
    req,
    '```',
    '',
    '</details>',
    '',
  ].join('\n');
  const file = `${ACC12_PATHS.PARTS}/${c.ac}.md`;
  fs.writeFileSync(file, md, 'utf8');
  c.part = file;
  return file;
}

/** 追加一行 results.jsonl（同一 AC 多次运行取最后一条为准）。 */
export function appendResult(c) {
  ensureDir(path.dirname(ACC12_PATHS.RESULTS));
  const record = {
    ac: c.ac,
    batch: 'a',
    title: c.title,
    scenario: c.scenario,
    verdict: c.verdict,
    grading: c.grading,
    checksTotal: c.checksTotal,
    checksPassed: c.checksPassed,
    checksFailed: c.checksFailed,
    failedChecks: c.checks.filter((item) => !item.ok).map((item) => ({ id: item.id, label: item.label, expected: item.expected, actual: item.actual })),
    evidenceFiles: c.evidence.map((item) => item.file),
    evidenceCount: c.evidence.length,
    blocker: c.blocker,
    notes: c.notes,
    root: c.root,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    part: c.part,
  };
  appendLine(ACC12_PATHS.RESULTS, JSON.stringify(record));
  return record;
}
