#!/usr/bin/env node
/**
 * 产物冒烟四件套——需求 AC-40 / AC-44。
 *
 * 四项（缺一不可，任一不过即非零退出）：
 *   1. 应用能启动：直接执行包内二进制，探针出现 `ready`（条件轮询，禁固定 sleep）
 *   2. 鉴权守卫：无凭据 `GET /ui/labels` 返回 401
 *   3. 签名：`codesign --verify --deep --strict` 通过
 *   4. 安装包镜像：`hdiutil verify` 通过 + 挂载后对**镜像里那份** `.app` 再次验签
 *
 * 平台分派：macOS 面四项全跑；Windows 面只跑前两项 + 包内可执行存在
 * （NSIS 交互式安装与 SmartScreen 启属人工核验，需求 §1.3 已排除）。
 *
 * 用法：
 *   node scripts/desktop/smoke.mjs --app <Maestro.app> [--dmg <x.dmg>]
 *   node scripts/desktop/smoke.mjs --dir <解包目录> --exe <Maestro.exe>
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const READY_TIMEOUT_MS = 30_000;
const POLL_MS = 100;

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  process.stdout.write(`[smoke] ${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}\n`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(POLL_MS);
  }
  throw new Error(`等待超时：${label}（${timeoutMs}ms）`);
}

function readProbeEvents(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function httpGet(port, urlPath, token) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: urlPath, method: 'GET', headers: token ? { Authorization: `Bearer ${token}` } : {} },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      },
    );
    req.setTimeout(3000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key.startsWith('--')) {
      const value = argv[i + 1];
      if (value && !value.startsWith('--')) {
        out[key.slice(2)] = path.resolve(value);
        i += 1;
      } else {
        out[key.slice(2)] = true;
      }
    }
  }
  return out;
}

/**
 * 桌面通道没起来时的现场诊断（只读 + 一次受控试跑，不改任何状态）。
 *
 * 为什么需要：Windows 首跑实测「应用可启动」通过、但 `.orch/desktop.json` 10s 未出现，
 * 而壳层把 daemon 的 stdout/stderr 都接到 null，CI 日志里什么也看不到。
 * 这里列出 `.orch` 实际内容，并用**同一份包内运行时**直接起一次 daemon 抓输出，
 * 让下一次红是可归因的。
 */
async function diagnoseDaemon(shellPath, root) {
  const orchDir = path.join(root, '.orch');
  let listing = '(不存在)';
  try {
    listing = fs.readdirSync(orchDir).join(', ') || '(空目录)';
  } catch {
    /* 保持 (不存在) */
  }
  process.stdout.write(`[smoke] 诊断：${orchDir} 内容 = ${listing}\n`);

  const dir = path.dirname(shellPath);
  const nodeName = process.platform === 'win32' ? 'node.exe' : 'node';
  const node = path.join(dir, 'runtime', nodeName);
  const entry = path.join(dir, 'src', 'daemon', 'serve-entry.js');
  if (!fs.existsSync(node) || !fs.existsSync(entry)) {
    process.stdout.write(`[smoke] 诊断：包内运行时缺失（node=${fs.existsSync(node)} entry=${fs.existsSync(entry)}）\n`);
    return;
  }
  const probe = spawnSync(node, [entry, '--project', root, '--desktop'], {
    encoding: 'utf8',
    timeout: 8000,
    env: { ...process.env, MAESTRO_SMOKE_DIAG: '1' },
  });
  const out = `${probe.stdout ?? ''}${probe.stderr ?? ''}`.trim();
  process.stdout.write(`[smoke] 诊断：直起 daemon exit=${probe.status} signal=${probe.signal ?? '-'}\n`);
  for (const line of out.split('\n').slice(0, 20)) process.stdout.write(`[smoke]   | ${line}\n`);
}

async function smokeApp(shellPath, root) {
  const probe = path.join(root, 'probe.jsonl');
  const ctl = path.join(root, 'ctl');
  fs.mkdirSync(ctl, { recursive: true });

  const child = spawn(shellPath, ['--project', root, '--probe', probe, '--ctl', ctl], {
    env: { ...process.env, MAESTRO_CONFIG_DIR: path.join(root, 'config') },
    stdio: 'ignore',
    detached: false,
  });

  try {
    // 1. 启动 → ready
    let ready = null;
    try {
      await waitFor(
        () => {
          ready = readProbeEvents(probe).find((e) => e.event === 'ready') ?? null;
          return ready !== null;
        },
        READY_TIMEOUT_MS,
        '探针 ready',
      );
      record('1. 应用可启动（探针 ready）', true, `view=${ready.view ?? 'n/a'}`);
    } catch (err) {
      record('1. 应用可启动（探针 ready）', false, err.message);
      return;
    }

    // 2. 无凭据 → 401
    const metaPath = path.join(root, '.orch', 'desktop.json');
    try {
      await waitFor(() => fs.existsSync(metaPath), 10_000, 'desktop.json 出现');
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const res = await httpGet(meta.port, '/ui/labels', null);
      record('2. 鉴权守卫（无凭据 401）', res.status === 401, `HTTP ${res.status}`);
    } catch (err) {
      record('2. 鉴权守卫（无凭据 401）', false, err.message);
      await diagnoseDaemon(shellPath, root);
    }
  } finally {
    // 收尾：ctl 触发托盘退出（有实例时需确认），再兜底 kill。
    try {
      fs.writeFileSync(path.join(ctl, 'tray-quit'), '');
      await waitFor(() => child.exitCode !== null || child.signalCode !== null, 15_000, '进程退出');
    } catch {
      child.kill('SIGKILL');
    }
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
}

function verifySigned(target, label) {
  const r = spawnSync('codesign', ['--verify', '--deep', '--strict', target], { encoding: 'utf8' });
  record(label, r.status === 0, `exit ${r.status}${r.stderr ? ` · ${r.stderr.trim().slice(0, 120)}` : ''}`);
  return r.status === 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const platform = process.platform;

  if (platform === 'darwin') {
    const app = args.app;
    if (!app || !fs.existsSync(app)) {
      process.stderr.write('[smoke] FAIL: --app <Maestro.app> 缺失\n');
      process.exit(2);
    }
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-smoke-'));
    try {
      await smokeApp(path.join(app, 'Contents', 'MacOS', 'maestro'), root);
      verifySigned(app, '3. 签名验签（.app）');

      if (args.dmg) {
        const verify = spawnSync('hdiutil', ['verify', args.dmg], { encoding: 'utf8' });
        record('4a. 镜像完整性（hdiutil verify）', verify.status === 0, `exit ${verify.status}`);

        const attach = spawnSync('hdiutil', ['attach', '-nobrowse', '-readonly', args.dmg], { encoding: 'utf8' });
        const mount = String(attach.stdout ?? '')
          .split('\n')
          .map((line) => line.split('\t').pop()?.trim())
          .find((value) => value && value.startsWith('/Volumes/'));
        if (attach.status !== 0 || !mount) {
          record('4b. 镜像内应用复验', false, `挂载失败 exit ${attach.status}`);
        } else {
          try {
            verifySigned(path.join(mount, 'Maestro.app'), '4b. 镜像内应用复验');
          } finally {
            spawnSync('hdiutil', ['detach', mount, '-force'], { stdio: 'ignore' });
          }
        }
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  } else if (platform === 'win32') {
    // Windows 面验的是「安装包里那份应用」：静默安装到临时目录后运行解包产物。
    // NSIS 交互式安装流程与 SmartScreen 首启属人工核验（需求 §1.3 已排除）。
    const installer = args.installer;
    const direct = args.exe;
    if (!installer && !direct) {
      process.stderr.write('[smoke] FAIL: 需要 --installer <setup.exe> 或 --exe <Maestro.exe>\n');
      process.exit(2);
    }
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-smoke-'));
    const installDir = path.join(root, 'app');
    try {
      let exePath = direct;
      if (installer) {
        if (!fs.existsSync(installer)) {
          process.stderr.write(`[smoke] FAIL: 安装包不存在：${installer}\n`);
          process.exit(2);
        }
        // NSIS：/S 静默安装，/D 必须是最后一个参数且不加引号。
        const install = spawnSync(installer, ['/S', `/D=${installDir}`], { stdio: 'ignore' });
        const installed = path.join(installDir, 'Maestro.exe');
        record('安装包可静默安装', install.status === 0 && fs.existsSync(installed), `exit ${install.status}`);
        exePath = installed;
      }
      if (!exePath || !fs.existsSync(exePath)) {
        record('包内可执行存在', false, String(exePath));
      } else {
        await smokeApp(exePath, root);
        record('包内可执行存在', true, exePath);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  } else {
    process.stderr.write(`[smoke] FAIL: 不支持的平台 ${platform}\n`);
    process.exit(2);
  }

  const failed = results.filter((r) => !r.ok);
  process.stdout.write(`[smoke] 汇总：${results.length - failed.length}/${results.length} 通过\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`[smoke] FAIL: ${err.message}\n`);
  process.exit(1);
});
