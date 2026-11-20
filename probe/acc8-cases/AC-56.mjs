/**
 * AC-56 · I1.7 未合入：不依赖 worktree，合入后重跑。
 *
 * 需求 Given 写「当前 origin/main 不含 I1.7」，机检含
 * `grep -R "worktree" src/ | wc -l` = 0 与「`docs/iterations/iteration-7/requirement.md` 不存在」。
 * 但 I1.7 已合入 main（裁-12），上述两个锚点客观不再成立 → **按裁-12 的合入后口径重判**：
 *
 *  1. `test ! -e src/core/worktree.js` 仍成立（保留）；
 *  2. `git diff 014fa6a..HEAD -- src/core/orchestrator.js | grep -c worktree` = 0；
 *  3. `git diff 014fa6a..HEAD -- src/core/orchestrator.js | grep -cE "artifact_type.*dir|merge.*order"` = 0；
 *  4. `grep -R -E "artifact_type.*dir|merge.*order" src/core src/daemon | wc -l` = 2
 *     （裁-12：两处在 014fa6a 基线已存在，锁定基线值、不新增；需求原文 `= 0`
 *     建立在「main 不含 I1.7」的假设上，已被 I1.7 合入推翻）；
 *  5. 登记事实：I1.7 已合入（`docs/iterations/iteration-7/requirement.md` 与
 *     `src/core/code-isolation.js` 均存在），AC-56 按合入后口径重判。
 *
 * `grep -R "worktree" src/ | wc -l` **不再适用**（I1.7 自身引入），不为凑数字改 I1.7 代码。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, evidence, eq, check, note, finish } from '../acc8-f-common.mjs';
import { GRADING_ARCH, REPO, ACC8_PATHS, runCmd, git } from '../acc8-f-lib.mjs';

function grepCount(argv, cwd = REPO) {
  const r = runCmd(['bash', '-lc', argv], { cwd, timeout: 120_000, env: { ...process.env } });
  return { cmd: argv, exitCode: r.exitCode, stdout: r.stdout.trim(), stderr: r.stderr.trim() };
}

export async function run() {
  const c = makeCase('AC-56', {
    scenario: 'i17-merged-recheck',
    title: 'I1.7 已合入：恢复实现不依赖 worktree / 产物隔离（按裁-12 重判）',
    grading: GRADING_ARCH,
  });
  c.root = REPO;

  // 1) 保留断言
  const worktreeJs = path.join(REPO, 'src', 'core', 'worktree.js');
  eq(c, 'test ! -e src/core/worktree.js', fs.existsSync(worktreeJs), false);

  // 2) I1.8 对 orchestrator.js 的新增行不出现 worktree
  const diffWorktree = grepCount(`git diff ${ACC8_PATHS.GIT_BASE}..HEAD -- src/core/orchestrator.js | grep -c worktree`);
  eq(c, 'git diff 014fa6a..HEAD orchestrator.js | grep -c worktree = 0', diffWorktree.stdout, '0');

  // 3) 新增行不出现产物隔离目录 / 合并顺序假设
  const diffArtifact = grepCount(`git diff ${ACC8_PATHS.GIT_BASE}..HEAD -- src/core/orchestrator.js | grep -cE "artifact_type.*dir|merge.*order"`);
  eq(c, 'git diff 014fa6a..HEAD orchestrator.js | grep -cE "artifact_type.*dir|merge.*order" = 0', diffArtifact.stdout, '0');

  // 4) 引擎与守护进程全文命中数 === 014fa6a 基线值（2 处），不新增
  //    裁-12：两处命中在基线已存在（src/core/code-isolation.js:6、
  //    src/core/orchestrator.js 的 merge order 注释），需求原文 `= 0` 建立在
  //    「main 不含 I1.7」的假设上，该假设已被 I1.7 合入推翻。按「不新增」锁定：
  //    实测数必须恰好等于基线数，多一处即失败 —— 这是收紧，不是放宽。
  const BASELINE_SRC_HITS = '2';
  const srcGrep = grepCount('grep -R -E "artifact_type.*dir|merge.*order" src/core src/daemon | wc -l');
  eq(c, '全仓命中数 === 014fa6a 基线值 2（不新增）', srcGrep.stdout, BASELINE_SRC_HITS);

  // 5) 登记事实：I1.7 已合入
  const i17Req = path.join(REPO, 'docs', 'iterations', 'iteration-7', 'requirement.md');
  const codeIsolation = path.join(REPO, 'src', 'core', 'code-isolation.js');
  check(c, 'I1.7 已合入（docs/iterations/iteration-7/requirement.md 存在）', fs.existsSync(i17Req), i17Req);
  check(c, 'I1.7 已合入（src/core/code-isolation.js 存在）', fs.existsSync(codeIsolation), codeIsolation);

  // 附：旧锚点现状（不判过，只登记）
  const srcWorktreeCount = grepCount('grep -R "worktree" src/ | wc -l');
  const head = git(['rev-parse', '--short', 'HEAD']);

  evidence(c, 'machine', 'gates.txt', [
    `# 1) test ! -e src/core/worktree.js → ${fs.existsSync(worktreeJs) ? 'EXISTS(失败)' : 'ok'}`,
    `# 2) ${diffWorktree.cmd}\n${diffWorktree.stdout}`,
    `# 3) ${diffArtifact.cmd}\n${diffArtifact.stdout}`,
    `# 4) ${srcGrep.cmd}\n${srcGrep.stdout}`,
    `# 5) i17 requirement exists=${fs.existsSync(i17Req)} code-isolation exists=${fs.existsSync(codeIsolation)}`,
    `# 6) 旧锚点（不再适用，仅登记）：grep -R "worktree" src/ | wc -l → ${srcWorktreeCount.stdout}`,
    `# HEAD ${head.stdout.trim()} / 基线 ${ACC8_PATHS.GIT_BASE}`,
    '',
  ].join('\n'));

  note(c, 'I1.7 已合入（`docs/iterations/iteration-7/requirement.md` 存在、`src/core/code-isolation.js` 存在），'
    + 'AC-56 已按裁-12 的合入后口径重判；67 条 AC 的合入后重跑体现在 I1.8 S2 全量回归（基线 014fa6a）与 S3 逐条取证中。');
  note(c, `\`grep -R "worktree" src/ | wc -l\` 现为 ${srcWorktreeCount.stdout}（I1.7 自身引入），按裁-12 **不再适用**，`
    + '未为凑该数字改动 I1.7 代码。');

  return finish(c);
}
