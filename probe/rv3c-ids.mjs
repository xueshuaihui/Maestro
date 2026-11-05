// probe/rv3c-ids.mjs — I1.3 第 2 路：编号连续性与全文交叉引用独立复核
// 用法：node probe/rv3c-ids.mjs   （只读，不改动任何文件）
import fs from 'node:fs';

const FILE = 'docs/iterations/iteration-3/requirement.md';
const text = fs.readFileSync(FILE, 'utf8');
const lines = text.split(/\r?\n/);

// 各编号族「定义行」的识别式
const families = {
  AC:  /^#### AC-(\d+)\b/,
  BR:  /^\|\s*\*\*BR-(\d+)\*\*\s*\|/,
  M:   /^\|\s*\*\*M-(\d+)\*\*\s*\|/,
  C:   /^\|\s*\*\*C-(\d+)\*\*\s*\|/,
  D:   /^#{3,4}\s+D-(\d+)\b/,
  A:   /^#{3,4}\s+A-(\d+)\b/,
  R:   /\*\*R-(\d+)[（(]/,
  NFR: /^\|\s*\*\*NFR-(\d+)\*\*\s*\|/,
  B:   /^\|\s*\*\*B-(\d+)\*\*\s*\|/,
};
// 任务书最初期望的条数（仅用于标注快照漂移，不作为判定错误）
const expect = { AC: 43, BR: 38, M: 10, C: 14, D: 10, A: 4, R: 6, NFR: 10, B: 10 };

const defs = {};
for (const f of Object.keys(families)) defs[f] = new Map();
lines.forEach((ln, i) => {
  for (const [f, re] of Object.entries(families)) {
    const m = ln.match(re);
    if (m) defs[f].set(Number(m[1]), i + 1);
  }
});

const out = [];
out.push(`文件行数（split）= ${lines.length}`);
out.push('');
out.push('=== 1. 编号定义与连续性（1..max 无缺口即连续）===');
for (const f of Object.keys(families)) {
  const nums = [...defs[f].keys()].sort((a, b) => a - b);
  const max = nums.length ? nums[nums.length - 1] : 0;
  const gaps = [];
  for (let n = 1; n <= max; n += 1) if (!defs[f].has(n)) gaps.push(n);
  const short = nums.length <= 14 ? `[${nums.join(',')}]` : `[${nums.slice(0, 3).join(',')},...,${nums.slice(-2).join(',')}]`;
  const drift = nums.length !== expect[f] ? `  <-- 任务书期望 ${expect[f]} 条，实际 ${nums.length} 条（快照漂移）` : '';
  out.push(`${f.padEnd(3)}: 定义 ${String(nums.length).padStart(2)} 条 ${short}  max=${max}  gaps=[${gaps.length ? gaps.join(',') : '无'}]${drift}`);
  out.push(`     定义行=[${nums.map((n) => defs[f].get(n)).join(',')}]`);
}

out.push('');
out.push('=== 2. 全文交叉引用扫描（引用 vs 定义，列悬空引用）===');
const refRe = /\b(AC|BR|NFR|M|C|D|A|R|B)-(\d+)\b/g;
const dangling = [];
const refCount = {};
const refSet = {};
let m;
while ((m = refRe.exec(text)) !== null) {
  const f = m[1];
  const n = Number(m[2]);
  refCount[f] = (refCount[f] || 0) + 1;
  (refSet[f] ||= new Set()).add(n);
  if (!defs[f].has(n)) {
    const lineNo = text.slice(0, m.index).split(/\r?\n/).length;
    const lineText = (lines[lineNo - 1] || '').trim().slice(0, 100);
    const key = `${f}-${n}@${lineNo}`;
    if (!dangling.some((d) => d.startsWith(`[DANGLING] ${key} `))) {
      dangling.push(`[DANGLING] ${key}  「${lineText}」`);
    }
  }
}
if (dangling.length === 0) out.push('悬空引用=[无]');
else dangling.forEach((d) => out.push(d));
out.push(`引用次数：${Object.entries(refCount).map(([f, c]) => `${f}=${c}`).join('  ')}`);
for (const f of Object.keys(families)) {
  const s = [...(refSet[f] || [])].sort((a, b) => a - b);
  out.push(`被引用 ${f.padEnd(3)} = [${s.length ? s.join(',') : '无'}]`);
}

out.push('');
out.push('=== 3. 每条 AC 的「规则」字段是否引用存在的 BR ===');
const acTitles = [];
lines.forEach((ln, i) => {
  const mm = ln.match(/^#### (AC-\d+)\b/);
  if (mm) acTitles.push({ id: mm[1], line: i + 1, start: i });
});
const missRule = [];
const noBr = [];
const badBr = [];
acTitles.forEach((ac, idx) => {
  const end = idx + 1 < acTitles.length ? acTitles[idx + 1].start : lines.length;
  const body = lines.slice(ac.start, end).join('\n');
  const rm = body.match(/\*\*规则\*\*[：:]\s*([^\n]*)/);
  if (!rm) { missRule.push(ac.id); return; }
  const brs = [...rm[1].matchAll(/BR-(\d+)/g)].map((x) => Number(x[1]));
  if (brs.length === 0) noBr.push(ac.id);
  brs.forEach((n) => { if (!defs.BR.has(n)) badBr.push(`${ac.id}->BR-${n}`); });
});
out.push(`AC 块 ${acTitles.length} 条；缺「规则」字段=[${missRule.length ? missRule.join(',') : '无'}]；规则未引 BR=[${noBr.length ? noBr.join(',') : '无'}]；规则引用未定义 BR=[${badBr.length ? badBr.join(',') : '无'}]`);

out.push('');
out.push('=== 4. BR 表「覆盖 AC」列 ===');
const covered = new Set();
const badCover = [];
lines.forEach((ln, i) => {
  const bm = ln.match(/^\|\s*\*\*BR-(\d+)\*\*\s*\|/);
  if (!bm) return;
  [...ln.matchAll(/AC-(\d+)/g)].forEach((x) => {
    const n = Number(x[1]);
    if (!defs.AC.has(n)) badCover.push(`BR-${bm[1]}->AC-${n} @L${i + 1}`);
    else covered.add(n);
  });
});
const allAc = [...defs.AC.keys()].sort((a, b) => a - b);
const uncovered = allAc.filter((n) => !covered.has(n));
out.push(`覆盖列悬空 AC=[${badCover.length ? badCover.join(', ') : '无'}]；未被任何 BR 覆盖的 AC=[${uncovered.length ? uncovered.join(',') : '无'}]`);

out.push('');
out.push('=== 5. §1.3.1 规划对应表 AC 引用 ===');
let start = lines.findIndex((ln) => /^#{1,4}\s*1\.3\.1\b/.test(ln));
if (start < 0) start = lines.findIndex((ln) => /规划对应/.test(ln));
if (start < 0) {
  out.push('未定位到 §1.3.1 / 规划对应表');
} else {
  const seg = lines.slice(start, start + 22).join('\n');
  const refs = [...new Set([...seg.matchAll(/AC-(\d+)/g)].map((x) => Number(x[1])))].sort((a, b) => a - b);
  const bad = refs.filter((n) => !defs.AC.has(n));
  out.push(`起始行=${start + 1}；引用=[${refs.join(',')}]；悬空/作废=[${bad.length ? bad.join(',') : '无'}]`);
}

console.log(out.join('\n'));
