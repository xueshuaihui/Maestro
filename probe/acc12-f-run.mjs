/**
 * I1.12 S3 单 AC / 批次入口（批次 A：AC-01~AC-12）。
 *   node probe/acc12-f-run.mjs AC-01
 *   node probe/acc12-f-run.mjs --batch a
 * 注册表覆盖 AC-01~AC-12；AC-13~AC-23 预留给批次 B 追加（不冒跑）。
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  ACC12_PATHS, ensureDir, appendLine, writeText, iso, GRADING_MOCK, VERDICT_BLOCK,
} from './acc12-f-lib.mjs';
import {
  makeCase, block, finish, writePart, appendResult, evidence, note,
} from './acc12-f-common.mjs';

const CASE_FILES = Object.freeze({
  'AC-01': './acc12-cases/AC-01.mjs',
  'AC-02': './acc12-cases/AC-02.mjs',
  'AC-03': './acc12-cases/AC-03.mjs',
  'AC-04': './acc12-cases/AC-04.mjs',
  'AC-05': './acc12-cases/AC-05.mjs',
  'AC-06': './acc12-cases/AC-06.mjs',
  'AC-07': './acc12-cases/AC-07.mjs',
  'AC-08': './acc12-cases/AC-08.mjs',
  'AC-09': './acc12-cases/AC-09.mjs',
  'AC-10': './acc12-cases/AC-10.mjs',
  'AC-11': './acc12-cases/AC-11.mjs',
  'AC-12': './acc12-cases/AC-12.mjs',
});

/** 批次 B 预留：AC-13~AC-23 由另一验收同学追加到 CASE_FILES。 */
const RESERVED = Object.freeze(Array.from({ length: 11 }, (_, i) => `AC-${String(13 + i).padStart(2, '0')}`));

export const REGISTRY = Object.freeze({ ...CASE_FILES });

const BATCH_A = Object.keys(CASE_FILES);
const TIMEOUT_MS = 90_000;

function pruneResults(acs) {
  ensureDir(ACC12_PATHS.PARTS);
  ensureDir(path.dirname(ACC12_PATHS.RESULTS));
  let lines = [];
  try { lines = fs.readFileSync(ACC12_PATHS.RESULTS, 'utf8').split(/\r?\n/).filter(Boolean); } catch { /* 首次运行 */ }
  const kept = lines.filter((line) => {
    try { return !acs.includes(JSON.parse(line).ac); } catch { return false; }
  });
  writeText(ACC12_PATHS.RESULTS, kept.length ? `${kept.join('\n')}\n` : '');
}

function withTimeout(promise, ms) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`TIMEOUT after ${ms}ms`)), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

async function runOne(ac) {
  const started = Date.now();
  let c;
  try {
    const spec = CASE_FILES[ac];
    if (!spec) {
      c = makeCase(ac, { scenario: 'reserved', title: '预留给批次 B' });
      block(c, `AC ${ac} 归批次 B，本批次（A）不执行；注册表未登记用例函数`);
      c = finish(c);
      writePart(c);
      appendResult(c);
      return c;
    }
    const mod = await import(spec);
    if (typeof mod.run !== 'function') throw new Error(`${spec} does not export run()`);
    c = await withTimeout(mod.run(), TIMEOUT_MS);
    if (!c || typeof c !== 'object') throw new Error(`${spec} run() did not return a case`);
  } catch (err) {
    c = c || makeCase(ac, { scenario: 'error', title: '用例异常' });
    // 用例抛错时原 case 对象可能丢失，按 AC 前缀把已落盘的原始帧补登到清单。
    try {
      const names = fs.readdirSync(ACC12_PATHS.EVID).filter((name) => name.startsWith(`${ac}.`));
      for (const name of names) {
        const file = path.join(ACC12_PATHS.EVID, name);
        c.evidence.push({ file, bytes: fs.statSync(file).size, sha256: '' });
      }
    } catch { /* 证据目录缺失不影响阻塞判定 */ }
    block(c, `用例执行异常：${err?.message || String(err)}`);
    c = finish(c);
    c.verdict = VERDICT_BLOCK;
    try {
      evidence(c, 'error', 'stack.txt', String(err?.stack || err));
    } catch { /* 证据写入失败不掩盖阻塞判定 */ }
  }
  c.durationMs = Date.now() - started;
  c.grading = GRADING_MOCK;
  writePart(c);
  appendResult(c);
  return c;
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('--help')) {
    process.stdout.write('用法：node probe/acc12-f-run.mjs AC-XX | --batch a\n');
    return 0;
  }
  if (args[0] === '--batch') {
    const batch = (args[1] || '').toLowerCase();
    if (batch !== 'a') {
      process.stdout.write(`批次 ${batch} 不由本脚本执行（本脚本仅批次 a：AC-01~AC-12）\n`);
      return 0;
    }
    pruneResults(BATCH_A);
    (async () => {
      const summary = [];
      for (const ac of BATCH_A) {
        const c = await runOne(ac);
        summary.push(`${ac}\t${c.verdict}\t${c.checksPassed ?? 0}/${c.checksTotal ?? 0}\t证据 ${c.evidence.length}`);
        process.stdout.write(`${ac} → ${c.verdict}（核对 ${c.checksPassed ?? 0}/${c.checksTotal ?? 0}，证据 ${c.evidence.length}）\n`);
      }
      writeText(`${ACC12_PATHS.PARTS}/_batch-a-run.md`, [
        '# 批次 A 运行摘要', '', `- 时间：${iso()}`,
        `- 限时：每条 AC ${TIMEOUT_MS / 1000}s`,
        `- 注册表：AC-01~AC-12（批次 B 预留：${RESERVED.join(', ')}）`,
        '', '```', ...summary, '```', '',
      ].join('\n'));
      process.stdout.write(`\n批次 A 完成：${summary.length} 条 AC\n`);
    })().catch((err) => {
      process.stderr.write(`batch runner failed: ${err?.stack || err}\n`);
      process.exitCode = 1;
    });
    return 0;
  }

  const ac = args[0].toUpperCase();
  if (!/^AC-\d+$/.test(ac)) {
    process.stdout.write(`非法 AC 号：${ac}\n`);
    return 1;
  }
  pruneResults([ac]);
  runOne(ac).then((c) => {
    process.stdout.write(`${ac} → ${c.verdict}（核对 ${c.checksPassed ?? 0}/${c.checksTotal ?? 0}，证据 ${c.evidence.length}）\n`);
  }).catch((err) => {
    process.stderr.write(`single runner failed: ${err?.stack || err}\n`);
    process.exitCode = 1;
  });
  return 0;
}

main(process.argv);
