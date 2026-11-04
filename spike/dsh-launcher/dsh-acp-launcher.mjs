#!/usr/bin/env node
/**
 * dsh-acp-server 的 Windows 绕行启动器。
 *
 * 两个 Windows 事实（都已验证，见报告 §ENV-1）：
 *  1. dsh-acp-server@0.14.4 的 bin 用 `import(join(...))` 加载本地模块，
 *     Node 22 抛 ERR_UNSUPPORTED_ESM_URL_SCHEME（Received protocol 'd:'）。
 *     这里改用 pathToFileURL 加载。
 *  2. `dsh` 在 Windows 上是 dsh.cmd，内部用 Electron（ELECTRON_RUN_AS_NODE=1）
 *     跑 app.asar 里的 cli.js；Node 22 不能直接 spawn .cmd（EINVAL），
 *     也不能用纯 node 读 asar 路径。这里直接以 node 模式启动 Electron 可执行文件。
 *
 * 阶段一若要正式支持 Windows + DSH，应向上游提 issue 或内置该 shim。
 */
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const pkgRoot = process.env.DSH_ACP_PKG_ROOT;
const dshExe = process.env.DSH_EXE;
const dshCliJs = process.env.DSH_CLI_JS;
if (!pkgRoot || !dshExe || !dshCliJs) {
  process.stderr.write('need DSH_ACP_PKG_ROOT / DSH_EXE / DSH_CLI_JS\n');
  process.exit(1);
}

const { ensureAcpProfile } = await import(pathToFileURL(path.join(pkgRoot, 'lib/cli/bootstrap.js')).href);
ensureAcpProfile();

const child = spawn(dshExe, ['--expose-internals', dshCliJs, '--profile', 'acp', ...process.argv.slice(2)], {
  stdio: ['inherit', 'inherit', 'inherit'],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
});

child.on('error', (error) => {
  process.stderr.write(`dsh-acp-launcher: failed to launch: ${String(error)}\n`);
  process.exit(1);
});
child.on('exit', (code, signal) => process.exit(signal ? 129 : (code ?? 0)));
