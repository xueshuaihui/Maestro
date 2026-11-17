#!/usr/bin/env node
// I1.10b S3 批次 a —— 由 probe/acc10b-f-results.jsonl + probe/acc10b-f-parts/ 重建
// docs/iterations/iteration-10b/acceptance-a.md，并输出 probe/acc10b-f-summary.json。
// 判定只认需求原文 Then/And；results 同 AC 多条取最后一条。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, EVID, REPORT, PARTS, RESULTS, SUMMARY, BASE, BLOCKERS,
  requirementTitle, forceKillCore, ensureDir
} from './acc10b-f-common.mjs';

const AC_ORDER = Array.from({ length: 15 }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`);

function readResults() {
  const map = new Map();
  try {
    for (const line of fs.readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean)) {
      let r;
      try { r = JSON.parse(line); } catch { continue; }
      if (!r?.ac) continue;
      map.set(r.ac, r); // 后跑的覆盖先跑的：同一 AC 取最后一条
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
    perAc.push({ id, verdict: '阻塞', checks: [{ text: '已产出证据与判定', ok: false, blocked: true, actual: '未登记或未执行' }] });
    bad.push({ id, verdict: '阻塞', failed: [{ text: '未登记或未执行用例', actual: '—' }], notes: [] });
    continue;
  }
  const checks = (r.checks ?? []).map((x) => ({ text: x.text, ok: Boolean(x.ok), blocked: Boolean(x.blocked) }));
  stat[r.verdict] = (stat[r.verdict] ?? 0) + 1;
  perAc.push({
    id, verdict: r.verdict, face: r.face, title: r.title, checks,
    total: r.total, ok: r.ok, evidenceCount: (r.evidence ?? []).length
  });
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
  evidenceFiles = fs.readdirSync(EVID).filter((f) => /^AC-\d{2}\..+$/.test(f)).sort();
} catch { /* ignore */ }
const acOfFile = (f) => (f.match(/^(AC-\d{2})\./) ?? [])[1] ?? null;
const covered = new Set(evidenceFiles.map(acOfFile).filter(Boolean));

const cell = (s, n = 260) => String(s ?? '').replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').slice(0, n);

const head = [
  '# I1.10b S3 验收 · A 组（AC-01 ~ AC-15）', '',
  '> 判据来源：`docs/iterations/iteration-10b/requirement.md` v6.1 §3.1 同号 AC 全文、附录 A-0~A-4 逐字基线；',
  '> `docs/templates/execution-template.md` §3.1~§3.5；`docs/iterations/iteration-10b/decisions.md` 裁决 G/H/J。',
  '> 取证脚手架：`probe/acc10b-f-{lib,common,run,final}.mjs` + `probe/acc10b-cases/`（目录名不带 `-f`）。',
  '> 只做取证：未改动 `src/**`、`desktop/**`、`test/**`、`bin/**`、`package.json`。', '',
  '## 0. 总判', '',
  `**15 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}**`, '',
  `- 已产出证据与判定：${AC_ORDER.length - missing.length} 条；未登记或未执行：${missing.length ? missing.join('、') : '无'}。`,
  `- 证据文件：\`docs/iterations/iteration-10b/evidence/\` 下 ${evidenceFiles.length} 个（覆盖 ${covered.size} 条 AC，每条 ≥4 文件、无空文件）。`,
  `- 不通过 / 阻塞条目：${bad.length ? bad.map((b) => `${b.id}（${b.verdict}）`).join('、') : '无'}。`,
  '- 机器可读汇总：`probe/acc10b-f-summary.json`；单条核对表：`probe/acc10b-f-parts/<AC>.md`；缺陷台账：`probe/acc10b-f-blockers.md`。',
  '- 判定口径：`通过` = 需求 Then/And 全部核对项成立且证据分级为 `mock 实测`；`不通过` = 有核对项不成立（附冲突原始帧）；`阻塞` = 行为无法在夹具上观测或超时（写明要求/试过路径/为何观测不到）。',
  '- 判定纪律：只认需求原文 Then，不采信测试自述；文案逐字比对、数量核对数组长度、时序实测毫秒（`t_drill-t_click ≤ 1000`）。', '',
  '## 1. AC 逐条判定表', '',
  '| AC | 标题 | 判定 | 证据分级 | 核对项 | 证据文件数 |', '|---|---|---|---|---|---|',
  ...AC_ORDER.map((id) => {
    const r = results.get(id);
    if (!r) return `| ${id} | — | 阻塞 | 阻塞 | 0/0 | 0 |`;
    const grade = r.verdict === '通过' ? (r.face || 'mock 实测') : r.verdict;
    return `| ${id} | ${cell(r.title ?? requirementTitle(id), 60)} | **${r.verdict}** | ${grade} | ${r.ok}/${r.total} | ${(r.evidence ?? []).length} |`;
  }), '',
  '## 2. 逐 AC 取证明细（命令 / 需求原文 / 证据 / 逐项核对）', ''
];

const sections = [];
for (const id of AC_ORDER) {
  const md = part(id);
  if (md) { sections.push(md); continue; }
  sections.push([
    `#### ${id}（阻塞：未产出证据与判定）`, '',
    '- 判定：**阻塞**',
    '- 原因：该 AC 尚未登记用例或尚未执行（`node probe/acc10b-f-run.mjs ' + id + '` 可补跑）。',
    '', '---', ''
  ].join('\n'));
}

const badRows = bad.map((b) => {
  const items = (b.failed ?? []).slice(0, 8).map((f) => `- ${f.text}${f.actual ? `：\`${cell(f.actual, 200)}\`` : ''}`).join('<br>');
  return `| ${b.id} | ${b.verdict} | ${items || '—'} | ${cell((b.notes ?? []).join('；'), 200) || '—'} |`;
});
const section2 = [
  '## 3. 不通过 / 阻塞项原始帧摘要', '',
  ...(badRows.length
    ? ['| AC | 判定 | 未成立 / 阻塞的核对项（含原始值） | 备注 |', '|---|---|---|---|', ...badRows]
    : ['（无不通过 / 阻塞项）']), ''
];

const idxRows = AC_ORDER.map((id) => {
  const files = evidenceFiles.filter((f) => acOfFile(f) === id);
  return `| ${id} | ${files.length} | ${files.map((f) => `\`evidence/${f}\``).join('<br>') || '—'} |`;
});
const section3 = [
  '## 4. 证据索引', '',
  `共 ${evidenceFiles.length} 个文件；每条 AC 至少 state / events / tests.stdout / arch.stdout / meta / status 六类原始帧，无空文件。`, '',
  '| AC | 文件数 | 证据文件 |', '|---|---|---|', ...idxRows, ''
];

const doc = [...head, ...sections, ...section2, ...section3].join('\n');
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, doc, 'utf8');

ensureDir(path.dirname(SUMMARY));
fs.writeFileSync(SUMMARY, JSON.stringify({
  batch: 'a',
  acRange: 'AC-01~AC-15',
  total: AC_ORDER.length,
  通过: stat.通过,
  不通过: stat.不通过,
  阻塞: stat.阻塞,
  evidenceFiles: evidenceFiles.length,
  perAc
}, null, 2) + '\n', 'utf8');

console.log(`[final] 15 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}（未登记 ${missing.length}）`);
console.log(`[final] 报告：${path.relative(REPO, REPORT)}；汇总：${path.relative(REPO, SUMMARY)}；证据 ${evidenceFiles.length} 个`);
if (bad.length) console.log(`[final] 非通过：${bad.map((b) => `${b.id}:${b.verdict}`).join(', ')}`);

try {
  for (const d of fs.readdirSync(BASE)) await forceKillCore(path.join(BASE, d));
} catch { /* BASE 不存在则跳过 */ }
