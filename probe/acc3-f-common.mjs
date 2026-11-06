// I1.3 验收 —— 验收动作 / 断言辅助 / parts 与 results 落盘。
// 用例只用这里的原语：makeCase 收集核对项 → finish(c) 落 evidence + parts + results。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, NODE, ORCH, DRIVER, SEAM, BASE, EVID, REPORT, PARTS, RESULTS, SUMMARY,
  REQUIREMENT, SCENARIO_DIR, DEFAULT_TASK,
  ensureDir, exists, sleep, freshRoot, baseEnv, runCmd, orch, driver,
  statePath, eventsPath, workspacePath, readJson, readState, readEvents, instanceIds,
  sha256File, fileInfo, waitUntil, startDriver, waitMarker, killAllDrivers, forceKillCore,
  noteScenario, scenariosSinceRecycle, resetScenarioCounter, SCENARIO_RECYCLE_AT,
  saveEvidence, countLines
} from './acc3-f-lib.mjs';

export {
  REPO, NODE, ORCH, DRIVER, SEAM, BASE, EVID, REPORT, PARTS, RESULTS, SUMMARY,
  REQUIREMENT, SCENARIO_DIR, DEFAULT_TASK,
  ensureDir, exists, sleep, freshRoot, baseEnv, runCmd, orch, driver,
  statePath, eventsPath, workspacePath, readJson, readState, readEvents, instanceIds,
  sha256File, fileInfo, waitUntil, startDriver, waitMarker, killAllDrivers, forceKillCore,
  noteScenario, scenariosSinceRecycle, resetScenarioCounter, SCENARIO_RECYCLE_AT,
  saveEvidence, countLines
};

/** 脚手架路径总表（final 与用例共用，避免各处拼路径）。 */
export const ACC3_PATHS = {
  REPO, BASE, EVID, REPORT, PARTS, RESULTS, SUMMARY, REQUIREMENT,
  ORCH, DRIVER, SEAM, SCENARIO_DIR
};

export function ensureParts() { fs.mkdirSync(PARTS, { recursive: true }); }
export function text(res) { return `${res?.stdout ?? ''}${res?.stderr ?? ''}`; }
export function lines(t) { return String(t).split('\n'); }
export function grepCount(t, re) { return lines(t).filter((l) => re.test(l)).length; }
export function nonEmptyLines(t) { return lines(t).filter((l) => l.trim().length > 0); }

// ---------------------------------------------------------------- 场景helper

/** 按名取场景（只读 test/fixtures/scenarios/task-loop/<名>.json），返回 {name, steps, stopAfter}。 */
export function scenario(name) {
  const file = path.join(SCENARIO_DIR, `${name}.json`);
  const raw = readJson(file);
  if (!raw) throw new Error(`未知 task-loop 场景：${name}（缺少 ${file}）`);
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) throw new Error(`场景没有 steps：${name}`);
  return {
    name,
    stopAfter: Number.isInteger(raw.stopAfter) && raw.stopAfter > 0 ? raw.stopAfter : null,
    steps: raw.steps.map((s) => ({ ...s }))
  };
}
export function scenarioNames() {
  try {
    return fs.readdirSync(SCENARIO_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  } catch { return []; }
}
/** 场景的第 n 步（1 基）；越界返回 null。 */
export function scenarioStep(name, n) {
  return scenario(name).steps[n - 1] ?? null;
}
/** `.mock/prompts/<n>.json`（{n,nodeId,round,task}），缺失返回 null。 */
export function promptOf(root, n) {
  return readJson(path.join(root, '.mock', 'prompts', `${n}.json`));
}
/** 实例工作区内的相对引用 → 绝对路径。 */
export function wsPath(root, ref, instance = 'INST-001') {
  return path.join(workspacePath(root, instance), ...String(ref).split('/'));
}
/** 任务目录（orch run --cwd 指的地方），默认 <root>/demo-doc。 */
export function taskDir(root, name = 'demo-doc') { return path.join(root, name); }

// ---------------------------------------------------------------- 产品命令封装

export function statusText(root, { instance = 'INST-001', events = false, env } = {}) {
  const args = ['status', '--instance', instance];
  if (events) args.push('--events');
  return orch(root, args, env ? { env } : {});
}
export function statusEvents(root, instance = 'INST-001') {
  return orch(root, ['status', '--instance', instance, '--events']);
}
export function statusAll(root, { events = false } = {}) {
  const args = ['status'];
  if (events) args.push('--events');
  return orch(root, args);
}
export function cancel(root, instance = 'INST-001') { return orch(root, ['cancel', '--instance', instance]); }
export function coreStop(root, env) { return orch(root, ['core', 'stop'], env ? { env } : {}); }

/** 同步跑完一个夹具场景（驱动会透传 orch run 的输出与退出码）。 */
export function runSync(root, name, extra = [], opts = {}) {
  noteScenario();
  return driver(root, ['--scenario', name, ...extra], opts);
}
/** 只备现场：只写 .mock/ 与 .orch/hosts/dsh.json，不启核心、不建实例。 */
export function prepareOnly(root, name, extra = []) {
  return driver(root, ['--scenario', name, '--prepare-only', ...extra]);
}
/** 长驻场景（--keep），交给 startDriver 管理；用完必须 await h.stop()。 */
export function startKeep(root, name, extra = [], env = baseEnv(), timeout = 60000) {
  noteScenario();
  return startDriver(root, ['--scenario', name, '--keep', ...extra], { env, timeout });
}
// ---- I1.2 回归面（AC-36 / AC-37 / AC-38 用）----
export const CODE_DRIVER = path.join(REPO, 'test', 'fixtures', 'code-loop-driver.mjs');
export const PURITY_CHECK = path.join(REPO, 'test', 'fixtures', 'purity-check.mjs');
export const LEGACY_V1 = path.join(REPO, 'test', 'fixtures', 'legacy-v1');

/** 跑 I1.2 的 code-loop 驱动（参数与 task-loop 驱动同形）。 */
export function codeLoopDriver(root, args = [], opts = {}) {
  noteScenario();
  return runCmd([NODE, CODE_DRIVER, '--root', root, ...args], {
    cwd: REPO, ...opts, label: opts.label ?? `code-loop-driver ${args.join(' ')}`
  });
}
/** 架构扫描：默认扫 src/core + src/daemon，禁词由调用方给全表。 */
export function purity({ dirs = 'src/core,src/daemon', forbid = 'code-loop,developer,tester,coordinator', extra = [] } = {}) {
  return runCmd([NODE, PURITY_CHECK, '--dirs', dirs, '--forbid', forbid, ...extra], { cwd: REPO, label: 'purity-check' });
}
/** 全量测试入口（Node 22 / Windows 下必须传 glob 字符串，不能传目录）。 */
export function nodeTest(globs = ['test/**/*.test.js'], opts = {}) {
  return runCmd([NODE, '--test', ...globs], { cwd: REPO, timeout: 600000, ...opts, label: `node --test ${globs.join(' ')}` });
}
/** 把 I1.1 旧格式实例（schemaVersion=1）拷进项目根：.orch/instances/<id>/{state.json,events.jsonl}。 */
export function installLegacyV1(root, id = 'OLD-001') {
  const dest = path.join(root, '.orch', 'instances', id);
  ensureDir(dest);
  for (const f of ['state.json', 'events.jsonl']) fs.copyFileSync(path.join(LEGACY_V1, id, f), path.join(dest, f));
  return dest;
}
/** legacy-v1/SHA256SUMS 里登记的基线哈希（复核「字节未改变」用）。 */
export function legacyV1Hashes() {
  try {
    const map = {};
    for (const line of fs.readFileSync(path.join(LEGACY_V1, 'SHA256SUMS'), 'utf8').split('\n').filter(Boolean)) {
      const m = /^([0-9a-f]{64})\s+(.+)$/.exec(line.trim());
      if (m) map[m[2].replace(/\\/g, '/')] = m[1];
    }
    return map;
  } catch { return {}; }
}

/** 产品命令 orch run（不经驱动）。 */
export function runProduct(root, { task = DEFAULT_TASK, cwd = './demo-doc', template = 'task-loop', host = 'dsh', instance = null, env, timeout = 120000 } = {}) {
  const args = ['run', '--cwd', cwd, '--task', task];
  if (template) args.push('--template', template);
  if (host) args.push('--host', host);
  if (instance) args.push('--instance', instance);
  return orch(root, args, { timeout, ...(env ? { env } : {}) });
}

/** 记录长驻 driver 命令（startDriver 是 spawn，拿不到 runCmd 结果）。 */
export function noteKeep(c, root, name, extra = [], envKeys = []) {
  c.commands.push({
    label: `driver --scenario ${name} --keep ${extra.join(' ')}（长驻，startDriver 管理）`,
    argv: [NODE, DRIVER, '--root', root, '--scenario', name, '--keep', ...extra],
    cwd: REPO, exitCode: null, durationMs: 0,
    stdout: `（长驻进程；env 关键键：${envKeys.join(', ') || 'NODE_ENV=test'}）`,
    stderr: ''
  });
}
/** 记录夹具手工动作（建目录、改 mtime、写标记等），保证命令清单完整。 */
export function noteFixture(c, label, detail = '') {
  c.commands.push({
    label: `夹具：${label}`, argv: [`(fixture) ${label}`], cwd: REPO,
    exitCode: 0, durationMs: 0, stdout: String(detail), stderr: ''
  });
}

// ---------------------------------------------------------------- 状态读取 helper

export function nodeOf(state, id) { return (state?.nodes ?? []).find((n) => n.nodeId === id) ?? null; }
export function handoffOf(state, id) { return (state?.handoffs ?? []).find((h) => h.handoffId === id) ?? null; }
export function backflowOf(state) { return (state?.handoffs ?? []).find((h) => h.edge?.kind === 'backflow') ?? null; }
export function escalationOf(state, i = 0) { return (state?.escalations ?? [])[i] ?? null; }
export function eventsOf(events, pred) { return (events ?? []).filter(pred); }
export function eventSeqs(res) {
  return [...String(res?.stdout ?? '').matchAll(/\[#(\d+)\]/g)].map((m) => Number(m[1]));
}

// ---------------------------------------------------------------- 用例结构

/**
 * 统一用例：{ac,title,verdict,checks[],evidence[],notes[]}。
 * check(text, ok, actual) 收一条核对项；block(text, reason) 记「阻塞」（无法在夹具上观测）。
 */
export function makeCase(ac, { title = '', face = '夹具', root = null } = {}) {
  return {
    ac,
    title,
    face,
    token: currentToken(),
    verdict: null,
    checks: [],
    evidence: [],
    notes: [],
    commands: [],
    roots: [],
    startedAt: new Date().toISOString(),
    add(r) { if (r && !this.roots.includes(r)) this.roots.push(r); return r; },
    note(msg) { this.notes.push(String(msg)); return this; },
    check(label, ok, actual = null) {
      this.checks.push({
        text: label,
        ok: Boolean(ok),
        blocked: false,
        actual: actual === null || actual === undefined ? null : String(actual).slice(0, 4000)
      });
      return Boolean(ok);
    },
    block(label, reason) {
      this.checks.push({ text: label, ok: false, blocked: true, actual: String(reason ?? '无法在夹具上观测').slice(0, 4000) });
      return false;
    },
    eq(label, actual, expected) {
      return this.check(`${label}（期望 ${JSON.stringify(expected)}）`, Object.is(actual, expected), JSON.stringify(actual));
    },
    includes(label, haystack, needle) {
      return this.check(`${label}（期望含 ${JSON.stringify(needle)}）`, String(haystack).includes(needle), String(haystack).slice(0, 3000));
    },
    notIncludes(label, haystack, needle) {
      return this.check(`${label}（期望不含 ${JSON.stringify(needle)}）`, !String(haystack).includes(needle), String(haystack).slice(0, 3000));
    },
    matches(label, haystack, re) {
      return this.check(`${label}（期望匹配 ${re}）`, re.test(String(haystack)), String(haystack).slice(0, 3000));
    },
    cmd(res, label = null) {
      if (!res) return res;
      this.commands.push({
        label: label ?? res.label ?? null,
        argv: res.argv ?? [],
        cwd: res.cwd ?? null,
        exitCode: res.exitCode ?? null,
        timedOut: Boolean(res.timedOut),
        durationMs: res.durationMs ?? 0,
        stdout: res.stdout ?? '',
        stderr: res.stderr ?? ''
      });
      return res;
    },
    /** 追加一份「断言时刻」的原始快照（如 state.live.json），与收尾 state.json 区分。 */
    snap(root, label) {
      ensureDir(EVID);
      const ids = instanceIds(root);
      const doc = ids.length === 0 ? null
        : ids.length === 1 ? readState(root, ids[0])
          : { instances: ids.map((id) => ({ instanceId: id, state: readState(root, id) })) };
      const p = path.join(EVID, `${this.ac}.${label}.json`);
      fs.writeFileSync(p, JSON.stringify(doc, null, 2) + '\n', 'utf8');
      this.evidence.push(p);
      return p;
    },
    /** 把长驻 driver 的当前输出记成一条命令（exitCode 未知）。 */
    keep(label, handle, argv = null) {
      this.commands.push({
        label,
        argv: argv ?? handle?.argv ?? [],
        cwd: REPO,
        exitCode: handle?.exitCode ?? null,
        timedOut: false,
        durationMs: Date.now() - (handle?.startedAt ?? Date.now()),
        stdout: handle?.stdout ?? '',
        stderr: handle?.stderr ?? ''
      });
      return handle;
    }
  };
}

/** 把 checks 收敛成三档：任一阻塞 → 阻塞；否则全通过且非空 → 通过；其余 → 不通过。 */
export function summarize(c) {
  const checks = c.checks ?? [];
  const blocked = checks.filter((x) => x.blocked);
  const failed = checks.filter((x) => !x.ok && !x.blocked);
  let verdict = '不通过';
  if (checks.length === 0) verdict = '阻塞';
  else if (blocked.length > 0) verdict = '阻塞';
  else if (failed.length === 0) verdict = '通过';
  return {
    verdict,
    pass: verdict === '通过',
    total: checks.length,
    ok: checks.filter((x) => x.ok).length,
    failed,
    blocked
  };
}

// ---------------------------------------------------------------- 需求原文

const AC_HEAD_RE = /^#### (AC-\d+)[^\n]*\n([\s\S]*?)(?=^#### AC-\d+|^### )/gm;

function requirementText() {
  try { return fs.readFileSync(REQUIREMENT, 'utf8'); } catch { return ''; }
}

/** 抽取某条 AC 的需求原文 gherkin（Given/When/Then/And 逐字行）。 */
export function requirementLines(ac) {
  const src = requirementText();
  AC_HEAD_RE.lastIndex = 0;
  for (const m of src.matchAll(AC_HEAD_RE)) {
    if (m[1] !== ac) continue;
    const body = m[2];
    const fence = body.match(/```gherkin\n([\s\S]*?)```/);
    const gherkin = fence ? fence[1] : body;
    return lines(gherkin).map((l) => l.trim()).filter((l) => /^(Given|When|Then|And)\s/.test(l));
  }
  return [];
}
export function requirementTitle(ac) {
  const src = requirementText();
  const m = new RegExp(`^#### ${ac} ([^\\n]+)$`, 'm').exec(src);
  return m ? m[1].trim() : '';
}

// ---------------------------------------------------------------- parts / results

function rel(p) { return path.relative(REPO, p).split(path.sep).join('/'); }
function mdCell(s, n = 240) { return String(s ?? '').replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').slice(0, n); }

/** 写 probe/acc3-f-parts/<AC>.md（final 直接拼接这一节）。 */
export function writePart(c) {
  ensureParts();
  const sum = summarize(c);
  const thenLines = requirementLines(c.ac);
  const title = c.title || requirementTitle(c.ac) || '';

  const cmdLines = (c.commands ?? []).map((cmd) => {
    const argv = (cmd.argv ?? []).map((a) => (String(a).includes(' ') ? JSON.stringify(a) : a)).join(' ');
    return `${cmd.label ? `[${cmd.label}] ` : ''}${argv}   | cwd=${cmd.cwd} | exit=${cmd.exitCode ?? '-'} | ${cmd.durationMs ?? 0}ms`;
  });

  const evRows = (c.evidence ?? []).map((f) => {
    const info = fileInfo(f);
    return `| \`${rel(f)}\` | ${info.bytes} B |`;
  });

  const checkRows = (c.checks ?? []).map((x, i) => {
    const mark = x.blocked ? '⛔ 阻塞' : x.ok ? '✅' : '❌';
    const actual = x.actual === null ? '—' : `\`${mdCell(x.actual, 260)}\``;
    return `| ${i + 1} | ${mdCell(x.text, 200)} | ${mark} | ${actual} |`;
  });

  const md = [
    `#### ${c.ac} ${title}`.trim(), '',
    `- 判定：**${sum.verdict}**（核对 ${sum.ok}/${sum.total} 通过${sum.blocked.length ? `，阻塞 ${sum.blocked.length}` : ''}）`,
    `- 验证面：${c.face}`,
    `- 项目根：${c.roots.length ? c.roots.map((r) => '`' + r + '`').join('、') : '（无）'}`,
    `- 实例：${c.roots.flatMap((r) => instanceIds(r)).join('、') || '（无）'}`,
    '', '**① 完整命令（逐条可复跑）**', '', '```', ...(cmdLines.length ? cmdLines : ['（无命令）']), '```', '',
    `> 每条命令 stdout+stderr 全文见 \`${rel(path.join(EVID, `${c.ac}.output.json`))}\`；\`status.txt\` 是可读转录。`, '',
    '**② 需求原文（Given / When / Then，逐字）**', '', '```gherkin', ...(thenLines.length ? thenLines : ['（未抽取到，见 requirement.md §3.1）']), '```', '',
    '**③ 实测证据文件清单**', '',
    evRows.length ? ['| 文件 | 大小 |', '|---|---|', ...evRows].join('\n') : '（未落盘）', '',
    '**④ 逐项核对表**', '',
    checkRows.length ? ['| # | 核对项 | 结果 | 实测 |', '|---|---|---|---|', ...checkRows].join('\n') : '（无用例核对项）', '',
    `**⑤ 判定**：${sum.verdict}`, '',
    ...(c.notes.length ? ['**备注**', '', ...c.notes.map((n) => `- ${n}`), ''] : []),
    '---', ''
  ].join('\n');

  fs.writeFileSync(path.join(PARTS, `${c.ac}.md`), md, 'utf8');
  return md;
}

/** 追加 probe/acc3-f-results.jsonl（一行一条 AC）。 */
export function appendResult(c) {
  ensureDir(PARTS);
  const sum = summarize(c);
  fs.appendFileSync(RESULTS, JSON.stringify({
    ac: c.ac,
    title: c.title || requirementTitle(c.ac),
    face: c.face,
    verdict: sum.verdict,
    pass: sum.pass,
    total: sum.total,
    ok: sum.ok,
    blocked: sum.blocked.map((x) => ({ text: x.text, actual: x.actual })),
    failed: sum.failed.map((x) => ({ text: x.text, actual: x.actual })),
    checks: c.checks.map((x) => ({ text: x.text, ok: x.ok, blocked: Boolean(x.blocked) })),
    evidence: (c.evidence ?? []).map(rel),
    roots: c.roots,
    notes: c.notes,
    at: new Date().toISOString()
  }) + '\n', 'utf8');
  return sum;
}

/**
 * 执行代际：runner 每跑一条 AC 换一次 token；用例在 makeCase 时捕获当前 token。
 * 超时/异常后 runner 再换 token，被落下的旧用例即使后来跑完，finish() 也不会重复写结果。
 */
let CASE_TOKEN = Symbol('case');
export function newToken() { CASE_TOKEN = Symbol('case'); return CASE_TOKEN; }
export function currentToken() { return CASE_TOKEN; }

/** 一条 AC 的收尾：evidence → parts → results。返回 summarize 结果。 */
export function finish(c, extra = {}) {
  const sum = summarize(c);
  if (c.token && c.token !== CASE_TOKEN) return sum; // 已被超时/异常兜底接管
  c.verdict = sum.verdict;
  c.title = c.title || requirementTitle(c.ac);
  saveEvidence(c, { verdict: sum.verdict, ...extra });
  writePart(c);
  appendResult(c);
  return sum;
}
