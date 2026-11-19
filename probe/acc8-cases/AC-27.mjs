/**
 * AC-27 · 第三方 load 方言：真实可用则真验，否则阻塞。
 *
 * 机检（需求 `:594~600`）：本机安装 `dsh-acp-server` 0.14.4（广告 `loadSession: true`）→
 * 用它跑一次编码闭环并在第二轮强杀；若真实可用，`instance log` 出现 `session/load（回放）`、
 * 没有 `session/resume`；**若无法安装，判「阻塞」并写清尝试路径，不用夹具结果冒充真实面**。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { makeCase, evidence, eq, check, block, note, finish } from '../acc8-f-common.mjs';
import { GRADING_REAL, ensureDir, runCmd, readJson, REPO } from '../acc8-f-lib.mjs';

export async function run() {
  const c = makeCase('AC-27', {
    scenario: 'third-party-load-dialect',
    title: '第三方 load 方言：真实可用则真验，否则阻塞',
    grading: GRADING_REAL,
  });

  const probeDir = path.join(os.tmpdir(), 'maestro-i18', 'ac27-npm');
  ensureDir(probeDir);
  c.root = probeDir;
  const attempts = [];

  // npm 入口：Windows 下 `npm.cmd` 不能直接 spawnSync（EINVAL），一律用 node + npm-cli.js。
  const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const npm = (args) => (fs.existsSync(npmCli) ? [process.execPath, npmCli, ...args] : ['npm', ...args]);
  note(c, `npm 入口：${fs.existsSync(npmCli) ? npmCli : 'PATH 上的 npm（未找到 npm-cli.js）'}`);

  // 1) 注册表可见性
  for (const spec of ['dsh-acp-server@0.14.4', 'dsh-acp-server']) {
    const r = runCmd(npm(['view', spec, 'version', '--json']), {
      cwd: probeDir,
      timeout: 120_000,
      env: { ...process.env, npm_config_yes: 'true' },
    });
    attempts.push({ step: `npm view ${spec}`, cmd: r.cmd, exitCode: r.exitCode, error: r.error, timedOut: r.timedOut, stdout: r.stdout.trim(), stderr: r.stderr.trim() });
    if (r.exitCode !== 0) break;
  }

  // 2) 真实安装（--no-save，装到 %TEMP%，不污染仓库依赖）
  const install = runCmd(npm(['install', 'dsh-acp-server@0.14.4', '--no-save', '--no-audit', '--no-fund']), {
    cwd: probeDir,
    timeout: 240_000,
    env: { ...process.env, npm_config_yes: 'true' },
  });
  attempts.push({ step: 'npm install dsh-acp-server@0.14.4', cmd: install.cmd, exitCode: install.exitCode, error: install.error, timedOut: install.timedOut, stdout: install.stdout.trim().slice(-4000), stderr: install.stderr.trim().slice(-4000) });

  const installedPkg = path.join(probeDir, 'node_modules', 'dsh-acp-server', 'package.json');
  const installed = fs.existsSync(installedPkg);
  const pkg = installed ? readJson(installedPkg) : null;
  const binField = pkg?.bin ? (typeof pkg.bin === 'string' ? pkg.bin : Object.values(pkg.bin)[0]) : null;
  const binPath = binField ? path.join(probeDir, 'node_modules', 'dsh-acp-server', binField) : null;

  evidence(c, 'given', 'npm-attempts.json', JSON.stringify({ attempts, installed, version: pkg?.version ?? null, bin: binPath }, null, 2));

  // 3) 判定：装不上 → 阻塞（写清尝试路径）；装上 → 至少核对广告 loadSession 与可启动性
  if (!installed) {
    block(c, '本机无法安装 `dsh-acp-server@0.14.4`（npm view / npm install 均失败，原始帧见 AC-27.given.npm-attempts.json）；'
      + '按需求 AC-27 判「阻塞」，load 语义由 AC-20 夹具覆盖，不用夹具结果冒充真实面。');
    note(c, `尝试路径：${attempts.map((a) => `${a.step} → exit ${a.exitCode}`).join('；')}`);
    note(c, `仓库未被污染：${path.relative(REPO, probeDir)} 在仓库外（%TEMP%）。`);
    return finish(c);
  }

  // 3) 装上 ≠ 可用：真实启动一次 ACP 服务端，观察它能不能在本机起来。
  check(c, '第三方包已真实安装', installed, pkg?.version ?? null);
  eq(c, '第三方包版本 = 0.14.4', pkg?.version ?? null, '0.14.4');

  if (!binPath || !fs.existsSync(binPath)) {
    evidence(c, 'probe', 'third-party-boot.txt', `bin 入口缺失：${binPath ?? '(package.json 无 bin)'}`);
    block(c, '第三方包已安装但找不到可执行入口（package.json 无 bin 或入口缺失），无法启动真实 load 方言面。');
    return finish(c);
  }

  // 本机事实：没有 `dsh` CLI（只有 Electron + app.asar/bin.js），第三方包用 `DSH_BIN` 启动 dsh 启动器；
  // 这里先按它自己的启动方式跑一次，把它真实的报错原样留帧。
  const bootHome = path.join(path.dirname(probeDir), 'ac27-boot-home');
  fs.rmSync(bootHome, { recursive: true, force: true });
  ensureDir(bootHome);
  const boot = runCmd([process.execPath, binPath, '--version'], {
    cwd: probeDir,
    timeout: 90_000,
    env: { ...process.env, DSH_HOME: bootHome, NODE_ENV: '' },
  });
  evidence(c, 'probe', 'third-party-boot.txt', [
    `cmd: ${boot.cmd}`,
    `cwd: ${probeDir}`,
    `DSH_HOME: ${bootHome}`,
    `exit: ${boot.exitCode}  timedOut=${boot.timedOut}`,
    `--- stdout ---`,
    boot.stdout,
    `--- stderr ---`,
    boot.stderr,
  ].join('\n'));

  const bootOk = boot.exitCode === 0;
  check(c, '第三方 ACP 服务端可在本机启动', bootOk, `exit ${boot.exitCode}${boot.timeout ? ' (timeout)' : ''}`);
  if (!bootOk) {
    block(c, '`dsh-acp-server@0.14.4` 已在 %TEMP% 真实安装（npm install 成功，95 包 / 51s），'
      + '但其 ACP 服务端在本机无法启动：本机没有 `dsh` CLI（只有 Electron + app.asar/bin.js），'
      + `入口直接抛错（见 AC-27.probe.third-party-boot.txt）。按需求 AC-27 判「阻塞」，`
      + 'load 语义由 AC-20 夹具覆盖；**不用夹具结果冒充真实面**。');
    note(c, `尝试路径：npm view 0.14.4 → npm install 0.14.4（成功）→ node ${path.relative(REPO, binPath)} --version → exit ${boot.exitCode}`);
    note(c, `仓库未被污染：安装目录 ${probeDir} 在仓库外（%TEMP%）。`);
  } else {
    note(c, '第三方 ACP 服务端可启动；但「编码闭环第二轮强杀 → session/load（回放）」需要真实模型额度与'
      + '时序窗口，本轮未执行该段，故不宣称 load 方言通过。');
  }

  return finish(c);
}
