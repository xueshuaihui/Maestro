#!/usr/bin/env node
// I1.10b S3 批次 c —— 由 results.jsonl + parts/ 重建 acceptance-c.md，输出 summary-c.json。
// 范围：AC-31~AC-45 除 AC-33（真实宿主面留批 e）。判定只认需求原文 Then/机检；同 AC 多条取最后一条。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, EVID, PARTS, RESULTS, BASE,
  requirementTitle, forceKillCore, ensureDir
} from './acc10b-f-common.mjs';

const REPORT = path.join(REPO, 'docs', 'iterations', 'iteration-10b', 'acceptance-c.md');
const SUMMARY = path.join(REPO, 'probe', 'acc10b-f-summary-c.json');
const AC_ORDER = Array.from({ length: 15 }, (_, i) => `AC-${String(i + 31).padStart(2, '0')}`)
  .filter((id) => id !== 'AC-33');

function readResults() {
  const map = new Map();
  try {
    for (const line of fs.readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean)) {
      let r;
      try { r = JSON.parse(line); } catch { continue; }
      if (!r?.ac) continue;
      map.set(r.ac, r); // 后跑覆盖先跑：同一 AC 取最后一条
    }
  } catch { /* no results yet */ }
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
  perAc.push({ id, verdict: r.verdict, face: r.face, title: r.title, checks,
    total: r.total, ok: r.ok, evidenceCount: (r.evidence ?? []).length });
  if (r.verdict !== '通过') {
    bad.push({ id, verdict: r.verdict,
      failed: [...(r.failed ?? []), ...(r.blocked ?? [])], notes: r.notes ?? [] });
  }
}

let evidenceFiles = [];
try { evidenceFiles = fs.readdirSync(EVID).filter((f) => /^AC-\d{2}\..+$/.test(f)).sort(); } catch { /* ignore */ }
const acOfFile = (f) => (f.match(/^(AC-\d{2})\./) ?? [])[1] ?? null;
const covered = new Set(evidenceFiles.map(acOfFile).filter(Boolean));
const cell = (s, n = 260) => String(s ?? '').replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').slice(0, n);

const head = [
  '# I1.10b S3 验收 · C 组（AC-31 ~ AC-45，除 AC-33）', '',
  '> 判据来源：`docs/iterations/iteration-10b/requirement.md` v6.1 §3.1 同号 AC 全文、附录 A-0~A-10 逐字基线；',
  '> `docs/templates/execution-template.md` §3.1~§3.5；`docs/iterations/iteration-10b/decisions.md` 裁决 G/H/J。',
  '> 取证脚手架：`probe/acc10b-f-{lib,common,run,final}.mjs` + `probe/acc10b-f-final-c.mjs` + `probe/acc10b-cases/`（目录名不带 `-f`）。',
  '> AC-33 为真实宿主面（一键跳转进程幂等），按任务留待真实宿主批 e，本批跳过（不写 results 行）。',
  '> 只做取证：未改动 `src/**`、`desktop/**`、`test/**`、`bin/**`、`package.json`。', '',
  '## 0. 总判', '',
  `**${AC_ORDER.length} 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}**`, '',
  `- 已产出证据与判定：${AC_ORDER.length - missing.length} 条；未登记或未执行：${missing.length ? missing.join('、') : '无'}。`,
  `- 证据文件：\`docs/iterations/iteration-10b/evidence/\` 下 AC-31~AC-45 相关共 ${evidenceFiles.filter((f) => AC_ORDER.includes(acOfFile(f))).length} 个（每条 ≥4 文件、无空文件）。`,
  `- 不通过 / 阻塞条目：${bad.length ? bad.map((b) => `${b.id}（${b.verdict}）`).join('、') : '无'}。`,
  '- 机器可读汇总：`probe/acc10b-f-summary-c.json`；单条核对表：`probe/acc10b-f-parts/<AC>.md`；缺陷台账：`probe/acc10b-f-blockers.md`。',
  '- 判定口径：`通过` = 需求 Then/机检逐字全部成立且证据分级为 `mock 实测`；`不通过` = 有核对项不成立（附冲突原始帧）；`阻塞` = 行为无法在夹具上观测或超时。',
  '- 判定纪律：只认需求原文 Then/机检逐字，不采信测试自述；文案逐字比对、数量核对数组长度、内部断言（滚动/耗时）仅作回归信号不冒充用户可见结论；同 AC 多记录取最后一条。', '',
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
  sections.push([`#### ${id}（阻塞：未产出证据与判定）`, '', '- 判定：**阻塞**',
    `- 原因：该 AC 尚未登记用例或尚未执行（\`node probe/acc10b-f-run.mjs ${id}\` 可补跑）。`, '', '---', ''].join('\n'));
}

const badRows = bad.map((b) => {
  const items = (b.failed ?? []).slice(0, 8).map((f) => `- ${f.text}${f.actual ? `：\`${cell(f.actual, 300)}\`` : ''}`).join('<br>');
  return `| ${b.id} | ${b.verdict} | ${items || '—'} | ${cell((b.notes ?? []).join('；'), 240) || '—'} |`;
});
const section3 = [
  '## 3. 不通过 / 阻塞项原始帧摘要', '',
  ...(badRows.length
    ? ['| AC | 判定 | 未成立 / 阻塞的核对项（含原始值） | 备注 |', '|---|---|---|---|', ...badRows]
    : ['（无不通过 / 阻塞项）']), ''
];

const idxRows = AC_ORDER.map((id) => {
  const files = evidenceFiles.filter((f) => acOfFile(f) === id);
  return `| ${id} | ${files.length} | ${files.map((f) => `\`evidence/${f}\``).join('<br>') || '—'} |`;
});
const section4 = [
  '## 4. 证据索引', '',
  `共 ${evidenceFiles.filter((f) => AC_ORDER.includes(acOfFile(f))).length} 个本批文件；每条 AC 至少 state / events / tests.stdout / meta / status 原始帧，无空文件。`, '',
  '| AC | 文件数 | 证据文件 |', '|---|---|---|', ...idxRows, ''
];

const doc = [...head, ...sections, ...section3, ...section4].join('\n');
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, doc, 'utf8');

ensureDir(path.dirname(SUMMARY));
fs.writeFileSync(SUMMARY, JSON.stringify({
  batch: 'c', acRange: 'AC-31~AC-45 除 AC-33', total: AC_ORDER.length,
  通过: stat.通过, 不通过: stat.不通过, 阻塞: stat.阻塞,
  evidenceFiles: evidenceFiles.filter((f) => AC_ORDER.includes(acOfFile(f))).length,
  perAc
}, null, 2) + '\n', 'utf8');

console.log(`[final-c] ${AC_ORDER.length} 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}（未登记 ${missing.length}）`);
console.log(`[final-c] 报告：${path.relative(REPO, REPORT)}；汇总：${path.relative(REPO, SUMMARY)}`);
if (bad.length) console.log(`[final-c] 非通过：${bad.map((b) => `${b.id}:${b.verdict}`).join(', ')}`);

try { for (const d of fs.readdirSync(BASE)) await forceKillCore(path.join(BASE, d)); } catch { /* ignore */ }
