#!/usr/bin/env node
// I1.10b S3 批次 a 验收 —— 单 AC / 批次执行入口。
//   node probe/acc10b-f-run.mjs AC-01
//   node probe/acc10b-f-run.mjs --batch a        # a = AC-01~AC-15
//   node probe/acc10b-f-run.mjs --all
//   node probe/acc10b-f-run.mjs --list
// 用例注册表：probe/acc10b-cases/*.mjs（跳过 _ 开头），每个文件导出
//   export const cases = [{ ac, title, face, run }] 或单条 { ac, title, face, run }。
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  REPO, BASE, PARTS, RESULTS, EVID, CASES_DIR, requirementTitle,
  makeCase, finish, ensureParts, forceKillCore, coreStop,
  newToken, sleep
} from './acc10b-f-common.mjs';

const CASE_TIMEOUT_MS = Number(process.env.ACC10B_CASE_TIMEOUT_MS) > 0
  ? Number(process.env.ACC10B_CASE_TIMEOUT_MS)
  : 90_000;
const ALL = Array.from({ length: 15 }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`);
// 批次 b：AC-16~AC-30，跳过 AC-25（真实宿主面留批 e）
const BATCH_B = Array.from({ length: 15 }, (_, i) => `AC-${String(i + 16).padStart(2, '0')}`)
  .filter((id) => id !== 'AC-25');
// 批次 c：AC-31~AC-45，跳过 AC-33（真实宿主面留待批 e）
const BATCH_C = Array.from({ length: 15 }, (_, i) => `AC-${String(i + 31).padStart(2, '0')}`)
  .filter((id) => id !== 'AC-33');
const BATCHES = { a: ALL, b: BATCH_B, c: BATCH_C };

function usage() {
  return [
    '用法：node probe/acc10b-f-run.mjs <AC-xx ...> | --batch <a|b|c> | --all | --list',
    `批次：a=${BATCHES.a[0]}~${BATCHES.a.at(-1)}（${BATCHES.a.length} 条）；b=AC-16~AC-30 除 AC-25（${BATCHES.b.length} 条）；c=AC-31~AC-45 除 AC-33（${BATCHES.c.length} 条）；单条超时 ${CASE_TIMEOUT_MS / 1000}s`
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
    const list = Array.isArray(mod.cases) ? mod.cases
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

async function runOne(ac, entry) {
  const started = Date.now();
  let timedOut = false;
  newToken();
  const work = Promise.resolve().then(() => entry.run({ ac, entry }));
  work.catch(() => { /* 超时后不再关心 */ });
  let timer;
  const guard = new Promise((resolve) => { timer = setTimeout(() => resolve('__TIMEOUT__'), CASE_TIMEOUT_MS); });
  let sum;
  try {
    const out = await Promise.race([work, guard]);
    if (out === '__TIMEOUT__') {
      timedOut = true;
      newToken();
      await cleanRoot(ac);
      const root = path.join(BASE, ac);
      const c = makeCase(ac, { title: requirementTitle(ac), face: entry.face ?? 'mock 实测', root: fs.existsSync(root) ? root : null });
      const stamp = path.join(EVID, `${ac}.timeout.txt`);
      fs.mkdirSync(EVID, { recursive: true });
      fs.writeFileSync(stamp, `AC=${ac} 超时于 ${new Date().toISOString()}，耗时 ${Date.now() - started}ms（上限 ${CASE_TIMEOUT_MS / 1000}s）\n`, 'utf8');
      c.frame('timeout', 'txt', fs.readFileSync(stamp, 'utf8'));
      c.block(`用例在 ${CASE_TIMEOUT_MS / 1000} 秒内跑完`, `超时 ${Date.now() - started}ms；已回收核心，附 ${ac}.timeout.txt`);
      sum = finish(c, { timeout: true });
    } else if (out && typeof out === 'object' && out.verdict) {
      sum = out;
    } else {
      sum = { verdict: '阻塞', ok: 0, total: 0, blocked: [{ text: '用例未返回判定' }], failed: [] };
    }
  } catch (err) {
    newToken();
    await cleanRoot(ac);
    const root = path.join(BASE, ac);
    const c = makeCase(ac, { title: requirementTitle(ac), face: entry.face ?? 'mock 实测', root: fs.existsSync(root) ? root : null });
    c.frame('error', 'txt', `AC=${ac} 异常：${err?.stack ?? err}\n`);
    c.block('用例执行未抛异常', `${err?.stack ?? err}`.slice(0, 2000));
    sum = finish(c, { error: String(err?.message ?? err) });
  } finally {
    clearTimeout(timer);
    // 每条 AC 跑完按 §3.2 收尾：独立根下 orch core stop。
    const root = path.join(BASE, ac);
    if (fs.existsSync(root)) {
      try { coreStop(root); } catch { /* ignore */ }
      await forceKillCore(root);
    }
    await cleanRoot(ac);
  }
  const ms = Date.now() - started;
  const flag = timedOut ? '（超时）' : '';
  console.log(`[${ac}] ${sum.verdict}${flag} ${sum.ok ?? 0}/${sum.total ?? 0} ${(ms / 1000).toFixed(1)}s → probe/acc10b-f-parts/${ac}.md`);
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
      const key = argv[i + 1]; i += 1;
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
  fs.mkdirSync(EVID, { recursive: true });
  const stat = { 通过: 0, 不通过: 0, 阻塞: 0, 未登记: 0 };

  for (const ac of targets) {
    const entry = registry.get(ac);
    if (!entry) {
      stat.未登记 += 1;
      console.log(`[${ac}] 跳过：probe/acc10b-cases/ 下没有登记用例`);
      continue;
    }
    const sum = await runOne(ac, entry);
    stat[sum.verdict] = (stat[sum.verdict] ?? 0) + 1;
  }

  console.log(`[run] 完成：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞} / 未登记 ${stat.未登记}`);
  console.log(`[run] 证据：docs/iterations/iteration-10b/evidence/ ；分节：${PARTS} ；结果：${RESULTS}`);
  return 0;
}

const code = await main(process.argv.slice(2));
process.exit(code);
