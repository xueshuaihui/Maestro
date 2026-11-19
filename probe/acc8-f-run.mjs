/**
 * I1.8 S3 单 AC / 批次入口（WP-7 末批：AC-25/26/27/52/53/54/55/56/57）。
 *
 *   node probe/acc8-f-run.mjs AC-52
 *   node probe/acc8-f-run.mjs --batch all
 *
 * 执行顺序固定：真实宿主组（AC-25 → AC-26 → AC-57，共一次真跑）→ AC-27（第三方安装尝试）
 * → 架构门禁组（AC-52 / 53 / 54 / 55 / 56）。注册表外的 AC 一律「阻塞：不属本批」。
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  ACC8_PATHS, ensureDir, writeText, iso, VERDICT_BLOCK,
} from './acc8-f-lib.mjs';
import {
  makeCase, block, finish, writePart, appendResult, evidence,
} from './acc8-f-common.mjs';

const CASE_FILES = Object.freeze({
  'AC-25': './acc8-cases/AC-25.mjs',
  'AC-26': './acc8-cases/AC-26.mjs',
  'AC-27': './acc8-cases/AC-27.mjs',
  'AC-52': './acc8-cases/AC-52.mjs',
  'AC-53': './acc8-cases/AC-53.mjs',
  'AC-54': './acc8-cases/AC-54.mjs',
  'AC-55': './acc8-cases/AC-55.mjs',
  'AC-56': './acc8-cases/AC-56.mjs',
  'AC-57': './acc8-cases/AC-57.mjs',
});

export const REGISTRY = Object.freeze({ ...CASE_FILES });

const BATCH = Object.keys(CASE_FILES);
/** 分组批次：真实宿主组共用一次真跑（`realCrashRecovery` 进程内记忆），架构门禁组互不依赖。 */
const GROUPS = Object.freeze({
  all: BATCH,
  realhost: ['AC-25', 'AC-26', 'AC-57'],
  arch: ['AC-27', 'AC-52', 'AC-53', 'AC-54', 'AC-55', 'AC-56'],
});
const TIMEOUT_MS = 1_200_000;

function pruneResults(acs) {
  ensureDir(path.dirname(ACC8_PATHS.RESULTS));
  let lines = [];
  try {
    lines = fs.readFileSync(ACC8_PATHS.RESULTS, 'utf8').split(/\r?\n/).filter(Boolean);
  } catch {
    /* 首次运行 */
  }
  const kept = lines.filter((line) => {
    try {
      return !acs.includes(JSON.parse(line).ac);
    } catch {
      return false;
    }
  });
  writeText(ACC8_PATHS.RESULTS, kept.length ? `${kept.join('\n')}\n` : '');
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
      c = makeCase(ac, { scenario: 'out-of-batch', title: '不属本批' });
      block(c, `AC ${ac} 不在 WP-7 末批的 9 条清单内（AC-25/26/27/52/53/54/55/56/57）`);
      c = finish(c);
      writePart(c);
      appendResult(c);
      return c;
    }
    const mod = await import(spec);
    if (typeof mod.run !== 'function') throw new Error(`${spec} 没有导出 run()`);
    c = await withTimeout(mod.run(), TIMEOUT_MS);
    if (!c || typeof c !== 'object') throw new Error(`${spec} run() 没有返回 case 对象`);
  } catch (err) {
    c = c || makeCase(ac, { scenario: 'error', title: '用例异常' });
    try {
      const names = fs.readdirSync(ACC8_PATHS.EVID).filter((name) => name.startsWith(`${ac}.`));
      for (const name of names) {
        const file = path.join(ACC8_PATHS.EVID, name);
        c.evidence.push({ file: path.relative(ACC8_PATHS.REPO, file).replace(/\\/g, '/'), bytes: fs.statSync(file).size, sha256: '' });
      }
    } catch {
      /* 证据目录缺失不影响阻塞判定 */
    }
    block(c, `用例执行异常：${err?.message || String(err)}`);
    c = finish(c);
    c.verdict = VERDICT_BLOCK;
    try {
      evidence(c, 'error', 'stack.txt', String(err?.stack || err));
    } catch {
      /* 证据写入失败不掩盖阻塞判定 */
    }
  }
  c.durationMs = Date.now() - started;
  writePart(c);
  appendResult(c);
  return c;
}

async function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('--help')) {
    process.stdout.write('用法：node probe/acc8-f-run.mjs AC-XX | --batch all|realhost|arch\n');
    return 0;
  }
  if (args[0] === '--batch') {
    const group = String(args[1] ?? 'all').toLowerCase();
    const list = GROUPS[group];
    if (!list) {
      process.stdout.write(`未知批次：${group}（可选 ${Object.keys(GROUPS).join(' / ')}）\n`);
      return 1;
    }
    pruneResults(list);
    const summary = [];
    for (const ac of list) {
      const c = await runOne(ac);
      summary.push(`${ac}\t${c.verdict}\t${c.checksPassed ?? 0}/${c.checksTotal ?? 0}\t证据 ${c.evidence.length}`);
      process.stdout.write(`${ac} → ${c.verdict}（核对 ${c.checksPassed ?? 0}/${c.checksTotal ?? 0}，证据 ${c.evidence.length}）\n`);
    }
    writeText(path.join(ACC8_PATHS.EVID, '_batch-run.md'), [
      '# WP-7 末批 9 条 AC 运行摘要',
      '',
      `- 时间：${iso()}`,
      `- 限时：每条 AC ${TIMEOUT_MS / 1000}s`,
      `- 批次：${group}（${list.join(', ')}）`,
      '',
      '```',
      ...summary,
      '```',
      '',
    ].join('\n'));
    process.stdout.write(`\n完成：${summary.length} 条 AC\n`);
    return 0;
  }

  const ac = args[0].toUpperCase();
  if (!/^AC-\d+$/.test(ac)) {
    process.stdout.write(`非法 AC 号：${ac}\n`);
    return 1;
  }
  pruneResults([ac]);
  const c = await runOne(ac);
  process.stdout.write(`${ac} → ${c.verdict}（核对 ${c.checksPassed ?? 0}/${c.checksTotal ?? 0}，证据 ${c.evidence.length}）\n`);
  return 0;
}

process.exitCode = await main(process.argv);
