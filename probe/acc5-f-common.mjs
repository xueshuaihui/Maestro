// I1.5 验收 —— 验收动作 / 断言辅助 / 夹具构造 / parts 与 results 落盘。
// 用例只用这里的原语：makeCase 收集核对项 → finish(c) 落 evidence + parts + results。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, NODE, ORCH, MOCK, CODE_DRIVER, TASK_DRIVER, SEAM, PURITY,
  ITERATION_DIR, REQUIREMENT, REPORT, EVID, BASE, PARTS, RESULTS, SUMMARY, BLOCKERS, CASES_DIR,
  BASELINE_COMMIT, CODE_TASK, DOC_TASK, SINGLE_TASK,
  ensureDir, exists, sleep, freshRoot, baseEnv, runCmd, orch, orchOf, codeDriver, taskDriver,
  codeDriverOf, taskDriverOf, seam, purity, nodeTest,
  statePath, eventsPath, workspacePath, readJson, readText, readState, readEvents, instanceIds,
  sha256File, fileInfo, listFiles, dirSnapshot, waitUntil,
  startDriver, startProduct, waitMarker, waitPaused, killAllDrivers, forceKillCore, sweepStrays,
  noteScenario, scenariosSinceRecycle, resetScenarioCounter, SCENARIO_RECYCLE_AT,
  saveEvidence, countLines
} from './acc5-f-lib.mjs';

export {
  REPO, NODE, ORCH, MOCK, CODE_DRIVER, TASK_DRIVER, SEAM, PURITY,
  ITERATION_DIR, REQUIREMENT, REPORT, EVID, BASE, PARTS, RESULTS, SUMMARY, BLOCKERS, CASES_DIR,
  BASELINE_COMMIT, CODE_TASK, DOC_TASK, SINGLE_TASK,
  ensureDir, exists, sleep, freshRoot, baseEnv, runCmd, orch, orchOf, codeDriver, taskDriver,
  codeDriverOf, taskDriverOf, seam, purity, nodeTest,
  statePath, eventsPath, workspacePath, readJson, readText, readState, readEvents, instanceIds,
  sha256File, fileInfo, listFiles, dirSnapshot, waitUntil,
  startDriver, startProduct, waitMarker, waitPaused, killAllDrivers, forceKillCore, sweepStrays,
  noteScenario, scenariosSinceRecycle, resetScenarioCounter, SCENARIO_RECYCLE_AT,
  saveEvidence, countLines
};

/** 脚手架路径总表（final 与用例共用，避免各处拼路径）。 */
export const ACC5_PATHS = {
  REPO, BASE, EVID, REPORT, PARTS, RESULTS, SUMMARY, BLOCKERS, CASES_DIR, REQUIREMENT,
  ORCH, MOCK, CODE_DRIVER, TASK_DRIVER, SEAM, PURITY
};

export function ensureParts() { fs.mkdirSync(PARTS, { recursive: true }); }
export function text(res) { return `${res?.stdout ?? ''}${res?.stderr ?? ''}`; }
export function lines(t) { return String(t).split('\n'); }
export function grepCount(t, re) { return lines(t).filter((l) => re.test(l)).length; }
export function nonEmptyLines(t) { return lines(t).filter((l) => l.trim().length > 0); }
/** 行首尾不改，只把 CRLF 归一（Windows 上 spawnSync 拿到的是 \r\n）。 */
export function clean(t) { return String(t ?? '').replace(/\r\n/g, '\n'); }

// ---------------------------------------------------------------- 项目资产夹具

export const ROLE_DIR = (root) => path.join(root, '.orch', 'roles');
export const SKILL_DIR = (root) => path.join(root, '.orch', 'skills');

/** 一份合法角色 YAML（字段顺序与 `assets/roles/developer.yaml` 一致）。 */
export function roleYaml(over = {}) {
  const r = {
    schema: 'role/v1',
    id: 'researcher',
    name: '研究员',
    group: 'research',
    summary: '按任务收集事实，交出研究笔记',
    artifactType: 'report',
    sideEffect: 'write',
    skills: ['research-brief'],
    tools: ['read', 'write'],
    wakeAllow: [],
    max: 1,
    ...over
  };
  const omit = new Set(over.omit ?? []);
  const out = [];
  const push = (key, line) => { if (!omit.has(key)) out.push(line); };
  push('schema', `schema: ${r.schema}`);
  push('id', `id: ${r.id}`);
  push('name', `name: ${r.name}`);
  push('group', `group: ${r.group}`);
  push('summary', `summary: ${r.summary}`);
  push('artifact_type', `artifact_type: ${r.artifactType}`);
  push('side_effect', `side_effect: ${r.sideEffect}`);
  if (!omit.has('skills')) {
    out.push('skills:');
    for (const s of r.skills) out.push(`  - ${s}`);
    if (r.skills.length === 0) out[out.length - 1] = 'skills: []';
  }
  if (!omit.has('tools')) {
    out.push('tools:');
    for (const t of r.tools) out.push(`  - ${t}`);
  }
  if (!omit.has('wake_allow')) {
    out.push('wake_allow:');
    for (const w of r.wakeAllow) out.push(`  - ${w}`);
    if (r.wakeAllow.length === 0) out[out.length - 1] = 'wake_allow: []';
  }
  push('max_concurrent_sessions', `max_concurrent_sessions: ${r.max}`);
  return `${out.join('\n')}\n`;
}

/** 写 `<root>/.orch/roles/<file>.yaml`（内容由 roleYaml / 原始文本决定）。 */
export function writeRole(root, file, content) {
  ensureDir(ROLE_DIR(root));
  const p = path.join(ROLE_DIR(root), `${file}.yaml`);
  fs.writeFileSync(p, typeof content === 'string' ? content : roleYaml({ id: file, ...content }), 'utf8');
  return p;
}

/** 一份合法技能文件。 */
export function skillMarkdown(over = {}) {
  const s = {
    schema: 'skill/v1',
    id: 'code-change',
    name: '代码修改（项目版）',
    summary: '项目自己的改码口径：先读产物行，再最小改动',
    appliesTo: '[coding]',
    commands: '["node --test"]',
    body: '### 项目口径\n\n1. 先读「产物：」那一行。\n2. 只改必要位置。\n',
    ...over
  };
  const omit = new Set(over.omit ?? []);
  const head = [];
  const push = (key, line) => { if (!omit.has(key)) head.push(line); };
  push('schema', `schema: ${s.schema}`);
  push('id', `id: ${s.id}`);
  push('name', `name: ${s.name}`);
  push('summary', `summary: ${s.summary}`);
  push('applies_to', `applies_to: ${s.appliesTo}`);
  push('commands', `commands: ${s.commands}`);
  return `---\n${head.join('\n')}\n---\n\n${s.body ?? ''}`;
}

/** 写 `<root>/.orch/skills/<dir>/SKILL.md`。 */
export function writeSkill(root, dir, content) {
  const d = path.join(SKILL_DIR(root), dir);
  ensureDir(d);
  const p = path.join(d, 'SKILL.md');
  fs.writeFileSync(p, typeof content === 'string' ? content : skillMarkdown({ id: dir, ...content }), 'utf8');
  return p;
}

/** 只建目录（AC-13：目录在、SKILL.md 不在）。 */
export function writeSkillDirOnly(root, dir) {
  const d = path.join(SKILL_DIR(root), dir);
  ensureDir(d);
  return d;
}

// ---------------------------------------------------------------- 宿主夹具

/**
 * 写 `.orch/hosts/<hostId>.json`：launch 指向仓库内 mock ACP agent。
 * `hostId` 决定 `state.json` 里会话的 `hostId`（AC-22 要求出现 `dsh`）。
 */
export function writeHostConfig(root, { hostId = 'dsh', scenario = 'backflow', suite = null, args = [] } = {}) {
  const dir = path.join(root, '.orch', 'hosts');
  ensureDir(dir);
  const launchArgs = [MOCK, '--root', root, '--scenario', scenario];
  if (suite) launchArgs.push('--suite', suite);
  launchArgs.push(...args);
  const payload = {
    id: hostId,
    transport: 'stdio',
    launch: { command: NODE, args: launchArgs },
    limits: {
      initializeTimeoutMs: 15000, requestTimeoutMs: 15000, promptTimeoutMs: 60000,
      quietIdleMs: 30, quietCapMs: 200
    }
  };
  const p = path.join(dir, `${hostId}.json`);
  fs.writeFileSync(p, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return p;
}

/** code-loop 驱动只备现场（写 `.mock/` 与 `.orch/hosts/mock.json`），不启核心。 */
export function prepareCodeLoop(root, scenario = 'backflow') {
  noteScenario();
  return codeDriver(root, ['--scenario', scenario, '--prepare-only', '--reset']);
}

// ---------------------------------------------------------------- 产品命令封装

/** `orch run`（同步）。 */
export function runProduct(root, {
  cwd = './demo-work', task = CODE_TASK, template = 'code-loop', host = 'dsh', instance = null,
  env = undefined, timeout = 180000
} = {}) {
  const args = ['run', '--cwd', cwd, '--task', task];
  if (template) args.push('--template', template);
  if (host) args.push('--host', host);
  if (instance) args.push('--instance', instance);
  return orch(root, args, { timeout, ...(env ? { env } : {}) });
}

/** 长驻 `orch run`（要停在中间态时用；`env` 里放 `MAESTRO_TEST_PAUSE` / `MAESTRO_TEST_STOP_AFTER`）。 */
export function startProductRun(root, opts = {}) {
  const {
    cwd = './demo-work', task = CODE_TASK, template = 'code-loop', host = 'dsh', extra = [],
    env = baseEnv(), timeout = 90000
  } = opts;
  const args = ['run', '--cwd', cwd, '--task', task];
  if (template) args.push('--template', template);
  if (host) args.push('--host', host);
  args.push(...extra);
  noteScenario();
  return startProduct(root, args, { env, timeout });
}

export function roleList(root, args = [], opts = {}) {
  return orch(root, ['role', 'list', ...args], opts);
}
export function roleShow(root, id, args = [], opts = {}) {
  return orch(root, ['role', 'show', id, ...args], opts);
}
export function roleValidate(root, args = [], opts = {}) {
  return orch(root, ['role', 'validate', ...args], opts);
}

/** `role … --format json` 的解析结果（解析失败返回 null，用例自己判）。 */
export function jsonOf(res) {
  try { return JSON.parse(String(res?.stdout ?? '')); } catch { return null; }
}

/** `orch role list --instance <id> --format json` 解析。 */
export function roleListJson(root, instance = 'INST-001') {
  const res = roleList(root, ['--instance', instance, '--format', 'json']);
  return { res, payload: jsonOf(res) };
}

/** `orch role show <id> --instance <id> --format json` 解析。 */
export function roleShowJson(root, roleId, instance = 'INST-001') {
  const res = roleShow(root, roleId, ['--instance', instance, '--format', 'json']);
  return { res, payload: jsonOf(res) };
}

/** 从 `role list --instance` 的载荷里取某个角色的实例视图。 */
export function viewOf(payload, roleId) {
  return (payload?.instance?.roles ?? []).find((v) => v.roleId === roleId) ?? null;
}
export function roleIdsOf(payload) {
  return (payload?.instance?.roles ?? []).map((v) => v.roleId);
}

// ---------------------------------------------------------------- 状态读取 helper

export function nodeOf(state, id) { return (state?.nodes ?? []).find((n) => n.nodeId === id) ?? null; }
export function sessionOf(state, id) { return (state?.sessions ?? []).find((s) => s.sessionId === id) ?? null; }
export function sessionsOfNode(state, nodeId) { return (state?.sessions ?? []).filter((s) => s.nodeId === nodeId); }
export function eventSeqs(res) {
  return [...String(res?.stdout ?? '').matchAll(/\[#(\d+)\]/g)].map((m) => Number(m[1]));
}

// ---------------------------------------------------------------- 输出归一化（AC-19）

/** 需求原文给的两条归一化：`已运行 12s` 与 `HH:mm:ss`。 */
export function stripRequired(t) {
  return clean(t)
    .replace(/已运行 [0-9]+s/g, '')
    .replace(/[0-9]{2}:[0-9]{2}:[0-9]{2}/g, '');
}

/**
 * AC-19 的**夹具侧**易变量（与产品是否回归无关，逐类可核）：
 * 1. `mock-sess-<pid>-<n>`：mock 宿主每次运行生成的新会话号；
 * 2. `耗时 <n>s`：单节点用时，同一条用例两次跑都可能落在 0s/1s；
 * 3. `hh:mm:ss` 之外的 ISO 时间戳（`stateSince` 等不出现在文本输出里，这里兜底）。
 */
export function stripFixtureVars(t) {
  return stripRequired(t)
    .replace(/mock-sess-[0-9]+-[0-9]+/g, 'mock-sess-<id>')
    .replace(/耗时 [0-9]+s/g, '耗时 <n>s');
}

/** 逐行比对，返回 {same, left, right, diffs:[{i,a,b}]}。 */
export function diffLines(a, b) {
  const left = nonEmptyLines(a);
  const right = nonEmptyLines(b);
  const diffs = [];
  const n = Math.max(left.length, right.length);
  for (let i = 0; i < n; i += 1) {
    if ((left[i] ?? '') !== (right[i] ?? '')) diffs.push({ i, a: left[i] ?? null, b: right[i] ?? null });
  }
  return { same: diffs.length === 0, left, right, diffs };
}

/** `state.json` 的结构形状：键集合按层级展开成可比较的字符串集合。 */
export function shapeOf(obj, prefix = '') {
  const out = [];
  if (Array.isArray(obj)) {
    for (const item of obj) out.push(...shapeOf(item, `${prefix}[]`));
    return out;
  }
  if (obj === null || typeof obj !== 'object') return out;
  for (const key of Object.keys(obj).sort()) {
    const p = prefix ? `${prefix}.${key}` : key;
    out.push(p);
    out.push(...shapeOf(obj[key], p));
  }
  return out;
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
    /** 额外证据（原始帧）：`<AC>.<label>.txt` / `.json`。 */
    evText(label, content) {
      ensureDir(EVID);
      const p = path.join(EVID, `${this.ac}.${label}.txt`);
      fs.writeFileSync(p, `${clean(content)}\n`, 'utf8');
      this.evidence.push(p);
      return p;
    },
    evJson(label, value) {
      ensureDir(EVID);
      const p = path.join(EVID, `${this.ac}.${label}.json`);
      fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      this.evidence.push(p);
      return p;
    },
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
    deepEq(label, actual, expected) {
      const a = JSON.stringify(actual);
      const e = JSON.stringify(expected);
      return this.check(`${label}（期望 ${e}）`, a === e, a);
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
    lineEq(label, actualLine, expectedLine) {
      return this.check(`${label}（期望逐字 ${JSON.stringify(expectedLine)}）`, actualLine === expectedLine, JSON.stringify(actualLine));
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
    /** 把长驻进程的当前输出记成一条命令（exitCode 未知）。 */
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
    },
    /** 夹具手工动作（建目录、写 .orch/roles/** 等），保证命令清单完整可复跑。 */
    noteFixture(label, detail = '') {
      this.commands.push({
        label: `夹具：${label}`, argv: [`(fixture) ${label}`], cwd: REPO,
        exitCode: 0, durationMs: 0, stdout: String(detail), stderr: ''
      });
      return this;
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

/** 抽取某条 AC 的「Then / 机检」原文行（Given/When/Then/And 与 `- **机检：**`）。 */
export function requirementLines(ac) {
  const src = requirementText();
  AC_HEAD_RE.lastIndex = 0;
  for (const m of src.matchAll(AC_HEAD_RE)) {
    if (m[1] !== ac) continue;
    return clean(m[2])
      .split('\n')
      .map((l) => l.trim())
      // 需求里的行形如 `- **Given** …` / `- **机检：** …`：先去掉列表标记与加粗标记再判前缀，
      // 否则 (Given|When|Then) 前缀永远不成立，只剩机检那一行被抽出来（验收文档会丢掉 When/Then）。
      .map((l) => l.replace(/^[-*+]\s*/, '').replace(/\*\*/g, ''))
      .filter((l) => /^(Given|When|Then|And)\s/.test(l) || /^(机检|夹具|架构检查)：/.test(l))
      // `**机检：**` 去粗体后会留下「机检： 内容」的空格，收一下。
      .map((l) => l.replace(/^(机检|夹具|架构检查)：\s+/, '$1：'));
  }
  return [];
}
export function requirementTitle(ac) {
  const src = requirementText();
  const m = new RegExp(`^#### ${ac} ([^\\n]+)$`, 'm').exec(src);
  return m ? m[1].trim() : '';
}
/** 需求里该 AC 声明的验证面（场景类型）。 */
export function requirementFace(ac) {
  const src = requirementText();
  const m = new RegExp(`^#### ${ac} [^\\n]+\\n\\n- 场景类型：([^｜\\n]+)`, 'm').exec(src);
  return m ? m[1].trim() : '';
}

// ---------------------------------------------------------------- parts / results

function rel(p) { return path.relative(REPO, p).split(path.sep).join('/'); }
function mdCell(s, n = 240) { return String(s ?? '').replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').slice(0, n); }

/** 写 probe/acc5-f-parts/<AC>.md（final 直接拼接这一节）。 */
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
    '**② 需求原文（Given / When / Then / 机检，逐字）**', '', '```gherkin', ...(thenLines.length ? thenLines : ['（未抽取到，见 requirement.md §3.1）']), '```', '',
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

/** 追加 probe/acc5-f-results.jsonl（一行一条 AC）。 */
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
