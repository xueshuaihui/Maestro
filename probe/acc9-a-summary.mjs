// I1.9 S3 验收 A 组：AC-04（失败摘要四要素）/ AC-05（摘要边界与缺项）。
//
// 夹具：`host-logs/T-001.log` 由本脚手架预置在**项目根**（不在实例目录内，D-13），
// mock 只上报引用字符串、不创建文件、不复制正文。
//
// 复跑：`NODE_ENV=test node probe/acc9-a-summary.mjs`
// 证据：docs/iterations/iteration-9/evidence/acc9/AC-04|AC-05/
import fs from 'node:fs';
import path from 'node:path';

import {
  ensureDir, evidenceDir, freshRoot, makeChecks, nowIso, parseEventJson, removeProject,
  report, runCli, stopCore, tracesPath, writeEvidence, writeMockConfig,
} from './acc9-a-lib.mjs';

const LOG_REL = 'host-logs/T-001.log';
const LOG_BODY = 'line-1: start\nline-2: work\nline-3: exit 1\n';
const TRACE_SPAN = /^\d{2}:\d{2}:\d{2} → \d{2}:\d{2}:\d{2}  T-001  失败  交接 HO-001$/;
const A4_LINE = '  失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log';
const A12_RE = /^\d{2}:\d{2}:\d{2}  会话 mock-sess-\d+-\d+  执行摘要 命令 node out\/run\.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs\/T-001\.log$/;

function walk(dir, base = dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) walk(p, base, out);
    else out.push({ rel: path.relative(base, p), size: stat.size, file: p });
  }
  return out;
}

function ac04() {
  const { checks, check } = makeChecks();
  const root = freshRoot('AC-04');
  writeMockConfig(root, ['--fail-tool']);
  ensureDir(path.join(root, 'host-logs'));
  fs.writeFileSync(path.join(root, LOG_REL), LOG_BODY, 'utf8');

  const run = runCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '执行 out/run.js']);
  const trace = runCli(root, ['trace', 'show', 'INST-001']);
  const logText = runCli(root, ['instance', 'log', 'INST-001']);
  const logJson = runCli(root, ['instance', 'log', 'INST-001', '--format', 'json']);

  check('run 以失败收尾（退出码 1，属本夹具预期）', run.exitCode === 1, { exitCode: run.exitCode });
  check('trace show 退出码 0', trace.exitCode === 0, { exitCode: trace.exitCode, stderr: trace.stderr });
  const traceLines = trace.stdout.replace(/\n$/, '').split('\n');
  check('跨度行逐字匹配 A-4 形态', traceLines.some((l) => TRACE_SPAN.test(l)),
    { lines: traceLines });
  check('失败摘要四项逐字命中 A-4', traceLines.includes(A4_LINE),
    { want: A4_LINE, got: traceLines });
  check('摘要行紧跟在跨度行之后',
    traceLines.indexOf(A4_LINE) === traceLines.findIndex((l) => TRACE_SPAN.test(l)) + 1);

  const events = parseEventJson(logJson.stdout);
  const summaries = events.filter((e) => e.reason === 'execution.summary');
  check('instance log --format json 有 1 条 execution.summary', summaries.length === 1, { n: summaries.length });
  const sm = summaries[0]?.detail?.summary ?? {};
  check('JSON 摘要四项取值与夹具一致',
    sm.command === 'node out/run.js' && sm.exitCode === 1 && sm.keyOutputLines === 3 && sm.logRef === LOG_REL,
    sm);
  check('文本视图含 A-12 摘要行且四项与 JSON 一致',
    logText.stdout.split('\n').some((l) => A12_RE.test(l)),
    { tail: logText.stdout.split('\n').slice(-3) });

  // 实例目录内不得有完整日志副本（内容级比对，不只按文件名）。
  const instFiles = walk(path.join(root, '.orch', 'instances', 'INST-001'));
  const copies = instFiles.filter((f) => f.size === Buffer.byteLength(LOG_BODY)
    && fs.readFileSync(f.file, 'utf8') === LOG_BODY);
  check('实例目录内无完整日志副本（按内容比对）', copies.length === 0,
    { instanceFiles: instFiles.map((f) => f.rel), copies: copies.map((c) => c.rel) });
  check('host-logs/T-001.log 仍在项目根（未被搬迁）',
    fs.existsSync(path.join(root, LOG_REL)) && fs.readFileSync(path.join(root, LOG_REL), 'utf8') === LOG_BODY);

  check('摘要不包含完整日志正文', !JSON.stringify(summaries).includes('line-1: start'));

  // AC-04 Then 末句：成功节点同样附加四项摘要（追踪不强制展示）。
  writeMockConfig(root);
  const run2 = runCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--instance', 'INST-002', '--task', '写一份说明']);
  const log2 = runCli(root, ['instance', 'log', 'INST-002', '--format', 'json']);
  const summaries2 = parseEventJson(log2.stdout).filter((e) => e.reason === 'execution.summary');
  check('成功实例同样有 execution.summary 记录（每会话一条）',
    run2.exitCode === 0 && summaries2.length === 1 && summaries2[0].detail?.summary
      && ['command', 'exitCode', 'keyOutputLines', 'logRef'].every((k) => k in summaries2[0].detail.summary),
    { run2: run2.exitCode, n: summaries2.length, summary: summaries2[0]?.detail?.summary });

  writeEvidence('AC-04', 'stdout-run.txt', run.stdout + run.stderr);
  writeEvidence('AC-04', 'stdout-trace-show.txt', trace.stdout + trace.stderr);
  writeEvidence('AC-04', 'stdout-instance-log.txt', logText.stdout + logText.stderr);
  writeEvidence('AC-04', 'stdout-instance-log-json.txt', logJson.stdout + logJson.stderr);
  writeEvidence('AC-04', 'instance-dir-files.txt', instFiles.map((f) => `${f.rel}\t${f.size}B`).join('\n'));
  writeEvidence('AC-04', 'host-log-preset.txt', LOG_BODY);
  const payload = { root, checks, pass: checks.every((c) => c.ok) };
  report('AC-04', payload);
  stopCore(root);
  removeProject(root);
  return payload;
}

function ac05() {
  const { checks, check } = makeChecks();
  const root = freshRoot('AC-05');
  writeMockConfig(root, ['--fail-tool-no-refs']);

  const run = runCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '执行 out/run.js']);
  const trace = runCli(root, ['trace', 'show', 'INST-001']);
  const logJson = runCli(root, ['instance', 'log', 'INST-001', '--format', 'json']);

  check('run 以失败收尾（退出码 1）', run.exitCode === 1, { exitCode: run.exitCode });
  check('trace show 退出码 0（追踪仍可打开）', trace.exitCode === 0, { exitCode: trace.exitCode, stderr: trace.stderr });
  check('失败摘要：命令与退出码照常显示',
    trace.stdout.includes('命令 node out/run.js · 退出码 1'));
  check('失败摘要：关键输出显示「未提供」', trace.stdout.includes('关键输出 未提供'));
  check('失败摘要：日志引用显示「未提供」', trace.stdout.includes('日志 未提供'));
  check('四项顺序未变（命令 → 退出码 → 关键输出 → 日志）',
    /失败摘要 命令 node out\/run\.js · 退出码 1 · 关键输出 未提供 · 日志 未提供/.test(trace.stdout));

  const summaries = parseEventJson(logJson.stdout).filter((e) => e.reason === 'execution.summary');
  const sm = summaries[0]?.detail?.summary ?? {};
  check('JSON：缺失两项为 null（不是空串、不是猜值）',
    summaries.length === 1 && sm.keyOutputLines === null && sm.logRef === null, sm);
  check('JSON 摘要不含完整输出正文字段',
    !Object.keys(sm).some((k) => /body|content|stdout|outputText/i.test(k)), { keys: Object.keys(sm) });

  const instDir = path.join(root, '.orch', 'instances', 'INST-001');
  const files = walk(instDir);
  check('实例目录内不存在宿主日志副本（也不存在 host-logs 目录）',
    !files.some((f) => f.rel.includes('host-logs') || f.rel.endsWith('.log')),
    { files: files.map((f) => f.rel) });
  check('实例目录仅含事件/快照/追踪/status.md 四类文件',
    files.every((f) => ['.jsonl', '.json', '.md'].includes(path.extname(f.file))),
    { files: files.map((f) => f.rel) });
  check('实例未崩溃：状态快照仍可读且为失败态',
    (() => {
      try {
        const s = JSON.parse(fs.readFileSync(path.join(instDir, 'state.json'), 'utf8'));
        return s.state === 'failed';
      } catch { return false; }
    })());
  check('追踪文件仍存在且只有 1 行跨度',
    fs.existsSync(tracesPath(root)) && fs.readFileSync(tracesPath(root), 'utf8').trim().split('\n').length === 1);

  writeEvidence('AC-05', 'stdout-run.txt', run.stdout + run.stderr);
  writeEvidence('AC-05', 'stdout-trace-show.txt', trace.stdout + trace.stderr);
  writeEvidence('AC-05', 'stdout-instance-log-json.txt', logJson.stdout + logJson.stderr);
  writeEvidence('AC-05', 'instance-dir-files.txt', files.map((f) => `${f.rel}\t${f.size}B`).join('\n'));
  const payload = { root, checks, pass: checks.every((c) => c.ok) };
  report('AC-05', payload);
  stopCore(root);
  removeProject(root);
  return payload;
}

const payload4 = ac04();
const payload5 = ac05();
process.stdout.write(`\nAC-04 ${payload4.pass ? 'PASS' : 'FAIL'}\nAC-05 ${payload5.pass ? 'PASS' : 'FAIL'}\n`);
process.exit(payload4.pass && payload5.pass ? 0 : 1);
