#!/usr/bin/env node
/**
 * VP-8 冒烟：在真实 Electron 运行时里验证「托盘 + 多窗口 + WebSocket 客户端」三件事。
 *
 *   node smoke.mjs
 *
 * 流程：起 daemon 桩 → 启动 Electron（SMOKE=1，窗口隐藏）→ 渲染进程连 WS 收推送 →
 *      主进程写 evidence.json → 本脚本断言并退出。
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(HERE, '../..');
const RUN_DIR = path.join(WORKSPACE, '.orch-spike/runs/vp8/desktop');
fs.mkdirSync(RUN_DIR, { recursive: true });
const EVIDENCE = path.join(RUN_DIR, 'evidence.json');
const PORT = 4319;
const DAEMON = `http://127.0.0.1:${PORT}`;

const require = createRequire(import.meta.url);
let electronPath;
try {
  electronPath = require('electron');
} catch {
  process.stderr.write('未安装 electron，请先 npm install\n');
  process.exit(2);
}
if (typeof electronPath !== 'string') {
  process.stderr.write('electron 路径解析失败\n');
  process.exit(2);
}

fs.rmSync(EVIDENCE, { force: true });

const stub = spawn(process.execPath, [path.join(HERE, 'daemon-stub.mjs')], {
  env: { ...process.env, STUB_PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const stubReady = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('daemon 桩启动超时')), 8000);
  stub.stdout.on('data', (d) => {
    if (d.toString().includes('"ready":true')) {
      clearTimeout(timer);
      resolve(true);
    }
  });
  stub.once('exit', (c) => reject(new Error(`daemon 桩提前退出 ${c}`)));
});

const child = spawn(electronPath, [HERE], {
  env: (() => {
    const e = {
      ...process.env,
      SMOKE: '1',
      EVIDENCE_PATH: EVIDENCE,
      DAEMON_URL: DAEMON,
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    };
    // 若外部 shell 残留该变量，Electron 会退化成纯 Node（require('electron') 只返回路径）
    delete e.ELECTRON_RUN_AS_NODE;
    return e;
  })(),
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
child.stderr.on('data', (d) => {
  stderr += d.toString();
});
child.stdout.on('data', () => {});

const exitCode = await new Promise((resolve) => {
  const timer = setTimeout(() => {
    child.kill();
    resolve('timeout');
  }, 60_000);
  child.once('exit', (code) => {
    clearTimeout(timer);
    resolve(code);
  });
});

stub.kill();

let evidence = null;
try {
  evidence = JSON.parse(fs.readFileSync(EVIDENCE, 'utf8'));
} catch {
  /* 留空，下面判失败 */
}

const checks = evidence?.checks ?? {};
const result = {
  electron: evidence?.electron ?? null,
  chrome: evidence?.chrome ?? null,
  exitCode,
  tray: !!checks.tray,
  multiWindow: !!checks.multiWindow,
  websocket: !!checks.websocket,
  daemonHttp: !!checks.daemonHttp,
  rendererDom: !!checks.rendererDom,
  closeToTray: !!checks.closeToTray,
  windows: evidence?.windows ?? [],
  renderer: evidence?.renderer ?? null,
  durationMs: evidence?.durationMs ?? null,
  memoryMB: evidence?.memory ? Math.round(evidence.memory.rss / 1024 / 1024) : null,
  processWorkingSetMB: (evidence?.metrics ?? []).reduce((a, m) => a + (m.workingSetMB ?? 0), 0) || null,
  processes: (evidence?.metrics ?? []).length || null,
  errors: evidence?.errors ?? [],
  stderrTail: stderr.trim().split('\n').slice(-5),
};

const pass =
  result.tray && result.multiWindow && result.websocket && result.daemonHttp && result.rendererDom && result.closeToTray && exitCode === 0;
result.pass = pass;

fs.writeFileSync(path.join(RUN_DIR, 'smoke-result.json'), JSON.stringify(result, null, 2));
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.exit(pass ? 0 : 1);
