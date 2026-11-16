/**
 * I1.11 S3 验收脚手架 · 动作与断言辅助（只新增，不改产品代码）。
 *
 * 用例只用这里的原语：makeCase → check/eq/includes/matches/block → finish。
 * 判定三档：通过 / 不通过 / 阻塞。
 * 证据分级：已实测（真实宿主） / mock 实测 / 阻塞。
 * finish → saveEvidence（test-stdout/meta/state/check/output 五件套）→ writePart → appendResult。
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, NODE, ORCH, DRIVER, BASE, EVID, REPORT, PARTS, RESULTS, SUMMARY, BLOCKERS,
  REQUIREMENT, ACC11_PATHS,
  ensureDir, exists, iso, sleep, sha256, writeText, writeJson, appendLine, readJson, readState, readEvents,
  instanceIds, freshRoot, baseEnv, runCmd, orch, driver, waitUntil, startDriver, waitMarker,
  killAllDrivers, forceKillCore, saveEvidence, parseTap, f16Verdict, requirementBlocks,
  evidenceDir, caseTmp, fixtureRoots, gitHead, lastResults, countLines, grepCount, jsq
} from './acc11-f-lib.mjs';

export {
  REPO, NODE, ORCH, DRIVER, BASE, EVID, REPORT, PARTS, RESULTS, SUMMARY, BLOCKERS,
  REQUIREMENT, ACC11_PATHS,
  ensureDir, exists, iso, sleep, sha256, writeText, writeJson, appendLine, readJson, readState, readEvents,
  instanceIds, freshRoot, baseEnv, runCmd, orch, driver, waitUntil, startDriver, waitMarker,
  killAllDrivers, forceKillCore, parseTap, f16Verdict, requirementBlocks,
  evidenceDir, caseTmp, fixtureRoots, gitHead, lastResults, saveEvidence, countLines, grepCount, jsq
};

const REQ = requirementBlocks();
export function req(ac) { return REQ.get(ac) || null; }

export function text(res) { return `${res?.stdout ?? ''}${res?.stderr ?? ''}`; }

// ---------------------------------------------------------------- 用例结构

/**
 * 统一用例对象。
 * - check(label, ok, actual, expected)：一条核对项，expected 逐字来自需求 Then/机检。
 * - block(label, reason)：观测不到 → 阻塞（必须写明需求要求 / 已试路径 / 为何观测不到）。
 * - grade：证据分级；用例可按面覆写，finish 时阻塞强制改为「阻塞」。
 */
export function makeCase(ac, { title = '', face = '夹具', grade = 'mock 实测' } = {}) {
  const r = req(ac);
  return {
    ac,
    title: title || r?.title || '',
    face,
    grade,
    verdict: null,
    checks: [],
    evidence: [],
    notes: [],
    commands: [],
    roots: [],
    testRuns: [],
    arch: [],
    frame: null,
    startedAt: iso(),
    add(root) { if (root && !this.roots.includes(root)) this.roots.push(root); return root; },
    note(msg) { this.notes.push(String(msg)); return this; },
    check(label, ok, actual = null, expected = null) {
      this.checks.push({
        text: String(label),
        ok: Boolean(ok),
        blocked: false,
        actual: actual === null || actual === undefined ? null : String(actual).slice(0, 6000),
        expected: expected === null || expected === undefined ? null : String(expected).slice(0, 6000)
      });
      return Boolean(ok);
    },
    block(label, reason) {
      this.checks.push({
        text: String(label), ok: false, blocked: true,
        actual: String(reason ?? '无法在夹具上观测').slice(0, 6000), expected: null
      });
      return false;
    },
    eq(label, actual, expected) {
      return this.check(`${label}（期望逐字 ${JSON.stringify(expected)}）`, Object.is(actual, expected), JSON.stringify(actual), JSON.stringify(expected));
    },
    includes(label, haystack, needle) {
      return this.check(`${label}（期望含 ${JSON.stringify(needle)}）`, String(haystack).includes(needle), String(haystack).slice(0, 4000), String(needle));
    },
    notIncludes(label, haystack, needle) {
      return this.check(`${label}（期望不含 ${JSON.stringify(needle)}）`, !String(haystack).includes(needle), String(haystack).slice(0, 4000), String(needle));
    },
    matches(label, haystack, re) {
      return this.check(`${label}（期望匹配 ${re}）`, re.test(String(haystack)), String(haystack).slice(0, 4000), String(re));
    },
    cmd(res, label = null) {
      if (!res) return res;
      this.commands.push({
        label: label ?? res.label ?? null,
        cmd: res.cmd ?? null, argv: res.argv ?? null, cwd: res.cwd ?? null,
        exit: res.exit ?? res.exitCode ?? null, timedOut: Boolean(res.timedOut),
        durationMs: res.durationMs ?? 0, stdout: res.stdout ?? '', stderr: res.stderr ?? ''
      });
      return res;
    },
    /** 追加一份「断言时刻」的原始快照（state / events 之外的中间态）。 */
    snap(label, doc) {
      const E = evidenceDir(this.ac);
      const p = path.join(E, `${this.ac}.${label}.json`);
      fs.writeFileSync(p, JSON.stringify(doc ?? null, null, 2) + '\n', 'utf8');
      this.evidence.push(p);
      return p;
    }
  };
}

/** 收敛三档：任一阻塞 → 阻塞；否则全部通过且非空 → 通过；其余 → 不通过。 */
export function summarize(c) {
  const checks = c.checks ?? [];
  const blocked = checks.filter((x) => x.blocked);
  const failed = checks.filter((x) => !x.ok && !x.blocked);
  let verdict = '不通过';
  if (checks.length === 0) verdict = '阻塞';
  else if (blocked.length > 0) verdict = '阻塞';
  else if (failed.length === 0) verdict = '通过';
  return { verdict, pass: verdict === '通过', total: checks.length, ok: checks.filter((x) => x.ok).length, failed, blocked };
}

// ---------------------------------------------------------------- 机检 / 架构检查执行

/**
 * F-16 形态机检：test -f test/wp14/<file> && NODE_ENV=test node --test test/wp14/<file>。
 * 保留整文件原始 stdout，返回 {file, cmd, exit, timedOut, tap, v, raw, subtests, labeled}。
 */
export function runTestFile(ac, file, { tmpdir, attempts = 1 } = {}) {
  const cmd = `test -f test/wp14/${file} && NODE_ENV=test node --test test/wp14/${file}`;
  const E = evidenceDir(ac);
  let last = null;
  for (let i = 1; i <= attempts; i++) {
    const r = runCmd(cmd, { tmpdir, timeoutMs: 180_000 });
    const v = f16Verdict(r);
    const raw = `${r.stdout}${r.stderr ? `\n--- STDERR ---\n${r.stderr}` : ''}`;
    writeText(path.join(E, `${ac}.${file.replace(/\.test\.js$/, '')}.attempt-${i}.log`), raw);
    last = {
      file, cmd, attempt: i, exit: r.exit, timedOut: r.timedOut,
      durationMs: r.durationMs, tap: v.tap, v, raw,
      subtests: v.tap.subtests,
      labeled: v.tap.subtests.filter((n) => n.includes(ac))
    };
    c_note_safe(ac, `${file} 第 ${i} 次机检 exit=${r.exit} / # pass ${v.tap.pass} / # fail ${v.tap.fail}`);
    if (v.ok || r.timedOut) break;
  }
  // 稳定主日志（test-stdout 由 saveEvidence 从 testRuns 汇总）
  writeText(path.join(E, `${ac}.${file.replace(/\.test\.js$/, '')}.log`), last.raw);
  writeJson(path.join(E, `${ac}.${file.replace(/\.test\.js$/, '')}.tap.json`), {
    ac, file, cmd: last.cmd, exit: last.exit, durationMs: last.durationMs,
    timedOut: last.timedOut, tap: last.tap, f16: {
      exitOk: last.v.exitOk, passAtLeastOne: last.v.passAtLeastOne,
      failZero: last.v.failZero, fileMissing: last.v.fileMissing, ok: last.v.ok
    }, labeled: last.labeled
  });
  return last;
}
function c_note_safe(_ac, _msg) { /* 预留：逐次复跑注记由用例自行 note，避免耦合 */ }

/**
 * 按需求 §3.1 同号架构检查执行命令。
 * expect: 1 = 零命中(exit 1)，0 = 有命中，null = 留证不判。
 */
export function runArch(ac, index, spec, { tmpdir } = {}) {
  const r = runCmd(spec.cmd, { tmpdir, timeoutMs: 60_000 });
  const out = `${r.stdout}${r.stderr ? `\n--- STDERR ---\n${r.stderr}` : ''}`.trimEnd();
  const E = evidenceDir(ac);
  writeText(path.join(E, `${ac}.arch-${index}.log`), out + '\n');
  const lines = countLines(out);
  let ok = spec.expect === null ? true : r.exit === spec.expect;
  if (spec.lines != null) ok = ok && lines === spec.lines;
  if (spec.contains != null) ok = ok && out.includes(spec.contains);
  if (spec.notContains != null) ok = ok && !out.includes(spec.notContains);
  return {
    index, cmd: spec.cmd, note: spec.note, expect: spec.expect, exit: r.exit,
    lines, stdout: out, contains: spec.contains ?? null,
    expectLines: spec.lines ?? null, ok, informational: spec.expect === null
  };
}

// ---------------------------------------------------------------- 落盘

export function ensureParts() { ensureDir(PARTS); }

/** Then 原文逐条登记；成立与否绑定机检+架构检查的独立复核结论（不写死 true）。 */
export function thenChecks(c) {
  const machineOk = c.testRuns.length > 0
    && c.testRuns.every((t) => t.v.ok)
    && c.arch.every((a) => a.ok || a.informational);
  const r = req(c.ac);
  (r?.then ?? []).forEach((line, i) => {
    c.check(`Then #${i + 1}（逐字，机检 + 架构检查复核）`, machineOk, line, line);
  });
  return machineOk;
}

/**
 * 机检 + 架构检查的通用执行与核对项登记：
 * - 每个点名测试文件先 test -f 再 node --test（判定口径 5）：exit 0 / # pass≥1 / # fail 0；
 * - 每条架构检查按需求同号原文命令执行（expect 1=零命中，0=有命中，null=留证）；
 * - 测试文件未命名本 AC 时追加 AC 级隔离机检（判定口径 5 的「文件存在再运行」已满足）。
 */
export function machineChecks(c, { files = [], arch = [], tmpdir } = {}) {
  for (const file of files) {
    const t = runTestFile(c.ac, file, { tmpdir });
    c.testRuns.push(t);
    c.cmd({ cmd: t.cmd, cwd: REPO, exit: t.exit, stdout: t.raw, durationMs: t.durationMs, timedOut: t.timedOut }, `机检 ${file}`);
    c.check(`机检 ${file}：test -f 前置断言（文件存在）`, !t.v.fileMissing, `exit=${t.exit}；stderr=${String(t.raw).slice(-300)}`);
    c.check(`机检 ${file}：exit 0`, t.v.exitOk, `实际 exit=${t.exit}${t.timedOut ? '（超时）' : ''}`);
    c.check(`机检 ${file}：# pass ≥ 1`, t.v.passAtLeastOne, `# pass ${t.tap.pass} / # tests ${t.tap.tests}`);
    c.check(`机检 ${file}：# fail 0`, t.v.failZero, `# fail ${t.tap.fail}${t.tap.notOk.length ? `；not ok: ${t.tap.notOk.join(' / ')}` : ''}`);
    c.note(`机检 ${file}：# tests ${t.tap.tests} / # pass ${t.tap.pass} / # fail ${t.tap.fail} / # skipped ${t.tap.skipped}；带本 AC 编号用例 ${t.labeled.length} 条。`);
  }
  for (let i = 0; i < arch.length; i++) {
    const a = runArch(c.ac, i + 1, arch[i], { tmpdir });
    c.arch.push(a);
    const expectText = a.expect === null ? '留证不判' : `exit ${a.expect}${a.lines != null ? ` / 恰好 ${a.lines} 行` : ''}${a.contains ? ` / 含「${a.contains}」` : ''}`;
    c.check(`架构检查 #${a.index}：${a.note}`, a.ok, `\`${a.cmd}\` → ${expectText}；实测 exit ${a.exit} / ${a.lines} 行`, a.expect === null ? a.stdout.slice(0, 300) : `exit ${a.expect}`);
  }
}

function rel(p) { return path.relative(REPO, p).split(path.sep).join('/'); }
function mdCell(s, n = 280) { return String(s ?? '').replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').slice(0, n); }

/** 写一份统一 meta（判定 / 证据分级 / HEAD / 时间 / 命令 / 备注）。 */
function buildMeta(c, sum) {
  return {
    ac: c.ac, title: c.title, face: c.face,
    verdict: sum.verdict,
    evidenceLevel: sum.verdict === '阻塞' ? '阻塞' : c.grade,
    head: gitHead(),
    startedAt: c.startedAt, finishedAt: iso(),
    platform: process.platform, node: process.version,
    repo: REPO, base: BASE, env: { NODE_ENV: 'test' },
    roots: c.roots,
    checks: { total: sum.total, ok: sum.ok, failed: sum.failed.length, blocked: sum.blocked.length },
    testRuns: c.testRuns.map((t) => ({ file: t.file, exit: t.exit, timedOut: t.timedOut, tap: {
      tests: t.tap.tests, pass: t.tap.pass, fail: t.tap.fail, skipped: t.tap.skipped
    }, labeled: t.labeled })),
    arch: c.arch.map((a) => ({ index: a.index, cmd: a.cmd, expect: a.expect, exit: a.exit, ok: a.ok })),
    notes: c.notes,
    source: `docs/iterations/iteration-11/requirement.md §3.1 ${c.ac}`
  };
}

/** finish：evidence 五件套 → parts → results。返回 summarize。 */
export function finish(c, extra = {}) {
  const sum = summarize(c);
  c.verdict = sum.verdict;
  const E = evidenceDir(c.ac);

  // test-stdout：汇总所有机检原始 stdout（含 stderr 分节）
  const stdoutText = c.testRuns.length
    ? c.testRuns.map((t) => `===== ${t.file} (exit ${t.exit}) =====\n${t.raw}`).join('\n\n')
    : (c.commands.length
      ? c.commands.map((x) => `$ ${x.cmd || (x.argv || []).join(' ')}\n${x.stdout || ''}${x.stderr ? `\n--- stderr ---\n${x.stderr}` : ''}`).join('\n\n')
      : '（无机检 stdout）');
  fs.writeFileSync(path.join(E, `${c.ac}.test-stdout.txt`), stdoutText + '\n', 'utf8');

  // state：原始帧（意图 / 队列投影 / state 快照等），至少为一个对象
  const frame = c.frame ?? {
    ac: c.ac,
    note: '本 AC 为机检型，原始帧见同名 *.log / *.tap.json / arch-*.log；此对象为占位索引。',
    testRuns: c.testRuns.map((t) => ({ file: t.file, exit: t.exit, tap: t.tap }))
  };
  fs.writeFileSync(path.join(E, `${c.ac}.state.json`), JSON.stringify(frame, null, 2) + '\n', 'utf8');

  // meta：判定 + 证据分级
  fs.writeFileSync(path.join(E, `${c.ac}.meta.json`), JSON.stringify(buildMeta(c, sum), null, 2) + '\n', 'utf8');

  // check：核对项逐条 + 期望值逐字
  fs.writeFileSync(path.join(E, `${c.ac}.check.json`), JSON.stringify({
    ac: c.ac, verdict: sum.verdict, evidenceLevel: sum.verdict === '阻塞' ? '阻塞' : c.grade,
    requirement: req(c.ac),
    checks: c.checks
  }, null, 2) + '\n', 'utf8');

  // output：全部命令原始 stdout/stderr
  fs.writeFileSync(path.join(E, `${c.ac}.output.json`), JSON.stringify({
    ac: c.ac, commands: c.commands, testRuns: c.testRuns.map((t) => ({
      file: t.file, cmd: t.cmd, exit: t.exit, raw: t.raw, tap: t.tap
    })), arch: c.arch
  }, null, 2) + '\n', 'utf8');

  const files = ['test-stdout.txt', 'state.json', 'meta.json', 'check.json', 'output.json'].map((n) => path.join(E, `${c.ac}.${n}`));
  for (const f of files) if (!c.evidence.includes(f)) c.evidence.push(f);

  writePart(c, sum);
  appendResult(c, sum, { ...extra });
  return sum;
}

/** 写 probe/acc11-f-parts/<AC>.md（final 直接拼接该节）。 */
export function writePart(c, sum = summarize(c)) {
  ensureParts();
  const r = req(c.ac);
  const cmdLines = c.commands.map((x) => `${x.label ? `[${x.label}] ` : ''}${x.cmd || (x.argv || []).join(' ')} | exit=${x.exit ?? '-'} | ${x.durationMs ?? 0}ms`);
  for (const t of c.testRuns) cmdLines.push(`[机检] ${t.cmd} | exit=${t.exit} | # pass ${t.tap.pass} / # fail ${t.tap.fail} | ${t.durationMs}ms`);
  for (const a of c.arch) cmdLines.push(`[架构#${a.index}] ${a.cmd} | 期望 exit ${a.expect} / 实测 exit ${a.exit}`);
  const evRows = c.evidence.map((f) => {
    let bytes = 0;
    try { bytes = fs.statSync(f).size; } catch { /* ignore */ }
    return `| \`${rel(f)}\` | ${bytes} B |`;
  });
  const checkRows = c.checks.map((x, i) => {
    const mark = x.blocked ? '⛔ 阻塞' : x.ok ? '✅' : '❌';
    return `| ${i + 1} | ${mdCell(x.text, 200)} | ${mark} | \`${mdCell(x.actual, 220)}\` | \`${mdCell(x.expected, 220)}\` |`;
  });
  const md = [
    `#### ${c.ac} ${c.title}`.trim(), '',
    `- 判定：**${sum.verdict}**（核对 ${sum.ok}/${sum.total} 通过${sum.blocked.length ? `，阻塞 ${sum.blocked.length}` : ''}${sum.failed.length ? `，不通过 ${sum.failed.length}` : ''}）`,
    `- 证据分级：**${sum.verdict === '阻塞' ? '阻塞' : c.grade}**`,
    `- 验证面：${c.face}`,
    `- 项目根：${c.roots.length ? c.roots.map((x) => '`' + x + '`').join('、') : '（机检型，独立 TMPDIR 见 meta）'}`,
    '', '**① 需求原文（Given / When / Then，逐字）**', '', '```gherkin',
    r ? `- Given ${r.given}` : '（未抽取到）',
    r ? `- When ${r.when}` : '',
    ...((r?.then ?? []).map((t) => `- Then ${t}`)), '', '```',
    r?.jijian ? ['', `**机检原文**：${r.jijian}`, ''] : [],
    r?.archText ? [`**架构检查原文**：${r.archText}`, ''] : [],
    '**② 命令与退出码（原始帧见证据清单）**', '', '```', ...(cmdLines.length ? cmdLines : ['（无命令）']), '```', '',
    '**③ 证据文件清单**', '',
    evRows.length ? ['| 文件 | 大小 |', '|---|---|', ...evRows].join('\n') : '（未落盘）', '',
    '**④ 逐项核对表**', '',
    checkRows.length ? ['| # | 核对项 | 结果 | 实测 | 期望（逐字） |', '|---|---|---|---|---|', ...checkRows].join('\n') : '（无核对项）', '',
    ...(c.notes.length ? ['**备注**', '', ...c.notes.map((n) => `- ${n}`), ''] : []),
    `**⑤ 判定**：${sum.verdict}`, '', '---', ''
  ].join('\n');
  fs.writeFileSync(path.join(PARTS, `${c.ac}.md`), md, 'utf8');
  return md;
}

/** 追加 probe/acc11-f-results.jsonl（一行一条 AC；final 取最后一条）。 */
export function appendResult(c, sum = summarize(c), extra = {}) {
  const line = {
    ac: c.ac, title: c.title, face: c.face,
    verdict: sum.verdict,
    evidenceLevel: sum.verdict === '阻塞' ? '阻塞' : c.grade,
    pass: sum.pass, total: sum.total, ok: sum.ok,
    failed: sum.failed.map((x) => ({ text: x.text, actual: x.actual })),
    blocked: sum.blocked.map((x) => ({ text: x.text, actual: x.actual })),
    checks: c.checks.map((x) => ({ text: x.text, ok: x.ok, blocked: Boolean(x.blocked) })),
    evidence: c.evidence.map(rel),
    notes: c.notes,
    testRuns: c.testRuns.map((t) => ({ file: t.file, exit: t.exit, fail: t.tap.fail, pass: t.tap.pass })),
    at: iso(),
    ...extra
  };
  appendLine(RESULTS, JSON.stringify(line));
  return sum;
}
