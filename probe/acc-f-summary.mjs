// 从 evidence/<ID>.meta.json 重建批次汇总（不重跑任何用例）。
import fs from 'node:fs';
import path from 'node:path';

import { EVID, REPO } from './acc-f-lib.mjs';

const ORDER = [
  'AC-15', 'AC-16', 'AC-17', 'AC-18', 'AC-19', 'AC-20', 'AC-21', 'AC-22',
  'AC-23', 'AC-24', 'AC-25', 'AC-25.supplement', 'AC-26',
  'NFR-03', 'NFR-04', 'NFR-06',
];

const summary = [];
for (const id of ORDER) {
  const file = path.join(EVID, `${id}.meta.json`);
  if (!fs.existsSync(file)) continue;
  const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
  summary.push({
    id,
    verdict: meta.judgment?.verdict ?? '未知',
    failed: meta.judgment?.failed ?? [],
    files: ['meta.json', 'output.json', 'state.json', 'events.jsonl'].map(
      (s) => `docs/iterations/iteration-1/evidence/${id}.${s}`,
    ),
  });
}
fs.writeFileSync(path.join(EVID, '_fixture-run-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(summary.map((s) => `${s.id}: ${s.verdict}`).join('\n'));
console.log(`\n${summary.length} 项；根目录 ${REPO}`);
