/**
 * I1.10a S3 验收脚手架 · 逐 AC runner。
 *
 *   node probe/acc10-f-run.mjs AC-01           # 单条
 *   node probe/acc10-f-run.mjs --batch a       # AC-01~10
 *   node probe/acc10-f-run.mjs --batch b       # AC-11~20
 *   node probe/acc10-f-run.mjs --batch c       # AC-21~30
 *   node probe/acc10-f-run.mjs --batch d       # AC-31~37
 *   node probe/acc10-f-run.mjs --batch r       # AC-38~44（发布面）
 *   node probe/acc10-f-run.mjs --all           # 37 条串行
 *   node probe/acc10-f-run.mjs --list          # 只列用例，不执行
 *
 * results.jsonl 追加写；final 按 AC 取最后一条。退出码 0 只表示「跑完并落了判定」，
 * 不代表全通过；逐 AC 结论看 parts / result.json / final 汇总。
 *
 * 纪律：脚本不改产品代码；单条最多 2 次 attempt（ACC10_ATTEMPTS 可调），
 * 每次 attempt 的原始 TAP 日志全部保留，断言绝不改。
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO, PARTS, RESULTS, ensureDir, iso } from './acc10-f-lib.mjs';

const CASES = path.join(REPO, 'probe', 'acc10-cases');
const BATCHES = { a: [1, 10], b: [11, 20], c: [21, 30], d: [31, 37], r: [38, 44] };
const acId = (n) => `AC-${String(n).padStart(2, '0')}`;
const casePath = (ac) => path.join(CASES, `${ac.toLowerCase().replace('-', '')}.mjs`);

function select(argv) {
  if (argv.includes('--all')) return Array.from({ length: 37 }, (_, i) => acId(i + 1));
  const bi = argv.indexOf('--batch');
  if (bi >= 0) {
    const key = argv[bi + 1];
    if (!BATCHES[key]) throw new Error(`未知批次 ${key}（可用 a/b/c/d/r）`);
    const [lo, hi] = BATCHES[key];
    return Array.from({ length: hi - lo + 1 }, (_, i) => acId(lo + i));
  }
  const one = argv.find((a) => /^AC-\d{2}$/.test(a));
  if (one) return [one];
  const from = argv.indexOf('--from'), to = argv.indexOf('--to');
  if (from >= 0 && to >= 0) {
    const lo = Number(argv[from + 1]), hi = Number(argv[to + 1]);
    return Array.from({ length: hi - lo + 1 }, (_, i) => acId(lo + i));
  }
  throw new Error('用法：AC-xx | --batch a|b|c|d|r | --all | --from N --to M | --list');
}

async function main() {
  ensureDir(PARTS);
  ensureDir(path.dirname(RESULTS));
  if (process.argv.includes('--list')) {
    for (let i = 1; i <= 37; i++) {
      const ac = acId(i);
      const p = casePath(ac);
      const { spec } = fs.existsSync(p) ? await import(`file://${p}`) : { spec: null };
      console.log(`${ac}  ${spec ? spec.title : '(缺失)'}  files=${spec ? spec.files.join(',') : '-'}  then=${spec ? spec.then.length : 0}`);
    }
    return;
  }
  const list = select(process.argv.slice(2));
  const results = [];
  const t0 = Date.now();
  for (const ac of list) {
    const p = casePath(ac);
    if (!fs.existsSync(p)) { console.error(`MISSING ${p}`); process.exitCode = 2; continue; }
    const mod = await import(`file://${p}?t=${Date.now()}`);
    if (!Array.isArray(mod.cases) || mod.cases.length === 0) throw new Error(`${ac} 未导出 cases`);
    const started = iso();
    let r;
    try {
      r = await mod.cases[0].run();
    } catch (err) {
      console.error(`ERROR ${ac}: ${err.stack || err}`);
      r = { ac, verdict: '阻塞', level: '阻塞', error: String(err), startedAt: started, endedAt: iso() };
    }
    results.push(r);
    const v = r.verdict || '阻塞';
    console.log(`${ac}  ${v.padEnd(4)}  checks ${r.checksPass ?? '-'}/${r.checksTotal ?? '-'}  then ${r.thenCount ?? '-'}  files ${(r.unit || []).map((u) => `${u.file}(${u.tap?.pass}p/${u.tap?.fail}f/a${u.attempt})`).join(',') || '-'}  ${r.durationMs ?? '-'}ms`);
  }
  const counts = { 通过: 0, 不通过: 0, 阻塞: 0 };
  for (const r of results) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
  console.log(`--- batch summary ${new Date().toISOString()} ---`);
  console.log(`total ${results.length}  通过 ${counts.通过}  不通过 ${counts.不通过}  阻塞 ${counts.阻塞}  ${Date.now() - t0}ms`);
  console.log(`results -> ${RESULTS}`);
}

main().catch((e) => { console.error(e.stack || e); process.exit(1); });
