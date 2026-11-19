/**
 * AC-55 · 不新增 CLI 命令，用法块不变。
 *
 * 机检（需求 `:844`）：`USAGE_LINES.length === 25`；`COMMANDS` 不含 `recover`；
 * `orch --help` 前 8 行与 I1.6 基线逐字相同；`orch recover` 退出码 2。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, evidence, eq, check, includes, excludes, note, finish } from '../acc8-f-common.mjs';
import {
  GRADING_ARCH, REPO, NODE, ORCH_BIN, ACC8_PATHS, BASE, runCmd, readText, writeText,
  ensureDir, git, loadModule,
} from '../acc8-f-lib.mjs';

export async function run() {
  const c = makeCase('AC-55', {
    scenario: 'cli-surface-frozen',
    title: '不新增 CLI 命令，用法块不变',
    grading: GRADING_ARCH,
  });
  c.root = REPO;

  // 1) 当前 labels.js
  const labels = await loadModule(path.join(REPO, 'src', 'cli', 'labels.js'));
  const usage = [...labels.USAGE_LINES];

  // 2) 基线 labels.js（I1.8 开工点 014fa6a）抽到 %TEMP% 后 import，逐字对照
  const baseDir = path.join(BASE, 'maestro-i18', 'ac55');
  fs.rmSync(baseDir, { recursive: true, force: true });
  ensureDir(baseDir);
  const show = git(['show', `${ACC8_PATHS.GIT_BASE}:src/cli/labels.js`]);
  const baseFile = path.join(baseDir, 'labels.base.mjs');
  writeText(baseFile, show.stdout);
  const baseLabels = show.exitCode === 0 ? await loadModule(baseFile) : { USAGE_LINES: [] };
  const baseUsage = [...(baseLabels.USAGE_LINES ?? [])];

  evidence(c, 'given', 'usage-lines.json', JSON.stringify({
    current: usage,
    baseline: baseUsage,
    baselineCommit: ACC8_PATHS.GIT_BASE,
  }, null, 2));

  eq(c, 'USAGE_LINES.length === 25', usage.length, 25);
  eq(c, '前 8 行与基线 014fa6a 逐字相同', usage.slice(0, 8), baseUsage.slice(0, 8));
  eq(c, '整份用法块与基线逐字相同', usage, baseUsage);

  // 3) COMMANDS 不含 recover（读 main.js 的命令集合字面量）
  const mainSrc = readText(path.join(REPO, 'src', 'cli', 'main.js'));
  const m = mainSrc.match(/const COMMANDS = new Set\(\[([^\]]*)\]\)/);
  const commands = m ? m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean) : [];
  const runtimeMatch = mainSrc.match(/const RUNTIME_COMMANDS = new Set\(\[([\s\S]*?)\]\)/);
  const runtimeCommands = runtimeMatch ? [...runtimeMatch[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
  evidence(c, 'given', 'command-sets.json', JSON.stringify({ commands, runtimeCommands }, null, 2));
  check(c, 'COMMANDS 已从 main.js 解析到', commands.length > 0, JSON.stringify(commands));
  eq(c, 'COMMANDS 不含 recover', commands.includes('recover'), false);
  eq(c, 'RUNTIME_COMMANDS 不含 recover', runtimeCommands.includes('recover'), false);

  // 4) orch recover → 退出码 2
  const recoverRoot = path.join(baseDir, 'recover-root');
  ensureDir(recoverRoot);
  const r = runCmd([NODE, ORCH_BIN, 'recover'], { cwd: recoverRoot, timeout: 60_000 });
  evidence(c, 'machine', 'orch-recover.txt', `${r.cmd}\nexit=${r.exitCode}\n--- stdout ---\n${r.stdout}\n--- stderr ---\n${r.stderr}`);
  eq(c, 'orch recover 退出码 = 2', r.exitCode, 2);
  includes(c, 'orch recover 输出用法（未知命令）', `${r.stdout}${r.stderr}`, '用法：orch');

  const help = runCmd([NODE, ORCH_BIN, '--help'], { cwd: recoverRoot, timeout: 60_000 });
  evidence(c, 'machine', 'orch-help.txt', `${help.cmd}\nexit=${help.exitCode}\n${help.stdout}`);
  excludes(c, 'orch --help 不含 recover 子命令', help.stdout, 'orch recover');
  note(c, `--help 实际行数 ${help.stdout.split(/\r?\n/).filter(Boolean).length}（25 行用法块 + I1.12 的 6 行扩展，AC-55 只冻结 USAGE_LINES）。`);

  return finish(c);
}
