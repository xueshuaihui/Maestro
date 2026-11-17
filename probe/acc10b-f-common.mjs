// I1.10b S3 批次 a 验收 —— 动作与断言辅助 / parts 与 results 落盘。
// 用例只用这里的原语：makeCase → check/eq/includes/matches/block → finish(c)。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, NODE, ORCH, DRIVER, PURITY_CHECK, TEST_DIR, REQUIREMENT, DECISIONS,
  BASE, EVID, PARTS, RESULTS, SUMMARY, BLOCKERS, REPORT, CASES_DIR, ACC10B_PATHS, WORDS_31,
  ensureDir, exists, sleep, sha256, sha256File, fileInfo, writeText, writeJson, readJson,
  freshRoot, baseEnv, runCmd, runBash, parseTap, f16Verdict, runNodeTest, grepCheck,
  renderArchFrame, requirementBlocks, requirementTitle, requirementThen, requirementGivenWhenThen,
  lastResults, saveEvidence, countLines, coreStop, forceKillCore, iso
} from './acc10b-f-lib.mjs';

export {
  REPO, NODE, ORCH, DRIVER, PURITY_CHECK, TEST_DIR, REQUIREMENT, DECISIONS,
  BASE, EVID, PARTS, RESULTS, SUMMARY, BLOCKERS, REPORT, CASES_DIR, ACC10B_PATHS, WORDS_31,
  ensureDir, exists, sleep, sha256, sha256File, fileInfo, writeText, writeJson, readJson,
  freshRoot, baseEnv, runCmd, runBash, parseTap, f16Verdict, runNodeTest, grepCheck,
  renderArchFrame, requirementBlocks, requirementTitle, requirementThen, requirementGivenWhenThen,
  lastResults, saveEvidence, countLines, coreStop, forceKillCore, iso
};

export function ensureParts() { fs.mkdirSync(PARTS, { recursive: true }); }
export function text(res) { return `${res?.stdout ?? ''}${res?.stderr ?? ''}`; }
export function lines(t) { return String(t).split('\n'); }
export function grepCount(t, re) { return lines(t).filter((l) => re.test(l)).length; }
export function nonEmpty(t) { return lines(t).filter((l) => l.trim().length > 0); }

/** 断言机检文件 F-16：文件存在 + exit 0 + # pass≥1 + # fail 0；任一不满足判红。 */
export function checkF16(c, t, label = '机检 F-16') {
  c.check(`${label}：测试文件存在`, Boolean(t.fileExists), `test/wp14/${t.file}`);
  c.check(`${label}：exit 0`, t.res.exitCode === 0, `exit=${t.res.exitCode}`);
  c.check(`${label}：# pass ≥ 1`, t.f16.tap.pass >= 1, `# pass=${t.f16.tap.pass}`);
  c.check(`${label}：# fail 0`, t.f16.tap.fail === 0, `# fail=${t.f16.tap.fail}`);
  c.check(`${label}：无 not ok`, (t.f16.tap.notOk ?? []).length === 0, (t.f16.tap.notOk ?? []).join(' | ') || '无');
  return t.f16.ok;
}

/** 断言一组架构检查全部符合需求期望。 */
export function checkArch(c, checks) {
  for (const x of checks) {
    c.check(`架构：${x.label}（expect=${x.expect}）`, x.ok, `exit=${x.exitCode} hits=${x.hits}${x.lines.length ? ' | ' + x.lines.slice(0, 3).join(' ; ') : ''}`);
  }
  return checks.every((x) => x.ok);
}

// ---------------------------------------------------------------- 用例结构

/**
 * 统一用例：{ac,title,face,verdict,checks[],evidence[],frames[],notes[],commands[],roots[]}。
 * check(text, ok, actual) 收一条核对项；block(text, reason) 记「阻塞」（无法在夹具上观测）。
 */
export function makeCase(ac, { title = '', face = 'mock 实测', root = null } = {}) {
  const c = {
    ac,
    title: title || requirementTitle(ac),
    face,
    token: currentToken(),
    verdict: null,
    checks: [],
    evidence: [],
    frames: [],
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
    deepEq(label, actual, expected) {
      return this.check(`${label}（期望 ${JSON.stringify(expected)}）`, JSON.stringify(actual) === JSON.stringify(expected), JSON.stringify(actual));
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
        cmd: res.cmd ?? null,
        cwd: res.cwd ?? null,
        exitCode: res.exitCode ?? null,
        timedOut: Boolean(res.timedOut),
        durationMs: res.durationMs ?? 0,
        stdout: res.stdout ?? '',
        stderr: res.stderr ?? ''
      });
      return res;
    },
    /** 追加一份原始帧：AC-XX.<name>.<ext>，保证非空由 saveEvidence 兜底。 */
    frame(name, ext, frameText) {
      this.frames.push({ name, ext, text: String(frameText ?? '') });
      return frameText;
    },
    /** 把给定项目根下的 state/events 原样读成帧（多实例带标记）。 */
    stateFrames(root, { id = 'INST-001' } = {}) {
      const sp = path.join(root, '.orch', 'instances', id, 'state.json');
      const ep = path.join(root, '.orch', 'instances', id, 'events.jsonl');
      const s = exists(sp) ? fs.readFileSync(sp, 'utf8') : JSON.stringify({ __note: '本 AC 走纯投影/机检面，无落盘实例 state', ac: this.ac }, null, 2);
      const e = exists(ep) ? fs.readFileSync(ep, 'utf8') : JSON.stringify({ __note: '本 AC 无落盘事件帧', ac: this.ac }) + '\n';
      this.frame('state', 'json', s);
      this.frame('events', 'jsonl', e);
      return { s, e };
    },
    noteFixture(label, detail = '') {
      this.commands.push({
        label: `夹具：${label}`, argv: [`(fixture) ${label}`], cwd: REPO,
        exitCode: 0, durationMs: 0, stdout: String(detail), stderr: ''
      });
    }
  };
  if (root) c.add(root);
  return c;
}

/** 三档收敛：任一阻塞 → 阻塞；否则全通过且非空 → 通过；其余 → 不通过。 */
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

// ---------------------------------------------------------------- parts / results

function rel(p) { return path.relative(REPO, p).split(path.sep).join('/'); }
function mdCell(s, n = 240) { return String(s ?? '').replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').slice(0, n); }

export function writePart(c) {
  ensureParts();
  const sum = summarize(c);
  const gwt = requirementGivenWhenThen(c.ac);
  const title = c.title || requirementTitle(c.ac) || '';

  const cmdLines = (c.commands ?? []).map((cmd) => {
    const argv = (cmd.argv ?? []).map((a) => (String(a).includes(' ') ? JSON.stringify(a) : a)).join(' ');
    return `${cmd.label ? `[${cmd.label}] ` : ''}${argv || cmd.cmd || ''}   | cwd=${cmd.cwd} | exit=${cmd.exitCode ?? '-'} | ${cmd.durationMs ?? 0}ms`;
  });

  const evRows = (c.evidence ?? []).filter((f) => fs.existsSync(f)).map((f) => {
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
    `- 项目根：${c.roots.length ? c.roots.map((r) => '`' + r + '`').join('、') : '（纯投影机检面，独立根见 meta.json）'}`,
    '', '**① 完整命令（逐条可复跑）**', '', '```', ...(cmdLines.length ? cmdLines : ['（无命令）']), '```', '',
    `> 每条命令 stdout+stderr 全文见 \`${rel(path.join(EVID, `${c.ac}.tests.stdout.txt`))}\`；架构原始帧见 \`${rel(path.join(EVID, `${c.ac}.arch.stdout.txt`))}\`。`, '',
    '**② 需求原文（Given / When / Then，逐字）**', '', '```gherkin', ...(gwt.length ? gwt : ['（未抽取到，见 requirement.md §3.1）']), '```', '',
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

let CASE_TOKEN = Symbol('case');
export function newToken() { CASE_TOKEN = Symbol('case'); return CASE_TOKEN; }
export function currentToken() { return CASE_TOKEN; }

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
