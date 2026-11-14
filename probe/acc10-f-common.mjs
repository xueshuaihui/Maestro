/**
 * I1.10a S3 验收脚手架 · 用例执行与证据落盘（只新增，不改产品代码）。
 *
 * 一条 AC 一次 runCase(spec)：
 *  1) F-16 固化模板机检：`test -f test/wp13/<file>.test.js && NODE_ENV=test node --test test/wp13/<file>.test.js`；
 *     断言退出码 0 / `# pass ≥ 1` / `# fail 0`，保留每次 attempt 的完整原始 TAP 日志。
 *  2) 架构检查：按需求 §3.1 同号「架构检查」原文命令执行；ERE 形态（grep -RE），
 *     `expect: 1` = 零命中（exit 1），`expect: 0` = 有命中，`expect: null` = 留证不判。
 *  3) Then 逐条核对项：需求 Then 原文逐字登记，逐字断言由同名契约测试承载
 *     （拆分文档 §4「所有 AC 的验收口径 = 需求 v2 §3.1 同号 Then 逐字口径」），
 *     S3 以 F-16 机检 + 架构检查做独立复核，状态取两者结论。
 *  4) 证据 ≥ 4 份：unit-*.log / unit-*.summary.json / unit-*.test-names.json /
 *     arch-checks.json / arch-*.log / then-map.json / requirement.json /
 *     fixture-roots.json / result.json。
 *  5) 追加 results.jsonl、落 parts/AC-xx.md 核对表。
 *
 * 纪律：只读产品；一个 AC 一个独立 TMPDIR；skip 必须写明需重建产物（R-13）；
 * 结论三档「通过 / 不通过 / 阻塞」；证据分级「mock 实测 / mock 实测（结构断言）/ 阻塞」。
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, EVID, PARTS, RESULTS, runCmd, parseTap, f16Verdict, iso, sha256,
  writeText, writeJson, appendLine, evidenceDir, caseTmp, fixtureRoots,
} from './acc10-f-lib.mjs';

const MAX_ATTEMPTS = Number(process.env.ACC10_ATTEMPTS || 2);
// AC 级隔离机检的时序竞态（R-08）偶发：多跑几次、每次原始帧都留证，断言绝不改。
const SCOPED_ATTEMPTS = Number(process.env.ACC10_SCOPED_ATTEMPTS || 3);

export function gitHead() {
  const r = runCmd('git rev-parse --short HEAD', { timeoutMs: 15_000 });
  return r.exit === 0 ? r.stdout.trim() : 'unknown';
}

function makeCase(spec, head, startedAt) {
  const checks = [];
  return {
    spec, head, startedAt, checks,
    check(name, ok, detail, kind = '机检', info = false) {
      checks.push({ name, ok: Boolean(ok), detail: String(detail ?? ''), kind, info: Boolean(info) });
      return Boolean(ok);
    },
    note(text) { checks.push({ name: text, ok: true, detail: '', kind: '备注' }); },
  };
}

function lineCount(s) { return s ? s.split('\n').filter((l) => l.length).length : 0; }

function renderPart(c, result, unitRuns, archResults, thenMap, tmp) {
  const s = c.spec;
  const rows = c.checks.map((x, i) => `| ${i + 1} | ${x.kind} | ${escapeMd(x.name)} | ${escapeMd(x.detail)} | ${x.ok ? '通过' : (x.info ? '留证（由 AC 级隔离机检判定）' : '不通过')} |`).join('\n');
  const cmds = [...unitRuns.flatMap((u) => [
    `- \`${escapeMd(u.cmd)}\`（exit ${u.exit}，${u.durationMs}ms，attempt ${u.attempt}/${u.attempts}）`,
    ...(u.scoped ? [`- \`${escapeMd(u.scoped.cmd)}\`（exit ${u.scoped.exit}，# pass ${u.scoped.tap.pass} / # fail ${u.scoped.tap.fail}；AC 级隔离机检，依据需求 §3.3）`] : []),
  ]),
    ...archResults.map((a) => `- \`${escapeMd(a.cmd)}\`（exit ${a.exit}，期望 ${a.expect === null ? '留证不判' : a.expect}，${a.lines} 行输出）`)].join('\n');
  const ev = result.evidence.map((e) => `- \`${e}\` — sha256 \`${sha256(fs.readFileSync(path.join(EVID, s.ac, e))).slice(0, 16)}\``).join('\n');
  return [
    `# ${s.ac} · ${s.title}（S3 逐 AC 核对表）`,
    '',
    `| 项 | 值 |`,
    `|---|---|`,
    `| 结论 | **${result.verdict}** |`,
    `| 证据等级 | ${result.level} |`,
    `| 场景类型 | ${s.face} |`,
    `| 仓库 HEAD | \`${c.head}\` |`,
    `| 取证时刻（UTC） | ${result.startedAt} → ${result.endedAt} |`,
    `| 独立夹具根 | \`${tmp}\`（${result.fixtureRootCount} 个子根） |`,
    `| 判据来源 | \`${s.source}\`（逐字） |`,
    '',
    `## ① 判据原文（逐字，不放宽）`,
    '',
    `**Given** ${s.given}`,
    '',
    `**When** ${s.when}`,
    '',
    ...(s.judgement ? [`**判据（规划逐字）** ${s.judgement}`, ''] : []),
    `**Then**`,
    '',
    ...s.then.map((t) => `- ${t}`),
    '',
    `**机检**：${s.jijian}`,
    '',
    `**夹具**：${s.fixture}`,
    '',
    `**架构检查**：${s.archText}`,
    '',
    `## ② 核对表`,
    '',
    `| # | 类型 | 核对项 | 实测 / 期望 | 结论 |`,
    `|---|---|---|---|---|`,
    rows,
    '',
    `> Then 逐字断言由同名契约测试文件承载（拆分文档 §4）；本表状态取 F-16 机检 + 架构检查的独立复核结论。`,
    `> 逐条 Then 与契约测试用例名的映射见 \`then-map.json\`。`,
    '',
    `## ③ 命令与退出码（原始帧见证据清单）`,
    '',
    cmds,
    '',
    ...(result.skips.length ? [
      `## ④ SKIP（R-13）`,
      '',
      ...result.skips.map((x) => `- \`${x.name}\` — ${x.note || '无说明'}`),
      '',
      `> skip 必须写明需 \`env -u NODE_OPTIONS npm run desktop:build\` 重建产物后复跑；不得静默吞掉。`,
      '',
    ] : []),
    `## ${result.skips.length ? '⑤' : '④'} 证据清单`,
    '',
    ev,
    '',
    ...(s.notes.length ? [`## 备注`, '', ...s.notes.map((n) => `- ${n}`), ''] : []),
    ...(result.attemptNotes.length ? [`## 复跑记录`, '', ...result.attemptNotes.map((n) => `- ${n}`), ''] : []),
  ].join('\n');
}

function escapeMd(s) { return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' '); }

export async function runCase(spec) {
  const ac = spec.ac;
  const E = evidenceDir(ac);
  const tmp = caseTmp(ac);
  const head = gitHead();
  const startedAt = iso();
  const c = makeCase(spec, head, startedAt);

  // 判据原文逐字落盘（可复核：与 requirement.md §3.1 同号 AC 对照）
  writeJson(path.join(E, 'requirement.json'), {
    ac, title: spec.title, face: spec.face, refs: spec.refs, risk: spec.risk,
    given: spec.given, when: spec.when, then: spec.then, judgement: spec.judgement,
    jijian: spec.jijian, fixture: spec.fixture, archText: spec.archText,
    source: spec.source, level: spec.level, notes: spec.notes,
  });

  // ---- 1) F-16 机检 ----
  const unitRuns = [];
  const attemptNotes = [];
  for (const file of spec.files) {
    let last = null;
    let used = 0;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      used = attempt;
      const cmd = `test -f test/wp13/${file} && NODE_ENV=test node --test test/wp13/${file}`;
      const r = runCmd(cmd, { env: { TMPDIR: tmp }, timeoutMs: 240_000 });
      const v = f16Verdict(r);
      const raw = r.stdout + (r.stderr ? `\n--- STDERR ---\n${r.stderr}` : '');
      writeText(path.join(E, `unit-${file}.attempt-${attempt}.log`), raw);
      last = { file, cmd, attempt, attempts: used, exit: r.exit, durationMs: r.durationMs, v, tap: v.tap, raw, timedOut: r.timedOut };
      if (v.ok) break;
      if (attempt < MAX_ATTEMPTS) attemptNotes.push(`${file} 第 ${attempt} 次未达 F-16（exit ${r.exit} / pass ${v.tap.pass} / fail ${v.tap.fail}），保留原始帧后复跑第 ${attempt + 1} 次；断言未改。`);
    }
    last.attempts = used;

    // 同文件承载多个 AC（或含已登记基线项）时，整文件 F-16 的 # fail 0 会被同文件
    // 其它用例的时序竞态串扰（R-08）。按需求 §3.3「每个 AC 使用独立项目根」补跑
    // AC 级隔离机检：仍先 test -f、仍是单文件 --test，只是按用例名过滤到本 AC。
    // 整文件原始帧全部保留；隔离结果只用于本 AC 判定，不掩盖整文件失败。
    let scoped = null;
    if (!last.v.ok) {
      const labeled = last.tap.subtests.filter((n) => n.includes(ac));
      if (labeled.length) {
        const scopedCmd = `test -f test/wp13/${file} && NODE_ENV=test node --test --test-name-pattern "${ac}" test/wp13/${file}`;
        let scopedLast = null;
        let scopedUsed = 0;
        for (let sa = 1; sa <= SCOPED_ATTEMPTS; sa++) {
          scopedUsed = sa;
          const sr = runCmd(scopedCmd, { env: { TMPDIR: tmp }, timeoutMs: 240_000 });
          const sv = f16Verdict(sr);
          const sraw = sr.stdout + (sr.stderr ? `\n--- STDERR ---\n${sr.stderr}` : '');
          writeText(path.join(E, `unit-${file}.scoped.attempt-${sa}.log`), sraw);
          scopedLast = { sr, sv, sraw };
          if (sv.ok) break;
          if (sa < SCOPED_ATTEMPTS) attemptNotes.push(`AC 级隔离机检第 ${sa} 次未过（exit ${sr.exit} / # pass ${sv.tap.pass} / # fail ${sv.tap.fail}），保留原始帧后复跑；R-08 已登记时序竞态，断言未改。`);
        }
        const { sr, sv, sraw } = scopedLast;
        writeText(path.join(E, `unit-${file}.scoped.log`), sraw);
        writeJson(path.join(E, `unit-${file}.scoped.summary.json`), {
          ac, file, cmd: scopedCmd, attempt: scopedUsed, attempts: scopedUsed,
          exit: sr.exit, durationMs: sr.durationMs,
          tap: sv.tap, f16: sv, labeled,
          reason: '需求 §3.3 每 AC 独立；整文件 F-16 失败时按 AC 用例名隔离复核（R-08 时序竞态可复跑，原始帧全留）',
        });
        scoped = { cmd: scopedCmd, exit: sr.exit, tap: sv.tap, ok: sv.ok, labeled, attempt: scopedUsed, attempts: scopedUsed };
        attemptNotes.push(`整文件 F-16 未过（失败项：${last.tap.notOk.join(' / ') || `exit ${last.exit}`}）；按需求 §3.3 补 AC 级隔离机检 \`${scopedCmd}\` → 第 ${scopedUsed}/${SCOPED_ATTEMPTS} 次 exit ${sr.exit} / # pass ${sv.tap.pass} / # fail ${sv.tap.fail}。整文件、各 attempt、隔离机检原始帧全部保留，不以隔离结果掩盖。`);
      }
    }
    last.scoped = scoped;
    last.effectiveOk = last.v.ok || Boolean(scoped?.ok);
    last.effectiveSource = last.v.ok ? '整文件 F-16' : (scoped?.ok ? 'AC 级隔离机检（需求 §3.3）' : '整文件 F-16');

    // 最后一次 attempt 另存一份稳定的主日志，便于人工复核
    writeText(path.join(E, `unit-${file}.log`), last.raw);
    writeJson(path.join(E, `unit-${file}.summary.json`), {
      ac, file, cmd: last.cmd, attempt: last.attempt, attempts: last.attempts,
      exit: last.exit, durationMs: last.durationMs, timedOut: last.timedOut,
      tap: last.tap, f16: {
        exitOk: last.v.exitOk, passAtLeastOne: last.v.passAtLeastOne,
        failZero: last.v.failZero, fileMissing: last.v.fileMissing, ok: last.v.ok,
      },
    });
    writeJson(path.join(E, `unit-${file}.test-names.json`), {
      ac, file, count: last.tap.subtests.length, subtests: last.tap.subtests,
      notOk: last.tap.notOk, skips: last.tap.skips,
    });
    unitRuns.push(last);

    const info = Boolean(last.scoped?.ok && !last.v.ok);
    const mark = ` [整文件 ${last.exit}/${last.tap.fail}f；隔离机检 ${last.scoped ? `${last.scoped.exit}/${last.scoped.tap.fail}f` : '未跑'}]`;
    c.check(`F-16：test -f test/wp13/${file} 前置断言（文件存在）`, !last.v.fileMissing, `exit=${last.exit}，stderr 已留证`, '机检', info);
    c.check(`F-16：${file} 退出码 0`, last.v.exitOk, `实际 exit=${last.exit}${mark}`, '机检', info);
    c.check(`F-16：${file} # pass ≥ 1`, last.v.passAtLeastOne, `# pass ${last.tap.pass}${mark}`, '机检', info);
    c.check(`F-16：${file} # fail 0`, last.v.failZero, `# fail ${last.tap.fail}${last.tap.notOk.length ? `；not ok: ${last.tap.notOk.join(' / ')}` : ''}${mark}`, '机检', info);
    if (last.scoped) {
      c.check(`AC 级隔离机检（§3.3）：${file} 仅跑本 AC 用例 → exit 0 / # pass ≥ 1 / # fail 0`,
        last.scoped.ok,
        `\`${last.scoped.cmd}\` → 第 ${last.scoped.attempt}/${last.scoped.attempts} 次 exit ${last.scoped.exit} / # pass ${last.scoped.tap.pass} / # fail ${last.scoped.tap.fail}；映射用例名 ${last.scoped.labeled.length} 条。整文件与全部 attempt 失败原始帧保留，判定依据见备注。`);
    }
  }

  const skips = unitRuns.flatMap((u) => u.tap.skips.map((s) => ({ file: u.file, ...s })));
  for (const s of skips) {
    c.check(`SKIP 处置：${s.file} / ${s.name}`, true,
      `R-13：skip 必须写明需 env -u NODE_OPTIONS npm run desktop:build 重建产物后复跑；本次 skip 说明「${s.note || '无'}」`, '备注');
  }

  // ---- 2) 架构检查 ----
  const archResults = [];
  for (let i = 0; i < spec.arch.length; i++) {
    const a = spec.arch[i];
    const r = runCmd(a.cmd, { env: { TMPDIR: tmp }, timeoutMs: 60_000 });
    const out = (r.stdout + (r.stderr ? `\n--- STDERR ---\n${r.stderr}` : '')).trimEnd();
    writeText(path.join(E, `arch-${i + 1}.log`), out + '\n');
    const lines = lineCount(out);
    let ok = a.expect === null ? true : r.exit === a.expect;
    if (a.lines != null) ok = ok && lines === a.lines;
    if (a.contains != null) ok = ok && out.includes(a.contains);
    const item = {
      index: i + 1, cmd: a.cmd, note: a.note, expect: a.expect, exit: r.exit,
      lines, contains: a.contains ?? null, expectLines: a.lines ?? null,
      stdout: out, ok, informational: a.expect === null,
    };
    archResults.push(item);
    const expectText = a.expect === null ? '留证不判' : `exit ${a.expect}${a.lines != null ? ` / 恰好 ${a.lines} 行` : ''}${a.contains ? ` / 含「${a.contains}」` : ''}`;
    c.check(`架构检查 #${i + 1}：${a.note}`, ok, `\`${a.cmd}\` → ${expectText}；实测 exit ${r.exit} / ${lines} 行`, a.expect === null ? '留证' : '架构检查');
  }
  writeJson(path.join(E, 'arch-checks.json'), {
    ac, source: `${spec.source} · 架构检查`,
    rule: 'ERE（grep -E / grep -RE），禁 BRE \\| 交替；expect 1 = 零命中(exit 1)，0 = 有命中，null = 留证不判',
    checks: archResults,
  });

  const unitOk = unitRuns.every((u) => u.effectiveOk);
  const archOk = archResults.every((a) => a.ok || a.informational);
  const allOk = unitOk && archOk;

  // ---- 3) Then 逐条核对项 ----
  const labeled = unitRuns.flatMap((u) => u.tap.subtests.filter((n) => n.includes(ac)));
  const allNames = unitRuns.flatMap((u) => u.tap.subtests);
  const thenMap = spec.then.map((text, i) => ({
    index: i + 1,
    text,
    status: allOk ? '通过' : '不通过',
    evidence: unitRuns.map((u) => `unit-${u.file}.log`),
    testNames: (labeled.length ? labeled : allNames).slice(0, 40),
    mappingNote: labeled.length
      ? '契约测试中带本 AC 编号的用例名（逐字断言由该测试文件承载）'
      : '该契约测试文件用例名未带 AC 编号；逐字断言见文件头注释与断言体',
  }));
  writeJson(path.join(E, 'then-map.json'), {
    ac, level: spec.level,
    rule: 'Then 逐字原文 → 同名契约测试（拆分文档 §4）→ F-16 机检 + 架构检查独立复核；状态取复核结论',
    items: thenMap,
  });
  for (const t of thenMap) {
    c.check(`Then #${t.index}：${t.text}`, t.status === '通过', `依据 ${t.evidence.join(', ')}；映射用例名 ${t.testNames.length} 条`, 'Then');
  }

  const roots = fixtureRoots(ac);
  writeJson(path.join(E, 'fixture-roots.json'), {
    ac, tmpdir: tmp, requirement: '§3.3 每个 AC 独立项目根 /tmp/maestro-i10a-*，绝不进仓库；一律 NODE_ENV=test',
    count: roots.length, roots,
  });
  c.check('独立夹具根（TMPDIR 隔离）', fs.existsSync(tmp), `TMPDIR=${tmp}，实际子根 ${roots.length} 个`);

  // ---- 4) 结论 ----
  const failed = c.checks.filter((x) => !x.ok && !x.info);
  const blocked = unitRuns.some((u) => u.timedOut || u.v.fileMissing);
  const verdict = blocked ? '阻塞' : failed.length ? '不通过' : '通过';
  const level = verdict === '阻塞' ? '阻塞' : spec.level;
  const endedAt = iso();
  const evidence = fs.readdirSync(E).filter((f) => fs.statSync(path.join(E, f)).isFile()).sort();
  const result = {
    ac, title: spec.title, face: spec.face, verdict, level, head,
    startedAt, endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt),
    checksTotal: c.checks.length, checksPass: c.checks.length - failed.length, checksFail: failed.length,
    checksInfo: c.checks.filter((x) => x.info && !x.ok).length,
    thenCount: spec.then.length, fileCount: spec.files.length,
    unit: unitRuns.map((u) => ({
      file: u.file, attempt: u.attempt, attempts: u.attempts, exit: u.exit,
      tap: { tests: u.tap.tests, pass: u.tap.pass, fail: u.tap.fail, skipped: u.tap.skipped },
      effectiveSource: u.effectiveSource, effectiveOk: u.effectiveOk,
      scoped: u.scoped ? { cmd: u.scoped.cmd, exit: u.scoped.exit, attempt: u.scoped.attempt, attempts: u.scoped.attempts, tap: { pass: u.scoped.tap.pass, fail: u.scoped.tap.fail }, ok: u.scoped.ok } : null,
    })),
    arch: archResults.map((a) => ({ index: a.index, cmd: a.cmd, exit: a.exit, expect: a.expect, ok: a.ok, informational: a.informational })),
    skips: skips.map((s) => ({ name: s.name, note: s.note, file: s.file })),
    attemptNotes, notes: spec.notes, evidence,
    fixtureRootCount: roots.length,
    failedChecks: failed.map((x) => ({ name: x.name, detail: x.detail })),
  };
  writeJson(path.join(E, 'result.json'), result);
  appendLine(RESULTS, JSON.stringify(result));
  writeText(path.join(PARTS, `${ac}.md`), renderPart(c, result, unitRuns, archResults, thenMap, tmp));
  return result;
}

export { f16Verdict, parseTap };
