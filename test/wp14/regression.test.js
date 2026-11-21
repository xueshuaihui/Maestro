/**
 * I1.11 WP-11 · 回归红线（整合验收，D-44 / D-21；零产品改动）。
 *
 * 本文件只做跨域回归护栏，不改实现、不改 scripts/desktop/gate.mjs：
 * - 全量条数下限（只增不减）+ 失败集合与判定基线差集 0（禁 fail===0）；
 * - 31 词 purity 双扫 + desktop/ui|harness CJK 代码行零命中（剥注释）；
 * - dependencies=0、USAGE_LINES 25、CLI 命令表/两层子命令表未变；
 * - 既有 8 条 HTTP 路径未变、shapeSnapshot 逐字未变、pendingEscalations
 *   计数点口径未变、tray-quit-confirm 通道未被误移入 CTL 分发器；
 * - 三主链 single/code-loop/task-loop A-0 归一化逐字回归。
 *
 * 全量测试不在本文件内跑（会自递归）：条数/差集的权威判定来自门禁命令
 * `env -u NODE_OPTIONS NODE_ENV=test node --test --test-concurrency=1 <test 目录全部 *.test.js>`；
 * 本文件用「结构下限 + 可选 gate 摘要只读断言」表达同一口径（I1.10a B-38 先例）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { USAGE_LINES } from '../../src/cli/labels.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BIN = path.join(REPO, 'bin', 'orch.js');
const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');
const PURITY = path.join(REPO, 'test', 'fixtures', 'purity-check.mjs');

const envFor = () => ({ ...process.env, NODE_ENV: 'test' });
// 读源码文本时统一 EOL：仓库按 LF 存储，但 Windows 检出（core.autocrlf=true）会变成 CRLF。
// 若不规范化，逐字锚点比较与「行内注释剥离」正则会因 `\r` 而误判（跨平台假红）。
// 规范化只影响比较口径，不改任何断言语义：锚点内容与剥离规则均逐字保持。
const readText = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');

// 31 词（与 requirement AC-40 / 门禁命令逐字一致）
const WORDS_31 = [
  'task-loop', 'researcher', 'writer', 'reviewer', '研究员', '撰写者', '审核者',
  'code-loop', 'developer', 'tester', 'coordinator', 'arbiter', 'planner',
  'summarizer', 'worker', 'data-analyst', 'fact-checker', 'editor', 'code-reviewer',
  'compliance-reviewer', 'requirement-clarifier', 'research-brief', 'fact-check',
  'data-analysis', 'doc-draft', 'doc-review', 'code-change', 'test-run', 'code-review',
  'coordination', 'compliance-check',
];

// ---------------------------------------------------------------------------
// 全量条数 / 失败集合差集（D-21 / D-44）
// ---------------------------------------------------------------------------

/** 当前结构下限（锚定本迭代收口时的实测值，只增不减；不是运行时 1567）。 */
const STRUCTURAL_FLOOR = 1535;
/** 门禁实测运行时下限（I1.11 收口 = 1567，只增不减、不写死）。 */
const RUNTIME_FLOOR = 1567;
/** 判定基线 = 历史 8 条（物理清单）+ 裁决 R-08 的 AC-04 = 9 条。 */
const R08_ALLOWED = ['AC-04'];

function countTestDeclarations() {
  let count = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.test.js')) {
        for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
          if (/^\s*test\(/.test(line)) count += 1;
        }
      }
    }
  };
  walk(path.join(REPO, 'test'));
  return count;
}

test('全量用例结构下限不低于 I1.11 收口（只增不减，不写死条数）', () => {
  const count = countTestDeclarations();
  assert.ok(
    count >= STRUCTURAL_FLOOR,
    `测试声明数 ${count} 低于结构下限 ${STRUCTURAL_FLOOR}（疑似大量用例被删）`,
  );
});

test('判定基线清单存在且为 8 物理条 + R-08 的 AC-04 = 9 条（差集口径）', () => {
  const manifest = path.join(REPO, 'docs', 'iterations', 'iteration-7', 'baseline-failures.txt');
  assert.equal(fs.existsSync(manifest), true, `判定基线清单缺失：${manifest}`);
  const lines = fs.readFileSync(manifest, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  assert.equal(lines.length, 8, `物理基线必须恰 8 条（实际 ${lines.length}）`);
  assert.equal(new Set(lines).size, lines.length, '基线清单不得有重复项');
  assert.equal(lines.length + R08_ALLOWED.length, 9, '判定口径必须恰 9 条（物理 8 + R-08 一项）');
  assert.ok(lines.some((l) => l.startsWith('NFR-02:')));
  assert.ok(lines.some((l) => l.startsWith('core.stop')));
  assert.ok(lines.some((l) => l.startsWith('main：--cwd')));
  assert.ok(lines.some((l) => l.includes('task-loop 审核提示词')));

  // 当前全量允许的 4 条失败逐条落在判定基线内（差集 0 的可枚举表达）。
  const allowedNow = [
    'core.stop：先回包再断连',
    'main：--cwd 相对当前 shell 目录解析',
    'task-loop 审核提示词给绝对路径',
    'AC-04：空态、不可读行不阻断',
  ];
  for (const name of allowedNow) {
    const inPhysical = lines.some((l) => l.includes(name));
    const inR08 = R08_ALLOWED.some((code) => name.startsWith(code));
    assert.ok(inPhysical || inR08, `允许失败项未落在判定基线内：${name}`);
  }
});

test('全量门禁摘要（可选）：tests >= 1567 且失败集合差集 0（禁 fail===0）', (t) => {
  const candidates = [
    process.env.MAESTRO_FULL_RUN_SUMMARY,
    path.join(os.tmpdir(), 'maestro-i11-full-suite-summary.json'),
    path.join(REPO, 'docs', 'iterations', 'iteration-11', 'evidence', 'full-suite-summary.json'),
  ].filter(Boolean);
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) {
    t.skip(
      '未找到全量 gate 摘要；请在门禁命令后生成摘要（见回执 §6），' +
        '权威差集判定由门禁命令本身承担，本测试不自递归跑全量。',
    );
    return;
  }
  const summary = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(summary.tests >= RUNTIME_FLOOR, `全量条数 ${summary.tests} < ${RUNTIME_FLOOR}`);
  // D-21：只断言差集为 0，绝不写 fail===0（本基线本身有 4 条已裁决失败 + 1 skip）。
  assert.equal(summary.diffFromBaseline, 0, `失败集合与判定基线差集 ${summary.diffFromBaseline} != 0`);
  const failed = Array.isArray(summary.failed) ? summary.failed : [];
  const manifest = fs.readFileSync(path.join(REPO, 'docs', 'iterations', 'iteration-7', 'baseline-failures.txt'), 'utf8');
  for (const name of failed) {
    const covered = manifest.includes(name) || R08_ALLOWED.some((code) => name.startsWith(code));
    assert.ok(covered, `新增失败不在判定基线内：${name}`);
  }
});

// ---------------------------------------------------------------------------
// 31 词纯度双扫 + CJK 代码行零命中
// ---------------------------------------------------------------------------

test('31 词纯净扫描双扫：src/core,src/daemon 与 desktop/ui 均 exit 0', () => {
  assert.equal(WORDS_31.length, 31, '禁词表必须恰 31 个');
  for (const dirs of ['src/core,src/daemon', 'desktop/ui']) {
    const res = spawnSync(process.execPath, [PURITY, '--dirs', dirs, '--forbid', WORDS_31.join(',')], {
      cwd: REPO, env: envFor(), encoding: 'utf8', timeout: 60_000,
    });
    assert.equal(res.status, 0, `${dirs} 纯净扫描未 exit 0：\n${res.stdout}\n${res.stderr}`);
  }
});

/** 剥行注释与块注释后再判 CJK（字符串内的中文属违规，注释不属）。 */
function stripComments(text) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += n ?? ''; i += 2; continue; }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '/' && n === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 2;
      out += '\n';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    out += c;
    i += 1;
  }
  return out;
}

test('desktop/ui + desktop/harness CJK 代码行零命中（剥注释）', () => {
  const cjk = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
  const ext = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.json', '.jsonl', '.svg', '.txt']);
  const hits = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', 'target'].includes(entry.name) || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (ext.has(path.extname(entry.name).toLowerCase())) {
        stripComments(fs.readFileSync(full, 'utf8')).split('\n').forEach((line, idx) => {
          if (cjk.test(line)) hits.push(`${path.relative(REPO, full)}:${idx + 1}: ${line.trim()}`);
        });
      }
    }
  };
  for (const dir of ['desktop/ui', 'desktop/harness']) walk(path.join(REPO, dir));
  assert.deepEqual(hits, [], `桌面层出现 CJK 代码行（必须经 /ui/labels）：\n${hits.join('\n')}`);
});

// ---------------------------------------------------------------------------
// 零依赖 / USAGE / CLI 命令表
// ---------------------------------------------------------------------------

test('dependencies=0 且 USAGE_LINES 仍 25 行（D-12 / D-14）', () => {
  const pkg = JSON.parse(readText('package.json'));
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, 'dependencies 必须为 0');
  assert.equal(USAGE_LINES.length, 25, 'USAGE_LINES 必须恰 25 行');
  assert.equal(
    USAGE_LINES[24],
    '  orch workflow dry-run <工作流> [--task <说明>] [--format text|json]',
    'USAGE_LINES 末行漂移',
  );
});

function setLiteral(src, name) {
  const m = src.match(new RegExp(`const ${name} = new Set\\(\\[([^\\]]*)\\]\\)`));
  assert.ok(m, `未找到命令表常量 ${name}`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

function frozenSubs(src) {
  const m = src.match(/const RUNTIME_SUBS = Object\.freeze\(\{([\s\S]*?)\}\);/);
  assert.ok(m, '未找到两层子命令表 RUNTIME_SUBS');
  const out = {};
  for (const pair of m[1].matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
    out[pair[1]] = [...pair[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }
  return out;
}

test('CLI 命令表与两层子命令表未变（D-14 冻结，锚点取 src/cli/main.js）', () => {
  const src = readText('src/cli/main.js');
  assert.deepEqual(setLiteral(src, 'COMMANDS'), ['run', 'status', 'cancel', 'core', 'role', 'skill', 'workflow']);
  // D-14 冻结：既有 11 条成员与顺序逐字不可变。I1.12 按裁决 A/D-13 只允许在末尾
  // 追加 `verify/migrate/export` 三条（命令名已由裁决 A 冻结），故尾部单列断言而非放宽为子集。
  const runtimeCommands = setLiteral(src, 'RUNTIME_COMMANDS');
  assert.deepEqual(runtimeCommands.slice(0, 11), [
    'run', 'status', 'cancel', 'core', 'instance', 'attach', 'escalate', 'approve',
    'handoff', 'workflow', 'trace',
  ]);
  assert.deepEqual(runtimeCommands.slice(11), ['migrate', 'verify', 'export']);
  // 既有六组子命令逐字不变；`verify` 是 I1.12 新增组（D-13：一个 handler 四目标，
  // 仅 import/review 两目标需要子命令 token），单列精确断言。
  const { verify, ...legacySubs } = frozenSubs(src);
  assert.deepEqual(legacySubs, {
    core: ['stop'],
    instance: ['status', 'log', 'graph'],
    escalate: ['list', 'resolve'],
    handoff: ['list', 'show'],
    workflow: ['pause', 'resume', 'abort'],
    trace: ['show'],
  });
  assert.deepEqual(verify, ['import', 'review']);
});

// ---------------------------------------------------------------------------
// 既有 8 条 HTTP 路径 / shapeSnapshot / 计数点 / 托盘通道
// ---------------------------------------------------------------------------

test('既有 8 条 HTTP 路径与 2 个测试接缝锚点仍在（逐字、D-11/拆分 §2.8）', () => {
  const server = readText('src/daemon/http/server.js');
  const routes = readText('src/daemon/http/routes.js');
  // routes.js 三条：GET/POST /instances、GET /workflows
  for (const anchor of [
    "method: 'GET',\n      pattern: '/instances'",
    "method: 'POST',\n      pattern: '/instances'",
    "method: 'GET',\n      pattern: '/workflows'",
  ]) {
    assert.ok(routes.includes(anchor), `routes.js 缺既有路由锚点：${anchor}`);
  }
  // server.js 五条业务/静态路径 + 两个测试接缝
  for (const anchor of [
    "pathname === '/ui/labels'",
    "pathname === '/instances/stream'",
    "matchPattern('/instances/:id/graph/stream'",
    "matchPattern('/instances/:id/graph'",
    "pathname.startsWith('/ui/')",
    "pathname === '/__test__/graph/pulse'",
    "pathname === '/__test__/window-probe'",
  ]) {
    assert.ok(server.includes(anchor), `server.js 缺既有路径锚点：${anchor}`);
  }
});

/** 与 66e5a6b:src/daemon/server.js:900–912 逐字一致（行号因上方新增代码漂移到 1018）。 */
const FROZEN_SHAPE_SNAPSHOT = `function shapeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot ?? null;
  const escalations = Array.isArray(snapshot.escalations) ? snapshot.escalations : [];
  const pendingEscalations = Number.isInteger(snapshot.pendingEscalations)
    ? snapshot.pendingEscalations
    : escalations.filter((entry) => entry?.state === 'pending').length;
  return {
    ...snapshot,
    // 未知 / 缺省模板按 \`single\`：\`single\` 实例行不打印模板，旧格式因此不会多出一段。
    template: typeof snapshot.template === 'string' && snapshot.template.length > 0 ? snapshot.template : 'single',
    pendingEscalations,
  };
}`;

test('shapeSnapshot 函数体逐字未改（D-36：禁止为凑「一处」改它）', () => {
  const src = readText('src/daemon/server.js');
  const m = src.match(/function shapeSnapshot\(snapshot\) \{[\s\S]*?\n\}/);
  assert.ok(m, '未找到 shapeSnapshot 函数体');
  assert.equal(m[0], FROZEN_SHAPE_SNAPSHOT, 'shapeSnapshot 与 I1.10a 基线不一致');
});

function jsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsFiles(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

test('escalations.filter|reduce 在 src/daemon 恰 1 条基线（shapeSnapshot 回退）', () => {
  const hits = [];
  for (const file of jsFiles(path.join(REPO, 'src', 'daemon'))) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, idx) => {
      if (/escalations\.(filter|reduce)/.test(line)) {
        // path.relative 在 Windows 返回反斜杠，统一成正斜杠再与仓库相对路径锚点比较（跨平台假红，非判定放宽）。
        hits.push(path.relative(REPO, file).replace(/\\/g, '/') + ':' + (idx + 1));
      }
    });
  }
  assert.equal(hits.length, 1, `计数表达式应恰 1 条（基线 src/daemon/server.js:905），实际：${hits.join(', ')}`);
  assert.match(hits[0], /^src\/daemon\/server\.js:/, `唯一计数点必须在 shapeSnapshot 内：${hits[0]}`);
});

test('pendingEscalations 在 http 仅既有透传 1 条（零重算表达式）', () => {
  const hits = [];
  for (const file of jsFiles(path.join(REPO, 'src', 'daemon', 'http'))) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, idx) => {
      if (/pendingEscalations/.test(line)) hits.push({ at: `${path.relative(REPO, file)}:${idx + 1}`, line });
    });
  }
  assert.equal(hits.length, 1, `http 层 pendingEscalations 应仅 1 条透传，实际：${hits.map((h) => h.at).join(', ')}`);
  assert.match(hits[0].line, /Number\.isInteger/, `该条必须是透传：${hits[0].line}`);
  assert.ok(
    !/(filter|reduce|\.length\s*\+\+|push\()/.test(hits[0].line),
    `透传行不得含重算表达式：${hits[0].line}`,
  );
});

test('tray-quit-confirm 仅由 wait_ctl_file 消费、不在 CTL_ACTIONS（D-9）', () => {
  const probe = readText('desktop/src-tauri/src/probe.rs');
  const tray = readText('desktop/src-tauri/src/tray.rs');
  const actions = probe.match(/const CTL_ACTIONS:[^=]*=\s*\[([\s\S]*?)\];/);
  assert.ok(actions, '未找到 CTL_ACTIONS 分发表');
  const list = [...actions[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(list, [
    'close-window', 'tray-open', 'tray-quit',
    'notify-open', 'tray-pause', 'tray-resume', 'queue-open',
  ], 'CTL_ACTIONS 必须是既有三条 + 新增四条');
  assert.ok(!list.includes('tray-quit-confirm'), 'tray-quit-confirm 不得进入 CTL_ACTIONS');
  assert.ok(
    /wait_ctl_file\(&dir,\s*"tray-quit-confirm"/.test(tray),
    'tray-quit-confirm 必须由 tray.rs 的 wait_ctl_file 消费',
  );
  assert.ok(
    /name == "tray-quit-confirm"/.test(probe),
    'watcher 必须跳过 tray-quit-confirm 文件',
  );
});

// ---------------------------------------------------------------------------
// 三主链 A-0 归一化逐字回归（复用 I1.9 final-verification / wp13 基线）
// ---------------------------------------------------------------------------

function makeChainProject(t, tag) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `maestro-i11-reg-${tag}-`));
  const dir = path.join(root, '.orch', 'hosts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'mock.json'), JSON.stringify({
    transport: 'stdio',
    launch: { command: process.execPath, args: [MOCK] },
    limits: { initializeTimeoutMs: 15_000, requestTimeoutMs: 15_000, promptTimeoutMs: 30_000, quietIdleMs: 30, quietCapMs: 200 },
  }, null, 2), 'utf8');
  // `orch run` 会拉起常驻核心（独立进程 + 命名管道），它持有本项目 `.orch` 目录的句柄。
  // 不停掉就直接删，Windows 上必然 EBUSY（POSIX 的 unlink 语义更宽松，所以只在这里炸）。
  // 用产品自带的优雅停止入口 `orch core stop` 收尾，再删目录；对残余句柄延迟仍保留退避重试。
  t.after(async () => {
    spawnSync(process.execPath, [BIN, 'core', 'stop'], {
      cwd: root, env: envFor(), encoding: 'utf8', timeout: 30_000, windowsHide: true,
    });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        fs.rmSync(root, { recursive: true, force: true });
        return;
      } catch (err) {
        if (err?.code !== 'EBUSY' && err?.code !== 'EPERM' && err?.code !== 'ENOTEMPTY') throw err;
        await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}

function runChain(root, template, task) {
  const res = spawnSync(process.execPath, [BIN, 'run', '--cwd', '.', '--template', template, '--host', 'mock', '--task', task], {
    cwd: root, env: envFor(), encoding: 'utf8', timeout: 90_000, windowsHide: true,
  });
  const stdout = res.stdout ?? '';
  return { code: res.status, stdout, stderr: res.stderr ?? '', lines: stdout === '' ? [] : stdout.replace(/\n$/, '').split('\n') };
}

/** A-0 归一化（与 test/wp9/i19-regression.test.js 同口径）：只替换可变值。 */
function normalizeLine(line) {
  return line
    .replace(/mock-sess-\d+-\d+/g, 'mock-sess-PID-SEQ')
    .replace(/INST-\d+/g, 'INST-N')
    .replace(/\d{2}:\d{2}:\d{2}/g, 'TIME')
    .replace(/已运行 \d+s/g, '已运行 Ns')
    .replace(/耗时 \d+s/g, '耗时 Ns');
}

const ESCALATE_NEXT_STEP =
  '下一步：orch escalate list --instance INST-N 查看升级；' +
  'orch escalate resolve ESC-nnn --instance INST-N --decision retry|pass|fail 处理；' +
  '要终止请执行 orch cancel --instance INST-N';

/**
 * 三条主链冻结基线（A-0 归一化后的整份 stdout）。来源：single 取
 * docs/iterations/iteration-1/evidence/NFR-03.output.json；code-loop / task-loop
 * 取 docs/iterations/iteration-9/review-wp7-r2.md §2.2/§2.3（worktree 基线
 * 322fb5e 与当前树归一化 diff=0 的冻结对照）。iteration-3/report.md §回归红线
 * 亦登记 single/code-loop 逐字不变。
 */
const CHAINS = {
  single: {
    task: '写一段流程说明', exit: 0, runs: 2,
    baseline: [
      '实例 INST-N · 运行中',
      '会话已创建 mock-sess-PID-SEQ',
      '任务已投递',
      '会话 执行中 · 已运行 Ns',
      '会话 等待下游 · 产出已提交',
      '会话 空闲',
      '节点 已完成 · 耗时 Ns',
      '交接包 HO-001  已构造   TIME',
      '交接包 HO-001  已投递   TIME',
      '交接包 HO-001  已接受   TIME',
      '交接包 HO-001  已完成   TIME',
    ],
  },
  'code-loop': {
    task: '实现一个示例功能\n产物：calc.js', exit: 4, runs: 2,
    baseline: [
      '实例 INST-N · 运行中 · 模板 编码闭环',
      '会话已创建 mock-sess-PID-SEQ',
      '任务已投递',
      '会话 执行中 · 已运行 Ns',
      '会话 等待下游 · 产出已提交',
      '会话 空闲',
      '会话 已升级',
      '实例 INST-N · 已挂起 · 模板 编码闭环',
      '升级 ESC-001 待处理 · 节点 T-001 开发 · 第 1 轮',
      ESCALATE_NEXT_STEP,
    ],
  },
  'task-loop': {
    task: '整理一份调研纪要\n产物：release-notes.md', exit: 4, runs: 2,
    baseline: [
      '实例 INST-N · 运行中 · 模板 通用任务闭环',
      '会话已创建 mock-sess-PID-SEQ',
      '任务已投递',
      '会话 执行中 · 已运行 Ns',
      '会话 空闲',
      '会话 已升级',
      '实例 INST-N · 已挂起 · 模板 通用任务闭环',
      '升级 ESC-001 待处理 · 节点 T-001 研究员 · 第 1 轮',
      ESCALATE_NEXT_STEP,
    ],
  },
};
const FORBIDDEN_RUNTIME_WORDS = ['健康度', '追踪', '执行摘要', '已跳过'];

test('三主链：A-0 归一化后逐字命中 I1.1/I1.3 冻结基线（single/code-loop/task-loop）', async (t) => {
  for (const [template, spec] of Object.entries(CHAINS)) {
    const runs = [];
    for (let i = 0; i < spec.runs; i += 1) {
      const root = makeChainProject(t, `${template}-${i}`);
      const res = runChain(root, template, spec.task);
      assert.equal(res.code, spec.exit, `${template} 退出码漂移：\n${res.stdout ?? ''}\n${res.stderr}`);
      assert.equal(res.stderr, '', `${template} 不应写 stderr：\n${res.stderr}`);
      runs.push(res);
    }
    for (const res of runs) {
      for (const word of FORBIDDEN_RUNTIME_WORDS) {
        assert.ok(!res.lines.some((l) => l.includes(word)), `${template} 运行期出现新可见词「${word}」`);
      }
    }
    const exact = runs.filter((res) => {
      const n = res.lines.map(normalizeLine);
      return n.length === spec.baseline.length && n.every((line, i) => line === spec.baseline[i]);
    });
    // task-loop 的「会话 已升级」在基线本身 flaky（wp13 同款口径），N 次中至少 1 次整份命中即可。
    const required = template === 'task-loop' ? 1 : spec.runs;
    assert.ok(
      exact.length >= required,
      `${template} 归一化后未逐字命中基线（${exact.length}/${spec.runs}）：\n` +
        runs.map((r) => r.lines.join('\n')).join('\n---\n'),
    );
  }
});
