/**
 * AC-52 · 非恢复路径的三条主链不变。
 *
 * 机检（需求 `:800`）：三链 driver 输出归一化后与基线 diff 为空；
 * `instance graph` / `status` / `role show` 的既有断言全绿
 * （后者由 `test/wp9/i19-regression.test.js` 的 8 条断言承担，本用例实跑该文件）。
 *
 * 基线口径（progress.md「WP-7 任务书必须吸收的三条」第 3 条）：
 * `d4b0f94` 之后已合入 I1.7~I1.12，逐字基线改用 **I1.8 开工点 `014fa6a`** 的 worktree 对照。
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  makeCase, evidence, eq, check, includes, note, finish,
} from '../acc8-f-common.mjs';
import {
  GRADING_ARCH, REPO, NODE, ORCH_BIN, ACC8_PATHS, BASE, ensureDir, runCmd, orch,
  createMockHost, normalizeChain, readText, writeText, cleanupRoot, git,
} from '../acc8-f-lib.mjs';

const BASE_TREE = path.join(BASE, 'i18-acc52-base');

/** 三条主链的驱动输入（与 `test/wp9/i19-regression.test.js` 的 CHAINS 同口径）。 */
const CHAINS = [
  { template: 'single', task: '写一段流程说明' },
  { template: 'code-loop', task: '实现一个示例功能\n产物：calc.js' },
  { template: 'task-loop', task: '整理一份调研纪要\n产物：release-notes.md' },
];

function runChain(tree, chain, tag) {
  const root = path.join(BASE, 'maestro-i18', `ac52-${tag}-${chain.template}`);
  fs.rmSync(root, { recursive: true, force: true });
  ensureDir(root);
  createMockHost(root, path.join(tree, 'test', 'fixtures', 'mock-acp-agent.js'));
  const r = runCmd([NODE, path.join(tree, 'bin', 'orch.js'), 'run', '--cwd', '.', '--template', chain.template, '--host', 'mock', '--task', chain.task], {
    cwd: root,
    timeout: 180_000,
  });
  // 收尾：干净停核心后删根（不动基线树）
  runCmd([NODE, path.join(tree, 'bin', 'orch.js'), 'core', 'stop'], { cwd: root, timeout: 30_000 });
  cleanupRoot(root);
  return { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr, lines: normalizeChain(r.stdout) };
}

export async function run() {
  const c = makeCase('AC-52', {
    scenario: 'three-chains-baseline-diff',
    title: '非恢复路径的三条主链不变（基线 014fa6a）',
    grading: GRADING_ARCH,
  });
  c.root = BASE_TREE;

  // 0) 基线 worktree
  fs.rmSync(BASE_TREE, { recursive: true, force: true });
  const add = git(['worktree', 'add', '--detach', BASE_TREE, ACC8_PATHS.GIT_BASE]);
  evidence(c, 'given', 'worktree-add.txt', `${add.cmd}\nexit=${add.exitCode}\n${add.stdout}\n${add.stderr}`);
  check(c, `基线 worktree 检出 ${ACC8_PATHS.GIT_BASE}`, add.exitCode === 0 && fs.existsSync(path.join(BASE_TREE, 'bin', 'orch.js')), `exit ${add.exitCode}`);

  try {
    // 1) 既有 8 条断言（instance status / graph / role show / 三链可见词）
    const reg = runCmd([NODE, '--test', '--test-concurrency=1', 'test/wp9/i19-regression.test.js'], { cwd: REPO, timeout: 300_000 });
    evidence(c, 'machine', 'i19-regression.log', `${reg.cmd}\nexit=${reg.exitCode}\n${reg.stdout}\n${reg.stderr}`);
    eq(c, 'test/wp9/i19-regression.test.js 全绿（8 条既有断言）', reg.exitCode, 0);

    // 2) 三链 × 两树，归一化逐字比对
    const rows = [];
    for (const chain of CHAINS) {
      const baseRuns = [runChain(BASE_TREE, chain, 'base'), runChain(BASE_TREE, chain, 'base')];
      const base = baseRuns[0];
      let matched = null;
      const currentRuns = [];
      for (let i = 0; i < 3 && matched === null; i += 1) {
        const cur = runChain(REPO, chain, 'cur');
        currentRuns.push(cur);
        const same = cur.lines.length === base.lines.length && cur.lines.every((line, k) => line === base.lines[k]);
        if (same) matched = i + 1;
      }
      rows.push({
        template: chain.template,
        baseExit: base.exitCode,
        baseStable: baseRuns[0].lines.join('\n') === baseRuns[1].lines.join('\n'),
        currentExits: currentRuns.map((r) => r.exitCode),
        matchedAttempt: matched,
        baseLines: base.lines,
        currentLines: currentRuns[0].lines,
      });
      eq(c, `${chain.template}：与基线 014fa6a 归一化输出逐字相同`, matched !== null, true);
      eq(c, `${chain.template}：退出码与基线一致`, currentRuns[0].exitCode, base.exitCode);
      check(c, `${chain.template}：输出无恢复行 / 检查点行 / 复用行`,
        !/恢复：|检查点|会话 复用/.test(currentRuns[0].stdout ?? ''), '无恢复类新行');
    }

    evidence(c, 'machine', 'three-chains.json', JSON.stringify(rows, null, 2));
    evidence(c, 'machine', 'three-chains.diff.txt', rows.map((r) => {
      const diff = [];
      const n = Math.max(r.baseLines.length, r.currentLines.length);
      for (let i = 0; i < n; i += 1) {
        if (r.baseLines[i] !== r.currentLines[i]) diff.push(`${r.template}#${i}\n  base: ${r.baseLines[i] ?? '<none>'}\n  cur : ${r.currentLines[i] ?? '<none>'}`);
      }
      return `## ${r.template}（基线 ${r.baseLines.length} 行 / 当前 ${r.currentLines.length} 行，匹配于第 ${r.matchedAttempt ?? '-'} 次）\n${diff.length ? diff.join('\n') : '(无差异)'}`;
    }).join('\n\n'));

    note(c, `基线树：${BASE_TREE}（detach ${ACC8_PATHS.GIT_BASE}）；对照命令与 D-11 无关，仅三条主链。`);
  } finally {
    const rm = git(['worktree', 'remove', BASE_TREE, '--force']);
    const prune = git(['worktree', 'prune']);
    evidence(c, 'meta', 'worktree-remove.txt', `${rm.cmd}\nexit=${rm.exitCode}\n${rm.stdout}\n${rm.stderr}\n${prune.cmd}\nexit=${prune.exitCode}`);
    eq(c, '基线 worktree 已清理', fs.existsSync(BASE_TREE), false);
  }

  return finish(c);
}
