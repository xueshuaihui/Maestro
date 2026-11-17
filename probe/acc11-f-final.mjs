#!/usr/bin/env node
/**
 * I1.11 S3 验收 · 由 results.jsonl + parts/ 重建
 *   docs/iterations/iteration-11/acceptance-fixture.md
 *   probe/acc11-f-summary.json
 * 覆盖 AC-01~AC-49（批次 A + 批次 B + 批次 C + 批次 D）。取证请跑 probe/acc11-f-run.mjs --batch a / --batch b / --batch c / --batch d。
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, EVID, REPORT, PARTS, RESULTS, SUMMARY, BASE,
  lastResults, gitHead, forceKillCore, readJson
} from './acc11-f-common.mjs';

const AC_ORDER = Array.from({ length: 49 }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`);

const results = lastResults();
const part = (id) => {
  const p = path.join(PARTS, `${id}.md`);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
};

const stat = { 通过: 0, 不通过: 0, 阻塞: 0 };
const perAc = [];
const bad = [];
const missing = [];
for (const id of AC_ORDER) {
  const r = results.get(id);
  if (!r) {
    missing.push(id);
    stat.阻塞 += 1;
    perAc.push({ id, verdict: '阻塞', evidenceLevel: '阻塞', checks: 0, ok: 0 });
    bad.push({ id, verdict: '阻塞', failed: [{ text: '未登记或未执行用例', actual: '—' }], notes: [] });
    continue;
  }
  stat[r.verdict] = (stat[r.verdict] ?? 0) + 1;
  perAc.push({
    id, verdict: r.verdict, evidenceLevel: r.evidenceLevel,
    title: r.title, face: r.face, checks: r.total, ok: r.ok,
    testRuns: r.testRuns ?? [], evidenceCount: (r.evidence ?? []).length
  });
  if (r.verdict !== '通过') {
    bad.push({ id, verdict: r.verdict, failed: [...(r.failed ?? []), ...(r.blocked ?? [])], notes: r.notes ?? [] });
  }
}

// 证据文件索引（evidence/<AC>/<AC>.<name>.<ext>，含可选字母后缀）
let evidenceFiles = [];
try {
  for (const d of fs.readdirSync(EVID, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(EVID, d.name))) {
      if (/^(AC-\d{2})[a-z]?\.(.+)\.(json|jsonl|txt|log)$/.test(f)) evidenceFiles.push(`${d.name}/${f}`);
    }
  }
  evidenceFiles.sort();
} catch { /* ignore */ }
const acOfFile = (f) => (f.match(/^(AC-\d{2})[a-z]?[./]/) ?? [])[1] ?? null;
const covered = new Set(evidenceFiles.map(acOfFile).filter(Boolean));
const cell = (s, n = 240) => String(s ?? '').replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').slice(0, n);

const head = [
  '# I1.11 验收记录 · 批次 A+B+C+D（AC-01~AC-49）', '',
  '> 依据：`docs/iterations/iteration-11/requirement.md` v13 §3.1（AC-01~49 逐字 Given/When/Then/机检/夹具/架构检查）、附录 A-1~A-12（输出逐字基线）、`decisions.md`（D-39 / D-45 / D-46 / D-52 / D-53 / D-57）。',
  `> 执行：${process.platform} / Node ${process.version} / 仓库 \`${REPO}\` / HEAD \`${gitHead()}\`；每条 AC 一个独立根，机检「先 test -f 再 node --test」，一律 \`NODE_ENV=test\`。`,
  '> 生成：`probe/acc11-f-run.mjs --batch a` 逐条取证（evidence + parts + results.jsonl）→ 本脚本重建。判定只认需求 Then/And；证据分级：已实测（真实宿主）/ mock 实测 / 阻塞。', '',
  '## 0. 总判', '',
  `**批次 A+B+C+D 49 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}**`, '',
  `- 已产出证据：${AC_ORDER.length - missing.length} 条；未登记或未执行：${missing.length ? missing.join('、') : '无'}。`,
  `- 证据文件：\`docs/iterations/iteration-11/evidence/\` 下 ${evidenceFiles.length} 个（覆盖 ${covered.size} 条 AC）。`,
  `- 不通过 / 阻塞条目：${bad.length ? bad.map((b) => `${b.id}（${b.verdict}）`).join('、') : '无'}。`,
  '- 机器可读汇总：`probe/acc11-f-summary.json`；单条中间结论：`probe/acc11-f-parts/<AC>.md`；缺陷台账：`probe/acc11-f-blockers.md`。', '',
  '## 1. AC 逐条记录', '', ''
];

const sections = AC_ORDER.map((id) => {
  const md = part(id);
  if (md) return md;
  return [
    `#### ${id}（阻塞：未产出证据与判定）`, '',
    '- 判定：**阻塞**',
    '- 原因：该 AC 尚未登记用例或尚未执行（`node probe/acc11-f-run.mjs ' + id + '` 可补跑）。', '', '---', ''
  ].join('\n');
});

const badRows = bad.map((b) => {
  const items = (b.failed ?? []).slice(0, 8).map((f) => `- ${f.text}${f.actual ? `：\`${cell(f.actual, 200)}\`` : ''}`).join('<br>');
  return `| ${b.id} | ${b.verdict} | ${items || '—'} | ${cell((b.notes ?? []).join('；'), 200) || '—'} |`;
});
const section2 = [
  '## 2. 未通过 / 阻塞项汇总', '',
  ...(badRows.length ? ['| AC | 判定 | 未成立 / 阻塞的核对项 | 备注 |', '|---|---|---|---|', ...badRows] : ['（无未通过 / 阻塞项）']), ''
];
const idxRows = AC_ORDER.map((id) => {
  const files = evidenceFiles.filter((f) => acOfFile(f) === id);
  return `| ${id} | ${files.length ? files.map((f) => `\`evidence/${f}\``).join('<br>') : '—'} |`;
});
const section3 = [
  '## 3. 证据索引', '',
  `共 ${evidenceFiles.length} 个文件；每条 AC 至少 \`<AC>.test-stdout.txt\` / \`<AC>.meta.json\` / \`<AC>.state.json\` / \`<AC>.check.json\` / \`<AC>.output.json\`。`, '',
  '| AC | 证据文件 |', '|---|---|', ...idxRows, ''
];

const doc = [...head, ...sections, ...section2, ...section3].join('\n');
fs.writeFileSync(REPORT, doc, 'utf8');

fs.writeFileSync(SUMMARY, JSON.stringify({
  batch: 'a+b+c+d', acFrom: 'AC-01', acTo: 'AC-49', head: gitHead(),
  通过: stat.通过, 不通过: stat.不通过, 阻塞: stat.阻塞,
  acCount: AC_ORDER.length, missing,
  evidenceFileCount: evidenceFiles.length,
  perAc, bad
}, null, 2) + '\n', 'utf8');

console.log(`[final] 批次 A+B+C+D ${AC_ORDER.length} 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}（未登记 ${missing.length}）`);
console.log(`[final] 报告：${path.relative(REPO, REPORT)}；汇总：${path.relative(REPO, SUMMARY)}；证据 ${evidenceFiles.length} 个`);
if (bad.length) console.log(`[final] 非通过：${bad.map((b) => `${b.id}:${b.verdict}`).join(', ')}`);

try { for (const d of fs.readdirSync(BASE)) await forceKillCore(path.join(BASE, d)); } catch { /* ignore */ }
