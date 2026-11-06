#!/usr/bin/env node
// I1.3 验收 —— 由 probe/acc3-f-results.jsonl + probe/acc3-f-parts/ 重建
// docs/iterations/iteration-3/acceptance-fixture.md，并输出 probe/acc3-f-summary.json。
// 结构对齐 I1.2 的同名文档：每条 AC 一节（需求原文 Then / 证据清单 / 核对表 / 判定）。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, EVID, REPORT, PARTS, RESULTS, SUMMARY, BASE,
  forceKillCore, ensureDir
} from './acc3-f-common.mjs';

const AC_ORDER = Array.from({ length: 45 }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`);

function readResults() {
  const map = new Map();
  try {
    for (const line of fs.readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean)) {
      let r;
      try { r = JSON.parse(line); } catch { continue; }
      if (!r?.ac) continue;
      map.set(r.ac, r); // 后跑的覆盖先跑的
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
      id, verdict: '阻塞',
      checks: [{ text: '已产出证据与判定', ok: false, blocked: true, actual: '未登记或未执行' }]
    });
    bad.push({ id, verdict: '阻塞', failed: [{ text: '未登记或未执行用例', actual: '—' }], notes: [] });
    continue;
  }
  const checks = (r.checks ?? []).map((x) => ({ text: x.text, ok: Boolean(x.ok), blocked: Boolean(x.blocked) }));
  stat[r.verdict] = (stat[r.verdict] ?? 0) + 1;
  perAc.push({ id, verdict: r.verdict, checks });
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
  // AC 号后允许一个可选的字母后缀（如 AC-40b.*：真实面复验的主证据）；
  // 仍按前 5 位归到所属 AC，不影响任何判定。
  evidenceFiles = fs.readdirSync(EVID).filter((f) => /^(AC-\d{2})[a-z]?\.(.+)\.(json|jsonl|txt)$/.test(f)).sort();
} catch { /* ignore */ }
const acOfFile = (f) => (f.match(/^(AC-\d{2})[a-z]?\./) ?? [])[1] ?? null;
const covered = new Set(evidenceFiles.map(acOfFile).filter(Boolean));

const cell = (s, n = 260) => String(s ?? '').replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').slice(0, n);

const head = [
  '# I1.3 验收记录（夹具面）', '',
  '> 依据：`docs/iterations/iteration-3/requirement.md` §3.1（AC-01~AC-45，逐条 Given/When/Then）、附录 A-1/A-2/A-3（输出逐字版式）、附录 D-4~D-10（常量、文案、状态结构、夹具契约）。',
  `> 执行：${process.platform} / Node ${process.version} / 仓库 \`${REPO}\`；每条 AC 一个独立项目根 \`%TEMP%/maestro-acc-p3/<AC>/\`，跑完 \`orch core stop\` 并回收核心。`,
  '> 生成：`probe/acc3-f-run.mjs` 逐条取证（evidence + parts + results.jsonl）→ `probe/acc3-f-final.mjs` 重建本文件。判定只认需求原文的 Then/And；每条证据均可独立复核（原始 state/events/output 全文落盘）。', '',
  '## 0. 总判', '',
  `**45 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}**`, '',
  `- 已产出证据：${AC_ORDER.length - missing.length} 条；未登记或未执行：${missing.length ? missing.join('、') : '无'}。`,
  `- 证据文件：\`docs/iterations/iteration-3/evidence/\` 下 ${evidenceFiles.length} 个（覆盖 ${covered.size} 条 AC）。`,
  `- 不通过 / 阻塞条目：${bad.length ? bad.map((b) => `${b.id}（${b.verdict}）`).join('、') : '无'}。`,
  '- 机器可读汇总：`probe/acc3-f-summary.json`；单条中间结论：`probe/acc3-f-parts/<AC>.md`；缺陷记录：`probe/acc3-f-blockers.md`。',
  '- 判定口径：`通过` = 该 AC 的全部 Then/And 核对项成立；`不通过` = 有核对项不成立；`阻塞` = 需求要求的行为无法在夹具上观测（或超时），必须在 parts 里写明原因与已尝试路径。', '',
  '## 1. AC 逐条记录（命令 / 需求原文 / 证据 / 判定）', '',
  '> 「原始输出」全文在 `evidence/<AC>.output.json`（每条命令的 stdout+stderr 原样）与 `status.txt`（可读转录）；「状态证据」在 `evidence/<AC>.state.json` 与 `events.jsonl`。', ''
];

const sections = [];
for (const id of AC_ORDER) {
  const md = part(id);
  if (md) { sections.push(md); continue; }
  sections.push([
    `#### ${id}（阻塞：未产出证据与判定）`, '',
    '- 判定：**阻塞**',
    '- 原因：该 AC 尚未登记用例或尚未执行（`node probe/acc3-f-run.mjs ' + id + '` 可补跑）。',
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
  return `| ${id} | ${files.length ? files.map((f) => `\`evidence/${f}\``).join('<br>') : '—'} |`;
});
const section3 = [
  '## 3. 证据索引', '',
  `共 ${evidenceFiles.length} 个文件；每条 AC 至少 \`state.json\` / \`events.jsonl\` / \`meta.json\` / \`output.json\` / \`status.txt\`（无实例时 state 为 null）。`, '',
  '| AC | 证据文件 |', '|---|---|', ...idxRows, ''
];

const doc = [...head, ...sections, ...section2, ...section3].join('\n');
fs.writeFileSync(REPORT, doc, 'utf8');

ensureDir(path.dirname(SUMMARY));
fs.writeFileSync(SUMMARY, JSON.stringify({
  通过: stat.通过,
  不通过: stat.不通过,
  阻塞: stat.阻塞,
  perAc
}, null, 2) + '\n', 'utf8');

console.log(`[final] 45 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}（未登记 ${missing.length}）`);
console.log(`[final] 报告：${path.relative(REPO, REPORT)}；汇总：${path.relative(REPO, SUMMARY)}；证据 ${evidenceFiles.length} 个`);
if (bad.length) console.log(`[final] 非通过：${bad.map((b) => `${b.id}:${b.verdict}`).join(', ')}`);

// 收尾：清掉 BASE 下可能残留的核心。
try {
  for (const d of fs.readdirSync(BASE)) await forceKillCore(path.join(BASE, d));
} catch { /* BASE 不存在则跳过 */ }
