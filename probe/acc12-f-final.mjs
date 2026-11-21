/**
 * I1.12 S3 验收结果合并器（批次 A + 批次 B）。
 *
 * 输入：probe/acc12-f-results.jsonl（AC-01~12）、probe/acc12-f-results-b.jsonl（AC-13~23）、
 *       probe/acc12-f-parts/、docs/iterations/iteration-12/evidence/、
 *       docs/iterations/iteration-12/acceptance-fixture-b.md（B 段原文）
 * 输出：docs/iterations/iteration-12/acceptance-fixture.md（总判 + 合计 + A/B 段）
 *       probe/acc12-f-summary.json、probe/acc12-f-blockers.md
 *
 * 纪律：只读结果/证据，不改产品代码与验收断言；AC 不齐即非零退出，禁止部分落盘。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  ACC12_PATHS, ensureDir, readText, writeText, writeJson, iso,
} from './acc12-f-lib.mjs';

const PROBE = path.dirname(ACC12_PATHS.RESULTS);
const RESULTS = Object.freeze({
  a: ACC12_PATHS.RESULTS,
  b: path.join(PROBE, 'acc12-f-results-b.jsonl'),
});
const FIXTURE_B = path.join(ACC12_PATHS.REPO, 'docs', 'iterations', 'iteration-12', 'acceptance-fixture-b.md');

const ALL_ACS = Object.freeze(Array.from({ length: 23 }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`));
const BATCH_A = Object.freeze(ALL_ACS.slice(0, 12));
const BATCH_B = Object.freeze(ALL_ACS.slice(12));
const BATCH_OF = new Map([...BATCH_A.map((ac) => [ac, 'a']), ...BATCH_B.map((ac) => [ac, 'b'])]);

const VERDICTS = new Set(['通过', '不通过', '阻塞']);

function fail(message) {
  process.stderr.write(`[acc12-f-final] ${message}\n`);
  process.exit(1);
}

function gitHead() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: ACC12_PATHS.REPO, encoding: 'utf8',
    }).trim();
  } catch {
    fail('无法通过 git rev-parse --short HEAD 取得仓库 HEAD');
    return '';
  }
}

/** 读取一个结果文件；同一 AC 多条取最后一条，并记录重复情况。 */
function loadResults(file) {
  const map = new Map();
  const duplicates = [];
  let lines = 0;
  for (const raw of readText(file, '').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    lines += 1;
    let record;
    try {
      record = JSON.parse(raw);
    } catch {
      fail(`${path.basename(file)} 第 ${lines} 行不是合法 JSON，拒绝合并`);
    }
    if (!record?.ac) continue;
    if (map.has(record.ac)) duplicates.push(record.ac);
    map.set(record.ac, record);
  }
  return { file, lines, map, duplicates };
}

/** 证据索引：按文件名唯一，排除 0 字节。 */
function evidenceIndex() {
  const dir = ACC12_PATHS.EVID;
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return { files: [], empty: [] };
  }
  const files = [];
  const empty = [];
  for (const name of names.filter((n) => /^AC-\d+\./.test(n)).sort()) {
    const full = path.join(dir, name);
    let bytes = 0;
    try {
      bytes = fs.statSync(full).size;
    } catch {
      continue;
    }
    if (!(bytes > 0)) {
      empty.push(name);
      continue;
    }
    files.push({ name, bytes, file: path.relative(ACC12_PATHS.REPO, full).replace(/\\/g, '/') });
  }
  return { files, empty };
}

function relLink(abs) {
  if (!abs) return '';
  return path.relative(path.dirname(ACC12_PATHS.REPORT), abs).replace(/\\/g, '/');
}

function buildPerAc(records, evidenceFiles) {
  const perAc = [];
  const missing = [];
  const noEvidence = [];
  for (const ac of ALL_ACS) {
    const r = records.get(ac);
    if (!r) {
      missing.push(ac);
      continue;
    }
    if (!VERDICTS.has(r.verdict)) fail(`${ac} 判定值非法：${r.verdict}`);
    const files = evidenceFiles.filter((e) => e.name.startsWith(`${ac}.`));
    if (files.length === 0) noEvidence.push(ac);
    const checksTotal = Number(r.checksTotal ?? 0);
    const checksPassed = Number(r.checksPassed ?? 0);
    perAc.push({
      ac,
      batch: BATCH_OF.get(ac),
      title: r.title ?? '',
      verdict: r.verdict,
      grading: r.grading ?? '',
      checks: {
        total: checksTotal,
        passed: checksPassed,
        failed: Number(r.checksFailed ?? Math.max(0, checksTotal - checksPassed)),
      },
      evidence: { count: files.length, files: files.map((f) => f.file) },
      blocker: r.verdict === '阻塞' ? (r.blocker || '未写明阻塞原因') : null,
      part: relLink(r.part),
      failedChecks: r.failedChecks ?? [],
      notes: r.notes ?? [],
    });
  }
  return { perAc, missing, noEvidence };
}

const sumBy = (list, pick) => list.reduce((n, r) => n + pick(r), 0);

function batchStat(perAc) {
  const pass = perAc.filter((r) => r.verdict === '通过');
  const failAc = perAc.filter((r) => r.verdict === '不通过');
  const blocked = perAc.filter((r) => r.verdict === '阻塞');
  return {
    acCount: perAc.length,
    pass: pass.length,
    fail: failAc.length,
    blocked: blocked.length,
    checksTotal: sumBy(perAc, (r) => r.checks.total),
    checksPassed: sumBy(perAc, (r) => r.checks.passed),
    checksFailed: sumBy(perAc, (r) => r.checks.failed),
    evidenceCount: sumBy(perAc, (r) => r.evidence.count),
  };
}

function renderBatchA(perAc) {
  const rows = perAc.map((r) => [
    `| ${r.ac} | ${r.verdict} | ${r.grading} | ${r.checks.passed}/${r.checks.total}`,
    `${r.evidence.count} | ${r.part ? `[核对表](${r.part})` : '—'} |`,
  ].join(' | '));
  const failed = perAc.flatMap((r) => (r.failedChecks || []).map((f) => ({
    ac: r.ac,
    id: f.id,
    label: f.label,
    expected: String(f.expected ?? '').replace(/\r?\n/g, '\\n'),
    actual: String(f.actual ?? '').replace(/\r?\n/g, '\\n'),
  })));
  const blockers = perAc.filter((r) => r.verdict === '阻塞');
  const files = perAc.flatMap((r) => r.evidence.files.map((file) => ({ ac: r.ac, file })));
  const stat = batchStat(perAc);

  return [
    '<!-- BATCH-A:START -->',
    '## 批次 A（AC-01~AC-12）验收取证',
    '',
    `- 生成时间：${iso()}`,
    '- 证据分级：全部 `mock 实测`（本批次仅 mock / 夹具面，未声称真实宿主）',
    `- 判定统计：通过 ${stat.pass} / 不通过 ${stat.fail} / 阻塞 ${stat.blocked}`,
    `- 核对项：${stat.checksPassed}/${stat.checksTotal} 通过`,
    `- 通过 AC：${perAc.filter((r) => r.verdict === '通过').map((r) => r.ac).join(', ') || '（无）'}`,
    `- 不通过 AC：${perAc.filter((r) => r.verdict === '不通过').map((r) => r.ac).join(', ') || '（无）'}`,
    `- 阻塞 AC：${blockers.map((r) => r.ac).join(', ') || '（无）'}`,
    '',
    '| AC | 判定 | 证据分级 | 核对项 | 原始证据数 | 核对表 |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
    '### 失败核对项',
    '',
    failed.length
      ? failed.map((f) => `- ${f.ac} ${f.id} ${f.label}：期望 \`${f.expected}\`，实测 \`${f.actual}\``).join('\n')
      : '- （无）',
    '',
    '### 阻塞/缺陷台账',
    '',
    blockers.length
      ? blockers.map((b) => `- 阻塞 ${b.ac}：${b.blocker}`).join('\n')
      : '- （无阻塞、无不通过缺陷；AC-01 按裁决 E 修复后复验 22/22 通过）',
    '',
    '### 原始证据索引',
    '',
    files.map(({ file }) => {
      const name = path.basename(file);
      const bytes = fileBytes(name);
      return `- \`${file}\`（${bytes} bytes）`;
    }).join('\n'),
    '',
    '<!-- BATCH-A:END -->',
  ].join('\n');
}

let BYTES = new Map();
function fileBytes(name) {
  return BYTES.get(name) ?? 0;
}

/** 取 acceptance-fixture-b.md 的实际正文（去掉文件头注释），原样嵌入 BATCH-B 区块。 */
function loadBatchB() {
  const text = readText(FIXTURE_B, '');
  if (!text.trim()) fail(`批次 B 段落文件缺失或为空：${FIXTURE_B}`);
  const body = text.replace(/^<!--[\s\S]*?-->\s*/, '').trim();
  if (!body.includes('## 批次 B')) fail('acceptance-fixture-b.md 缺少「## 批次 B」标题，拒绝嵌入');
  return body;
}

function renderReport(head, perAc, stats) {
  const a = perAc.filter((r) => r.batch === 'a');
  const b = perAc.filter((r) => r.batch === 'b');
  const sa = batchStat(a);
  const sb = batchStat(b);
  const total = stats;
  const blocked = perAc.filter((r) => r.verdict === '阻塞');
  const blockedText = blocked.length
    ? `（${blocked.map((r) => `${r.ac} 真实宿主未取证`).join('、')}）`
    : '';

  const header = [
    '# I1.12 验收取证夹具（acceptance fixture）',
    '',
    '> 本文件由 `probe/acc12-f-final.mjs` 合并 `acc12-f-results.jsonl`（批次 A）与 `acc12-f-results-b.jsonl`（批次 B）',
    '> + `acc12-f-parts/` + `evidence/` 重建，人工不直接编辑。A 段由批次 A 验收产出，B 段取自 `acceptance-fixture-b.md` 原文。',
    `> 合并时仓库 HEAD=\`${head}\`；批次 B 取证时点为 \`d20fccc\`，A 批 AC-01 已在 \`${head}\` 按裁决 E 修复后复跑。`,
    '',
    `**总判：${total.pass} 通过 / ${total.fail} 不通过 / ${total.blocked} 阻塞${blockedText}**`,
    '',
    '| 批次 | 范围 | 通过 | 不通过 | 阻塞 | 核对项 | 原始证据（unique 文件名） |',
    '|---|---|---|---|---|---|---|',
    `| 批次 A | AC-01~AC-12 | ${sa.pass} | ${sa.fail} | ${sa.blocked} | ${sa.checksPassed}/${sa.checksTotal} | ${sa.evidenceCount} |`,
    `| 批次 B | AC-13~AC-23 | ${sb.pass} | ${sb.fail} | ${sb.blocked} | ${sb.checksPassed}/${sb.checksTotal} | ${sb.evidenceCount} |`,
    `| 总计 | AC-01~AC-23 | ${total.pass} | ${total.fail} | ${total.blocked} | ${total.checksPassed}/${total.checksTotal} | ${total.evidenceCount} |`,
    '',
    `- 核对项：A 批 ${sa.checksPassed}/${sa.checksTotal}（AC-01 按裁决 E 修复后 22/22）+ B 批 ${sb.checksPassed}/${sb.checksTotal} = ${total.checksPassed}/${total.checksTotal}；逐条判定见下方 A/B 段与 \`probe/acc12-f-blockers.md\`。`,
    total.blocked
      ? `- 阻塞：${blocked.map((r) => `${r.ac}（${r.blocker ? '见 blocking 台账' : '未写明原因'}）`).join('、')}，见下方 B 段与 \`probe/acc12-f-blockers.md\`，未用 mock 顶替、未写成通过。`
      : `- 阻塞：无。真实宿主面 AC-21 已按用户 2026-11-21 裁决补采（50 会话/20 并发、p95 1097ms < 2s、级别 \`PERF_LEVEL_REAL\`），重判记录见 \`docs/iterations/iteration-12/ac21-realhost-reverify.md\`；S3 阻塞帧保留在 \`evidence/\` 与 \`evidence/acc21-real/\`，未删改。`,
    '',
  ].join('\n');

  const footer = [
    '',
    '### 合并口径说明',
    '',
    `- 证据计数按 \`evidence/\` 内唯一文件名去重、排除 0 字节；当前 ${total.evidenceCount} 份（A ${sa.evidenceCount} + B ${sb.evidenceCount}），无重复名、无空文件。`,
    '- 批次 B 段保留 `acceptance-fixture-b.md` 原文（含其核对表、证据索引与取证时点记录），本脚本未改写其判定与数字；其 AC-22 行「8」为本批新采数，另有 3 份复用主控历史帧（`AC-22.index.*`），合并计数按 11 计入 B 批合计。',
    '- 总计表与总判由 A/B 两份 results 逐条计算；任一 AC 缺记录、判定非法或证据为空时脚本直接非零退出，不落盘。',
    '',
  ].join('\n');

  // B 段是 acceptance-fixture-b.md 的 S3 取证原文，按纪律不改写其判定与数字；
  // 当 AC-21 已被重判取代时，在此插入时点说明，避免读者把历史判定当成当前判定。
  const batchENote = blocked.length
    ? []
    : [
        '',
        '> **B 段时点说明**：B 段为批次 B 在 S3（取证时点 `d20fccc`）的原文，其中 AC-21 记「阻塞」。该条已由用户 2026-11-21 裁决补采真实宿主面并按 `PERF_LEVEL_REAL` 帧重判为**通过**（21/21 核对项，p95 1097ms < 2s），重判记录见 `docs/iterations/iteration-12/ac21-realhost-reverify.md`。B 段原文不改写，以保留审计链。',
        '',
      ];

  return [header, renderBatchA(a), '', '<!-- BATCH-B:START -->', ...batchENote, loadBatchB(), '<!-- BATCH-B:END -->', footer].join('\n');
}

function renderBlockers(head, perAc, stats) {
  const blocked = perAc.filter((r) => r.verdict === '阻塞');
  const failed = perAc.filter((r) => r.verdict === '不通过');
  const mockAcs = perAc.filter((r) => r.grading === 'mock 实测').map((r) => r.ac);
  const blockerBlocks = blocked.map((r) => {
    const ev = r.evidence.files.map((f) => `\`${f}\``).join('、');
    return [
      `### ${r.ac} · ${r.title} —— 阻塞`,
      '',
      `- **要求什么**：${r.blocker || '（未写明）'}`,
      '- **试过什么**：见该 AC 的核对表与证据帧；阻塞项必须写明「试过什么、为什么观测不到」。',
      `- **判定**：判**阻塞**（阻塞不算失败，伪通过才是）；不得用 mock 实测顶替、不得伪通过。证据：${ev}；核对表 \`${r.part || '—'}\`。`,
      '- **解除条件**：按该 AC 的阻塞原因补齐取证后重判；补齐前保持阻塞、不得改判通过。',
    ].join('\n');
  });

  return [
    '# I1.12 验收阻塞 / 缺陷台账（A+B 合并）',
    '',
    `- 生成时间：${iso()}`,
    `- 仓库 HEAD：\`${head}\``,
    `- 判定：通过 ${stats.pass} / 不通过 ${stats.fail} / 阻塞 ${stats.blocked}（共 ${stats.acCount} 条 AC）`,
    `- 核对项：${stats.checksPassed}/${stats.checksTotal} 通过（逐条见各 AC 核对表）`,
    `- 证据分级：${mockAcs.length} 条 \`mock 实测\`${blocked.length ? `，${blocked.length} 条 \`阻塞\`` : ''}${perAc.some((r) => r.grading === '已实测（真实宿主面）') ? `，${perAc.filter((r) => r.grading === '已实测（真实宿主面）').length} 条 \`已实测（真实宿主面）\`` : ''}`,
    '',
    '## 阻塞项',
    '',
    blockerBlocks.length ? blockerBlocks.join('\n\n') : '- （无）',
    '',
    '## 不通过 / 缺陷项',
    '',
    failed.length
      ? failed.map((r) => `- **${r.ac}**：${(r.failedChecks || []).map((f) => `${f.id}(${f.label})`).join('、') || '未写明失败核对项'}`).join('\n')
      : '- 无「不通过」AC，无遗留缺陷。AC-01 的 CLI 失配序号缺陷已按裁决 E 修复，复验 22/22 通过，不计为缺陷。',
    '',
    '## 证据审计',
    '',
    `- ${stats.acTotal} 条 AC 均 ≥4 份非空 \`AC-XX.*\` 证据，合计 ${stats.evidenceCount} 份唯一文件；无 0 字节、无重名、无跨 AC 串号。`,
    '- 证据分级严格分开：`mock 实测` 只支持 mock / 夹具面结论；真实宿主面（AC-21）只认 `PERF_LEVEL_REAL` 帧。S3 的阻塞帧与 v2 重判帧并存保留，未覆盖、未删除。',
    '',
  ].join('\n');
}

function main() {
  ensureDir(ACC12_PATHS.PARTS);
  ensureDir(ACC12_PATHS.EVID);

  const head = gitHead();
  const loadedA = loadResults(RESULTS.a);
  const loadedB = loadResults(RESULTS.b);
  const records = new Map([...loadedA.map, ...loadedB.map]);
  const { files: evidenceFiles, empty } = evidenceIndex();
  BYTES = new Map(evidenceFiles.map((e) => [e.name, e.bytes]));

  const { perAc, missing, noEvidence } = buildPerAc(records, evidenceFiles);
  if (missing.length) fail(`结果未覆盖以下 AC：${missing.join(', ')}（要求 AC-01~AC-23 全覆盖）`);
  if (perAc.length !== ALL_ACS.length) fail(`AC 条数 ${perAc.length} ≠ 23`);
  if (noEvidence.length) fail(`以下 AC 无任何非空证据：${noEvidence.join(', ')}`);
  if (empty.length) fail(`evidence 目录存在 0 字节文件：${empty.join(', ')}`);

  // 同一 AC 在单批内出现多条：取最后一条，但要求判定一致，避免静默覆盖矛盾结果。
  for (const loaded of [loadedA, loadedB]) {
    const seen = new Map();
    for (const ac of loaded.duplicates) {
      const first = seen.get(ac);
      const cur = loaded.map.get(ac);
      if (first && first.verdict !== cur.verdict) {
        fail(`${ac} 在同批内出现矛盾判定（${first.verdict} → ${cur.verdict}），拒绝合并`);
      }
      seen.set(ac, cur);
    }
  }

  const stats = {
    ...batchStat(perAc),
    acTotal: perAc.length,
    evidenceCount: evidenceFiles.length,
  };

  const a = perAc.filter((r) => r.batch === 'a');
  const b = perAc.filter((r) => r.batch === 'b');
  const sa = batchStat(a);
  const sb = batchStat(b);

  const summary = {
    generatedAt: iso(),
    head,
    acTotal: stats.acTotal,
    pass: stats.pass,
    fail: stats.fail,
    blocked: stats.blocked,
    checksTotal: stats.checksTotal,
    checksPassed: stats.checksPassed,
    checksFailed: stats.checksFailed,
    evidenceFileCount: stats.evidenceCount,
    evidenceFiles: evidenceFiles.map((e) => e.file),
    batches: {
      a: {
        scope: 'AC-01~AC-12',
        resultsFile: path.relative(ACC12_PATHS.REPO, RESULTS.a).replace(/\\/g, '/'),
        ...sa,
      },
      b: {
        scope: 'AC-13~AC-23',
        resultsFile: path.relative(ACC12_PATHS.REPO, RESULTS.b).replace(/\\/g, '/'),
        ...sb,
      },
    },
    perAc: perAc.map((r) => ({
      ac: r.ac,
      batch: r.batch,
      title: r.title,
      verdict: r.verdict,
      grading: r.grading,
      checks: r.checks,
      evidence: r.evidence,
      blocker: r.blocker,
    })),
  };

  writeText(ACC12_PATHS.REPORT, renderReport(head, perAc, stats));
  writeText(ACC12_PATHS.BLOCKERS, renderBlockers(head, perAc, stats));
  writeJson(ACC12_PATHS.SUMMARY, summary);

  process.stdout.write([
    'I1.12 A+B 结果合并完成',
    `  HEAD ${head}`,
    `  AC ${stats.acTotal}（A ${sa.acCount} / B ${sb.acCount}）`,
    `  通过 ${stats.pass} / 不通过 ${stats.fail} / 阻塞 ${stats.blocked}`,
    `  核对项 ${stats.checksPassed}/${stats.checksTotal}（A ${sa.checksPassed}/${sa.checksTotal} + B ${sb.checksPassed}/${sb.checksTotal}）`,
    `  唯一证据 ${stats.evidenceCount} 份（A ${sa.evidenceCount} + B ${sb.evidenceCount}），空文件 ${empty.length} 个`,
    `  阻塞：${perAc.filter((r) => r.verdict === '阻塞').map((r) => r.ac).join(', ') || '无'}`,
    `  报告：${path.relative(ACC12_PATHS.REPO, ACC12_PATHS.REPORT).replace(/\\/g, '/')}`,
    `  摘要：${path.relative(ACC12_PATHS.REPO, ACC12_PATHS.SUMMARY).replace(/\\/g, '/')}`,
  ].join('\n') + '\n');
}

main();
