#!/usr/bin/env node
/**
 * `orch` 可执行入口：拿 argv → main → 退出码（§2.14）。
 *
 * 另有一条内部通道：`core serve --project <root>` 是 `client` 自动拉起核心时使用的
 * 进程入口，转调 `src/daemon/serve-entry.js`。这条分支**不调** `process.exit`：
 * 核心自己管生命周期（`core.stop` 时优雅退出）。
 */
import { main } from '../src/cli/main.js';
import { cliDiscoveryMain } from '../src/cli/cli-discovery.js';

const argv = process.argv.slice(2);

/**
 * 内部通道只认**位置参数**：`core` 必须是第一个、`serve` 必须是第二个。
 * 用 `argv.includes(...)` 会把 `orch run --cwd core --task serve` 这类合法参数误判成内部通道。
 */
export function isInternalChannel(args) {
  return Array.isArray(args) && args[0] === 'core' && args[1] === 'serve';
}

if (isInternalChannel(argv)) {
  await import('../src/daemon/serve-entry.js');
} else if (argv[0] === 'cli') {
  // v2 A1: CLI discovery is a separate command family; its parser and writes
  // are isolated from the frozen I1.x command surface in main.js.
  const code = await cliDiscoveryMain(argv.slice(1));
  process.exit(code);
} else {
  const code = await main(argv);
  process.exit(code);
}
