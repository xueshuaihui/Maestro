#!/usr/bin/env node
// I1.6 验收 —— 由 probe/acc6-f-results.jsonl + probe/acc6-f-parts/ 重建
// docs/iterations/iteration-6/acceptance-fixture.md，并输出 probe/acc6-f-summary.json。
// 结构对齐 I1.5 的同名文档：每条 AC 一节（需求原文 / 证据清单 / 核对表 / 判定）。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, EVID, REPORT, PARTS, RESULTS, SUMMARY, BASE, AC_TOTAL,
  forceKillCore, ensureDir
} from './acc6-f-common.mjs';

const AC_ORDER = Array.from({ length: AC_TOTAL }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`);
const MIN_EVIDENCE = 4;

function readResults() {
  const map = new Map();
  try {
    for (const line of fs.readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean)) {
      let r;
      try { r = JSON.parse(line); } catch { continue; }
      if (!r?.ac) continue;
      map.set(r.ac, r); // 后跑的覆盖先跑的（模板 §3.5）
    }
  } catch { /* 还没有 results */ }
  return map;
}

const results = readResults();
const part = (id) => {
  const p = path.join(PARTS, `${id}.md`);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
};

const stat = { 通过: 0, 不通过: 0, 阻塞: 0 };
const perAc = [];
const missing = [];
const bad = [];
for (const id of AC_ORDER) {
  const r = results.get(id);
  if (!r) {
    missing.push(id);
    stat.阻塞 += 1;
    perAc.push({
      id, verdict: '阻塞', evidence: 0,
      checks: [{ text: '已产出证据与判定', ok: false, blocked: true, actual: '未登记或未执行' }]
    });
    bad.push({ id, verdict: '阻塞', failed: [{ text: '未登记或未执行用例', actual: '—' }], notes: [] });
    continue;
  }
  const checks = (r.checks ?? []).map((x) => ({ text: x.text, ok: Boolean(x.ok), blocked: Boolean(x.blocked) }));
  stat[r.verdict] = (stat[r.verdict] ?? 0) + 1;
  perAc.push({ id, verdict: r.verdict, face: r.face ?? null, evidence: (r.evidence ?? []).length, checks });
  if (r.verdict !== '通过') {
    bad.push({
      id, verdict: r.verdict,
      failed: [...(r.failed ?? []), ...(r.blocked ?? [])],
      notes: r.notes ?? []
    });
  }
}

let evidenceFiles = [];
try {
  // AC 号后允许一个可选的字母后缀（如 AC-24b.*：分段主证据）；仍按前 5 位归到所属 AC。
  evidenceFiles = fs.readdirSync(EVID).filter((f) => /^(AC-\d{2})[a-z]?\.(.+)\.(json|jsonl|txt)$/.test(f)).sort();
} catch { /* ignore */ }
const acOfFile = (f) => (f.match(/^(AC-\d{2})[a-z]?\./) ?? [])[1] ?? null;
const covered = new Set(evidenceFiles.map(acOfFile).filter(Boolean));
const thin = AC_ORDER.filter((id) => evidenceFiles.filter((f) => acOfFile(f) === id).length < MIN_EVIDENCE);

const cell = (s, n = 260) => String(s ?? '').replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').slice(0, n);

const head = [
  '# I1.6 验收记录（夹具面）', '',
  '> 依据：`docs/iterations/iteration-6/requirement.md` v7 §3.1（AC-01~AC-65，逐条 Given/When/Then）、附录 A-1~A-15（输出逐字版式、JSON 结构）、附录 D-2/D-3/D-6/D-7a/D-7b/D-9/D-10（YAML 子集、校验顺序、参数白名单、授权断言、内置资产对齐、架构扫描、测试约束）；裁决裁-11 ~ 裁-15（`decisions.md` 第十一~十三节）。',
  `> 执行：${process.platform} / Node ${process.version} / 仓库 \`${REPO}\`（HEAD baf975e）；每条 AC 一个独立项目根 \`%TEMP%/maestro-acc-p6/<AC>/\`，命令面 AC 不启核心。`,
  '> 已披露的实现口径：R-9（AC-24 按全量 validate 取证）、R-10（workflow create 缺省形 / diff map 路径）、R-11（doc-fanout 夹具在 T-001 补节点级 `wake_allow: [writer, editor]`）——均见 decisions.md 裁-13 ~ 裁-15。',
  '> 生成：`probe/acc6-f-run.mjs` 逐条取证（evidence + parts + results.jsonl）→ `probe/acc6-f-final.mjs` 重建本文件。判定只认需求原文的 Then/And/机检；每条证据均可独立复核（原始输出与状态全文落盘）。', '',
  '## 0. 总判', '',
  `**65 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}**`, '',
  `- 已产出证据：${AC_ORDER.length - missing.length} 条；未登记或未执行：${missing.length ? missing.join('、') : '无'}。`,
  `- 证据文件：\`docs/iterations/iteration-6/evidence/\` 下 ${evidenceFiles.length} 个（覆盖 ${covered.size} 条 AC；每条 AC 至少 ${MIN_EVIDENCE} 个——不足的：${thin.length ? thin.join('、') : '无'}）。`,
  `- 不通过 / 阻塞条目：${bad.length ? bad.map((b) => `${b.id}（${b.verdict}）`).join('、') : '无'}。`,
  '- 机器可读汇总：`probe/acc6-f-summary.json`；单条中间结论：`probe/acc6-f-parts/<AC>.md`；缺陷记录：`probe/acc6-f-blockers.md`。',
  '- 判定口径：`通过` = 该 AC 的全部 Then/And/机检核对项成立；`不通过` = 有核对项不成立；`阻塞` = 需求要求的行为无法在夹具上观测（或超时），必须在 parts 里写明原因与已尝试路径。', '',
  '## 1. AC 逐条记录（命令 / 需求原文 / 证据 / 判定）', '',
  '> 「原始输出」全文在 `evidence/<AC>.output.json`（每条命令的 stdout+stderr 原样）与 `status.txt`（可读转录）；「状态证据」在 `evidence/<AC>.state.json` 与 `events.jsonl`；「命令级原始帧」在 `evidence/<AC>.*.txt|json`。', ''
];

const sections = [];
for (const id of AC_ORDER) {
  const md = part(id);
  if (md) { sections.push(md); continue; }
  sections.push([
    `#### ${id}（阻塞：未产出证据与判定）`, '',
    '- 判定：**阻塞**',
    '- 原因：该 AC 尚未登记用例或尚未执行（`node probe/acc6-f-run.mjs ' + id + '` 可补跑）。',
    '', '---', ''
  ].join('\n'));
}

const badRows = bad.map((b) => {
  const items = (b.failed ?? []).slice(0, 6).map((f) => `- ${f.text}${f.actual ? `：\`${cell(f.actual, 200)}\`` : ''}`).join('<br>');
  return `| ${b.id} | ${b.verdict} | ${items || '—'} | ${cell((b.notes ?? []).join('；'), 200) || '—'} |`;
});

const section2 = [
  '## 2. 未通过 / 阻塞项汇总', '',
  ...(badRows.length
    ? ['| AC | 判定 | 未成立 / 阻塞的核对项 | 备注 |', '|---|---|---|---|', ...badRows]
    : ['（无未通过 / 阻塞项）']), ''
];

const idxRows = AC_ORDER.map((id) => {
  const files = evidenceFiles.filter((f) => acOfFile(f) === id);
  return `| ${id} | ${files.length} | ${files.length ? files.map((f) => `\`evidence/${f}\``).join('<br>') : '—'} |`;
});
const section3 = [
  '## 3. 证据索引', '',
  `共 ${evidenceFiles.length} 个文件；每条 AC 至少 \`state.json\` / \`meta.json\` / \`output.json\` / \`status.txt\`（无实例时 state 为 null，events 为空）。`, '',
  '| AC | 文件数 | 证据文件 |', '|---|---|---|', ...idxRows, ''
];

const doc = [...head, ...sections, ...section2, ...section3].join('\n');
fs.writeFileSync(REPORT, doc, 'utf8');

ensureDir(path.dirname(SUMMARY));
fs.writeFileSync(SUMMARY, JSON.stringify({
  通过: stat.通过,
  不通过: stat.不通过,
  阻塞: stat.阻塞,
  evidenceFiles: evidenceFiles.length,
  evidenceCovered: covered.size,
  thinEvidence: thin,
  perAc
}, null, 2) + '\n', 'utf8');

console.log(`[final] 65 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}（未登记 ${missing.length}）`);
console.log(`[final] 报告：${path.relative(REPO, REPORT)}；汇总：${path.relative(REPO, SUMMARY)}；证据 ${evidenceFiles.length} 个（覆盖 ${covered.size} 条）`);
if (thin.length) console.log(`[final] 证据不足 ${MIN_EVIDENCE} 个：${thin.join(', ')}`);
if (bad.length) console.log(`[final] 非通过：${bad.map((b) => `${b.id}:${b.verdict}`).join(', ')}`);

// 收尾：清掉 BASE 下可能残留的核心。
try {
  for (const d of fs.readdirSync(BASE)) await forceKillCore(path.join(BASE, d));
} catch { /* BASE 不存在则跳过 */ }
