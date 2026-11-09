// AC-43 新增中文只在 labels.js（架构检查）
import path from 'node:path';
import {
  makeCase, freshRoot, runCmd, NODE, REPO, listFiles, text, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-43';

// 需求原文：按 [\u4e00-\u9fff] 扫描 src/registry 与 src/cli/roles.js，命中即 exit 1。
const SCAN = `
const fs = require('fs');
const path = require('path');
const roots = ['src/registry', 'src/cli/roles.js'];
const hits = [];
function walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(p).sort()) walk(path.join(p, name));
    return;
  }
  const src = fs.readFileSync(p, 'utf8');
  src.split(/\\r?\\n/).forEach((line, i) => {
    if (/[\\u4e00-\\u9fff]/.test(line)) hits.push(p.replace(/\\\\/g, '/') + ':' + (i + 1) + ': ' + line.trim());
  });
}
for (const r of roots) walk(r);
if (hits.length > 0) { console.log(hits.join('\\n')); process.exit(1); }
console.log('OK: 零 CJK 命中（' + roots.join(', ') + '）');
`;

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '架构检查',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '架构检查' });
    const root = freshRoot(AC);
    c.add(root); // 独立根占位；本条只读源码

    const res = c.cmd(runCmd([NODE, '-e', SCAN], { cwd: REPO }), 'node -e <扫 [\\u4e00-\\u9fff] src/registry + src/cli/roles.js>');
    c.evText('cjk-scan', text(res));
    c.eq('架构检查：退出码 0（零命中）', res.exitCode, 0);
    c.matches('架构检查：输出 OK 行', text(res), /OK: 零 CJK 命中/);

    // 反向核对：这两处确实是「新增代码」而非空目录（防止扫 0 个文件造成的假绿）
    const files = [
      ...listFiles(path.join(REPO, 'src', 'registry')).map((f) => `src/registry/${f}`),
      'src/cli/roles.js'
    ];
    c.evJson('scanned-files', files);
    c.check('架构检查：扫描目标非空（src/registry/** + src/cli/roles.js 合计 ≥ 5 个文件）',
      files.length >= 5, `${files.length} 个文件`);
    c.check('架构检查：labels.js 不在扫描范围内（中文唯一来源）',
      files.every((f) => !f.endsWith('labels.js')), files.join(', '));

    return finish(c);
  }
}];
