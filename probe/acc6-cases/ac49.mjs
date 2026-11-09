// AC-49 三条主链逐字回归（回归）
// 基线：docs/iterations/iteration-5/evidence/AC-19.{single,code-loop,task-loop}-baseline.txt
//   （需求点名的对照文件；该证据产自 I1.3 收口 1490f6d 树，而 1490f6d..0cd113b 之间
//   test/fixtures 的驱动零改动（git diff --stat 已核），故它同时代表 0cd113b 的行为——
//   本用例另挂 0cd113b 工作树现跑三链做交叉验证，作为「只加不减」的补充断言）。
// 切取规则（c.note 同时登记）：
//  ① 需求原文两条归一化逐字执行：`已运行 [0-9]+s` 删除、`[0-9]{2}:[0-9]{2}:[0-9]{2}` 删除；
//  ② 夹具侧易变量两条（I1.5 AC-19 同款、已证与产品回归无关）：`mock-sess-<pid>-<n>` 会话号、
//     `耗时 <n>s` 单节点用时；
//  ③ code-loop 驱动自己的收尾 JSON 行（`{"ok":true,"root":…}`）是夹具自述，不属产品终端输出，剔除。
// 机检：`.mock/prompts/*.json` 的 task 文本与 0cd113b 基线树现跑结果一致（I1.5 存量证据无 prompts 帧）。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, NODE, BASE, BASELINE_COMMIT, makeCase, freshRoot, runCmd, orchOf, exists, readJson,
  listFiles, forceKillCore, noteScenario, diffLines, nonEmptyLines, clean, ensureDir,
  text, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-49';
const I15_EVID = path.join(REPO, 'docs', 'iterations', 'iteration-5', 'evidence');
// single 图的最小任务（I1.1 wp9 / I1.3 ac36 / I1.5 AC-19 同款夹具输入）
const SINGLE_TASK = '写一段 200 字的产品说明，保存到 out/intro.md';
const CHAINS = [
  { tpl: 'single', baselineFile: 'AC-19.single-baseline.txt' },
  { tpl: 'code-loop', baselineFile: 'AC-19.code-loop-baseline.txt', scenario: 'pass' },
  { tpl: 'task-loop', baselineFile: 'AC-19.task-loop-baseline.txt', scenario: 'doc-pass' }
];

const treeDir = () => path.join(BASE, `${AC}-baseline`);

function ensureBaselineTree() {
  const dir = treeDir();
  if (exists(dir)) runCmd(['git', 'worktree', 'remove', '--force', dir], { cwd: REPO });
  runCmd(['git', 'worktree', 'prune'], { cwd: REPO });
  const add = runCmd(['git', 'worktree', 'add', '--detach', dir, BASELINE_COMMIT], { cwd: REPO, timeout: 120000 });
  return { dir, add };
}

function dropBaselineTree() {
  const dir = treeDir();
  runCmd(['git', 'worktree', 'remove', '--force', dir], { cwd: REPO });
  runCmd(['git', 'worktree', 'prune'], { cwd: REPO });
  fs.rmSync(dir, { recursive: true, force: true });
}

/** single 图的最小宿主：mock 在会话 cwd 里写 out/intro.md（I1.5 AC-19 同款）。 */
function writeSingleHost(tree, root) {
  const dir = path.join(root, '.orch', 'hosts');
  ensureDir(dir);
  ensureDir(path.join(root, 'work'));
  fs.writeFileSync(path.join(dir, 'dsh.json'), `${JSON.stringify({
    id: 'dsh',
    transport: 'stdio',
    launch: { command: NODE, args: [path.join(tree, 'test', 'fixtures', 'mock-acp-agent.js'), '--write-ref', 'out/intro.md'] },
    limits: {
      initializeTimeoutMs: 15000, requestTimeoutMs: 15000, promptTimeoutMs: 30000,
      quietIdleMs: 30, quietCapMs: 200
    }
  }, null, 2)}\n`, 'utf8');
}

/** 需求两条归一化 + 夹具侧两条易变量 + 驱动 JSON 行三处（规则与理由见文件头注）。 */
function normalize(t) {
  return clean(t)
    .replace(/已运行 [0-9]+s/g, '')
    .replace(/[0-9]{2}:[0-9]{2}:[0-9]{2}/g, '')
    .replace(/mock-sess-[0-9]+-[0-9]+/g, 'mock-sess-<id>')
    .replace(/耗时 [0-9]+s/g, '耗时 <n>s')
    // 驱动收尾 JSON 行里的环境变量：临时根绝对路径（p5→p6 必然不同）与非确定计时
    .replace(/"root":"[^"]*"/g, '"root":"<root>"')
    .replace(/"cwd":"[^"]*"/g, '"cwd":"<cwd>"')
    .replace(/"durationMs":[0-9]+/g, '"durationMs":<n>');
}

/** 驱动收尾 JSON 行（`{"ok":true,"root":…}`）是夹具自述，主体比对时两边都剔除。 */
function stripDriverJson(t) {
  return nonEmptyLines(t).filter((l) => !/^\{"ok":true,"root":/.test(l)).join('\n');
}

/** 在指定代码树上跑一条主链；返回 {res, prompts, productOutput, raw}。跑完停核心。 */
function runChain(tree, root, tpl, scenario) {
  fs.rmSync(root, { recursive: true, force: true });
  ensureDir(root);
  let res;
  if (tpl === 'single') {
    writeSingleHost(tree, root);
    res = orchOf(tree, root, ['run', '--cwd', './work', '--task', SINGLE_TASK, '--host', 'dsh']);
  } else {
    noteScenario();
    res = runCmd([NODE, path.join(tree, 'test', 'fixtures', `${tpl}-driver.mjs`), '--root', root, '--scenario', scenario],
      { cwd: tree, timeout: 120000 });
  }
  const promptDir = path.join(root, '.mock', 'prompts');
  const prompts = listFiles(promptDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => readJson(path.join(promptDir, ...f.split('/'))))
    .filter(Boolean)
    .map((p) => p.task);
  // 驱动自己的收尾 JSON 属夹具自述，剔除后再比（I1.5 AC-19 同款口径）。
  const productOutput = nonEmptyLines(text(res)).filter((l) => !/^\{"ok":true,"root":/.test(l)).join('\n');
  orchOf(tree, root, ['core', 'stop']);
  forceKillCore(root);
  return { res, prompts, productOutput, raw: text(res) };
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '混合',
  timeoutMs: 300_000,
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '混合' });
    const root = freshRoot(AC);
    c.add(root);
    c.note('基线来源与切取规则见文件头注：I1.5 存量 AC-19 三份 baseline.txt（1490f6d 树产出、驱动零改动故代表 0cd113b）为需求点名基线；0cd113b 工作树现跑三链作交叉验证与 prompts 基线；归一化 = 需求两条（已运行 Ns、HH:mm:ss）+ 夹具侧两条（mock-sess 会话号、耗时 Ns）+ 剔除驱动收尾 JSON 行。');

    const { dir: tree, add } = ensureBaselineTree();
    try {
      c.eq('Given 基线代码树挂载成功（git worktree 0cd113b）', add.exitCode, 0);
      c.check('Given 基线树 bin/orch.js 与驱动存在',
        exists(path.join(tree, 'bin', 'orch.js')) && exists(path.join(tree, 'test', 'fixtures', 'code-loop-driver.mjs')),
        tree);

      for (const { tpl, baselineFile, scenario } of CHAINS) {
        const base = runChain(tree, root, tpl, scenario);
        c.cmd(base.res, `orch run（${tpl}，${BASELINE_COMMIT} 基线树）`);
        const cur = runChain(REPO, root, tpl, scenario);
        c.cmd(cur.res, `orch run（${tpl}，当前 HEAD）`);

        // Then：两条树都是退出码 0
        c.eq(`Then ${tpl} 基线树退出码 0`, base.res.exitCode, 0);
        c.eq(`Then ${tpl} 当前退出码 0`, cur.res.exitCode, 0);

        // 证据落盘（原始帧）
        c.evText(`${tpl}-current`, cur.raw);
        c.evText(`${tpl}-baseline-tree`, base.raw);

        // 机检主断言：归一化后与 I1.5 存量基线文件 diff 为空。
        // 切取规则：存量 code-loop 基线第一行是驱动收尾 JSON（夹具自述，含 p5 临时根绝对路径与
        // 非确定 durationMs），按任务口径「只比对输出主体」——两边都剔除该行后逐行比；
        // 附加断言（下一条）再对含 JSON 行的整输出做路径/计时归一化后比对，覆盖更强。
        const stored = clean(fs.readFileSync(path.join(I15_EVID, baselineFile), 'utf8'));
        const dStored = diffLines(normalize(stripDriverJson(cur.raw)), normalize(stripDriverJson(stored)));
        c.evText(`${tpl}-diff-vs-stored`, dStored.diffs.map((x) => `#${x.i}\n- ${x.a}\n+ ${x.b}`).join('\n') || '（无差异）');
        c.check(`机检：${tpl} 归一化后与 I1.5 存量基线（${baselineFile}）diff 为空（输出主体）`, dStored.same,
          `${dStored.diffs.length} 行差异：${JSON.stringify(dStored.diffs.slice(0, 3))}`);

        // 附加断言（只加不减）：不剔除 JSON 行，把 root/cwd 绝对路径与 durationMs 归一化后
        // 整输出（含驱动 JSON 行）与存量基线 diff 为空。
        const dFull = diffLines(normalize(cur.raw), normalize(stored));
        c.evText(`${tpl}-diff-vs-stored-full`, dFull.diffs.map((x) => `#${x.i}\n- ${x.a}\n+ ${x.b}`).join('\n') || '（无差异）');
        c.check(`机检：${tpl} 归一化后与存量基线整输出 diff 为空（含驱动 JSON 行，路径/计时归一化）`, dFull.same,
          `${dFull.diffs.length} 行差异：${JSON.stringify(dFull.diffs.slice(0, 3))}`);

        // 交叉验证（只加不减）：0cd113b 树现跑输出归一化后同样与存量基线 diff 为空
        const dCross = diffLines(normalize(stripDriverJson(base.raw)), normalize(stripDriverJson(stored)));
        c.evText(`${tpl}-diff-baseline-tree-vs-stored`, dCross.diffs.map((x) => `#${x.i}\n- ${x.a}\n+ ${x.b}`).join('\n') || '（无差异）');
        c.check(`机检：${tpl} 0cd113b 树现跑输出与存量基线也 diff 为空（基线出处自证）`, dCross.same,
          `${dCross.diffs.length} 行差异：${JSON.stringify(dCross.diffs.slice(0, 3))}`);

        // 机检：.mock/prompts task 文本与 0cd113b 基线一致
        c.deepEq(`机检：${tpl} 的 .mock/prompts task 文本与 0cd113b 基线一致`,
          cur.prompts, base.prompts);
      }
    } finally {
      dropBaselineTree();
      c.note('基线工作树已移除（git worktree remove --force + prune），仓库工作区未被改动。');
    }

    c.check('And 收尾后没有残留的基线工作树', !exists(treeDir()), treeDir());
    return finish(c);
  }
}];
