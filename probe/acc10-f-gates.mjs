/**
 * I1.10a S3 · 全量回归门禁与静态门禁取证（可复跑）。
 *
 *   ACC10_FULL_LOG=/tmp/i10a-s3-full.log node probe/acc10-f-gates.mjs
 *
 * 产物：docs/iterations/iteration-10a/evidence/gates/{full-suite.log,gates.json,gate-*.log}
 *
 * 判据：需求 §3.2 NF-6 / §3.3 回归基线、拆分文档 §4 门禁四件套、裁决 T（B-39 判定基线 9 条）、
 * 裁决 Y（S2 终值 1370 / 1365 / 4 / 1，差集 = 0）。
 * 差集口径：历史 baseline-failures.txt 物理 8 条 + R-08 允许的 AC-04 一项 = 9 条；
 * 不改历史基线文件、不伪造全绿。
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, EVID, BASELINE, BUNDLE_APP, WORDS_31, runCmd, parseTap,
  writeText, writeJson, ensureDir, iso,
} from './acc10-f-lib.mjs';

const G = ensureDir(path.join(EVID, 'gates'));
const FULL_LOG = process.env.ACC10_FULL_LOG || '/tmp/i10a-s3-full.log';

const gates = [];
function add(name, cmd, r, expect, note, extra = {}) {
  const out = (r.stdout + (r.stderr ? `\n--- STDERR ---\n${r.stderr}` : '')).trimEnd();
  const i = gates.length + 1;
  writeText(path.join(G, `gate-${String(i).padStart(2, '0')}.log`), out + '\n');
  const ok = typeof expect === 'function' ? expect(r, out) : r.exit === expect;
  gates.push({ index: i, name, cmd, note, exit: r.exit, expect: typeof expect === 'function' ? '函数判据' : expect, ok, output: out, ...extra });
  return gates[gates.length - 1];
}

function main() {
  const head = runCmd('git rev-parse --short HEAD', { timeoutMs: 15_000 }).stdout.trim();
  const raw = fs.existsSync(FULL_LOG) ? fs.readFileSync(FULL_LOG, 'utf8') : '';
  if (!raw) throw new Error(`全量日志不存在：${FULL_LOG}（先跑 env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"）`);
  fs.copyFileSync(FULL_LOG, path.join(G, 'full-suite.log'));
  const tap = parseTap(raw);
  const baselineLines = fs.readFileSync(BASELINE, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const allow = [...baselineLines, 'AC-04：空态、不可读行不阻断、新实例 2 秒内由推送触发出现；F-18 脉冲后 2 秒内更新'];
  // 基线文件可能是「用例名片段」或「编号」形态，按包含关系匹配；AC-04 由裁决 R-08 显式允许。
  const diff = tap.notOk.filter((name) => !allow.some((b) => name.includes(b) || b.includes(name)) && !name.startsWith('AC-04'));
  const suiteGate = {
    command: 'env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 "test/**/*.test.js"',
    log: FULL_LOG, capturedAt: iso(), head, ...tap,
    baselinePath: path.relative(REPO, BASELINE), baselineCount: baselineLines.length,
    decisionBaselineCount: baselineLines.length + 1,
    decisionBaselineNote: '历史 8 条 + 裁决 R（R-08）允许的 AC-04 一项 = 判定基线 9 条；历史文件不改',
    failSet: tap.notOk, diff, diffCount: diff.length,
    testsFloor: 1157, testsFloorOk: tap.tests >= 1157,
    ok: diff.length === 0 && tap.tests >= 1157,
  };

  add('全量测试（失败集合差集）', suiteGate.command,
    { exit: tap.fail > 0 ? 1 : 0, stdout: `# tests ${tap.tests}\n# pass ${tap.pass}\n# fail ${tap.fail}`, stderr: '' },
    (r, out) => diff.length === 0 && tap.tests >= 1157,
    `失败集合与判定基线 9 条差集 = ${diff.length}；条数 ${tap.tests} ≥ 1157`, { tap, diff });

  add('31 词 purity：src/core + src/daemon',
    `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "${WORDS_31}"`,
    runCmd(`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "${WORDS_31}"`, { timeoutMs: 60_000 }),
    0, '两轮之一：核心与守护进程零命中');
  add('31 词 purity：desktop/ui',
    `node test/fixtures/purity-check.mjs --dirs desktop/ui --forbid "${WORDS_31}"`,
    runCmd(`node test/fixtures/purity-check.mjs --dirs desktop/ui --forbid "${WORDS_31}"`, { timeoutMs: 60_000 }),
    0, '两轮之二：界面层零命中');
  add('零运行时依赖', `node -p "Object.keys(require('./package.json').dependencies||{}).length"`,
    runCmd(`node -p "Object.keys(require('./package.json').dependencies||{}).length"`, { timeoutMs: 15_000 }),
    (r, out) => out.trim() === '0', '输出 0');
  add('界面层 / harness 中文零命中', `grep -REn "[一-龥]" desktop/ui/ desktop/harness/`,
    runCmd(`grep -REn "[一-龥]" desktop/ui/ desktop/harness/`, { timeoutMs: 30_000 }), 1, '零命中 exit 1（ERE 中文字符类）');
  add('AC 条数 37', `grep -cE '^\\*\\*AC-' docs/iterations/iteration-10a/requirement.md`,
    runCmd(`grep -cE '^\\*\\*AC-' docs/iterations/iteration-10a/requirement.md`, { timeoutMs: 15_000 }),
    (r, out) => out.trim() === '37', '恰好 37');
  add('USAGE_LINES 25 行', `node -p "require('./src/cli/labels.js').USAGE_LINES.length"`,
    runCmd(`node -p "require('./src/cli/labels.js').USAGE_LINES.length"`, { timeoutMs: 15_000 }),
    (r, out) => out.trim() === '25', '25 行');
  add('核心 / 守护进程无宿主分支', `grep -REn "if host ==|switch \\(host\\)" src/core src/daemon`,
    runCmd(`grep -REn "if host ==|switch \\(host\\)" src/core src/daemon`, { timeoutMs: 30_000 }), 1, '零命中 exit 1');
  add('桌面产物时效（UI 资源）', `test -f "${BUNDLE_APP}/Contents/Resources/desktop/ui/index.html"`,
    runCmd(`test -f "${BUNDLE_APP}/Contents/Resources/desktop/ui/index.html"`, { timeoutMs: 15_000 }), 0, '产物含 UI 资源');
  add('桌面产物时效（裁决 R 静态面标记）', `grep -REc "the static face is public" "${BUNDLE_APP}/Contents/Resources/src/daemon/http/server.js"`,
    runCmd(`grep -REc "the static face is public" "${BUNDLE_APP}/Contents/Resources/src/daemon/http/server.js"`, { timeoutMs: 15_000 }),
    (r, out) => out.trim() === '1', '包内 server.js 含裁决 R 标记（B-40）');
  add('提交卫生', `git show --check --oneline HEAD`,
    runCmd('git show --check --oneline HEAD', { timeoutMs: 30_000 }), 0, 'HEAD 无空白错误');

  const result = {
    capturedAt: iso(), head, fullSuite: suiteGate,
    gates: gates.map(({ output, ...rest }) => rest),
    gatesPass: gates.filter((g) => g.ok).length, gatesTotal: gates.length,
    ok: suiteGate.ok && gates.every((g) => g.ok),
    bundle: {
      app: path.relative(REPO, BUNDLE_APP),
      resourcesUi: fs.existsSync(path.join(BUNDLE_APP, 'Contents/Resources/desktop/ui/index.html')),
      rebuildCommand: 'env -u NODE_OPTIONS npm run desktop:build',
      note: 'R-13：壳面用例 skip 判据 = 产物缺失 / 缺 UI 资源 / 缺裁决 R 标记；skip 必须写明需重建产物',
    },
  };
  writeJson(path.join(G, 'gates.json'), result);
  console.log(`full suite: ${tap.tests} tests / ${tap.pass} pass / ${tap.fail} fail / ${tap.skipped} skipped；差集 ${diff.length}；条数下限 ${tap.tests >= 1157}`);
  console.log(`static gates: ${result.gatesPass}/${result.gatesTotal} 通过`);
  console.log(`gates.json -> ${path.join(G, 'gates.json')}`);
  if (!result.ok) process.exitCode = 1;
}

main();
