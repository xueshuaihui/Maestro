#!/usr/bin/env node
// I1.3 验收 —— 单 AC / 批次执行入口。
//
//   node probe/acc3-f-run.mjs AC-07
//   node probe/acc3-f-run.mjs --batch a          # a=AC-01~12  b=AC-13~21  c=AC-22~35  d=AC-36~39+41~45  e=AC-40
//   node probe/acc3-f-run.mjs --all
//   node probe/acc3-f-run.mjs --list
//
// 用例注册表：自动加载 probe/acc3-cases/*.mjs（跳过 _ 开头的模板），每个文件导出
//   export const cases = [{ ac, title, face, run }]
// 或单条形状：
//   export const ac = 'AC-xx'; export const title = '…'; export async function run() {…}
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  REPO, BASE, PARTS, RESULTS, requirementTitle,
  makeCase, finish, ensureParts,
  killAllDrivers, forceKillCore, scenariosSinceRecycle, resetScenarioCounter,
  newToken, SCENARIO_RECYCLE_AT, sleep
} from './acc3-f-common.mjs';

const CASES_DIR = path.join(REPO, 'probe', 'acc3-cases');
const CASE_TIMEOUT_MS = Number(process.env.ACC3_CASE_TIMEOUT_MS) > 0
  ? Number(process.env.ACC3_CASE_TIMEOUT_MS)
  : 90_000;
const ALL = Array.from({ length: 45 }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`);
const range = (a, b) => ALL.filter((id) => {
  const n = Number(id.slice(3));
  return n >= a && n <= b;
});
const BATCHES = {
  a: range(1, 12),
  b: range(13, 21),
  c: range(22, 35),
  d: [...range(36, 39), ...range(41, 45)],
  e: range(40, 40)
};

function usage() {
  return [
    '用法：node probe/acc3-f-run.mjs <AC-xx ...> | --batch <a|b|c|d|e> | --all | --list',
    `批次：a=${BATCHES.a[0]}~${BATCHES.a.at(-1)}  b=${BATCHES.b[0]}~${BATCHES.b.at(-1)}  c=${BATCHES.c[0]}~${BATCHES.c.at(-1)}  d=AC-36~39+41~45  e=AC-40`
  ].join('\n');
}

/** 加载注册表：AC → {ac,title,face,run,file}。 */
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
  if (fs.existsSync(dir)) await forceKillCore(dir);
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
  newToken(); // 本轮的用例捕获这个 token；超时/异常后再换，旧用例即使跑完也不会重复写结果
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
      await killAllDrivers();
      await cleanRoot(ac);
      const root = path.join(BASE, ac);
      const c = makeCase(ac, { title: requirementTitle(ac), face: entry.face ?? '夹具' });
      if (fs.existsSync(root)) c.add(root);
      c.block(`用例在 ${CASE_TIMEOUT_MS / 1000} 秒内跑完`, `超时 ${Date.now() - started}ms；已强制回收核心与驱动`);
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
    await cleanRoot(ac);
    const root = path.join(BASE, ac);
    const c = makeCase(ac, { title: requirementTitle(ac), face: entry.face ?? '夹具' });
    if (fs.existsSync(root)) c.add(root);
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
  console.log(`[${ac}] ${sum.verdict}${flag} ${sum.ok ?? 0}/${sum.total ?? 0} ${(ms / 1000).toFixed(1)}s → probe/acc3-f-parts/${ac}.md`);
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
      console.log(`[${ac}] 跳过：probe/acc3-cases/ 下没有登记用例`);
      continue;
    }
    const sum = await runOne(ac, entry);
    stat[sum.verdict] = (stat[sum.verdict] ?? 0) + 1;
    if (await maybeRecycle()) console.log(`[run] 场景计数满 ${SCENARIO_RECYCLE_AT}，已回收核心`);
  }

  await killAllDrivers();
  console.log(`[run] 完成：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞} / 未登记 ${stat.未登记}`);
  console.log(`[run] 证据：docs/iterations/iteration-3/evidence/ ；分节：${PARTS} ；结果：${RESULTS}`);
  return 0;
}

const code = await main(process.argv.slice(2));
process.exit(code);
