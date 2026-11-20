/**
 * I1.8 S3/S4 汇总：把 `evidence/acc8/_acc8-f-results.jsonl`（67 条）汇总成
 * `_acc8-f-summary.json` 与 `_acc8-f-blockers.md`（不通过与阻塞清单，一条都不省略）。
 *
 *   node probe/acc8-f-final.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

import { ACC8_PATHS, EVID, REPO, iso, readText, writeJson, writeText, ensureDir } from './acc8-f-lib.mjs';

function readResults() {
  const lines = readText(ACC8_PATHS.RESULTS).split(/\r?\n/).filter(Boolean);
  const byAc = new Map();
  for (const line of lines) {
    try {
      const rec = JSON.parse(line);
      byAc.set(rec.ac, rec);
    } catch {
      /* 跳过坏行 */
    }
  }
  return [...byAc.values()].sort((a, b) => a.ac.localeCompare(b.ac));
}

function main() {
  ensureDir(EVID);
  const results = readResults();
  const summary = {
    iteration: 'I1.8',
    step: 'S4 / 全量 67 条终验口径',
    generatedAt: iso(),
    repoHead: readText(path.join(REPO, '.git', 'HEAD')).trim(),
    total: results.length,
    byVerdict: {
      通过: results.filter((r) => r.verdict === '通过').length,
      不通过: results.filter((r) => r.verdict === '不通过').length,
      阻塞: results.filter((r) => r.verdict === '阻塞').length,
    },
    acs: results.map((r) => ({
      ac: r.ac,
      title: r.title,
      verdict: r.verdict,
      grading: r.grading,
      checks: `${r.checksPassed}/${r.checksTotal}`,
      failedChecks: r.failedChecks,
      evidenceCount: (r.evidenceFiles ?? []).length,
      blocker: r.blocker,
    })),
  };
  writeJson(ACC8_PATHS.SUMMARY, summary);

  const blockers = results.filter((r) => r.verdict === '阻塞' || r.blocker);
  const failed = results.filter((r) => r.verdict === '不通过');
  const md = [
    '# I1.8 S4 · 阻塞与未通过清单（全量 67 条）',
    '',
    `- 生成时间：${iso()}`,
    `- 条目：${results.length} 条（通过 ${summary.byVerdict.通过} / 不通过 ${summary.byVerdict.不通过} / 阻塞 ${summary.byVerdict.阻塞}）`,
    '',
    '## 阻塞（NFR-08：如实登记，不伪造）',
    '',
    ...(blockers.length
      ? blockers.map((r) => `- **${r.ac}** ${r.title}\n  - 原因：${r.blocker}\n  - 备注：${(r.notes ?? []).join(' / ')}`)
      : ['- （无）']),
    '',
    '## 不通过（核对项未满足）',
    '',
    ...(failed.length
      ? failed.map((r) => `- **${r.ac}** ${r.title}\n${(r.failedChecks ?? []).map((f) => `  - ${f.id} ${f.label}：期望 \`${f.expected}\`，实测 \`${f.actual}\``).join('\n')}`)
      : ['- （无）']),
    '',
  ].join('\n');
  // 生成部分是机读清单；`## 处置结论` 之后是人工写的处置台账（豁免理由、遗留归属、谁在做）。
  // 整文件重写会把台账抹掉，所以先取出旧文件里的台账段再原样接回——否则每次重生成都要人工补回，
  // 一旦忘了，Done#4「缺陷与遗留收口」就会变成「清单里没有处置」。
  const LEDGER_HEADING = '## 处置结论';
  let ledger = '';
  try {
    const prev = readText(ACC8_PATHS.BLOCKERS);
    const at = prev.indexOf(LEDGER_HEADING);
    if (at >= 0) ledger = `\n${prev.slice(at).replace(/\s+$/, '')}\n`;
  } catch { /* 首次生成没有旧文件 */ }
  writeText(ACC8_PATHS.BLOCKERS, md + ledger);
  process.stdout.write(`${JSON.stringify({ total: summary.total, byVerdict: summary.byVerdict, acs: summary.acs.map((a) => `${a.ac}=${a.verdict}(${a.checks})`) }, null, 2)}\n`);
  return 0;
}

process.exitCode = main();
