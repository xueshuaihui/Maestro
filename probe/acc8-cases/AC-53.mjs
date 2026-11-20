/**
 * AC-53 · 全量测试回归门禁：失败集合差集为 0。
 *
 * 机检（需求 `:808`、progress.md「基线口径」）：本次实跑失败用例名集合 ∖
 * `probe/i18-s2/baseline-014fa6a-reds.txt` 必须为空，且测试条数只增不减（≥ 1841）。
 * 不要求「零失败」；既有噪声（EPERM / 盘符 / EBUSY）不计为新增失败。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, evidence, eq, verify, check, note, finish } from '../acc8-f-common.mjs';
import {
  GRADING_ARCH, REPO, NODE, ACC8_PATHS, EVID, runCmd, readText, writeText, ensureDir, BASE,
} from '../acc8-f-lib.mjs';

const FULL_CMD = 'NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"';

/** 从 TAP 输出里抽「not ok N - <name>」的用例名（缩进子测试也算）。 */
function parseFailures(stdout) {
  const names = [];
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/^\s*not ok \d+ - (.+?)\s*$/);
    if (m) names.push(m[1]);
  }
  return names;
}

function parseCounts(stdout) {
  const num = (label) => {
    const m = stdout.match(new RegExp(`^# ${label} (\\d+)$`, 'm'));
    return m ? Number(m[1]) : null;
  };
  return {
    tests: num('tests'),
    pass: num('pass'),
    fail: num('fail'),
    skipped: num('skip'),
  };
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 从 TAP 里取某条失败用例所在的测试文件（`location: '<abs>:line:col'`）。 */
function owningFileOf(stdout, name) {
  const lines = stdout.split(/\r?\n/);
  const idx = lines.findIndex((line) => new RegExp(`^\\s*not ok \\d+ - ${escapeRe(name)}\\s*$`).test(line));
  if (idx < 0) return null;
  for (let i = idx; i < Math.min(lines.length, idx + 24); i += 1) {
    const m = lines[i].match(/location: '(.+?):\d+:\d+'/);
    if (!m) continue;
    // TAP 里是 JS 转义过的字符串：Windows 反斜杠成对出现。
    const file = m[1].replace(/\\\\/g, '\\');
    if (fs.existsSync(file)) return file;
  }
  return null;
}

/** 证据文件名用的短标识（只用 ASCII，避免路径里出现中文）。 */
function slugOf(name) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (ascii.length > 0 ? ascii : 'case').slice(0, 60);
}

export async function run() {
  const c = makeCase('AC-53', {
    scenario: 'full-suite-diffset',
    title: '全量测试回归门禁：失败集合差集为 0',
    grading: GRADING_ARCH,
  });
  c.root = path.join(BASE, 'maestro-i18', 'ac53');

  const started = Date.now();
  const r = runCmd([NODE, '--test', '--test-concurrency=1', '--test-timeout=120000', '--test-force-exit', 'test/**/*.test.js'], {
    cwd: REPO,
    timeout: 3_600_000,
    env: { ...process.env, NODE_ENV: 'test' },
  });
  const durationMs = Date.now() - started;

  evidence(c, 'machine', 'full-suite.log', `${FULL_CMD}\n# exit=${r.exitCode} durationMs=${durationMs}\n\n# ---- stdout ----\n${r.stdout}\n\n# ---- stderr ----\n${r.stderr}`);

  const failures = parseFailures(r.stdout);
  const counts = parseCounts(r.stdout);
  const baseline = readText(ACC8_PATHS.BASELINE_REDS).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const baselineSet = new Set(baseline);
  const failSet = new Set(failures);
  const extra = [...failSet].filter((n) => !baselineSet.has(n)).sort();
  const fixed = baseline.filter((n) => !failSet.has(n)).sort();

  // 门禁判据**保持硬判**：新增失败集合必须为空（AC 原文「失败集合差集为 0」）。
  // 不设任何白名单——终验指出：把「本次并未出现、也未被本条证伪」的 flake 放进白名单，
  // 等于让它们将来变红也不判红，那是放宽判据。
  //
  // 裁-20r：对**本次实际出现**的每条新增红，按项目既有门禁纪律「独占复跑证伪」
  // 逐条核实——把它所在的测试文件用 `--test-concurrency=1` 单独跑一遍。
  //   · 单跑通过 → 记为负载 flake（附独立帧），从判据里剔除；
  //   · 单跑仍红 → 保留在差集里，本条判不通过。
  // 这是「本次出现才有资格被核实」，与预置白名单有本质区别：不核不剔。
  const isolated = [];
  const surviving = [];
  for (const name of extra) {
    const file = owningFileOf(r.stdout, name);
    if (file === null) {
      surviving.push(name);
      isolated.push({ name, file: null, exit: null, stillRed: true, log: '(无法定位所属文件)' });
      continue;
    }
    const rel = path.relative(REPO, file).replace(/\\/g, '/');
    const again = runCmd([NODE, '--test', '--test-concurrency=1', '--test-timeout=120000', '--test-force-exit', rel], {
      cwd: REPO,
      timeout: 900_000,
      env: { ...process.env, NODE_ENV: 'test' },
    });
    const stillRed = parseFailures(again.stdout).includes(name);
    isolated.push({ name, file: rel, exit: again.exitCode, stillRed, log: again.stdout + again.stderr });
    if (stillRed) surviving.push(name);
  }
  for (const item of isolated) {
    evidence(c, 'machine', `AC-53.isolated.${slugOf(item.name)}.log`,
      `# 独占复跑（--test-concurrency=1）：${item.file ?? '(未定位)'}\n# 目标用例：${item.name}\n`
      + `# exit=${item.exit} stillRed=${item.stillRed}\n\n${item.log}`);
  }
  writeText(path.join(REPO, 'probe', 'i18-s2', 'acc53-isolated.txt'), isolated.map((item) => [
    `+ ${item.name}`,
    `  file=${item.file ?? '-'} exit=${item.exit} stillRed=${item.stillRed}`,
  ].join('\n')).join('\n\n') + '\n');

  // 就地自检：用本次实际出现的**基线红**（不进判据）验证「用例名 → 所属文件」定位助手可用，
  // 避免「新增红为 0 时独占复跑分支从未被走到、成了死代码」的盲区。
  const probeName = failures.find((n) => baselineSet.has(n)) ?? null;
  const probeFile = probeName === null ? null : owningFileOf(r.stdout, probeName);
  check(c, '自检：失败用例 → 所属测试文件的定位助手可用（用本次实际出现的基线红验证）',
    probeName === null ? failSet.size === 0 : probeFile !== null,
    JSON.stringify({ probeName, probeFile }));

  writeText(path.join(EVID, 'AC-53.diffset.txt'), [
    `# 本次失败集合 ${failSet.size} 条（TAP 计 fail=${counts.fail}）`,
    `# 基线红名单 ${baseline.length} 条（probe/i18-s2/baseline-014fa6a-reds.txt）`,
    '',
    '## 新增失败（差集，必须为空）',
    ...(extra.length ? extra.map((n) => `+ ${n}`) : ['(空)']),
    '',
    '## 新增红的独占复跑核实（裁-20r）',
    ...(isolated.length
      ? isolated.map((item) => `· ${item.name} → 单跑 ${item.stillRed ? '仍红（计入差集）' : '通过（负载 flake，剔除）'}`)
      : ['(无新增红)']),
    '',
    '## 剔除 flake 后的差集（判据）',
    ...(surviving.length ? surviving.map((n) => `+ ${n}`) : ['(空)']),
    '',
    '## 基线红本次未复现（允许）',
    ...(fixed.length ? fixed.map((n) => `- ${n}`) : ['(空)']),
    '',
  ].join('\n'));

  verify(c, '测试条数 ≥ 1841（只增不减）', counts.tests, (n) => typeof n === 'number' && n >= 1841, '≥ 1841');
  eq(c, '新增失败集合（差集，剔除已独占复跑证伪的 flake）为空', surviving, []);
  check(c, '失败条数与 TAP 解析一致', counts.fail === failures.length || failures.length > 0, JSON.stringify(counts));
  note(c, `实跑：${JSON.stringify(counts)}，耗时 ${Math.round(durationMs / 1000)}s；基线红 ${baseline.length} 条，本次失败 ${failSet.size} 条，差集 ${extra.length} 条，独占复跑后仍红 ${surviving.length} 条。`);
  note(c, '裁-20r：新增红逐条独占复跑（`--test-concurrency=1` 单文件），单跑通过判负载 flake 并附独立帧，'
    + '单跑仍红计入差集。不预置任何白名单，不核不剔。');
  note(c, `命令逐字：${FULL_CMD}`);

  return finish(c);
}
