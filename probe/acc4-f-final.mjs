#!/usr/bin/env node
// WP-8 / I1.4 验收 —— 由 probe/acc4-f-results.jsonl + probe/acc4-f-parts/ 重建统计。
//
//   默认：只打印统计（已执行 / 未执行 / 通过 / 不通过 / 阻塞），不生成两文档。
//   --emit-docs：额外生成 acceptance-fixture.md 与 report.md（留给最后一批统一执行）。
//
// 尚无任何结果行的 AC 一律标「未执行」，绝不按通过统计；也不冒充「阻塞」。
// 支持「修完只重跑受影响批次」：results.jsonl 后写覆盖先写（Map.set 覆盖）。
const EMIT_DOCS = process.argv.includes('--emit-docs');
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, EVID, REPORT, REPORT_MD, PARTS, RESULTS, SUMMARY, BASE,
  forceKillCore, ensureDir,
} from './acc4-f-common.mjs';

const AC_ORDER = Array.from({ length: 70 }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`);
const BATCH_LABEL = (id) => {
  const n = Number(id.slice(3));
  if (n <= 15) return 'a';
  if (n <= 30) return 'b';
  if (n <= 45) return 'c';
  if (n <= 60) return 'd';
  return 'e';
};

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

const stat = { 通过: 0, 不通过: 0, 阻塞: 0, 未执行: 0 };
const gradeStat = { '已实测（真实宿主）': 0, 'mock 实测': 0, '阻塞': 0, '未执行': 0 };
const perAc = [];
const missing = [];
const bad = [];
const batchStat = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((k) => [k, { 通过: 0, 不通过: 0, 阻塞: 0, 未执行: 0 }]));

for (const id of AC_ORDER) {
  const r = results.get(id);
  const bk = BATCH_LABEL(id);
  if (!r) {
    // 本批未交付的 AC：如实标「未执行」，不计入通过/不通过/阻塞。
    missing.push(id);
    stat.未执行 += 1; batchStat[bk].未执行 += 1;
    gradeStat['未执行'] += 1;
    perAc.push({ id, verdict: '未执行', grade: '未执行', checks: [{ text: '本次尚未执行', ok: false, blocked: false }] });
    continue;
  }
  const checks = (r.checks ?? []).map((x) => ({ text: x.text, ok: Boolean(x.ok), blocked: Boolean(x.blocked) }));
  stat[r.verdict] = (stat[r.verdict] ?? 0) + 1;
  batchStat[bk][r.verdict] = (batchStat[bk][r.verdict] ?? 0) + 1;
  const g = r.grade ?? 'mock 实测';
  gradeStat[g] = (gradeStat[g] ?? 0) + 1;
  perAc.push({ id, verdict: r.verdict, grade: g, checks });
  if (r.verdict !== '通过') {
    bad.push({ id, verdict: r.verdict, grade: g,
      failed: [...(r.failed ?? []), ...(r.blocked ?? [])], notes: r.notes ?? [] });
  }
}

let evidenceFiles = [];
try {
  evidenceFiles = fs.readdirSync(EVID).filter((f) => /^(AC-\d{2})[a-z]?\.(.+)\.(json|jsonl|txt|md)$/.test(f)).sort();
} catch { /* ignore */ }
const acOfFile = (f) => (f.match(/^(AC-\d{2})[a-z]?\./) ?? [])[1] ?? null;
const covered = new Set(evidenceFiles.map(acOfFile).filter(Boolean));
const cell = (s, n = 260) => String(s ?? '').replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').slice(0, n);

const executed = AC_ORDER.length - missing.length;
const finalLine = `70 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞} / 未执行 ${stat.未执行}`;
const execLine = `已执行 ${executed} / 未执行 ${missing.length}`;

// NFR 性能证据：test/wp11/perf.test.js 把实测耗时落盘到 evidence/nfr-perf-*.json。
// 这里只做报告引用，不设墙钟阈值（§7.2 白名单两条 perf 是负载相关豁免项）。
let nfrFiles = [];
try {
  nfrFiles = fs.readdirSync(EVID).filter((f) => /^nfr-perf-.*\.json$/.test(f)).sort();
} catch { /* ignore */ }
const nfrData = nfrFiles.map((f) => {
  try { return { file: f, data: JSON.parse(fs.readFileSync(path.join(EVID, f), 'utf8')) }; }
  catch { return { file: f, data: null }; }
});

const head = [
  '# I1.4 验收记录（夹具面 / WP-8）', '',
  '> 依据：`docs/iterations/iteration-4/requirement.md` v26 §3.1（AC-01~AC-70，逐条 Given/When/Then/机检）、§3.2 NFR-01~07、§3.3 前置条件、附录 A-1~A-6（输出/状态页/提示词逐字基线）、附录 D-10（测试接缝）、NFR-06 基线说明。',
  `> 执行：${process.platform} / Node ${process.version} / 仓库 \`${REPO}\`；每条 AC 一个独立项目根 \`os.tmpdir()/maestro-acc-p4/<AC>/\`，跑完 \`orch core stop\` 并回收核心。当前环境 **macOS、无 DSH 真实宿主**（真实宿主为 Windows 侧能力），全部 AC 走 mock ACP agent 夹具面。`,
  '> 生成：`probe/acc4-f-run.mjs` 逐条取证（evidence + parts + results.jsonl）→ `probe/acc4-f-final.mjs` 重建本文件。判定只认需求原文的 Then/机检；每条证据均可独立复核（原始 state/events/stdout/status.md 全文落盘）。', '',
  '## 0. 总判', '',
  `**${finalLine}**`, '',
  `**${execLine}**`, '',
  `- 已产出证据：${executed} 条；${missing.length ? `未执行：${missing.join('、')}` : '未执行：无'}。`,
  `- 证据文件：\`docs/iterations/iteration-4/evidence/\` 下 ${evidenceFiles.length} 个（覆盖 ${covered.size} 条 AC）。`,
  `- 证据分级：已实测（真实宿主）${gradeStat['已实测（真实宿主）']} 条 / mock 实测 ${gradeStat['mock 实测']} 条 / 阻塞 ${gradeStat['阻塞']} 条 / 未执行 ${gradeStat['未执行']} 条。`,
  `- 不通过 / 阻塞条目：${bad.length ? bad.map((b) => `${b.id}（${b.verdict}）`).join('、') : '无'}。`,
  '- 机器可读汇总：`probe/acc4-f-summary.json`；单条中间结论：`probe/acc4-f-parts/<AC>.md`。',
  '- 判定口径：`通过` = 该 AC 的全部 Then/机检核对项成立；`不通过` = 有核对项不成立；`阻塞` = 需求要求的行为无法在夹具上观测（或环境不具备），必须在 parts 里写明原因与已尝试路径；`未执行` = 本批尚未交付，绝不假报通过。', '',
  '## 0.1 分批结果（a=AC-01~15 / b=16~30 / c=31~45 / d=46~60 / e=61~70）', '',
  '| 批次 | 区间 | 通过 | 不通过 | 阻塞 | 未执行 |', '|---|---|---|---|---|---|',
  ...Object.entries(batchStat).map(([k, s]) => {
    const ranges = { a: 'AC-01~15', b: 'AC-16~30', c: 'AC-31~45', d: 'AC-46~60', e: 'AC-61~70' };
    return `| ${k} | ${ranges[k]} | ${s.通过} | ${s.不通过} | ${s.阻塞} | ${s.未执行} |`;
  }), '',
  '## 1. AC 逐条记录（命令 / 需求原文 / 证据 / 判定）', '',
  '> 「原始输出」全文在 `evidence/<AC>.output.json`（每条命令的 stdout+stderr 原样）与 `status.txt`（可读转录）；「状态证据」在 `evidence/<AC>.state.json` 与 `events.jsonl`。', '',
];

const sections = [];
for (const id of AC_ORDER) {
  const md = part(id);
  if (md) { sections.push(md); continue; }
  sections.push([
    `#### ${id}（未执行）`, '',
    '- 判定：**未执行**（本批未交付，非通过、非阻塞）',
    '- 证据分级：未执行',
    `- 原因：该 AC 尚未登记用例或尚未执行（后续批次 \`node probe/acc4-f-run.mjs ${id}\` 可补跑）。`,
    '', '---', '',
  ].join('\n'));
}

const badRows = bad.map((b) => {
  const items = (b.failed ?? []).slice(0, 6).map((f) => `- ${f.text}${f.actual ? `：\`${cell(f.actual, 200)}\`` : ''}`).join('<br>');
  return `| ${b.id} | ${b.verdict} | ${b.grade ?? '-'} | ${items || '-'} | ${cell((b.notes ?? []).join('；'), 200) || '-'} |`;
});
const section2 = [
  '## 2. 未通过 / 阻塞项汇总', '',
  ...(badRows.length
    ? ['| AC | 判定 | 分级 | 未成立 / 阻塞的核对项 | 备注 |', '|---|---|---|---|---|', ...badRows]
    : ['（无未通过 / 阻塞项）']), '',
];

const idxRows = AC_ORDER.map((id) => {
  const files = evidenceFiles.filter((f) => acOfFile(f) === id);
  return `| ${id} | ${files.length ? files.map((f) => `\`evidence/${f}\``).join('<br>') : '-'} |`;
});
const section3 = [
  '## 3. 证据索引', '',
  `共 ${evidenceFiles.length} 个文件；每条 AC 至少 \`state.json\` / \`events.jsonl\` / \`meta.json\` / \`output.json\` / \`status.txt\`（无实例时 state 为 null）。`, '',
  '| AC | 证据文件 |', '|---|---|', ...idxRows, '',
];

const doc = [...head, ...sections, ...section2, ...section3].join('\n');
if (EMIT_DOCS) fs.writeFileSync(REPORT, doc, 'utf8');

// report.md 的逐条 AC 结论 + 证据路径表：让报告自身可复核，不依赖外部文档跳转。
const perAcRows = AC_ORDER.map((id) => {
  const r = results.get(id);
  const files = evidenceFiles.filter((f) => acOfFile(f) === id);
  const p = perAc.find((x) => x.id === id);
  const checks = p?.checks ?? [];
  const ok = checks.filter((c) => c.ok).length;
  const paths = files.length
    ? `${files.slice(0, 2).map((f) => `\`evidence/${f}\``).join('<br>')}<br>（共 ${files.length} 份）`
    : '-';
  return `| ${id} | ${r?.verdict ?? '未执行'} | ${r?.grade ?? '未执行'} | ${ok}/${checks.length} | ${paths} |`;
});
const sectionAc = [
  '## 3.1 逐条 AC 结论与证据路径', '',
  '| AC | 判定 | 证据分级 | 核对项通过/总数 | 证据路径 |', '|---|---|---|---|---|',
  ...perAcRows, '',
];

// report.md：验收总结（总判 + 分级 + 批次 + 命令口径 + 证据索引简表）。
const reportDoc = [
  '# I1.4 WP-8 验收报告', '',
  `**${finalLine}**`, '',
  `**${execLine}**`, '',
  '## 1. 总判与证据分级', '',
  `- 通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞} / 未执行 ${stat.未执行}（共 ${AC_ORDER.length} 条）。`,
  `- 证据分级：已实测（真实宿主）${gradeStat['已实测（真实宿主）']} / mock 实测 ${gradeStat['mock 实测']} / 阻塞 ${gradeStat['阻塞']} / 未执行 ${gradeStat['未执行']}。`,
  `- 当前环境 macOS、无 DSH 真实宿主；真实宿主为 Windows 侧能力，故「已实测（真实宿主）」为 0 属如实结论，非伪造通过。`,
  `- evidence/ 文件 ${evidenceFiles.length} 个，覆盖 ${covered.size} 条 AC。`,
  '', '## 2. 分批结果', '',
  '| 批次 | 区间 | 通过 | 不通过 | 阻塞 | 未执行 |', '|---|---|---|---|---|---|',
  ...Object.entries(batchStat).map(([k, s]) => {
    const ranges = { a: 'AC-01~15', b: 'AC-16~30', c: 'AC-31~45', d: 'AC-46~60', e: 'AC-61~70' };
    return `| ${k} | ${ranges[k]} | ${s.通过} | ${s.不通过} | ${s.阻塞} | ${s.未执行} |`;
  }), '',
  '## 3. 判定口径', '',
  '- 每条 AC 的 case 把需求 §3.1 的每个 Then / 机检点转成可执行断言；不做「只 includes 一个词」的弱判定，不合并多条 AC。',
  '- 证据落盘：`state.json` / `events.jsonl` / stdout / `status.md` / 命令退出码，存 `evidence/`，并在 `results.jsonl` 记录路径；每条 AC ≥ 1 份可复核原始帧。',
  '- 分批落盘：`--all` 按 a~e 五批执行，每批立刻写 `results.jsonl` 与 `evidence/`；`final` 从已落盘结果重建，支持只重跑受影响批次。',
  '- 独立项目根：每 AC 一个 `os.tmpdir()/maestro-acc-p4/<AC>`，绝不在仓库目录里跑。',
  '', ...sectionAc,
  '## 4. 未通过 / 阻塞项', '',
  ...(bad.length ? bad.map((b) => `- ${b.id}（${b.verdict}，${b.grade ?? '-'}）：${(b.failed ?? []).map((f) => f.text).join('；') || '未执行'}`) : ['（无）']),
  '', '## 4.1 未执行项（后续批次续派）', '',
  ...(missing.length ? [missing.join('、')] : ['（无）']),
  '', '## 5. NFR 性能证据', '',
  '- `test/wp11/perf.test.js`：3 条**确定性结构断言**（NFR-05 原子写 / 50 张包批量写 / NFR-01 100 事件 50 包渲染完整性），实测耗时落盘 `evidence/nfr-perf-*.json`；**不设墙钟阈值**，避免复现 §7.2 白名单 `test/wp10/perf.test.js` 两条负载相关红。',
  ...(nfrData.length
    ? nfrData.map(({ file, data }) => {
        const bits = [];
        if (data?.writes) bits.push(data.writes.map((w) => `${w.target}=${w.ms}ms`).join('、'));
        if (data?.totalMs !== undefined) bits.push(`total=${data.totalMs}ms`);
        if (data?.firstLineMs !== undefined) bits.push(`首行=${data.firstLineMs}ms`);
        if (data?.avgMs !== undefined) bits.push(`avg=${data.avgMs}ms`);
        return `- \`evidence/${file}\`：${bits.join('；') || '已落盘'}。`;
      })
    : ['- （`nfr-perf-*.json` 尚未生成：先跑 `node --test test/wp11/perf.test.js`）']),
  '- NFR-02 / 03 / 04（暂停、审批、待投递重试、`status` 时效、3 次失败升级、`pause/resume` 返回）由 AC-15~20、AC-49~52、AC-60~61 逐条取证；NFR-06 由 `node --test "test/**/*.test.js"` 全量回归、NFR-07 由 `package.json` 依赖检查实测（见最终验收汇报）。',
  '', `> 逐条记录（命令 / 需求原文 / 证据 / 判定）见 \`docs/iterations/iteration-4/acceptance-fixture.md\` 与 \`probe/acc4-f-parts/\`。`,
].join('\n');
if (EMIT_DOCS) fs.writeFileSync(REPORT_MD, reportDoc, 'utf8');

ensureDir(path.dirname(SUMMARY));
fs.writeFileSync(SUMMARY, JSON.stringify({
  通过: stat.通过, 不通过: stat.不通过, 阻塞: stat.阻塞, 未执行: stat.未执行,
  executed, missing, grade: gradeStat, batches: batchStat,
  evidenceFiles: evidenceFiles.length, perAc,
}, null, 2) + '\n', 'utf8');

console.log(`[final] ${finalLine}`);
console.log(`[final] ${execLine}${missing.length ? `（${missing.join('、')}）` : ''}`);
console.log(`[final] 证据分级：已实测（真实宿主）${gradeStat['已实测（真实宿主）']} / mock 实测 ${gradeStat['mock 实测']} / 阻塞 ${gradeStat['阻塞']} / 未执行 ${gradeStat['未执行']}`);
console.log(`[final] 汇总：${path.relative(REPO, SUMMARY)}；证据 ${evidenceFiles.length} 个`);
if (EMIT_DOCS) console.log(`[final] 两文档已生成：${path.relative(REPO, REPORT)} 与 ${path.relative(REPO, REPORT_MD)}`);
else console.log('[final] 本批不生成两文档（最后一批用 node probe/acc4-f-final.mjs --emit-docs 统一生成）');
if (bad.length) console.log(`[final] 非通过：${bad.map((b) => `${b.id}:${b.verdict}`).join(', ')}`);

// 收尾：清掉 BASE 下可能残留的核心。
try {
  for (const d of fs.readdirSync(BASE)) await forceKillCore(path.join(BASE, d));
} catch { /* BASE 不存在则跳过 */ }
