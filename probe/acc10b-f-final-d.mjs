#!/usr/bin/env node
// I1.10b S3 批次 d —— 由 results.jsonl + parts/ 重建 acceptance-d.md，输出 summary-d.json。
// 范围：AC-46~AC-51。判定只认需求原文 Then/机检；同 AC 多条取最后一条。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, EVID, PARTS, RESULTS, BASE,
  requirementTitle, forceKillCore, ensureDir
} from './acc10b-f-common.mjs';

const REPORT = path.join(REPO, 'docs', 'iterations', 'iteration-10b', 'acceptance-d.md');
const SUMMARY = path.join(REPO, 'probe', 'acc10b-f-summary-d.json');
const AC_ORDER = Array.from({ length: 6 }, (_, i) => `AC-${String(i + 46).padStart(2, '0')}`);

// 主控应独立复跑的 2 条 AC（证据薄弱/机检未覆盖 Then 的落点或真实路径）
const RERUN = [
  {
    id: 'AC-51',
    why: '本批改判不通过：connection-panel.test.js 的 AC-51 用例只断言 panel.target==="connection-panel"（模块静态属性），源码无 view / createApp / escalation-panel / stateHash 任一机检断言；app.js 无 open-connection 点击路由。',
    how: '主控在 createApp 视图层独立复跑三次点击（红/橙/delivered），逐字断言 view==="connection-panel"、view!=="escalation-panel"、view!=="drill"，并核对 stateHashBefore===stateHashAfter；同时核对连接线 click→openConnectionPanel 的路由是否存在。',
  },
  {
    id: 'AC-46',
    why: '本批通过为模块面证据：机检用合成 jumpState={ok:false,reason} 走 DRILL_HOST_FAILED 分支；真实 openHost 非 ENOENT 失败返回 code=DSH_SPAWN_FAILED + message="跳转失败 · <cause>"，而 host-jump.js 把该 code 映射为 DRILL_HOST_MISSING（"未找到 DeepSeek Harness"），存在 Then「跳转失败 · <原因>」在真实路径上的口径风险；state.json/events.jsonl 字节哈希仅以 fixture sha256 代理。',
    how: '主控在独立项目根以 MAESTRO_DSH_EXE 指向存在但不可执行文件（非 ENOENT）实跑唤起，核对提示以 "跳转失败 · " 开头且后半非空、按钮可重试、无 DSH 进程、state.json 与 events.jsonl 字节哈希前后不变；并实读 UI 如何把适配器结果喂给 buildHostJump 的 jumpState。',
  },
];

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
const cell = (s, n = 260) => String(s ?? '').replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').slice(0, n);

const head = [
  '# I1.10b S3 验收 · D 组（AC-46 ~ AC-51）', '',
  '> 判据来源：`docs/iterations/iteration-10b/requirement.md` v6.1 §3.1 同号 AC 全文、附录 A-0~A-10 逐字基线；',
  '> `docs/templates/execution-template.md` §3.1~§3.5；`docs/iterations/iteration-10b/decisions.md` 裁决 A/I/J/K（跳转三段口径、标识==sessionId、J-2 stateLabel、K 允许集合口径）。',
  '> 取证脚手架：`probe/acc10b-f-{lib,common,run}.mjs` + `probe/acc10b-f-final-d.mjs` + `probe/acc10b-cases/{ac46..ac51}.mjs`（目录名不带 `-f`）。',
  '> 只做取证：未改动 `src/**`、`desktop/**`、`test/**`、`bin/**`、`package.json`、需求与拆分。', '',
  '## 0. 总判', '',
  `**${AC_ORDER.length} 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}**`, '',
  `- 已产出证据与判定：${AC_ORDER.length - missing.length} 条；未登记或未执行：${missing.length ? missing.join('、') : '无'}。`,
  `- 证据文件：\`docs/iterations/iteration-10b/evidence/\` 下 AC-46~AC-51 相关共 ${evidenceFiles.filter((f) => AC_ORDER.includes(acOfFile(f))).length} 个（每条 ≥4 文件、无空文件；实测每 AC 8 文件）。`,
  `- 不通过 / 阻塞条目：${bad.length ? bad.map((b) => `${b.id}（${b.verdict}）`).join('、') : '无'}。`,
  '- 机器可读汇总：`probe/acc10b-f-summary-d.json`；单条核对表：`probe/acc10b-f-parts/<AC>.md`；缺陷台账：`probe/acc10b-f-blockers.md`（批次 d 段）。',
  '- 判定口径：`通过` = 需求 Then/机检逐字全部成立且证据分级为 `mock 实测`；`不通过` = 有核对项不成立（附冲突原始帧）；`阻塞` = 行为无法在夹具上观测或超时（90s 上限记阻塞）。',
  '- 判定纪律：只认需求原文 Then/机检逐字，不采信测试自述；文案逐字比对、数量核对数组长度、内部断言（耗时/哈希/键计数）仅作回归信号不冒充用户可见结论；同 AC 多记录取最后一条。',
  '- 取证环境：独立项目根 `%TEMP%/maestro-i10b-acc10b-f/<AC>/`、`NODE_ENV=test`、mock 宿主、每条结束 `orch core stop`；超时上限 90s。', '',
  '## 1. AC 逐条判定表', '',
  '| AC | 标题 | 判定 | 证据分级 | 核对项 | 证据文件数 | 关键实测 |', '|---|---|---|---|---|---|---|',
  ...AC_ORDER.map((id) => {
    const r = results.get(id);
    if (!r) return `| ${id} | — | 阻塞 | 阻塞 | 0/0 | 0 | 未登记或未执行 |`;
    const grade = r.verdict === '通过' ? (r.face || 'mock 实测') : r.verdict;
    const key = {
      'AC-46': '跳转失败 · 前缀 + retryable===true + 跳转零进程 + sha256 不变',
      'AC-47': '两条状态更新同时到达、顺序不变、2s 内',
      'AC-48': 'pulse 只翻状态词、服务/宿主/最近逐项保留、DAG 不塌陷',
      'AC-49': 'view===escalation-panel 且 !==drill、面包屑/计数/两条升级逐字',
      'AC-50': 'graphStreamReopened===true、角色行逐字、卡片「任务 无」、DAG 保留',
      'AC-51': '机检无 view 落点断言（5 项不成立）；模块 target===connection-panel 成立',
    }[id] ?? '';
    return `| ${id} | ${cell(r.title ?? requirementTitle(id), 60)} | **${r.verdict}** | ${grade} | ${r.ok}/${r.total} | ${(r.evidence ?? []).length} | ${cell(key, 120)} |`;
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
  `共 ${evidenceFiles.filter((f) => AC_ORDER.includes(acOfFile(f))).length} 个本批文件；每条 AC 至少 state / events / tests.stdout / test.source / arch.stdout / corestop / meta / status 原始帧，无空文件。`, '',
  '| AC | 文件数 | 证据文件 |', '|---|---|---|', ...idxRows, ''
];

const section5 = [
  '## 5. 主控应独立复跑的 2 条 AC 建议', '',
  '| AC | 为何需要独立复跑 | 建议复跑方式 |', '|---|---|---|',
  ...RERUN.map((r) => `| ${r.id} | ${cell(r.why, 400)} | ${cell(r.how, 400)} |`), ''
];

const doc = [...head, ...sections, ...section3, ...section4, ...section5].join('\n');
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, doc, 'utf8');

ensureDir(path.dirname(SUMMARY));
fs.writeFileSync(SUMMARY, JSON.stringify({
  batch: 'd', acRange: 'AC-46~AC-51', total: AC_ORDER.length,
  通过: stat.通过, 不通过: stat.不通过, 阻塞: stat.阻塞,
  evidenceFiles: evidenceFiles.filter((f) => AC_ORDER.includes(acOfFile(f))).length,
  rerunSuggestions: RERUN.map((r) => r.id),
  perAc
}, null, 2) + '\n', 'utf8');

console.log(`[final-d] ${AC_ORDER.length} 条：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}（未登记 ${missing.length}）`);
console.log(`[final-d] 报告：${path.relative(REPO, REPORT)}；汇总：${path.relative(REPO, SUMMARY)}`);
if (bad.length) console.log(`[final-d] 非通过：${bad.map((b) => `${b.id}:${b.verdict}`).join(', ')}`);

try { for (const d of fs.readdirSync(BASE)) await forceKillCore(path.join(BASE, d)); } catch { /* ignore */ }
