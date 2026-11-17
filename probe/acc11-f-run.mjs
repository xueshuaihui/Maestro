#!/usr/bin/env node
/**
 * I1.11 S3 验收 · 单 AC / 批次执行入口。
 *
 *   node probe/acc11-f-run.mjs AC-01
 *   node probe/acc11-f-run.mjs --batch a        # a = AC-01~13（本批 13 条）
 *   node probe/acc11-f-run.mjs --all             # 现有全部已登记用例
 *   node probe/acc11-f-run.mjs --list
 *
 * 注册表：自动加载 probe/acc11-cases/*.mjs（跳过 _ 开头模板），每个文件导出
 *   export const cases = [{ ac, title, face, run }]
 * 或单条形状：export const ac/title/face; export async function run()。
 *
 * 纪律：每条 AC 独立 root、单 AC 限时 90s（超时记阻塞 + 证据）、结束 orch core stop
 * 清理；results.jsonl 追加写，final 取每 AC 最后一条。退出码 0 只表示跑完并落判定。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  REPO, BASE, PARTS, RESULTS, EVID, req, makeCase, finish, ensureParts,
  killAllDrivers, forceKillCore, summarize
} from './acc11-f-common.mjs';

const CASES_DIR = path.join(REPO, 'probe', 'acc11-cases');
const CASE_TIMEOUT_MS = Number(process.env.ACC11_CASE_TIMEOUT_MS) > 0
  ? Number(process.env.ACC11_CASE_TIMEOUT_MS)
  : 90_000;
const ALL = Array.from({ length: 49 }, (_, i) => `AC-${String(i + 1).padStart(2, '0')}`);
const range = (a, b) => ALL.filter((id) => { const n = Number(id.slice(3)); return n >= a && n <= b; });
const BATCHES = {
  a: range(1, 13),  // 批次 A：AC-01~AC-13
  b: range(14, 26)  // 批次 B：AC-14~AC-26
};

function usage() {
  return [
    '用法：node probe/acc11-f-run.mjs <AC-xx ...> | --batch a|b | --all | --list',
    `批次：a=${BATCHES.a[0]}~${BATCHES.a.at(-1)}（13 条）、b=${BATCHES.b[0]}~${BATCHES.b.at(-1)}（13 条）；单 AC 限时 ${CASE_TIMEOUT_MS / 1000}s。`
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
    try { mod = await import(pathToFileURL(full).href); }
    catch (err) { console.error(`[run] 跳过 ${file}：加载失败 ${err?.message ?? err}`); continue; }
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
  const tmp = path.join(BASE, '_tmp', ac);
  if (fs.existsSync(tmp)) await forceKillCore(tmp);
}

/**
 * 执行一条 AC。用例通过 c.frame/testRuns/checks 自行 finish；runner 负责 90s 超时兜底，
 * 超时/异常后换 token 使旧用例的 finish 失效，避免重复写结果。
 */
async function runOne(ac, entry) {
  const started = Date.now();
  let timedOut = false;
  const work = Promise.resolve().then(() => entry.run({ ac, entry }));
  work.catch(() => { /* 超时后不再关心 */ });
  let timer;
  const guard = new Promise((resolve) => { timer = setTimeout(() => resolve('__TIMEOUT__'), CASE_TIMEOUT_MS); });
  let sum;
  try {
    const out = await Promise.race([work, guard]);
    if (out === '__TIMEOUT__') {
      timedOut = true;
      await killAllDrivers();
      await cleanRoot(ac);
      const c = makeCase(ac, { title: req(ac)?.title || entry.title, face: entry.face ?? '夹具' });
      c.block(`用例在 ${CASE_TIMEOUT_MS / 1000} 秒内跑完`, `超时 ${Date.now() - started}ms；已强制回收核心与驱动；需求要求与已尝试路径见用例 parts。`);
      c.note('超时判定为阻塞：附超时时刻证据（test-stdout.txt 记录已收到的机检 stdout；state.json 为超时瞬间快照）。');
      c.grade = '阻塞';
      sum = finish(c, { timeout: true });
    } else if (out && typeof out === 'object' && out.verdict) {
      sum = out;  // 用例自己 finish 过
    } else {
      const c = makeCase(ac, { title: req(ac)?.title || entry.title, face: entry.face ?? '夹具' });
      c.block('用例返回了判定', `run() 返回值缺少 verdict：${JSON.stringify(out)?.slice(0, 300)}`);
      sum = finish(c, { malformed: true });
    }
  } catch (err) {
    await killAllDrivers();
    await cleanRoot(ac);
    const c = makeCase(ac, { title: req(ac)?.title || entry.title, face: entry.face ?? '夹具' });
    c.block('用例执行未抛异常', `${err?.stack ?? err}`.slice(0, 3000));
    c.note('用例异常按阻塞记录（不是产品判定）；修复用例后重跑。');
    sum = finish(c, { error: String(err?.message ?? err) });
  } finally {
    clearTimeout(timer);
    // 同 root 独立、orch core stop 清理（由用例 finally 和此处双重兜底）
    await cleanRoot(ac);
    try { await killAllDrivers(); } catch { /* ignore */ }
  }
  const ms = Date.now() - started;
  const flag = timedOut ? '（超时）' : '';
  console.log(`[${ac}] ${sum.verdict}${flag} ${sum.ok ?? 0}/${sum.total ?? 0} ${(ms / 1000).toFixed(1)}s → probe/acc11-f-parts/${ac}.md`);
  return sum;
}

async function main(argv) {
  const registry = await loadCases();
  let targets = [];
  if (argv.includes('--list')) {
    console.log(`已登记用例（${registry.size}）：${[...registry.keys()].sort().join(', ') || '（无）'}`);
    console.log(`未登记：${ALL.filter((id) => !registry.has(id)).join(', ')}`);
    for (const [k, v] of Object.entries(BATCHES)) console.log(`批次 ${k}（${v.length} 条）：已登记 ${v.filter((id) => registry.has(id)).length}`);
    return 0;
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--all') targets.push(...ALL);
    else if (a === '--batch' || a.startsWith('--batch=')) {
      const key = (a === '--batch' ? argv[i + 1] : a.slice('--batch='.length));
      if (a === '--batch') i += 1;
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
    if (!entry) { stat.未登记 += 1; console.log(`[${ac}] 跳过：probe/acc11-cases/ 下没有登记用例`); continue; }
    const sum = await runOne(ac, entry);
    stat[sum.verdict] = (stat[sum.verdict] ?? 0) + 1;
  }
  await killAllDrivers();
  console.log(`[run] 完成：通过 ${stat.通过} / 不通过 ${stat.不通过} / 阻塞 ${stat.阻塞} / 未登记 ${stat.未登记}`);
  console.log(`[run] 证据：${EVID}；分节：${PARTS}；结果：${RESULTS}`);
  return 0;
}

const code = await main(process.argv.slice(2));
process.exit(code);
