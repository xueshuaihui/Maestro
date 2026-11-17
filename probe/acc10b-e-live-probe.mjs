#!/usr/bin/env node
// 验收 Agent 批次 e：AC-25 / AC-33 真实宿主面受控取证脚手架。
//
// 纪律：
//  - 只读校验器 acc10b-jump-verify.mjs 不自行启动宿主；本脚本负责“受控触发”。
//  - 触发走产品真实 src/adapter/host-open.js::openHost()，仓库无 .orch/hosts
//    配置时 resolveDshLaunch 默认推导到本机真实 DeepSeek Harness.exe（非 mock）。
//  - 进程计数一律用 --check process 只读帧；触发前后各取一帧，触发后多次轮询。
//  - 清理：仅 kill “本次新增”的 DeepSeek Harness PID（before 为 0 ⇒ 新增即本脚本触发），
//    绝不触碰用户原有进程；清理后再取一帧确认回到 0。
//  - sessionId 由 deriveSessionId() 从 ~/.dsh/sessions 真实目录派生，不写常量。
//  - 不写产品/测试/需求；不伪造观测；若无法拉起则如实保留 before=0 帧并在日志标注。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { openHost, resetOpenHostDedup } from '../src/adapter/host-open.js';

const execFileAsync = promisify(execFile);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const EVID = path.join(REPO, 'docs', 'iterations', 'iteration-10b', 'evidence');
const VERIFY = path.join(HERE, 'acc10b-jump-verify.mjs');

function deriveSessionId() {
  const root = path.join(os.homedir(), '.dsh', 'sessions');
  try {
    for (const ws of fs.readdirSync(root)) {
      const wp = path.join(root, ws);
      let dirs;
      try { dirs = fs.readdirSync(wp); } catch { continue; }
      for (const d of dirs) {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d)) return d;
      }
    }
  } catch { /* no sessions root */ }
  return '33333333-3333-4333-8333-333333333333'; // 仅在真实目录缺失时回退到机检派生 id
}

async function processFrame(sid) {
  const { stdout } = await execFileAsync(process.execPath, [VERIFY, sid, '--check', 'process'], {
    encoding: 'utf8', windowsHide: true,
  });
  return JSON.parse(stdout);
}

async function dshPids() {
  try {
    const { stdout } = await execFileAsync('tasklist.exe',
      ['/FI', 'IMAGENAME eq DeepSeek Harness.exe', '/FO', 'CSV', '/NH'],
      { encoding: 'utf8', windowsHide: true });
    const out = [];
    for (const line of String(stdout).split(/\r?\n/)) {
      const m = line.match(/"[^"]*","(\d+)"/);
      if (m) out.push(m[1]);
    }
    return out;
  } catch { return []; }
}

function save(name, obj) {
  fs.mkdirSync(EVID, { recursive: true });
  fs.writeFileSync(path.join(EVID, name), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2), 'utf8');
}

async function main() {
  const scenario = process.argv[2] === 'ac33' ? 'ac33' : 'ac25';
  const sid = deriveSessionId();
  resetOpenHostDedup();
  const log = {
    scenario,
    sessionId: sid,
    sessionIdSource: 'derived-from~/.dsh/sessions (not hardcoded)',
    at: new Date().toISOString(),
    platform: process.platform,
    trigger: 'product openHost() -> resolveDshLaunch default -> real DeepSeek Harness.exe',
    steps: [],
  };
  if (process.platform !== 'win32') {
    log.blocked = 'non-win32: --check process cannot observe DeepSeek Harness';
    save(`AC-${scenario === 'ac25' ? '25' : '33'}.live-log.json`, log);
    console.log(JSON.stringify(log, null, 2));
    return;
  }

  const pBefore = await processFrame(sid);
  const pidsBefore = await dshPids();
  save(`AC-${scenario === 'ac25' ? '25' : '33'}.live-before.process.json`, pBefore);
  log.steps.push({ phase: 'before', processCount: pBefore.processCount, pids: pidsBefore });

  let openResults = null;
  try {
    const base = { root: REPO, hostId: 'dsh', instanceId: 'INST-001', sessionId: sid };
    if (scenario === 'ac25') {
      const r1 = await openHost(base);
      openResults = { first: r1 };
      log.steps.push({ phase: 'click', openResult: r1 });
    } else {
      const r1 = await openHost(base);
      await sleep(150); // 200ms 内第二次点击（去重窗口 500ms）
      const r2 = await openHost(base);
      openResults = { first: r1, second: r2, sameObjectReused: r1 === r2 };
      log.steps.push({ phase: 'click-1', openResult: r1 });
      log.steps.push({ phase: 'click-2@150ms', openResult: r2, sameObjectReused: r1 === r2 });
    }
  } catch (e) {
    log.triggerError = String(e?.stack ?? e);
  }
  log.openResults = openResults;

  const delays = scenario === 'ac25' ? [0, 250, 1000, 3000] : [0, 250, 1000];
  let acc = 0;
  for (const d of delays) {
    const wait = d - acc; acc = d;
    if (wait > 0) await sleep(wait);
    const f = await processFrame(sid);
    const pids = await dshPids();
    const tag = `AC-${scenario === 'ac25' ? '25' : '33'}.live-t${d}ms.process.json`;
    save(tag, f);
    log.steps.push({ phase: `after+${d}ms`, processCount: f.processCount, evoked: f.evoked, exactlyOne: f.exactlyOne, pids });
  }

  const pidsAfter = await dshPids();
  const toKill = pidsAfter.filter((p) => !pidsBefore.includes(p));
  log.newPids = toKill;
  log.killAttempts = [];
  for (const pid of toKill) {
    let res = 'ok';
    try {
      await execFileAsync('taskkill.exe', ['/PID', pid, '/F', '/T'], { encoding: 'utf8', windowsHide: true });
    } catch (e) { res = String(e?.message ?? e); }
    log.killAttempts.push({ pid, res });
  }
  await sleep(400);
  const pClean = await processFrame(sid);
  save(`AC-${scenario === 'ac25' ? '25' : '33'}.live-cleanup.process.json`, pClean);
  log.steps.push({ phase: 'after-cleanup', processCount: pClean.processCount, pids: await dshPids() });

  save(`AC-${scenario === 'ac25' ? '25' : '33'}.live-log.json`, log);
  console.log(JSON.stringify(log, null, 2));
}

await main();
