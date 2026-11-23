#!/usr/bin/env node
// A1 验收 —— 单 AC / 批次执行入口（不启 core 进程，纯 CLI 命令面）。
//
//   node probe/accA1-f-run.mjs AC-07
//   node probe/accA1-f-run.mjs --batch a          # a=AC-01~05 b=AC-06~10 c=AC-11~15
//   node probe/accA1-f-run.mjs --all
//   node probe/accA1-f-run.mjs --list
//
// 用例注册表：自动加载 probe/accA1-cases/*.mjs（跳过 _ 开头的模板），导出
//   export const cases = [{ ac, title, face, run }]
// 或单条形状：export const ac / title / face / async function run()。
// 每条 AC 限时 90s；每跑完一条立即由用例 finish() 落 results + parts + evidence。
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  REPO, BASE, PARTS, RESULTS, EVID, VERDICTS, rel,
  requirementTitle, makeCase, finish, ensureParts, newToken
} from './accA1-f-common.mjs';

/** 跑前清掉该 AC 上一轮的旧证据帧，避免失败重跑残留混入证据索引。 */
function cleanEvidence(ac) {
  try {
    for (const f of fs.readdirSync(EVID)) {
      if (f.startsWith(`${ac}.`)) fs.rmSync(path.join(EVID, f), { force: true });
    }
  } catch { /* 目录不存在 */ }
}

const CASES_DIR = path.join(REPO, 'probe', 'accA1-cases');
const CASE_TIMEOUT_MS = Number(process.env.ACC_A1_CASE_TIMEOUT_MS) > 0
  ? Number(process.env.ACC_A1_CASE_TIMEOUT_MS) : 90_000;
const ALL = Array.from({ length: 15 }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`);
const range = (a, b) => ALL.filter((id) => {
  const n = Number(id.slice(3));
  return n >= a && n <= b;
});
const BATCHES = { a: range(1, 5), b: range(6, 10), c: range(11, 15) };

function usage() {
  return [
    '用法：node probe/accA1-f-run.mjs <AC-xx ...> | --batch <a|b|c> | --all | --list',
    `批次：a=${BATCHES.a[0]}~${BATCHES.a.at(-1)}  b=${BATCHES.b[0]}~${BATCHES.b.at(-1)}  c=${BATCHES.c[0]}~${BATCHES.c.at(-1)}`
  ].join('\n');
}

async function loadCases() {
  const registry = new Map();
  let files = [];
  try {
    files = fs.readdirSync(CASES_DIR).filter((f) => f.endsWith('.mjs') && !f.startsWith('_')).sort();
  } catch { /* 目录不存在 → 空注册表 */ }
  for (const file of files) {
    const full = path.join(CASES_DIR, file);
    let mod;
    try {
      mod = await import(pathToFileURL(full).href);
    } catch (err) {
      console.error(`[run] 跳过 ${file}：加载失败 ${err?.message ?? err}`);
      continue;
    }
    const list = Array.isArray(mod.cases)
      ? mod.cases
      : (mod.ac && typeof mod.run === 'function'
        ? [{ ac: mod.ac, title: mod.title, face: mod.face, run: mod.run }] : []);
    for (const entry of list) {
      if (!/^AC-\d{2}$/.test(entry?.ac ?? '')) {
        console.error(`[run] 跳过 ${file} 中的条目：ac 非法（${entry?.ac}）`);
        continue;
      }
      registry.set(entry.ac, { ...entry, file });
    }
  }
  return registry;
}

async function runOne(ac, entry) {
  cleanEvidence(ac); // 跑前清理旧帧，本轮只留最新原始证据
  const started = Date.now();
  let timedOut = false;
  newToken(); // 用例捕获本轮 token；超时/异常后换 token，旧用例即使跑完也不会重复写
  const work = Promise.resolve().then(() => entry.run({ ac, entry }));
  work.catch(() => { /* 超时后不再关心 */ });
  let timer;
  const guard = new Promise((resolve) => {
    timer = setTimeout(() => resolve('__TIMEOUT__'), CASE_TIMEOUT_MS);
  });
  let sum;
  try {
    const out = await Promise.race([work, guard]);
    if (out === '__TIMEOUT__') {
      timedOut = true;
      newToken();
      const c = makeCase(ac, { title: requirementTitle(ac), face: entry.face ?? 'mock 面', level: 'pending' });
      c.block(`用例在 ${CASE_TIMEOUT_MS / 1000} 秒内跑完`, `超时 ${Date.now() - started}ms（CLI 命令面，无 core 可回收）`);
      c.note('超时按阻塞记录（不是产品判定），附超时时刻快照；修复用例后重跑。');
      sum = finish(c, { timeout: true });
    } else if (out && typeof out === 'object' && out.verdict) {
      sum = out; // 用例自己 finish 过
    } else {
      sum = { verdict: VERDICTS.BLOCK, ok: 0, total: 0, blocked: [{ text: '用例未返回判定' }], failed: [] };
    }
  } catch (err) {
    newToken();
    const c = makeCase(ac, { title: requirementTitle(ac), face: entry.face ?? 'mock 面', level: 'pending' });
    c.block('用例执行未抛异常', `${err?.stack ?? err}`.slice(0, 2000));
    c.note('用例异常按阻塞记录（不是产品判定），修复用例后重跑。');
    sum = finish(c, { error: String(err?.message ?? err) });
  } finally {
    clearTimeout(timer);
  }
  const ms = Date.now() - started;
  const flag = timedOut ? '（超时）' : '';
  console.log(`[${ac}] ${sum.verdict}${flag} ${sum.ok ?? 0}/${sum.total ?? 0} ${(ms / 1000).toFixed(1)}s → probe/accA1-f-parts/${ac}.md`);
  return sum;
}

async function main(argv) {
  const registry = await loadCases();
  let targets = [];

  if (argv.includes('--list')) {
    console.log(`已登记用例（${registry.size}）：${[...registry.keys()].sort().join(', ') || '（无）'}`);
    const missing = ALL.filter((id) => !registry.has(id));
    console.log(`未登记（${missing.length}）：${missing.join(', ')}`);
    for (const [k, v] of Object.entries(BATCHES)) {
      console.log(`批次 ${k}（${v.length} 条）：已登记 ${v.filter((id) => registry.has(id)).length}`);
    }
    return 0;
  }

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--all') targets.push(...ALL);
    else if (a === '--batch') {
      const key = argv[i + 1];
      i += 1;
      if (!BATCHES[key]) { console.error(`未知批次：${key}\n${usage()}`); return 2; }
      targets.push(...BATCHES[key]);
    } else if (a.startsWith('--batch=')) {
      const key = a.slice('--batch='.length);
      if (!BATCHES[key]) { console.error(`未知批次：${key}\n${usage()}`); return 2; }
      targets.push(...BATCHES[key]);
    } else if (/^AC-\d{2}$/.test(a)) targets.push(a);
    else if (a.startsWith('--')) { console.error(`未知参数：${a}\n${usage()}`); return 2; }
    else { console.error(`无法识别的 AC：${a}\n${usage()}`); return 2; }
  }

  if (targets.length === 0) { console.error(usage()); return 2; }
  targets = [...new Set(targets)].sort();

  ensureParts();
  const stat = { 通过: 0, 不通过: 0, 阻塞: 0, 未登记: 0 };

  for (const ac of targets) {
    const entry = registry.get(ac);
    if (!entry) {
      stat.未登记 += 1;
      console.log(`[${ac}] 跳过：probe/accA1-cases/ 下没有登记用例`);
      continue;
    }
    const sum = await runOne(ac, entry);
    stat[sum.verdict] = (stat[sum.verdict] ?? 0) + 1;
    // 每跑完一条立即落盘：用例 finish() 已写，此处仅提示当前累计，不等全部跑完。
    console.log(`[run] 已落盘 ${ac}（results + parts + evidence）；累计 通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞}`);
  }

  console.log(`[run] 完成：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞} / 未登记 ${stat.未登记}`);
  console.log(`[run] 证据：${rel(EVID)}；分节：${rel(PARTS)}；结果：${rel(RESULTS)}`);
  return 0;
}

const code = await main(process.argv.slice(2));
process.exit(code);
