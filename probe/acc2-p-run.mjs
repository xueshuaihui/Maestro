/**
 * I1.2 真实面验收 —— `orch run` 采集器。
 *
 * 只做三件事：起进程、打时间戳、把原始输出与 .orch 现场抄进 evidence 目录。
 * 不解释结果（判定由验收员另行给出），不改任何实现。
 *
 * 用法：
 *   node probe/acc2-p-run.mjs --label AC-01 --root <项目根> --cwd demo-code-pass \
 *     --template code-loop --instance INST-301 --task "…" [--out <目录>] [--stop-core]
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ORCH = path.join(REPO, 'bin', 'orch.js');

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = true;
    else {
      flags[key] = next;
      i += 1;
    }
  }
  return flags;
}

const flags = parseArgs(process.argv.slice(2));
const label = String(flags.label ?? 'AC-XX');
const root = path.resolve(String(flags.root ?? ''));
const cwdRel = String(flags.cwd ?? 'demo');
const task = String(flags.task ?? '');
const template = typeof flags.template === 'string' ? flags.template : null;
const instance = typeof flags.instance === 'string' ? flags.instance : null;
const outDir = path.resolve(String(flags.out ?? path.join(REPO, 'docs/iterations/iteration-2/evidence')));
const suffix = typeof flags.suffix === 'string' ? flags.suffix : '';
const timeoutMs = Number(flags.timeout ?? 1_800_000);
const stopCore = flags['stop-core'] === true;

const DSH_HOME = path.join(process.env.TEMP, 'maestro-acc-p2', 'dsh-home');
const env = {
  ...process.env,
  DSH_HOME: DSH_HOME.replaceAll('\\', '/'),
  ELECTRON_RUN_AS_NODE: '1'
};
delete env.MAESTRO_DSH_EXE;
delete env.MAESTRO_DSH_BIN;
delete env.MAESTRO_DSH_ARGS;
delete env.MAESTRO_TEST_PAUSE;
delete env.MAESTRO_TEST_STOP_AFTER;
delete env.MAESTRO_FAULT;
delete env.MAESTRO_PERMISSION_POLICY;

const argv = ['run', '--cwd', cwdRel, '--task', task];
if (template) argv.push('--template', template);
if (instance) argv.push('--instance', instance);

fs.mkdirSync(outDir, { recursive: true });
const outBase = path.join(outDir, `${label}${suffix}`);

const t0 = process.hrtime.bigint();
const ms = () => Number(process.hrtime.bigint() - t0) / 1e6;

const chunks = [];
const lines = [];
let pending = '';
let firstThreeAt = null;
let lineCount = 0;
let sawLine3 = false;

const child = spawn(process.execPath, [ORCH, ...argv], {
  cwd: root,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true
});

const timer = setTimeout(() => {
  try {
    child.kill('SIGKILL');
  } catch {}
}, timeoutMs);

child.stdout.on('data', (buf) => {
  chunks.push({ at: ms(), stream: 'stdout', text: buf.toString('utf8') });
  pending += buf.toString('utf8');
  let idx;
  while ((idx = pending.indexOf('\n')) >= 0) {
    const line = pending.slice(0, idx);
    pending = pending.slice(idx + 1);
    lineCount += 1;
    lines.push({ at: ms(), text: line, n: lineCount });
    if (lineCount >= 3 && firstThreeAt === null) {
      firstThreeAt = ms();
      sawLine3 = true;
    }
  }
});
child.stderr.on('data', (buf) => {
  chunks.push({ at: ms(), stream: 'stderr', text: buf.toString('utf8') });
});
child.on('error', (err) => {
  chunks.push({ at: ms(), stream: 'spawn-error', text: String(err?.stack ?? err) });
});

const exit = await new Promise((resolve) => {
  child.on('close', (code, signal) => resolve({ code, signal, at: ms() }));
});
clearTimeout(timer);
if (pending.length > 0) {
  lineCount += 1;
  lines.push({ at: ms(), text: pending, n: lineCount });
}

const stdoutText = chunks.filter((c) => c.stream === 'stdout').map((c) => c.text).join('');
const stderrText = chunks.filter((c) => c.stream === 'stderr').map((c) => c.text).join('');
fs.writeFileSync(`${outBase}.output.txt`, stdoutText, 'utf8');
fs.writeFileSync(`${outBase}.stderr.txt`, stderrText, 'utf8');
fs.writeFileSync(`${outBase}.lines.json`, JSON.stringify(lines, null, 2), 'utf8');

// ---- 读取现场 ----
function readInstances() {
  const dir = path.join(root, '.orch', 'instances');
  if (!fs.existsSync(dir)) return { dir, ids: [] };
  return { dir, ids: fs.readdirSync(dir).sort() };
}

function runSyncOrch(args, { cwd = root } = {}) {
  const res = spawnSync(process.execPath, [ORCH, ...args], { cwd, env, encoding: 'utf8' });
  return { args, code: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

const inst = readInstances();
let targetId = instance;
if (!targetId && inst.ids.length === 1) targetId = inst.ids[0];
const instDir = targetId ? path.join(inst.dir, targetId) : null;
const statePath = instDir ? path.join(instDir, 'state.json') : null;
const eventsPath = instDir ? path.join(instDir, 'events.jsonl') : null;

if (statePath && fs.existsSync(statePath)) {
  fs.copyFileSync(statePath, `${outBase}.state.json`);
}
if (eventsPath && fs.existsSync(eventsPath)) {
  fs.copyFileSync(eventsPath, `${outBase}.events.jsonl`);
}

const status = targetId ? runSyncOrch(['status', '--instance', targetId]) : null;
const statusEvents = targetId ? runSyncOrch(['status', '--instance', targetId, '--events']) : null;
if (status) fs.writeFileSync(`${outBase}.status.txt`, status.stdout + status.stderr, 'utf8');
if (statusEvents) fs.writeFileSync(`${outBase}.status-events.txt`, statusEvents.stdout + statusEvents.stderr, 'utf8');

let stop = null;
if (stopCore) stop = runSyncOrch(['core', 'stop']);

let state = null;
if (statePath && fs.existsSync(statePath)) {
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (err) {
    state = { parseError: String(err) };
  }
}

const meta = {
  label,
  command: `${process.execPath} ${ORCH} ${argv.join(' ')}`,
  displayCommand: `orch ${argv.join(' ')}`,
  root,
  cwd: path.join(root, cwdRel),
  task,
  template,
  instance: targetId,
  dshHome: DSH_HOME,
  exitCode: exit.code,
  signal: exit.signal,
  timeouts: {
    spawnToThreeLinesMs: firstThreeAt,
    spawnToTerminalMs: exit.at,
    totalMs: exit.at
  },
  lineCount,
  sawThreeLines: sawLine3,
  stdoutLines: lines.map((l) => l.text),
  stderr: stderrText,
  statusExit: status?.code ?? null,
  statusEventsExit: statusEvents?.code ?? null,
  coreStop: stop ? { exitCode: stop.code, stdout: stop.stdout, stderr: stop.stderr } : null,
  stateSummary: state
    ? {
        schemaVersion: state.schemaVersion,
        instanceId: state.instanceId,
        state: state.state,
        template: state.template,
        halted: state.halted,
        rev: state.rev,
        nodes: (state.nodes ?? []).map((n) => ({
          nodeId: n.nodeId,
          roleId: n.roleId,
          round: n.round,
          state: n.state,
          verdict: n.verdict,
          startedAt: n.startedAt,
          roundStartedAt: n.roundStartedAt,
          endedAt: n.endedAt
        })),
        sessions: (state.sessions ?? []).map((s) => ({
          sessionId: s.sessionId,
          nodeId: s.nodeId,
          round: s.round,
          state: s.state
        })),
        handoffs: (state.handoffs ?? []).map((h) => ({
          handoffId: h.handoffId,
          edge: h.edge,
          state: h.state,
          defects: h.defects?.length ?? 0,
          wakeConsumedAt: h.wakeConsumedAt ?? null
        })),
        escalations: (state.escalations ?? []).map((e) => ({
          escalationId: e.escalationId,
          nodeId: e.nodeId,
          round: e.round,
          reasonCode: e.reasonCode,
          state: e.state
        })),
        counters: state.counters
      }
    : null
};

fs.writeFileSync(`${outBase}.meta.json`, JSON.stringify(meta, null, 2), 'utf8');
console.log(JSON.stringify({
  label,
  exitCode: meta.exitCode,
  instance: meta.instance,
  spawnToThreeLinesMs: meta.timeouts.spawnToThreeLinesMs,
  spawnToTerminalMs: meta.timeouts.spawnToTerminalMs,
  state: meta.stateSummary?.state,
  nodes: meta.stateSummary?.nodes,
  handoffs: meta.stateSummary?.handoffs,
  escalations: meta.stateSummary?.escalations,
  outBase
}, null, 2));
