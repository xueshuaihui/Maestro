/**
 * I1.8 S3 验收脚手架 · 动作与断言辅助（WP-7 末批）。
 *
 * 一个 case 的固定结构：
 *   makeCase → 构造 / 取证（含 saveEvidence 原始帧）→ 断言 → finish → writePart + appendResult。
 *
 * 真实宿主面（AC-25 / AC-26 / AC-57）共用 `realCrashRecovery()`：同一进程内**只真跑一次**
 * 编码闭环（真实 DSH + 真实账号凭据），AC-25 与 AC-26 各自对它记录的原始帧做本条的断言，
 * 避免为两条 AC 重复拉起两轮真实模型调用。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';

import {
  ACC8_PATHS, REPO, NODE, ORCH_BIN, EVID, RESULTS,
  GRADING_MOCK, VERDICT_PASS, VERDICT_FAIL, VERDICT_BLOCK,
  ensureDir, appendLine, iso, sleep, saveEvidence as saveFrame,
  readState, readEvents, readJson, writeText, statePath, eventsPath,
  snapshotTree, baseEnv, cleanupRoot, acBlock, sha256,
} from './acc8-f-lib.mjs';
import {
  prepareHome, cleanupHome, childEnv, RealHost, discoverHost, capsReport,
  userHomeFingerprint, HOME_ROOT,
} from './acc8-realhost.mjs';
import { resolveDshLaunch } from '../src/adapter/dsh-launch.js';

const safe = (v) => {
  if (v === undefined) return '<undefined>';
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

export function makeCase(ac, { scenario = '', title = '', grading = GRADING_MOCK } = {}) {
  return {
    ac,
    scenario,
    title,
    root: null,
    startedAt: iso(),
    endedAt: null,
    checks: [],
    evidence: [],
    snapshots: {},
    notes: [],
    blocker: null,
    verdict: null,
    grading,
    durationMs: null,
  };
}

function push(c, label, expected, actual, ok) {
  const item = {
    id: `C${String(c.checks.length + 1).padStart(2, '0')}`,
    label,
    expected: safe(expected),
    actual: safe(actual),
    ok: ok === true,
  };
  c.checks.push(item);
  return item;
}

export function eq(c, label, actual, expected) {
  return push(c, label, expected, actual, isDeepStrictEqual(actual, expected));
}

export function includes(c, label, actual, needle) {
  return push(c, label, needle, actual, typeof actual === 'string' && actual.includes(String(needle)));
}

export function excludes(c, label, actual, needle) {
  return push(c, label, `不含 ${needle}`, actual, typeof actual === 'string' && !actual.includes(String(needle)));
}

export function matches(c, label, actual, regex) {
  let ok = false;
  try {
    ok = regex.test(String(actual));
  } catch {
    ok = false;
  }
  return push(c, label, String(regex), actual, ok);
}

export function check(c, label, ok, detail = '') {
  return push(c, label, detail === '' ? 'true' : detail, ok === true ? 'true' : `false (${safe(detail)})`, ok === true);
}

export function verify(c, label, actual, predicate, expectedText) {
  let ok = false;
  try {
    ok = predicate(actual) === true;
  } catch {
    ok = false;
  }
  return push(c, label, expectedText, actual, ok);
}

export function snap(c, name, value) {
  c.snapshots[name] = value;
  return value;
}

/** 登记阻塞：需求要求什么 / 试过什么 / 为何观测不到（NFR-08 不伪造）。 */
export function block(c, reason) {
  c.blocker = String(reason ?? '');
  c.notes.push(`阻塞：${c.blocker}`);
  return c;
}

export function evidence(c, phase, type, content) {
  const saved = saveFrame(c.ac, phase, type, content);
  c.evidence.push(saved);
  return saved;
}

export function note(c, text) {
  c.notes.push(String(text ?? ''));
  return c;
}

export function finish(c) {
  c.endedAt = iso();
  const failed = c.checks.filter((item) => !item.ok);
  if (c.blocker) c.verdict = VERDICT_BLOCK;
  else if (c.checks.length === 0 || failed.length > 0) c.verdict = VERDICT_FAIL;
  else c.verdict = VERDICT_PASS;
  c.checksTotal = c.checks.length;
  c.checksPassed = c.checks.filter((item) => item.ok).length;
  c.checksFailed = failed.length;
  return c;
}

/** 写 Markdown 核对表（落 evidence/wp7，不新建 probe/acc8-f-parts 目录）。 */
export function writePart(c) {
  const rows = c.checks
    .map((item) => `| ${item.id} | ${item.label} | \`${item.expected}\` | \`${item.actual}\` | ${item.ok ? '✓' : '✗'} |`)
    .join('\n');
  const evRows = c.evidence.map((item) => `- \`${item.file}\`（${item.bytes} bytes, sha256 \`${item.sha256}\`）`).join('\n');
  const noteRows = c.notes.map((n) => `- ${n}`).join('\n') || '- （无）';
  const md = [
    `# ${c.ac} · ${c.title || c.scenario}`,
    '',
    `- 判定：**${c.verdict}**`,
    `- 证据分级：**${c.grading}**`,
    `- 项目根：\`${c.root || '(未使用独立项目根)'}\``,
    `- 场景：\`${c.scenario}\``,
    `- 核对项：${c.checksPassed}/${c.checksTotal} 通过，${c.checksFailed} 未通过`,
    `- 起止：${c.startedAt} → ${c.endedAt}`,
    '',
    '## 核对项',
    '',
    '| ID | 核对点 | 期望值 | 实测值 | 结果 |',
    '|---|---|---|---|---|',
    rows || '| — | — | — | — | — |',
    '',
    '## 原始证据',
    '',
    evRows || '- （无）',
    '',
    '## 备注',
    '',
    noteRows,
    '',
    '<details><summary>需求 AC 原文（from requirement.md）</summary>',
    '',
    '```text',
    acBlock(c.ac),
    '```',
    '',
    '</details>',
    '',
  ].join('\n');
  return writeText(path.join(EVID, `${c.ac}.part.md`), md);
}

export function appendResult(c) {
  ensureDir(path.dirname(RESULTS));
  const record = {
    ac: c.ac,
    title: c.title,
    scenario: c.scenario,
    verdict: c.verdict,
    grading: c.grading,
    checksTotal: c.checksTotal,
    checksPassed: c.checksPassed,
    checksFailed: c.checksFailed,
    failedChecks: c.checks.filter((i) => !i.ok).map((i) => ({ id: i.id, label: i.label, expected: i.expected, actual: i.actual })),
    evidenceFiles: c.evidence.map((i) => i.file),
    blocker: c.blocker,
    notes: c.notes,
    root: c.root,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
  };
  appendLine(RESULTS, JSON.stringify(record));
  return record;
}

/* ------------------------------------------------------- 真实宿主：一次真跑 */

const FLOW_CACHE = new Map();

/**
 * 编码闭环 → 强杀 daemon → 重启恢复（真实 DSH 0.2.2，隔离 DSH_HOME）。
 *
 * 强杀判据：`.orch/core.json.pid` + `SIGKILL`（§3.3#4，**不用 `core stop`**）。
 * 窗口选择：T-001（开发）已 `done` 且 T-002（测试）仍 `running` —— 正好覆盖
 * 「已完成节点不重跑」+「运行中节点会话 resume」两个断言面。
 */
export async function realCrashRecovery({ label = 'ac25', timeoutMs = 420_000 } = {}) {
  if (FLOW_CACHE.has(label)) return FLOW_CACHE.get(label);
  const job = (async () => {
    const rec = {
      label,
      startedAt: iso(),
      home: null,
      caps: null,
      host: null,
      run: null,
      kill: null,
      restart: null,
      before: null,
      after: null,
      artifacts: null,
      guards: null,
      error: null,
    };
    const homeRoot = path.join(HOME_ROOT, `flow-${label}`);
    const userBefore = userHomeFingerprint();
    const host = discoverHost();
    rec.host = { ok: host.ok, version: host.version, exe: host.exe, bin: host.bin, hasDshExe: host.hasDshExe, source: host.source };
    if (!host.ok) {
      rec.error = `宿主发现失败：${JSON.stringify(host.discovery?.params ?? host.discovery)}`;
      return rec;
    }
    const home = prepareHome(homeRoot);
    rec.home = { dshHome: home.dshHome, projectRoot: home.projectRoot, credentialsCopied: home.copiedCred, profileCopied: home.profileCopied };
    const env = childEnv(home.dshHome);
    const launch = resolveDshLaunch();
    const projectRoot = home.projectRoot;
    const demo = ensureDir(path.join(projectRoot, 'demo'));
    rec.run = { projectRoot, demo };

    // 1) 真实能力探针（同一次隔离 home，短命宿主）
    try {
      const probeHost = new RealHost(launch.launch, env, home.workspace, { timeoutMs: 120_000 });
      const init = await probeHost.initialize('maestro-acc8-caps');
      rec.caps = init.error ? { error: JSON.stringify(init.error) } : capsReport(init);
      await probeHost.close();
    } catch (err) {
      rec.caps = { error: String(err?.message ?? err) };
    }

    // 2) 真实编码闭环
    const task = [
      '给 demo 目录建 calc.js 与 calc.test.js：calc.js 导出 add 与 div，',
      'calc.test.js 用 node:test 断言 add(1,2)=3 与 div(6,2)=3，并运行 node --test 让其全绿。',
      '产物：calc.js',
    ].join('');
    const child = spawn(NODE, [ORCH_BIN, 'run', '--cwd', './demo', '--task', task, '--template', 'code-loop'], {
      cwd: projectRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let runOut = '';
    let runErr = '';
    child.stdout.on('data', (c) => {
      runOut += String(c);
    });
    child.stderr.on('data', (c) => {
      runErr += String(c);
    });
    const runClosed = new Promise((r) => child.once('close', (code, signal) => r({ code, signal })));

    // 3) 轮询到「一个节点 done + 一个节点 running 且已绑定会话」的窗口。
    //    只判 `running` 不够：派发到会话建立之间有 2~3s 空窗，此时节点无 sessionId，
    //    恢复只能走 `session_unrecoverable`，取不到 `session/resume` 方言行。
    const deadline = Date.now() + timeoutMs;
    let windowState = null;
    while (Date.now() < deadline) {
      const st = readState(projectRoot);
      const nodes = Array.isArray(st?.nodes) ? st.nodes : [];
      const sessions = Array.isArray(st?.sessions) ? st.sessions : [];
      const done = nodes.filter((n) => n.state === 'done');
      const running = nodes.filter((n) => n.state === 'running' && n.sessionId
        && sessions.some((s) => s.sessionId === n.sessionId));
      if (st && done.length >= 1 && running.length >= 1) {
        windowState = st;
        break;
      }
      if (st && ['completed', 'interrupted', 'suspended'].includes(st.state)) {
        windowState = st;
        break;
      }
      await sleep(300);
    }
    rec.run.stdout = runOut;
    rec.run.stderr = runErr;

    if (!windowState) {
      rec.error = '超时：未进入「已完成节点 + 运行中节点」窗口';
      child.kill();
      await runClosed.catch(() => {});
      rec.guards = finalizeGuards(rec, homeRoot, userBefore);
      return rec;
    }
    rec.before = summariseState(windowState);
    const instRoot = path.join(projectRoot, '.orch', 'instances', 'INST-001');
    const workspaceDir = path.join(instRoot, 'workspace');
    const artifactsDir = path.join(workspaceDir, 'artifacts');
    const stageDir = path.join(workspaceDir, 'stage');
    rec.artifacts = {
      dir: artifactsDir,
      exists: fs.existsSync(artifactsDir),
      before: snapshotTree(artifactsDir),
      stageBefore: snapshotTree(stageDir),
      workspaceBefore: snapshotTree(workspaceDir),
    };

    // 4) 强杀核心（SIGKILL，不用 core stop）
    const coreJson = readJson(path.join(projectRoot, '.orch', 'core.json'));
    const pid = coreJson?.pid ?? null;
    let killed = null;
    if (pid) {
      try {
        process.kill(pid, 'SIGKILL');
        killed = { pid, signal: 'SIGKILL', ok: true };
      } catch (err) {
        killed = { pid, signal: 'SIGKILL', ok: false, error: String(err?.message ?? err) };
      }
    }
    rec.kill = killed ?? { pid: null, ok: false, error: 'core.json 无 pid' };
    try {
      child.kill();
    } catch {
      /* 已随核心退出 */
    }
    await runClosed.catch(() => {});
    await sleep(800);

    const beforeEvents = readEvents(projectRoot);
    rec.before.dispatch = countDispatch(beforeEvents);
    rec.before.events = beforeEvents.length;

    // 5) 重启（任意 orch 命令经 ensureCore 拉起 → reconcileOnBoot）
    const restart = await import('./acc8-f-lib.mjs').then((m) => m.orch(projectRoot, ['instance', 'log', '--instance', 'INST-001'], { env }));
    rec.restart = { cmd: restart.cmd, exitCode: restart.exitCode, stdout: restart.stdout, stderr: restart.stderr };

    // 6) 等恢复事件落盘（recovery.summary 或 recovery.dialect）
    const rdeadline = Date.now() + 120_000;
    let ev = readEvents(projectRoot);
    while (Date.now() < rdeadline) {
      ev = readEvents(projectRoot);
      if (ev.some((e) => e.reason === 'recovery.summary') || ev.some((e) => e.reason === 'recovery.dialect')) break;
      await sleep(300);
    }
    const afterState = readState(projectRoot);
    rec.after = summariseState(afterState);
    rec.after.dispatch = countDispatch(ev);
    rec.after.events = ev.length;
    rec.after.recoveryEvents = ev.filter((e) => typeof e.reason === 'string' && e.reason.startsWith('recovery.'));
    rec.log = { text: rec.restart.stdout, lines: rec.restart.stdout.split(/\r?\n/).filter(Boolean) };

    const log2 = await import('./acc8-f-lib.mjs').then((m) => m.orch(projectRoot, ['instance', 'log', '--instance', 'INST-001'], { env }));
    rec.logAfterRecovery = log2.stdout;
    // `instance log` 的首次调用发生在核心启动瞬间，恢复事件尚未落盘；
    // 恢复完成后再读一次，才是 AC-25「instance log 出现方言行」的判定来源。
    rec.log.text = log2.stdout;

    rec.artifacts.after = snapshotTree(artifactsDir);
    rec.artifacts.stageAfter = snapshotTree(stageDir);
    rec.artifacts.workspaceAfter = snapshotTree(workspaceDir);

    // 7) 收尾：干净停核心（只是清理，不参与强杀判据）+ 删除隔离目录
    const stop = await import('./acc8-f-lib.mjs').then((m) => m.orch(projectRoot, ['core', 'stop'], { env }));
    rec.stop = { exitCode: stop.exitCode, stdout: stop.stdout.trim() };
    rec.guards = finalizeGuards(rec, homeRoot, userBefore);
    rec.endedAt = iso();
    return rec;
  })();
  FLOW_CACHE.set(label, job);
  return job;
}

function finalizeGuards(rec, homeRoot, userBefore) {
  const userAfter = userHomeFingerprint();
  const cleanup = cleanupHome(homeRoot);
  return {
    userHomeBefore: userBefore,
    userHomeAfter: userAfter,
    userHomeUntouched: userBefore.exists === userAfter.exists && userBefore.mtimeSec === userAfter.mtimeSec,
    isolatedRoot: homeRoot,
    isolatedRemoved: cleanup.removed,
  };
}

function countDispatch(events) {
  const per = {};
  for (const e of events) {
    if (e?.reason !== 'node.dispatch') continue;
    const id = e.objectId ?? e.detail?.nodeId ?? '?';
    per[id] = (per[id] ?? 0) + 1;
  }
  return per;
}

function summariseState(st) {
  if (!st) return null;
  return {
    state: st.state,
    recoveredAt: st.recoveredAt ?? null,
    recovery: st.recovery ?? null,
    nodes: (st.nodes ?? []).map((n) => ({
      nodeId: n.nodeId,
      state: n.state,
      phase: n.phase ?? null,
      round: n.round,
      sessionId: n.sessionId ?? null,
      artifactRefs: (n.artifactRefs ?? []).length,
    })),
    sessions: (st.sessions ?? []).map((s) => ({
      sessionId: s.sessionId,
      nodeId: s.nodeId ?? null,
      state: s.state,
      dialect: s.dialect ?? null,
      recovered: s.recovered ?? null,
    })),
  };
}

export { readState, readEvents, statePath, eventsPath, snapshotTree, baseEnv, cleanupRoot, os, path, fs, sha256 };
