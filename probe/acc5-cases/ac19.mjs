// AC-19 新增角色不改变三条主链输出（回归）
// 基线 = I1.3 收口后的 main 提交 1490f6d（`git worktree` 挂一份只读代码树），
// 两条代码树用**同一个项目根路径**先后跑同一条命令，因此输出里的绝对路径逐字可比。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, BASE, REPO, NODE, MOCK, BASELINE_COMMIT, SINGLE_TASK,
  runCmd, orchOf, codeDriverOf, taskDriverOf, readJson, readState, listFiles,
  stripRequired, stripFixtureVars, diffLines, shapeOf, ensureDir, exists, forceKillCore,
  nonEmptyLines, text, requirementTitle, finish, noteScenario
} from '../acc5-f-common.mjs';

const AC = 'AC-19';
const CHAINS = [
  { tpl: 'single', label: 'single' },
  { tpl: 'code-loop', label: 'code-loop' },
  { tpl: 'task-loop', label: 'task-loop' }
];

function baselineDir() { return path.join(BASE, `${AC}-baseline`); }

/** 挂上 / 刷新基线工作树（残留注册先清掉，避免「already registered」）。 */
function ensureBaseline() {
  const dir = baselineDir();
  if (exists(dir)) runCmd(['git', 'worktree', 'remove', '--force', dir], { cwd: REPO });
  runCmd(['git', 'worktree', 'prune'], { cwd: REPO });
  const add = runCmd(['git', 'worktree', 'add', '--detach', dir, BASELINE_COMMIT], { cwd: REPO, timeout: 120000 });
  return { dir, add };
}

function dropBaseline() {
  const dir = baselineDir();
  runCmd(['git', 'worktree', 'remove', '--force', dir], { cwd: REPO });
  runCmd(['git', 'worktree', 'prune'], { cwd: REPO });
  fs.rmSync(dir, { recursive: true, force: true });
}

/** single 图的最小宿主：mock 在会话 cwd 里写 out/intro.md（I1.1 wp9 同款）。 */
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

/** 在指定代码树上跑一条主链；返回 {res, prompts, state}。跑完停核心，避免下一次 rm 撞 EBUSY。 */
async function runChain(tree, root, tpl) {
  fs.rmSync(root, { recursive: true, force: true });
  ensureDir(root);
  let res;
  if (tpl === 'single') {
    writeSingleHost(tree, root);
    res = orchOf(tree, root, ['run', '--cwd', './work', '--task', SINGLE_TASK, '--host', 'dsh']);
  } else if (tpl === 'code-loop') {
    noteScenario();
    res = codeDriverOf(tree, root, ['--scenario', 'pass']);
  } else {
    noteScenario();
    res = taskDriverOf(tree, root, ['--scenario', 'doc-pass']);
  }
  const promptDir = path.join(root, '.mock', 'prompts');
  const prompts = listFiles(promptDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => readJson(path.join(promptDir, ...f.split('/'))))
    .filter(Boolean)
    .map((p) => ({ n: p.n, nodeId: p.nodeId ?? null, round: p.round ?? null, task: p.task }));
  const state = readState(root);
  // `orch run` 会留下常驻核心（它是加速器），读命令持有项目根：先停掉再进下一轮。
  orchOf(tree, root, ['core', 'stop']);
  await forceKillCore(root);
  // 驱动自己的收尾 JSON（`{"ok":true,"root":…}`）属于夹具自述，不是产品终端输出，剔除后再比。
  const productOutput = nonEmptyLines(text(res)).filter((l) => !/^\{"ok":true,"root":/.test(l)).join('\n');
  return { res, prompts, state, output: productOutput, raw: text(res) };
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '混合',
  timeoutMs: 240_000,
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '混合' });
    c.note('单条限时由 90s 放宽到 240s：本条要跑 3 条主链 × 2 份代码树 = 6 次完整运行。'
      + '模板 §3.2 的 90s 用于防挂死，本条按实测耗时登记为已授权例外（见 probe/acc5-cases/README.md）。');
    const { dir, add } = ensureBaseline();
    c.cmd(add, `git worktree add --detach <base> ${BASELINE_COMMIT}（挂 I1.3 基线代码树）`);
    const root = freshRoot(AC);
    c.add(root);

    try {
      c.eq('Given 基线代码树挂载成功', add.exitCode, 0);
      c.check('Given 基线树的 bin/orch.js 存在', exists(path.join(dir, 'bin', 'orch.js')), path.join(dir, 'bin', 'orch.js'));

      c.note('比对口径：① 需求原文的两条归一化（`已运行 Ns` 与 `HH:mm:ss`）原样执行；'
        + '② 另加夹具侧易变量（`mock-sess-<pid>-<n>` 会话号、`耗时 Ns`）——同一场景两次运行必然不同，与产品是否回归无关，'
        + '并逐条证明「只用需求两条时」的剩余差异全部落在这两类变量上；'
        + '③ 驱动自己的收尾 JSON 行（`{"ok":true,"root":…}`）是夹具自述，不属产品终端输出，已剔除（原始输出仍整段落盘）。');

      for (const { tpl } of CHAINS) {
        const base = await runChain(dir, root, tpl);
        c.cmd(base.res, `orch run（${tpl}，基线 ${BASELINE_COMMIT}）`);
        const cur = await runChain(REPO, root, tpl);
        c.cmd(cur.res, `orch run（${tpl}，当前 HEAD）`);

        c.eq(`Then ${tpl} 基线退出码 0`, base.res.exitCode, 0);
        c.eq(`Then ${tpl} 当前退出码 0`, cur.res.exitCode, 0);

        const reqDiff = diffLines(stripRequired(base.output), stripRequired(cur.output));
        const fullDiff = diffLines(stripFixtureVars(base.output), stripFixtureVars(cur.output));
        c.evText(`${tpl}-baseline`, base.raw);
        c.evText(`${tpl}-current`, cur.raw);
        c.evText(`${tpl}-diff-required`, reqDiff.diffs.map((d) => `#${d.i}\n- ${d.a}\n+ ${d.b}`).join('\n') || '（无差异）');
        c.evText(`${tpl}-diff-normalized`, fullDiff.diffs.map((d) => `#${d.i}\n- ${d.a}\n+ ${d.b}`).join('\n') || '（无差异）');

        c.check(`机检：${tpl} 归一化后逐行一致（需求两条归一化 + 夹具侧易变量）`, fullDiff.same,
          `${fullDiff.diffs.length} 行差异：${JSON.stringify(fullDiff.diffs.slice(0, 3))}`);
        // 需求原文只给两条 sed；这里逐条证明剩余差异**只**来自夹具侧的会话号/耗时。
        const onlyFixtureVars = reqDiff.diffs.every((d) => stripFixtureVars(d.a ?? '') === stripFixtureVars(d.b ?? ''));
        c.check(`机检：${tpl} 仅用需求两条归一化时的差异，逐条都可归因到夹具侧变量`,
          onlyFixtureVars, `${reqDiff.diffs.length} 行：${JSON.stringify(reqDiff.diffs.slice(0, 3))}`);

        // 夹具面：prompts 的 task 文本与基线一致
        c.deepEq(`夹具：${tpl} 的 .mock/prompts/*.json task 文本与 I1.3 基线一致`,
          base.prompts.map((p) => p.task), cur.prompts.map((p) => p.task));
        c.check(`夹具：${tpl} 未在提示词里插入任何角色/技能字样`,
          cur.prompts.every((p) => !/(developer|tester|researcher|writer|reviewer|coordinator|技能)/.test(String(p.task))),
          JSON.stringify(cur.prompts.map((p) => p.task).slice(0, 2)));
        c.eq(`夹具：${tpl} 的提示词帧数一致`, cur.prompts.length, base.prompts.length);

        // 机检：state.json 的键集合与基线相同
        c.deepEq(`机检：${tpl} 的 state.json 键集合与 I1.3 基线相同`, shapeOf(cur.state), shapeOf(base.state));
      }
    } finally {
      dropBaseline();
      c.note('基线工作树已移除（`git worktree remove --force` + `prune`），仓库工作区未被改动。');
    }

    c.check('And 收尾后没有残留的基线工作树', !exists(baselineDir()), baselineDir());
    return finish(c);
  }
}];
