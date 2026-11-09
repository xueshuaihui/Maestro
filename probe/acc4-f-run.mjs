#!/usr/bin/env node
// WP-8 / I1.4 验收 —— 单 AC / 批次 / 全量执行入口。
//
//   node probe/acc4-f-run.mjs AC-07
//   node probe/acc4-f-run.mjs --batch a        # a=AC-01~15  b=16~30  c=31~45  d=46~60  e=61~70
//   node probe/acc4-f-run.mjs --all            # 依次跑完 a~e 五批，每批立刻落盘
//   node probe/acc4-f-run.mjs --list
//
// 用例注册表：自动加载 probe/acc4-cases/*.mjs（跳过 _ 开头的模板），每个文件导出
//   export const cases = [{ ac, title, face, grade, run }]
// 或单条形状：
//   export const ac = 'AC-xx'; export async function run() {…}
// 每跑完一条立刻 finish() → evidence/ + parts/ + results.jsonl，不等全部跑完。
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  REPO, BASE, PARTS, RESULTS, requirementTitle,
  makeCase, finish, ensureParts, forceKillCore,
  killAllLive, newToken,
} from './acc4-f-common.mjs';

const CASES_DIR = path.join(REPO, 'probe', 'acc4-cases');
const CASE_TIMEOUT_MS = Number(process.env.ACC4_CASE_TIMEOUT_MS) > 0
  ? Number(process.env.ACC4_CASE_TIMEOUT_MS)
  : 150_000;
const ALL = Array.from({ length: 70 }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`);
const range = (a, b) => ALL.filter((id) => {
  const n = Number(id.slice(3));
  return n >= a && n <= b;
});
const BATCHES = {
  a: range(1, 15),
  b: range(16, 30),
  c: range(31, 45),
  d: range(46, 60),
  e: range(61, 70),
};

function usage() {
  return [
    '用法：node probe/acc4-f-run.mjs <AC-xx ...> | --batch <a|b|c|d|e> | --all | --list',
    `批次：a=${BATCHES.a[0]}~${BATCHES.a.at(-1)}  b=${BATCHES.b[0]}~${BATCHES.b.at(-1)}  c=${BATCHES.c[0]}~${BATCHES.c.at(-1)}  d=${BATCHES.d[0]}~${BATCHES.d.at(-1)}  e=${BATCHES.e[0]}~${BATCHES.e.at(-1)}`,
  ].join('\n');
}

/** 加载注册表：AC → {ac,title,face,grade,run,file}。 */
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
        ? [{ ac: mod.ac, title: mod.title, face: mod.face, grade: mod.grade, run: mod.run }] : []);
    // 发现规则：按 acc4-cases/acNN.mjs 文件名发现，且 NN 必须与 entry.ac 一致。
    // 这样「ac07.mjs 里误写 AC-16」不会污染批次区间，也不会越界执行。
    const fm = /^ac(\d{2})\.mjs$/.exec(file);
    const expected = fm ? `AC-${fm[1]}` : null;
    for (const entry of list) {
      if (!/^AC-\d{2}$/.test(entry?.ac ?? '')) {
        console.error(`[run] 跳过 ${file} 中的条目：ac 非法（${entry?.ac}）`);
        continue;
      }
      if (expected && entry.ac !== expected) {
        console.error(`[run] 跳过 ${file} 中的条目：ac=${entry.ac} 与文件名不符（应为 ${expected}）`);
        continue;
      }
      registry.set(entry.ac, { ...entry, file });
    }
  }
  return registry;
}

/** 重跑受影响批次：先从 results.jsonl 里剔除这些 AC 的旧行，避免重复累积。 */
function pruneResults(targets) {
  if (!fs.existsSync(RESULTS)) return;
  const drop = new Set(targets);
  const kept = fs.readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean).filter((line) => {
    try { return !drop.has(JSON.parse(line).ac); } catch { return true; }
  });
  fs.writeFileSync(RESULTS, kept.length ? kept.join('\n') + '\n' : '', 'utf8');
}

async function cleanRoot(ac) {
  const dir = path.join(BASE, ac);
  if (fs.existsSync(dir)) await forceKillCore(dir);
}

async function runOne(ac, entry) {
  const started = Date.now();
  let timedOut = false;
  newToken();
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
      await killAllLive();
      await cleanRoot(ac);
      const root = path.join(BASE, ac);
      const c = makeCase(ac, { title: requirementTitle(ac), face: entry.face ?? 'mock 夹具面', grade: '阻塞' });
      if (fs.existsSync(root)) c.add(root);
      c.block(`用例在 ${CASE_TIMEOUT_MS / 1000} 秒内跑完`, `超时 ${Date.now() - started}ms；已强制回收核心与长驻进程`);
      c.note('超时判定为阻塞：附超时瞬间快照（state.json / events.jsonl / status.txt）。');
      sum = finish(c, { timeout: true });
    } else if (out && typeof out === 'object' && out.verdict) {
      sum = out;
    } else {
      sum = { verdict: '阻塞', ok: 0, total: 0, blocked: [{ text: '用例未返回判定' }], failed: [] };
      const c = makeCase(ac, { title: requirementTitle(ac), face: entry.face ?? 'mock 夹具面', grade: '阻塞' });
      c.block('用例返回判定', '用例未调用 finish() / 未返回 summarize 结果');
      finish(c, { error: 'no-verdict' });
    }
  } catch (err) {
    newToken();
    await killAllLive();
    await cleanRoot(ac);
    const root = path.join(BASE, ac);
    const c = makeCase(ac, { title: requirementTitle(ac), face: entry.face ?? 'mock 夹具面', grade: '阻塞' });
    if (fs.existsSync(root)) c.add(root);
    c.block('用例执行未抛异常', `${err?.stack ?? err}`.slice(0, 2000));
    c.note('用例异常按阻塞记录（不是产品判定），修复用例后重跑。');
    sum = finish(c, { error: String(err?.message ?? err) });
  } finally {
    clearTimeout(timer);
    await cleanRoot(ac);
    try { await killAllLive(); } catch { /* ignore */ }
  }
  const ms = Date.now() - started;
  const flag = timedOut ? '（超时）' : '';
  console.log(`[${ac}] ${sum.verdict}${flag} ${sum.ok ?? 0}/${sum.total ?? 0} ${(ms / 1000).toFixed(1)}s → probe/acc4-f-parts/${ac}.md`);
  return sum;
}

async function runTargets(targets, registry, allowed = null) {
  const stat = { 通过: 0, 不通过: 0, 阻塞: 0, 未登记: 0, 越界跳过: 0 };
  for (const ac of targets) {
    // 批次白名单：--batch a 内若混入 b/c/d/e 的 AC，直接跳过，绝不越界执行。
    if (allowed && !allowed.has(ac)) {
      stat.越界跳过 += 1;
      console.log(`[${ac}] 跳过：不属于本次批次区间（固定分区，不越界执行）`);
      continue;
    }
    const entry = registry.get(ac);
    if (!entry) {
      stat.未登记 += 1;
      console.log(`[${ac}] 跳过：probe/acc4-cases/ 下没有登记用例`);
      continue;
    }
    const sum = await runOne(ac, entry);
    stat[sum.verdict] = (stat[sum.verdict] ?? 0) + 1;
  }
  return stat;
}

async function main(argv) {
  const registry = await loadCases();
  if (argv.includes('--list')) {
    console.log(`已登记用例（${registry.size}）：${[...registry.keys()].sort().join(', ') || '（无）'}`);
    console.log(`未登记（${ALL.length - registry.size}）：${ALL.filter((id) => !registry.has(id)).join(', ') || '无'}`);
    for (const [k, v] of Object.entries(BATCHES)) {
      console.log(`批次 ${k}（${v.length} 条）：已登记 ${v.filter((id) => registry.has(id)).length}`);
    }
    return 0;
  }

  let targets = [];
  let batchMode = false;
  const batchKeys = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--all') targets.push(...ALL);
    else if (a === '--batch') {
      const key = argv[i + 1]; i += 1;
      if (!BATCHES[key]) { console.error(`未知批次：${key}\n${usage()}`); return 2; }
      targets.push(...BATCHES[key]); batchMode = true; batchKeys.push(key);
    } else if (a.startsWith('--batch=')) {
      const key = a.slice('--batch='.length);
      if (!BATCHES[key]) { console.error(`未知批次：${key}\n${usage()}`); return 2; }
      targets.push(...BATCHES[key]); batchMode = true; batchKeys.push(key);
    } else if (/^AC-\d{2}$/.test(a)) targets.push(a);
    else if (a.startsWith('--')) { console.error(`未知参数：${a}\n${usage()}`); return 2; }
    else { console.error(`无法识别的 AC：${a}\n${usage()}`); return 2; }
  }
  if (targets.length === 0) { console.error(usage()); return 2; }
  targets = [...new Set(targets)].sort();
  // 批次白名单只由 --batch 指定的固定区间组成；--all 时放行为全集。
  const allowed = batchKeys.length ? new Set(batchKeys.flatMap((k) => BATCHES[k])) : null;

  ensureParts();
  pruneResults(targets);
  const total = { 通过: 0, 不通过: 0, 阻塞: 0, 未登记: 0, 越界跳过: 0 };
  const add = (stat) => { for (const k of Object.keys(total)) total[k] += stat[k] ?? 0; };

  if (argv.includes('--all')) {
    // --all 按 a~e 五批依次执行，每批立刻落盘 / 打印小结，中断也不丢已完成批次。
    for (const [key, list] of Object.entries(BATCHES)) {
      const batchTargets = list.filter((id) => targets.includes(id));
      console.log(`[run] === 批次 ${key}（${batchTargets[0]}~${batchTargets.at(-1)}，${batchTargets.length} 条）===`);
      const stat = await runTargets(batchTargets, registry, new Set(list));
      add(stat);
      console.log(`[run] 批次 ${key} 完成：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞} / 未登记 ${stat.未登记}（已落盘）`);
    }
  } else {
    const stat = await runTargets(targets, registry, allowed);
    add(stat);
    if (batchMode) console.log(`[run] 批次完成：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞} / 未登记 ${stat.未登记} / 越界跳过 ${stat.越界跳过}（已落盘）`);
  }

  await killAllLive();
  console.log(`[run] 完成：通过 ${total.通过} / 不通过 ${total.不通过} / 阻塞 ${total.阻塞} / 未登记 ${total.未登记} / 越界跳过 ${total.越界跳过}`);
  console.log(`[run] 证据：docs/iterations/iteration-4/evidence/ ；分节：${PARTS} ；结果：${RESULTS}`);
  return 0;
}

const code = await main(process.argv.slice(2));
process.exit(code);
