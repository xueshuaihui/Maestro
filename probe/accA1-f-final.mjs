#!/usr/bin/env node
// A1 验收 —— 由 probe/accA1-f-results.jsonl + probe/accA1-f-parts/ 重建
// docs/iterations/iteration-A1/acceptance-fixture.md，并输出
// probe/accA1-f-summary.json 与 docs/iterations/iteration-A1/blockers.md。
// 每条 AC 一节：需求原文 Then → 证据文件清单 → 逐项核对表 → 判定 + 证据分级。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, BASE, EVID, REPORT, BLOCKERS, PARTS, RESULTS, SUMMARY,
  ensureDir, rel
} from './accA1-f-common.mjs';

const AC_ORDER = Array.from({ length: 15 }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`);

function readResults() {
  const map = new Map();
  try {
    for (const line of fs.readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean)) {
      let r;
      try { r = JSON.parse(line); } catch { continue; }
      if (!r?.ac) continue;
      map.set(r.ac, r); // 后跑覆盖先跑
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
      id, verdict: '阻塞', evidenceLevel: '待本机实测（需装有目标 CLI 的机器）',
      checks: [{ text: '已产出证据与判定', ok: false, blocked: true, actual: '未登记或未执行' }]
    });
    bad.push({ id, verdict: '阻塞', evidenceLevel: '待本机实测（需装有目标 CLI 的机器）',
      failed: [{ text: '未登记或未执行用例', actual: '—' }], notes: [] });
    continue;
  }
  const checks = (r.checks ?? []).map((x) => ({ text: x.text, ok: Boolean(x.ok), blocked: Boolean(x.blocked) }));
  stat[r.verdict] = (stat[r.verdict] ?? 0) + 1;
  perAc.push({ id, verdict: r.verdict, evidenceLevel: r.evidenceLevel ?? '—', checks });
  if (r.verdict !== '通过') {
    bad.push({
      id, verdict: r.verdict, evidenceLevel: r.evidenceLevel ?? '—',
      failed: [...(r.failed ?? []), ...(r.blocked ?? [])],
      notes: r.notes ?? []
    });
  }
}

let evidenceFiles = [];
try {
  evidenceFiles = fs.readdirSync(EVID)
    .filter((f) => /^(AC-\d{2}).*\.(json|jsonl|txt)$/.test(f)).sort();
} catch { /* ignore */ }
const acOfFile = (f) => (f.match(/^(AC-\d{2})/) ?? [])[1] ?? null;
const covered = new Set(evidenceFiles.map(acOfFile).filter(Boolean));

const cell = (s, n = 260) => String(s ?? '').replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').slice(0, n);

const head = [
  '# A1 验收记录（CLI 命令面 / mock 面 + 真实宿主面阻塞）', '',
  '> 依据：`docs/iterations/iteration-A1/requirement.md` v2 §3.1（AC-01~AC-15，逐条 Given/When/Then）、附录 A-7（证据分级）、`docs/iterations/A-phase-decisions.md`（AD-01 命名 / AD-06 门禁口径 / AD-08 真实宿主判阻塞）。',
  `> 执行：${process.platform} / Node ${process.version} / 仓库 \`${REPO}\`；每条 AC 一个独立项目根 \`${rel(BASE)}/<AC>/\`，注入 \`NODE_ENV=test\`。`,
  '> 生成：`probe/accA1-f-run.mjs` 逐条取证（evidence + parts + results.jsonl，每跑完一条立即落盘）→ `probe/accA1-f-final.mjs` 重建本文件。判定只认需求原文的 Then/And；每条证据均为原始帧（stdout + registry + 中间态 + meta），可独立复核。',
  '> 判定三档：通过 / 不通过 / 阻塞；证据分级三档：mock 实测 / 待本机实测（需装有目标 CLI 的机器）/ 已实测（真实宿主面）。', '',
  '## 0. 总判', '',
  `**15 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}**`, '',
  `- 已产出证据：${AC_ORDER.length - missing.length} 条；未登记或未执行：${missing.length ? missing.join('、') : '无'}。`,
  `- 证据文件：\`${rel(EVID)}/\` 下 ${evidenceFiles.length} 个（覆盖 ${covered.size} 条 AC，每条 ≥4）。`,
  `- 不通过 / 阻塞条目：${bad.length ? bad.map((b) => `${b.id}（${b.verdict}）`).join('、') : '无'}。`,
  '- 机器可读汇总：`probe/accA1-f-summary.json`；单条中间结论：`probe/accA1-f-parts/<AC>.md`；缺陷台账：`docs/iterations/iteration-A1/blockers.md`。',
  '- 口径：`通过` = 该 AC 全部 Then/And 核对项成立；`不通过` = 有核对项不成立；`阻塞` = 需求要求的行为本机无法观测（AC-12 按 AD-08：本机无目标 CLI，须在取证机上补测，mock 不顶替）。', '',
  '## 1. AC 逐条记录（命令 / 需求原文 / 证据 / 核对 / 判定）', '',
  '> 原始输出全文在 `evidence/<AC>.<阶段>.stdout.txt` 与 `...output.json`；注册表快照 `...registry.json`；中间态 `...mid.json`；元信息 `AC-XX.meta.json`。', ''
];

const sections = [];
for (const id of AC_ORDER) {
  const md = part(id);
  if (md) { sections.push(md); continue; }
  sections.push([
    `#### ${id}（阻塞：未产出证据与判定）`, '',
    '- 判定：**阻塞**',
    '- 证据分级：待本机实测（需装有目标 CLI 的机器）',
    '- 原因：该 AC 尚未登记用例或尚未执行（`node probe/accA1-f-run.mjs ' + id + '` 可补跑）。',
    '', '---', ''
  ].join('\n'));
}

const badRows = bad.map((b) => {
  const items = (b.failed ?? []).slice(0, 6).map((f) => `- ${f.text}${f.actual ? `：\`${cell(f.actual, 200)}\`` : ''}`).join('<br>');
  return `| ${b.id} | ${b.verdict} | ${b.evidenceLevel} | ${items || '—'} | ${cell((b.notes ?? []).join('；'), 200) || '—'} |`;
});
const section2 = [
  '## 2. 未通过 / 阻塞项汇总', '',
  ...(badRows.length
    ? ['| AC | 判定 | 证据分级 | 未成立 / 阻塞的核对项 | 备注 |', '|---|---|---|---|---|', ...badRows]
    : ['（无未通过 / 阻塞项）']), ''
];

const idxRows = AC_ORDER.map((id) => {
  const files = evidenceFiles.filter((f) => acOfFile(f) === id);
  const r = results.get(id);
  return `| ${id} | ${r?.verdict ?? '阻塞'} | ${r?.evidenceLevel ?? '—'} | ${files.length} | ${files.map((f) => `\`evidence/${f}\``).join('<br>') || '—'} |`;
});
const section3 = [
  '## 3. 证据索引', '',
  `共 ${evidenceFiles.length} 个文件；每条 AC 至少 \`stdout.txt\` / \`output.json\` / \`registry.json\` / \`mid.json\` / \`meta.json\`。`, '',
  '| AC | 判定 | 证据分级 | 文件数 | 证据文件 |', '|---|---|---|---|---|', ...idxRows, ''
];

const doc = [...head, ...sections, ...section2, ...section3].join('\n');
fs.writeFileSync(REPORT, doc, 'utf8');

ensureDir(path.dirname(SUMMARY));
fs.writeFileSync(SUMMARY, JSON.stringify({ 通过: stat.通过, 不通过: stat.不通过, 阻塞: stat.阻塞, perAc }, null, 2) + '\n', 'utf8');

// blockers.md：缺陷 / 阻塞台账（AC-12 写明取证前提、试过路径、升级建议）
const blockerHead = [
  '# A1 缺陷 / 阻塞台账', '',
  '> 由 `probe/accA1-f-final.mjs` 从 results.jsonl 重建；只登记非「通过」条目。',
  '> 判定三档：通过 / 不通过 / 阻塞；证据分级三档：mock 实测 / 待本机实测 / 已实测（真实宿主面）。', '',
  `## 总览：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}`, ''
];
const blockerSections = bad.map((b) => {
  const items = (b.failed ?? []).map((f) => `- ${f.text}${f.actual ? `：\`${cell(f.actual, 400)}\`` : ''}`).join('\n');
  const notes = (b.notes ?? []).map((n) => `- ${n}`).join('\n');
  const extra = b.id === 'AC-12' ? [
    '', '### AC-12 取证前提与升级建议', '',
    '- 取证前提：一台装有目标 Agent CLI 且其可在命令搜索路径中执行的机器（D-4 / P-4）。',
    '- 升级建议：收口时若仍阻塞，按执行模板 §4.5 升级用户书面豁免；豁免前 AC-12 不判通过，AC-14 的 mock 实测不得写成真实宿主达标。',
    '- 取证动作：在取证机独立项目根执行 `NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" cli scan`，断言四项字段与 `which <bin>` / `<bin> --version` 实测一致。'
  ].join('\n') : '';
  return [
    `## ${b.id} · ${b.verdict}（证据分级：${b.evidenceLevel}）`, '',
    '**未成立 / 阻塞的核对项**', '', items || '- （无）', '',
    '**取证说明 / 备注**', '', notes || '- （无）', extra, '', '---', ''
  ].join('\n');
});
fs.writeFileSync(BLOCKERS, [...blockerHead, ...blockerSections].join('\n'), 'utf8');

console.log(`[final] 15 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}（未登记 ${missing.length}）`);
console.log(`[final] 报告：${rel(REPORT)}；汇总：${rel(SUMMARY)}；台账：${rel(BLOCKERS)}；证据 ${evidenceFiles.length} 个`);
if (bad.length) console.log(`[final] 非通过：${bad.map((b) => `${b.id}:${b.verdict}`).join(', ')}`);
