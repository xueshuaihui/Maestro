// A1 验收 —— 断言原语 / 用例结构 / parts 与 results 落盘 / mock 夹具 / 注入接缝。
// 用例只用这里的原语：makeCase 收集核对项 → finish(c) 落 evidence + parts + results。
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  REPO, NODE, ORCH, BASE, EVID, REPORT, BLOCKERS, PARTS, RESULTS, SUMMARY,
  REQUIREMENT, EVIDENCE_LEVELS, VERDICTS,
  ensureDir, exists, sleep, freshRoot, baseEnv, runCmd, orch, readJson, countLines,
  sha256File, fileInfo, text, rel, evidenceLevel, saveEvidence
} from './accA1-f-lib.mjs';

export {
  REPO, NODE, ORCH, BASE, EVID, REPORT, BLOCKERS, PARTS, RESULTS, SUMMARY,
  REQUIREMENT, EVIDENCE_LEVELS, VERDICTS,
  ensureDir, exists, sleep, freshRoot, baseEnv, runCmd, orch, readJson, countLines,
  sha256File, fileInfo, text, rel, evidenceLevel, saveEvidence
};

export const ACC_A1_PATHS = {
  REPO, BASE, EVID, REPORT, BLOCKERS, PARTS, RESULTS, SUMMARY, REQUIREMENT, ORCH
};

export function ensureParts() { fs.mkdirSync(PARTS, { recursive: true }); }
export function lines(t) { return String(t).split('\n'); }
export function grepCount(t, re) { return lines(t).filter((l) => re.test(l)).length; }
export function readRegistry(root) {
  return readJson(path.join(root, '.orch', 'cli-registry.json'));
}

// ---------------------------------------------------------------- 需求原文（A1 格式）
// A1 需求用 **AC-XX · 标题** + `- **Given/When/Then** ...`，不是 gherkin fence。
function requirementSource() {
  try { return fs.readFileSync(REQUIREMENT, 'utf8'); } catch { return ''; }
}
export function requirementTitle(ac) {
  const m = new RegExp(`^\\*\\*${ac}\\s*·\\s*([^*\\n]+?)\\*\\*`, 'm').exec(requirementSource());
  return m ? m[1].trim() : '';
}
export function requirementLines(ac) {
  const src = requirementSource();
  const head = new RegExp(`^\\*\\*${ac}\\s*·[^*\\n]+\\*\\*`, 'm').exec(src);
  if (!head) return [];
  const rest = src.slice(head.index + head[0].length);
  const next = /^### |^## |^\*\*AC-\d{2}\s*·/m.exec(rest);
  const body = next ? rest.slice(0, next.index) : rest;
  const out = [];
  for (const line of body.split('\n')) {
    const m = /^-\s+\*\*(Given|When|Then|And)\*\*\s+(.+)$/.exec(line.trim());
    if (m) out.push(`${m[1]} ${m[2].trim()}`);
  }
  return out;
}

// ---------------------------------------------------------------- mock 夹具（复用 test/wp16 手法）
/** 只应答 --version 的可执行（发现 + 版本维度），shell shebang。 */
export function versionAgent(root, name = 'codex', versionText = 'codex 1.2.3') {
  fs.mkdirSync(root, { recursive: true });
  const p = path.join(root, name);
  fs.writeFileSync(p, `#!/bin/sh\necho "${versionText}"\n`, 'utf8');
  fs.chmodSync(p, 0o755);
  return p;
}
/** 应答 --version 且用 NDJSON 回答 ACP initialize 的模拟 agent（P-5 / A1-10）。 */
export function speakingAgent(root, name = 'codex-mock', versionText = 'codex 1.2.3') {
  fs.mkdirSync(root, { recursive: true });
  const p = path.join(root, name);
  const NL = String.fromCharCode(10);
  const ls = [
    `#!${NODE}`,
    'const a = process.argv.slice(2);',
    'if (a.includes("--acp")) {',
    '  process.stdin.setEncoding("utf8");',
    '  let buf = "";',
    '  process.stdin.on("data", (c) => {',
    `    buf += c; for (const line of buf.split(${JSON.stringify(NL)})) {`,
    '      if (!line.trim()) continue;',
    '      try { const m = JSON.parse(line); if (m.method === "initialize") {',
    '        process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result:{',
    '          protocolVersion:1,capabilities:{session:true},',
    '          sessionCapabilities:["close","list","resume"]}})' + ' + ' + JSON.stringify(NL) + ');',
    '      } } catch (e) {}',
    '    }',
    '  });',
    '  setTimeout(() => process.exit(0), 200);',
    '} else {',
    `  process.stdout.write(${JSON.stringify(versionText + NL)});`,
    '}'
  ];
  fs.writeFileSync(p, ls.join(NL), 'utf8');
  fs.chmodSync(p, 0o755);
  return p;
}
/** 卡死不响应的 CLI（A1-13 超时取证用）：--version 起一个长 timer。 */
export function hangingAgent(root, name = 'hung') {
  fs.mkdirSync(root, { recursive: true });
  const p = path.join(root, name);
  // 绝对路径 node shebang：不依赖隔离后的 PATH；定时器模拟卡死，忽略 --version/--acp 参数。
  fs.writeFileSync(p, `#!${NODE}\nsetTimeout(() => {}, 20000);\n`, 'utf8');
  fs.chmodSync(p, 0o755);
  return p;
}

/**
 * 适配器注入接缝（P-3）：子进程里调 discoverAgentClis(options)，可选写入注册表。
 * 用于隔离单一来源（appDirs / npmGlobalRoot / home / pathEntries），命令面无法注入这些参数。
 * options 必须 JSON 可序列化（不注入 clock；扫描时间用真实时钟）。
 */
export function injectedScan(root, options, opts = {}) {
  const idxUrl = pathToFileURL(path.join(REPO, 'src', 'adapter', 'cli-discovery', 'index.js')).href;
  const code = [
    `const idx = await import(${JSON.stringify(idxUrl)});`,
    `const scan = idx.discoverAgentClis(${JSON.stringify(options)});`,
    opts.writeRegistry ? `await idx.saveCliRegistry(process.cwd(), scan, { userConfig: ${JSON.stringify(options.userConfig ?? [])} });` : '',
    'process.stdout.write(JSON.stringify(scan));'
  ].filter(Boolean).join('\n');
  return runCmd([NODE, '--input-type=module', '-e', code], {
    cwd: root, env: baseEnv(opts.env ?? {}), label: 'injected discoverAgentClis'
  });
}
export function noteFixture(c, label, detail = '') {
  c.commands.push({
    label: `夹具：${label}`, argv: [`(fixture) ${label}`], cwd: null,
    exitCode: 0, durationMs: 0, stdout: String(detail), stderr: ''
  });
}

// ---------------------------------------------------------------- 用例结构
/**
 * 统一用例：{ac,title,face,phase,evidenceLevel,verdict,checks[],evidence[],notes[],commands[],roots[],mid}。
 * check(text, ok, actual) 收一条核对项；block(text, reason) 记「阻塞」（无法在夹具上观测）。
 */
export function makeCase(ac, { title = '', face = 'mock 面', phase = 'flow', level = 'mock' } = {}) {
  return {
    ac,
    title: title || requirementTitle(ac),
    face,
    phase,
    evidenceLevel: evidenceLevel(level),
    token: currentToken(),
    verdict: null,
    checks: [],
    evidence: [],
    notes: [],
    commands: [],
    roots: [],
    mid: null,
    registryDoc: null,
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
    /** 落一份阶段快照到 evidence/AC-XX.<label>.json（原始帧，非「已确认」）。 */
    snap(label, data) {
      ensureDir(EVID);
      const p = path.join(EVID, `${this.ac}.${label}.json`);
      fs.writeFileSync(p, JSON.stringify(data ?? null, null, 2) + '\n', 'utf8');
      this.evidence.push(p);
      return p;
    }
  };
}

/** 收敛三档：任一阻塞 → 阻塞；否则全通过且非空 → 通过；其余 → 不通过。 */
export function summarize(c) {
  const checks = c.checks ?? [];
  const blocked = checks.filter((x) => x.blocked);
  const failed = checks.filter((x) => !x.ok && !x.blocked);
  let verdict = VERDICTS.FAIL;
  if (checks.length === 0) verdict = VERDICTS.BLOCK;
  else if (blocked.length > 0) verdict = VERDICTS.BLOCK;
  else if (failed.length === 0) verdict = VERDICTS.PASS;
  return {
    verdict,
    pass: verdict === VERDICTS.PASS,
    total: checks.length,
    ok: checks.filter((x) => x.ok).length,
    failed,
    blocked
  };
}

// ---------------------------------------------------------------- parts / results
function mdCell(s, n = 240) { return String(s ?? '').replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').slice(0, n); }

export function writePart(c) {
  ensureParts();
  const sum = summarize(c);
  const thenLines = requirementLines(c.ac);
  const title = c.title || requirementTitle(c.ac) || '';
  const cmdLines = (c.commands ?? []).map((cmd) => {
    const argv = (cmd.argv ?? []).map((a) => (String(a).includes(' ') ? JSON.stringify(a) : a)).join(' ');
    return `${cmd.label ? `[${cmd.label}] ` : ''}${argv}   | cwd=${cmd.cwd} | exit=${cmd.exitCode ?? '-'} | ${cmd.durationMs ?? 0}ms`;
  });
  const evRows = (c.evidence ?? []).map((f) => `| \`${rel(f)}\` | ${fileInfo(f).bytes} B |`);
  const checkRows = (c.checks ?? []).map((x, i) => {
    const mark = x.blocked ? '⛔ 阻塞' : x.ok ? '✅' : '❌';
    const actual = x.actual === null ? '—' : `\`${mdCell(x.actual, 260)}\``;
    return `| ${i + 1} | ${mdCell(x.text, 200)} | ${mark} | ${actual} |`;
  });
  const md = [
    `#### ${c.ac} ${title}`.trim(), '',
    `- 判定：**${sum.verdict}**（核对 ${sum.ok}/${sum.total} 通过${sum.blocked.length ? `，阻塞 ${sum.blocked.length}` : ''}）`,
    `- 验证面：${c.face}`,
    `- 证据分级：**${c.evidenceLevel}**`,
    `- 项目根：${c.roots.length ? c.roots.map((r) => '`' + r + '`').join('、') : '（无）'}`,
    '', '**① 完整命令（逐条可复跑）**', '', '```', ...(cmdLines.length ? cmdLines : ['（无命令）']), '```', '',
    `> 每条命令 stdout+stderr 原始帧见 \`${rel(path.join(EVID, `${c.ac}.${c.phase || 'flow'}.stdout.txt`))}\` 与 \`...output.json\`。`, '',
    '**② 需求原文（Given / When / Then，逐字）**', '', '```', ...(thenLines.length ? thenLines : ['（未抽取到，见 requirement.md §3.1）']), '```', '',
    '**③ 实测证据文件清单**', '',
    evRows.length ? ['| 文件 | 大小 |', '|---|---|', ...evRows].join('\n') : '（未落盘）', '',
    '**④ 逐项核对表**', '',
    checkRows.length ? ['| # | 核对项 | 结果 | 实测 |', '|---|---|---|---|', ...checkRows].join('\n') : '（无用例核对项）', '',
    `**⑤ 判定**：${sum.verdict}　|　**证据分级**：${c.evidenceLevel}`, '',
    ...(c.notes.length ? ['**备注**', '', ...c.notes.map((n) => `- ${n}`), ''] : []),
    '---', ''
  ].join('\n');
  fs.writeFileSync(path.join(PARTS, `${c.ac}.md`), md, 'utf8');
  return md;
}

export function appendResult(c) {
  ensureParts();
  const sum = summarize(c);
  fs.appendFileSync(RESULTS, JSON.stringify({
    ac: c.ac,
    title: c.title || requirementTitle(c.ac),
    face: c.face,
    phase: c.phase || 'flow',
    evidenceLevel: c.evidenceLevel,
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

/** 一条 AC 的收尾：evidence → parts → results（立即落盘，防中断丢成果）。 */
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
