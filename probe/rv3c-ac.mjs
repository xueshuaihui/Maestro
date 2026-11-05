// probe/rv3c-ac.mjs — I1.3 第 2 路：逐条 AC 头部字段与断言字面量速查
// 用法：node probe/rv3c-ac.mjs   （只读）
import fs from 'node:fs';

const FILE = 'docs/iterations/iteration-3/requirement.md';
const lines = fs.readFileSync(FILE, 'utf8').split(/\r?\n/);

const heads = [];
lines.forEach((ln, i) => {
  const m = ln.match(/^#### (AC-\d+)\s+(.+)$/);
  if (m) heads.push({ id: m[1], title: m[2].trim(), line: i + 1, start: i });
});

const rows = heads.map((h, idx) => {
  const end = idx + 1 < heads.length ? heads[idx + 1].start : lines.length;
  const body = lines.slice(h.start, end);
  const b = body.join('\n');
  const meta = b.match(/\*\*验证面\*\*[：:]\s*([^｜|]+)[｜|]\s*\*\*类型\*\*[：:]\s*([^｜|]+)[｜|]\s*\*\*风险\*\*[：:]\s*([^｜|]+)[｜|]\s*\*\*规则\*\*[：:]\s*([^\n]*)/);
  const face = meta ? meta[1].trim() : '-';
  const type = meta ? meta[2].trim() : '-';
  const risk = meta ? meta[3].trim() : '-';
  const rule = meta ? meta[4].trim() : '-';
  const brs = [...new Set([...rule.matchAll(/BR-(\d+)/g)].map((x) => 'BR-' + x[1]))].join(',');
  const gwt = (b.match(/^\s*[-*]?\s*\*{0,2}(Given|When|Then)\*{0,2}\s/gm) || []).length;
  const outputs = (b.match(/输出含/g) || []).length;
  const appendixA = /附录\s*A|A-1|A-2|A-3|A-4/.test(b);
  const machine = /(机检|grep |wc -l|node |vitest|assert|调用接缝|call-seam|MAESTRO_TEST_|MAESTRO_FAULT)/.test(b);
  const exit = /退出码|exit\s*code|exit\(\d|code\s*=\s*\d/.test(b);
  // 断言字面量：Then / 输出含 / 含 行里的反引号片段
  const lits = [];
  body.forEach((ln) => {
    if (/\bThen\b|输出含|含「|含"|逐字/.test(ln)) {
      [...ln.matchAll(/`([^`]+)`/g)].forEach((x) => lits.push(x[1]));
    }
  });
  return { ...h, face, type, risk, brs, gwt, outputs, appendixA, machine, exit, lits };
});

console.log(`AC 总数 = ${rows.length}`);
console.log('');
console.log('AC     | 行号 | 验证面          | 类型   | 风险 | 规则BR           | GWT | 输出含 | 附录A | 机检 | 退出码 | 标题');
rows.forEach((r) => {
  console.log(`${r.id.padEnd(6)} | ${String(r.line).padStart(4)} | ${r.face.padEnd(15)} | ${r.type.padEnd(6)} | ${r.risk.padEnd(4)} | ${r.brs.padEnd(16)} | ${String(r.gwt).padStart(3)} | ${String(r.outputs).padStart(6)} | ${(r.appendixA ? 'Y' : '-').padEnd(5)} | ${(r.machine ? 'Y' : '-').padEnd(4)} | ${(r.exit ? 'Y' : '-').padEnd(6)} | ${r.title}`);
});

console.log('');
console.log('=== 逐 AC 断言字面量（Then / 输出含 行的反引号片段，供附录 A 逐字比对）===');
rows.forEach((r) => {
  const uniq = [...new Set(r.lits)];
  if (uniq.length) console.log(`${r.id}: ${uniq.slice(0, 10).join(' | ')}`);
});
