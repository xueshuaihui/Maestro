/**
 * I1.8 S3 单 AC / 批次入口（全 67 条）。
 *
 *   node probe/acc8-f-run.mjs AC-52
 *   node probe/acc8-f-run.mjs --list
 *   node probe/acc8-f-run.mjs --batch all|realhost|arch|range:AC-01..AC-12
 *
 * 用例文件自动发现：`probe/acc8-cases/AC-<n>.mjs`，每个导出 `run(): Promise<case>`。
 * 新增用例只需落一个文件，**不需要改本文件**（避免多批次并行时的注册表冲突）。
 * 注册表之外 / 尚无用例文件的 AC 一律「阻塞：本 AC 暂无验收用例」，绝不静默跳过。
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  ACC8_PATHS, ensureDir, writeText, iso, VERDICT_BLOCK,
} from './acc8-f-lib.mjs';
import {
  makeCase, block, finish, writePart, appendResult, evidence,
} from './acc8-f-common.mjs';

const TOTAL_ACS = 67;

/** 从 `probe/acc8-cases/` 自动发现用例，按 AC 序号升序。 */
function discoverCases() {
  const map = {};
  let names = [];
  try {
    names = fs.readdirSync(ACC8_PATHS.CASES);
  } catch {
    return map;
  }
  const found = [];
  for (const name of names) {
    const m = /^AC-(\d+)\.mjs$/.exec(name);
    if (!m) continue;
    found.push({ ac: `AC-${m[1].padStart(2, '0')}`, file: `./acc8-cases/${name}` });
  }
  found.sort((a, b) => Number(a.ac.slice(3)) - Number(b.ac.slice(3)));
  for (const item of found) map[item.ac] = item.file;
  return map;
}

const CASE_FILES = Object.freeze(discoverCases());

export const REGISTRY = Object.freeze({ ...CASE_FILES });

const ALL = Object.keys(CASE_FILES);
/** 分组批次：真实宿主组共用一次真跑（`realCrashRecovery` 进程内记忆），架构门禁组互不依赖。 */
const GROUPS = Object.freeze({
  all: ALL,
  realhost: ['AC-25', 'AC-26', 'AC-57'],
  arch: ['AC-27', 'AC-52', 'AC-53', 'AC-54', 'AC-55', 'AC-56'],
});
const TIMEOUT_MS = 1_400_000;

/** `range:AC-01..AC-12` → 显式 AC 列表（含两端；不要求该 AC 已有用例文件）。 */
function parseRange(spec) {
  const m = /^range:AC-(\d+)\.\.AC-(\d+)$/i.exec(spec);
  if (!m) return null;
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (!(from > 0 && to >= from)) return null;
  const list = [];
  for (let i = from; i <= to; i += 1) list.push(`AC-${String(i).padStart(2, '0')}`);
  return list;
}

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
      c = makeCase(ac, { scenario: 'missing-case', title: '尚无用例文件' });
      block(c, `AC ${ac} 尚无验收用例文件（probe/acc8-cases/${ac}.mjs 不存在）；不得按「通过」处理，也不得跳过`);
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
    process.stdout.write([
      '用法：',
      '  node probe/acc8-f-run.mjs AC-XX',
      '  node probe/acc8-f-run.mjs --list',
      '  node probe/acc8-f-run.mjs --batch all|realhost|arch|range:AC-01..AC-12',
      '证据根：docs/iterations/iteration-8/evidence/<ACC8_EVID|acc8>/',
      '',
    ].join('\n'));
    return 0;
  }
  if (args.includes('--list')) {
    const have = Object.keys(CASE_FILES);
    const missing = [];
    for (let i = 1; i <= TOTAL_ACS; i += 1) {
      const ac = `AC-${String(i).padStart(2, '0')}`;
      if (!CASE_FILES[ac]) missing.push(ac);
    }
    process.stdout.write([
      `证据根：${ACC8_PATHS.EVID}`,
      `已就绪 ${have.length}/${TOTAL_ACS}：${have.join(', ') || '(无)'}`,
      `缺用例 ${missing.length}：${missing.join(', ') || '(无)'}`,
      '',
    ].join('\n'));
    return 0;
  }
  if (args[0] === '--batch') {
    const group = String(args[1] ?? 'all');
    const list = GROUPS[group.toLowerCase()] ?? parseRange(group);
    if (!list) {
      process.stdout.write(`未知批次：${group}（可选 ${Object.keys(GROUPS).join(' / ')} / range:AC-01..AC-12）\n`);
      return 1;
    }
    pruneResults(list);
    const summary = [];
    for (const ac of list) {
      const c = await runOne(ac);
      summary.push(`${ac}\t${c.verdict}\t${c.checksPassed ?? 0}/${c.checksTotal ?? 0}\t证据 ${c.evidence.length}`);
      process.stdout.write(`${ac} → ${c.verdict}（核对 ${c.checksPassed ?? 0}/${c.checksTotal ?? 0}，证据 ${c.evidence.length}）\n`);
    }
    const passed = summary.filter((s) => s.split('\t')[1] === '通过').length;
    const failed = summary.filter((s) => s.split('\t')[1] === '不通过').length;
    const blocked = summary.filter((s) => s.split('\t')[1] === '阻塞').length;
    writeText(path.join(ACC8_PATHS.EVID, '_batch-run.md'), [
      `# S3 批次运行摘要 · ${group}`,
      '',
      `- 时间：${iso()}`,
      `- 限时：每条 AC ${TIMEOUT_MS / 1000}s`,
      `- 条数：${list.length}（通过 ${passed} / 不通过 ${failed} / 阻塞 ${blocked}）`,
      '',
      '| AC | 判定 | 核对 | 证据 |',
      '|---|---|---|---|',
      ...summary.map((line) => {
        const [ac, verdict, checks, ev] = line.split('\t');
        return `| ${ac} | ${verdict} | ${checks} | ${ev} |`;
      }),
      '',
    ].join('\n'));
    process.stdout.write(`\n完成：${summary.length} 条 AC（通过 ${passed} / 不通过 ${failed} / 阻塞 ${blocked}）\n`);
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
