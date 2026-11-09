#!/usr/bin/env node
// I1.6 验收 —— 单 AC / 批次执行入口。
//
//   node probe/acc6-f-run.mjs AC-07
//   node probe/acc6-f-run.mjs --batch a          # a=AC-01~22  b=AC-23~44  c=AC-45~65
//   node probe/acc6-f-run.mjs --all
//   node probe/acc6-f-run.mjs --list
//
// 用例注册表：自动加载 probe/acc6-cases/*.mjs（跳过 _ 开头的模板），每个文件导出
//   export const cases = [{ ac, title, face, timeoutMs?, run }]
// 或单条形状：
//   export const ac = 'AC-xx'; export const title = '…'; export async function run() {…}
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BASE, PARTS, RESULTS, CASES_DIR, BATCHES, AC_TOTAL, requirementTitle,
  makeCase, finish, ensureParts,
  killAllDrivers, forceKillCore, scenariosSinceRecycle, resetScenarioCounter, sweepStrays,
  newToken, SCENARIO_RECYCLE_AT, exists
} from './acc6-f-common.mjs';

const CASE_TIMEOUT_MS = Number(process.env.ACC6_CASE_TIMEOUT_MS) > 0
  ? Number(process.env.ACC6_CASE_TIMEOUT_MS)
  : 90_000;
const ALL = Array.from({ length: AC_TOTAL }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`);
const range = (a, b) => ALL.filter((id) => {
  const n = Number(id.slice(3));
  return n >= a && n <= b;
});
const BATCH_MAP = {
  a: range(BATCHES.a[0], BATCHES.a[1]),
  b: range(BATCHES.b[0], BATCHES.b[1]),
  c: range(BATCHES.c[0], BATCHES.c[1])
};

function usage() {
  return [
    '用法：node probe/acc6-f-run.mjs <AC-xx ...> | --batch <a|b|c> | --all | --list',
    `批次：a=${BATCH_MAP.a[0]}~${BATCH_MAP.a.at(-1)}  b=${BATCH_MAP.b[0]}~${BATCH_MAP.b.at(-1)}  c=${BATCH_MAP.c[0]}~${BATCH_MAP.c.at(-1)}（任务书口径 a=22 / b=22 / c=21 条）`,
    `单条限时：${CASE_TIMEOUT_MS}ms（用例可用 timeoutMs 覆盖；显式覆盖的 AC 见 probe/acc6-cases/README.md）`
  ].join('\n');
}

/** 加载注册表：AC → {ac,title,face,run,file,timeoutMs}。 */
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
      : (mod.ac && typeof mod.run === 'function' ? [{ ac: mod.ac, title: mod.title, face: mod.face, run: mod.run }] : []);
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

async function cleanRoot(ac) {
  const dir = path.join(BASE, ac);
  if (exists(dir)) await forceKillCore(dir);
}

/** 已知：同进程连跑 20+ 场景会让 mock 的 session/new 全部失败；满 10 个回收一次。 */
async function maybeRecycle() {
  if (scenariosSinceRecycle() < SCENARIO_RECYCLE_AT) return false;
  let dirs = [];
  try { dirs = fs.readdirSync(BASE); } catch { /* ignore */ }
  for (const d of dirs) await forceKillCore(path.join(BASE, d));
  resetScenarioCounter();
  return true;
}

async function runOne(ac, entry) {
  const started = Date.now();
  let timedOut = false;
  // 每条 AC 起跑前清扫上一轮留下的孙进程（产品 spawn 的宿主不在 LIVE 表里）。
  const swept = await sweepStrays();
  if (swept > 0) console.log(`[${ac}] 清扫残留进程 ${swept} 个`);
  const budget = Number(entry.timeoutMs) > 0 ? Number(entry.timeoutMs) : CASE_TIMEOUT_MS;
  newToken(); // 本轮的用例捕获这个 token；超时/异常后再换，旧用例即使跑完也不会重复写结果
  const work = Promise.resolve().then(() => entry.run({ ac, entry }));
  work.catch(() => { /* 超时后不再关心 */ });
  let timer;
  const guard = new Promise((resolve) => {
    timer = setTimeout(() => resolve('__TIMEOUT__'), budget);
  });
  let sum;
  try {
    const out = await Promise.race([work, guard]);
    if (out === '__TIMEOUT__') {
      timedOut = true;
      newToken();
      await killAllDrivers();
      const root = path.join(BASE, ac);
      const c = makeCase(ac, { title: requirementTitle(ac), face: entry.face ?? '机检' });
      if (exists(root)) c.add(root);
      c.block(`用例在 ${budget / 1000} 秒内跑完`, `超时 ${Date.now() - started}ms；已强制回收核心与驱动`);
      c.note('超时判定为阻塞：附超时证据（state.json / events.jsonl / status.txt 为超时瞬间的快照）。');
      sum = finish(c, { timeout: true });
    } else if (out && typeof out === 'object' && out.verdict) {
      sum = out; // 用例自己 finish 过
    } else {
      sum = { verdict: '阻塞', ok: 0, total: 0, blocked: [{ text: '用例未返回判定' }], failed: [] };
    }
  } catch (err) {
    newToken();
    await killAllDrivers();
    const root = path.join(BASE, ac);
    const c = makeCase(ac, { title: requirementTitle(ac), face: entry.face ?? '机检' });
    if (exists(root)) c.add(root);
    c.block('用例执行未抛异常', `${err?.stack ?? err}`.slice(0, 2000));
    c.note('用例异常按阻塞记录（不是产品判定），修复用例后重跑。');
    sum = finish(c, { error: String(err?.message ?? err) });
  } finally {
    clearTimeout(timer);
    await cleanRoot(ac);
    try { await killAllDrivers(); } catch { /* ignore */ }
  }
  const ms = Date.now() - started;
  const flag = timedOut ? '（超时）' : '';
  console.log(`[${ac}] ${sum.verdict}${flag} ${sum.ok ?? 0}/${sum.total ?? 0} ${(ms / 1000).toFixed(1)}s → probe/acc6-f-parts/${ac}.md`);
  return sum;
}

async function main(argv) {
  const registry = await loadCases();
  let targets = [];

  if (argv.includes('--list')) {
    console.log(`已登记用例（${registry.size}）：${[...registry.keys()].sort().join(', ') || '（无）'}`);
    const missing = ALL.filter((id) => !registry.has(id));
    console.log(`未登记（${missing.length}）：${missing.join(', ') || '无'}`);
    for (const [k, v] of Object.entries(BATCH_MAP)) {
      console.log(`批次 ${k}（${v.length} 条）：已登记 ${v.filter((id) => registry.has(id)).length}`);
    }
    const overrides = [...registry.entries()].filter(([, v]) => Number(v.timeoutMs) > 0).map(([k, v]) => `${k}(${v.timeoutMs}ms)`);
    console.log(`单条限时覆盖：${overrides.join('、') || '无'}`);
    return 0;
  }

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--all') targets.push(...ALL);
    else if (a === '--batch') {
      const key = argv[i + 1];
      i += 1;
      if (!BATCH_MAP[key]) { console.error(`未知批次：${key}\n${usage()}`); return 2; }
      targets.push(...BATCH_MAP[key]);
    } else if (a.startsWith('--batch=')) {
      const key = a.slice('--batch='.length);
      if (!BATCH_MAP[key]) { console.error(`未知批次：${key}\n${usage()}`); return 2; }
      targets.push(...BATCH_MAP[key]);
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
      console.log(`[${ac}] 跳过：probe/acc6-cases/ 下没有登记用例`);
      continue;
    }
    const sum = await runOne(ac, entry);
    stat[sum.verdict] = (stat[sum.verdict] ?? 0) + 1;
    if (await maybeRecycle()) console.log(`[run] 场景计数满 ${SCENARIO_RECYCLE_AT}，已回收核心`);
  }

  await killAllDrivers();
  console.log(`[run] 完成：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞} / 未登记 ${stat.未登记}`);
  console.log(`[run] 证据：docs/iterations/iteration-6/evidence/ ；分节：${PARTS} ；结果：${RESULTS}`);
  return 0;
}

const code = await main(process.argv.slice(2));
process.exit(code);
