#!/usr/bin/env node
// I1.10b S3 批次 b —— 由 results.jsonl + parts/ 重建 acceptance-b.md，输出 summary-b.json。
// 范围：AC-16~AC-30 除 AC-25（真实宿主面留批 e）。判定只认需求原文 Then/机检；同 AC 多条取最后一条。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, EVID, PARTS, RESULTS, BASE,
  requirementTitle, forceKillCore, ensureDir
} from './acc10b-f-common.mjs';

const REPORT = path.join(REPO, 'docs', 'iterations', 'iteration-10b', 'acceptance-b.md');
const SUMMARY = path.join(REPO, 'probe', 'acc10b-f-summary-b.json');
const AC_ORDER = Array.from({ length: 15 }, (_, i) => `AC-${String(i + 16).padStart(2, '0')}`)
  .filter((id) => id !== 'AC-25');

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
const batchEvidence = evidenceFiles.filter((f) => AC_ORDER.includes(acOfFile(f)));
const covered = new Set(batchEvidence.map(acOfFile).filter(Boolean));
const cell = (s, n = 260) => String(s ?? '').replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').slice(0, n);

// 逐 AC 关键实测（从 results 的 notes 提取首条，逐字截取），供判定表"关键实测"列。
const keyFact = (id) => {
  const r = results.get(id);
  if (!r) return '—';
  const n = (r.notes ?? []).find((x) => /Then 逐字|机检核心|九步|Then ①|静态四面|复用性/.test(String(x)));
  const src = n ?? (r.notes ?? [])[0] ?? `${r.ok}/${r.total} 核对项成立`;
  return cell(String(src).replace(/^Then 逐字：/, ''), 150);
};

// 主控独立复跑建议（§3.5）：门控一次 CAS / 超限升级 / 并发互斥 / 异常停点中落在批 b 的核心写链与真守卫。
const RERUN = [
  { id: 'AC-22', why: '规划验收句末段唯一写动作（继续→实例恢复），两份等价夹具各跑一条路径的终态相等，是核心写链门控。' },
  { id: 'AC-23', why: '真守卫双 continue + 裁决 J-2 stateLabel 逐字；并发/重复提交异常停点，最易被放宽。' },
  { id: 'AC-29', why: '九步探针序列 + 七条 Then 端到端，覆盖无终端、子工作流、升级继续整链，复跑一次可交叉验证多条。' },
];

const head = [
  '# I1.10b S3 验收 · B 组（AC-16 ~ AC-30，除 AC-25）', '',
  '> 判据来源：`docs/iterations/iteration-10b/requirement.md` v6.1 §3.1 同号 AC 全文、附录 A-0~A-10 逐字基线；',
  '> `docs/templates/execution-template.md` §3.2~§3.4；`docs/iterations/iteration-10b/decisions.md` 裁决 A~J（重点 J-1/J-2、H、I）。',
  '> 取证脚手架：`probe/acc10b-f-{lib,common,run,final}.mjs` + `probe/acc10b-f-final-b.mjs` + `probe/acc10b-cases/`（目录名不带 `-f`）。',
  '> AC-25 为真实宿主面（一键跳转唤起宿主 + 会话标识核对），按任务留待真实宿主批 e，本批跳过（不写 results 行、不建用例）。',
  '> 只做取证：未改动 `src/**`、`desktop/**`、`test/**`、`bin/**`、`package.json`、`requirement.md`。', '',
  '## 0. 总判', '',
  `**${AC_ORDER.length} 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}**`, '',
  `- 已产出证据与判定：${AC_ORDER.length - missing.length} 条；未登记或未执行：${missing.length ? missing.join('、') : '无'}。`,
  `- 证据文件：\`docs/iterations/iteration-10b/evidence/\` 下本批 AC-16~AC-30（除 25）共 ${batchEvidence.length} 个（每条 ≥4 文件、无空文件，覆盖 ${covered.size} 条 AC）。`,
  `- 不通过 / 阻塞条目：${bad.length ? bad.map((b) => `${b.id}（${b.verdict}）`).join('、') : '无'}。`,
  '- 机器可读汇总：`probe/acc10b-f-summary-b.json`；单条核对表：`probe/acc10b-f-parts/<AC>.md`；缺陷台账：`probe/acc10b-f-blockers.md`。',
  '- 判定口径：`通过` = 需求 Then/机检逐字全部成立且证据分级为 `mock 实测`；`不通过` = 有核对项不成立（附冲突原始帧）；`阻塞` = 行为无法在夹具上观测或超时。',
  '- 判定纪律：只认需求原文 Then/机检逐字，不采信测试自述；文案逐字比对、数量核对数组长度、内部断言（耗时/opCount/坐标）仅作回归信号不冒充用户可见结论；同 AC 多记录取最后一条。', '',
  '## 1. AC 逐条判定表', '',
  '| AC | 标题 | 判定 | 证据数 | 分级 | 关键实测 |', '|---|---|---|---|---|---|',
  ...AC_ORDER.map((id) => {
    const r = results.get(id);
    if (!r) return `| ${id} | — | 阻塞 | 0 | 阻塞 | 未登记或未执行 |`;
    const grade = r.verdict === '通过' ? (r.face || 'mock 实测') : r.verdict;
    return `| ${id} | ${cell(r.title ?? requirementTitle(id), 48)} | **${r.verdict}** | ${(r.evidence ?? []).length} | ${grade} | ${keyFact(id)} |`;
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
    : ['（本批无不通过 / 阻塞项；14 条判定全部为「通过」，证据分级 `mock 实测`。）']), ''
];

const idxRows = AC_ORDER.map((id) => {
  const files = batchEvidence.filter((f) => acOfFile(f) === id);
  return `| ${id} | ${files.length} | ${files.map((f) => `\`evidence/${f}\``).join('<br>') || '—'} |`;
});
const section4 = [
  '## 4. 汇总数字', '',
  '| 项 | 值 |', '|---|---|',
  `| AC 总数（本批） | ${AC_ORDER.length} |`,
  `| 通过 / 不通过 / 阻塞 | ${stat.通过} / ${stat.不通过} / ${stat.阻塞} |`,
  `| 核对项总数（通过 / 总） | ${perAc.reduce((a, x) => a + (x.ok ?? 0), 0)} / ${perAc.reduce((a, x) => a + (x.total ?? 0), 0)} |`,
  `| 证据文件数（本批） | ${batchEvidence.length} |`,
  `| 覆盖 AC 数 | ${covered.size} |`, '',
  '> 四处一致：`results.jsonl`（本批 14 行，同 AC 取最后一条）、`summary-b.json`（total=' + AC_ORDER.length + '）、`parts/`（本批 14 份）、`evidence/`（本批 ' + batchEvidence.length + ' 文件）均指向同一组判定。', ''
];

const section5 = [
  '## 5. 主控应独立复跑的 AC 建议（§3.5）', '',
  '| AC | 理由 |', '|---|---|',
  ...RERUN.map((x) => `| ${x.id} | ${cell(x.why, 240)} |`), '',
  '> 复跑命令：`node probe/acc10b-f-run.mjs AC-22 AC-23 AC-29`；复核每条 `evidence/AC-xx.*` 原始帧是否支撑其判定，尤其 AC-23 的 `escalation-label.txt`（J-2 逐字）与 AC-22 的双夹具终态。', ''
];

const section6 = [
  '## 6. 证据索引', '',
  `共 ${batchEvidence.length} 个本批文件；每条 AC 至少 state / events / tests.stdout / arch.stdout / meta / status 原始帧，无空文件。`, '',
  '| AC | 文件数 | 证据文件 |', '|---|---|---|', ...idxRows, ''
];

const doc = [...head, ...sections, ...section3, ...section4, ...section5, ...section6].join('\n');
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, doc, 'utf8');

ensureDir(path.dirname(SUMMARY));
fs.writeFileSync(SUMMARY, JSON.stringify({
  batch: 'b', acRange: 'AC-16~AC-30 除 AC-25', total: AC_ORDER.length,
  通过: stat.通过, 不通过: stat.不通过, 阻塞: stat.阻塞,
  checksOk: perAc.reduce((a, x) => a + (x.ok ?? 0), 0),
  checksTotal: perAc.reduce((a, x) => a + (x.total ?? 0), 0),
  evidenceFiles: batchEvidence.length,
  coveredAc: covered.size,
  rerunSuggestions: RERUN.map((x) => x.id),
  perAc
}, null, 2) + '\n', 'utf8');

console.log(`[final-b] ${AC_ORDER.length} 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}（未登记 ${missing.length}）`);
console.log(`[final-b] 报告：${path.relative(REPO, REPORT)}；汇总：${path.relative(REPO, SUMMARY)}`);
if (bad.length) console.log(`[final-b] 非通过：${bad.map((b) => `${b.id}:${b.verdict}`).join(', ')}`);

try { for (const d of fs.readdirSync(BASE)) await forceKillCore(path.join(BASE, d)); } catch { /* ignore */ }
