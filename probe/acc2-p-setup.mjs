/**
 * I1.2 真实面验收（独立验收员 P）—— 场景目录生成脚本。
 *
 * 只写 %TEMP%/maestro-acc-p2 下各 proj 根的任务目录，绝不碰仓库里的 src/test/bin
 * 与 %TEMP%/maestro-acc-f2。所有产物可重复生成（幂等：只覆盖样例文件，不清 .orch）。
 *
 * 用法：node probe/acc2-p-setup.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = path.join(process.env.TEMP, 'maestro-acc-p2');

const CALC_JS = `// calc.js —— 被测实现。初始状态：只有 add / sub，缺 div。
function add(a, b) {
  return a + b;
}

function sub(a, b) {
  return a - b;
}

module.exports = { add, sub };
`;

const CALC_TEST_BASIC = `const test = require('node:test');
const assert = require('node:assert');
const { add, sub, div } = require('./calc.js');

test('add 返回两数之和', () => {
  assert.strictEqual(add(2, 3), 5);
});

test('sub 返回两数之差', () => {
  assert.strictEqual(sub(5, 2), 3);
});

test('div 返回两数之商（基础断言）', () => {
  assert.strictEqual(div(6, 3), 2);
});
`;

const CALC_TEST_FAIL = `const test = require('node:test');
const assert = require('node:assert');
const { add, sub, div } = require('./calc.js');

test('add 返回两数之和', () => {
  assert.strictEqual(add(2, 3), 5);
});

test('sub 返回两数之差', () => {
  assert.strictEqual(sub(5, 2), 3);
});

test('div 返回两数之商（基础断言）', () => {
  assert.strictEqual(div(6, 3), 2);
});

test('div(1, 0) 必须抛错（除零边界）', () => {
  assert.throws(() => div(1, 0));
});
`;

const PKG = (name) =>
  JSON.stringify(
    {
      name,
      version: '0.0.0',
      private: true,
      scripts: { test: 'node --test' }
    },
    null,
    2,
  ) + '\n';

async function writeFile(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}

async function makeCodeDir(dir, { withZeroAssert }) {
  await writeFile(path.join(dir, 'calc.js'), CALC_JS);
  await writeFile(path.join(dir, 'calc.test.js'), withZeroAssert ? CALC_TEST_FAIL : CALC_TEST_BASIC);
  await writeFile(path.join(dir, 'package.json'), PKG(path.basename(dir)));
  await fs.mkdir(path.join(dir, 'out'), { recursive: true });
}

const projects = {
  'proj-smoke': ['demo-code-pass'],
  'proj-ac01': ['demo-code-pass'],
  'proj-ac03': ['demo-code-pass'],
  'proj-ac45': ['demo-code-fail'],
  'proj-ac21': ['demo'],
  'proj-ac22': ['demo']
};

const summary = [];
for (const [project, dirs] of Object.entries(projects)) {
  const root = path.join(BASE, project);
  await fs.mkdir(root, { recursive: true });
  for (const dir of dirs) {
    const abs = path.join(root, dir);
    if (dir === 'demo-code-pass') await makeCodeDir(abs, { withZeroAssert: false });
    else if (dir === 'demo-code-fail') await makeCodeDir(abs, { withZeroAssert: true });
    else await fs.mkdir(path.join(abs, 'out'), { recursive: true });
    summary.push({ project, dir, abs });
  }
}

console.log(JSON.stringify({ base: BASE, summary }, null, 2));
