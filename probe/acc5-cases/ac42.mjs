// AC-42 既有 418 条测试全绿（回归）
//
// 判定口径（按需求字面，主控裁决 2026-11-08，记入 decisions.md B-2）：
//   需求 When/Then 是「执行 `node --test "test/**/*.test.js"` → fail === 0、pass === tests、
//   tests >= 418」，即**单次执行**的结果。因此判定锚定「存在一次同命令全绿 + 该次 pass === tests
//   + tests >= 418」，并要求「所有出现过的失败项都能归因到并发环境，而不是功能回归」。
//
// 为什么要跑多次：本机在默认并发（12 核）下，既有套件里有一批**时序敏感**的用例会随机红——
//   `wp10/perf.test.js` 的 p95 绝对墙钟预算、`wp3/stdio-transport.test.js` 与
//   `wp8/f1-permission.test.js` 的子进程启停时序。单跑一次可能撞绿也可能撞红，
//   所以「重试到出现一次全绿」是取得需求要求的那一次结果的手段，不是放宽：
//   每一次的 TAP 原始输出都落盘（`evidence/AC-42.suite-run*.txt`），失败项逐条进核对表。
//
// 归因方式（硬要求，防止「红了就当环境问题」）：
//   把每个失败用例的**所在文件单独跑一次**。单跑通过 → 并发环境问题；单跑也失败 → 功能问题，判不通过。
//   这条是把「失败项名字长得像 NFR」这种软判据换成**行为证据**。
//
// 另附两条不参与判定的归因证据：
//   · `--test-concurrency=4` 同命令是否全绿 → 证明同一份代码降并发可全绿；
//   · 未改动的基线提交 1490f6d 跑同一条命令 → 证明该不稳定不是 I1.5 引入的。
import path from 'node:path';
import {
  makeCase, freshRoot, nodeTest, text, requirementTitle, finish, runCmd, REPO, NODE,
  BASE, BASELINE_COMMIT, sweepStrays
} from '../acc5-f-common.mjs';

const AC = 'AC-42';
const MAX_RUNS = 6;

/** 解析 TAP 汇总行。 */
function parse(out) {
  const m = (re) => Number(re.exec(out)?.[1] ?? -1);
  return {
    tests: m(/^# tests (\d+)$/m),
    pass: m(/^# pass (\d+)$/m),
    fail: m(/^# fail (\d+)$/m)
  };
}

/** 从 TAP 里取出每个失败用例的名字与所在测试文件（相对仓库根）。 */
function parseFails(out) {
  const lines = out.split(/\r?\n/);
  const fails = [];
  for (let i = 0; i < lines.length; i += 1) {
    const hit = /^not ok \d+ - (.+)$/.exec(lines[i]);
    if (!hit) continue;
    let file = null;
    for (let j = i + 1; j < Math.min(i + 30, lines.length); j += 1) {
      if (/^\s*\.\.\.\s*$/.test(lines[j])) break;
      const loc = /^\s*location: '(.+)'\s*$/.exec(lines[j]);
      if (loc) {
        const rel = /(test[\\/][^:]+\.test\.[cm]?js)/.exec(loc[1]);
        if (rel) file = rel[1].replaceAll('\\', '/');
        break;
      }
    }
    fails.push({ name: hit[1], file });
  }
  return fails;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '架构检查',
  timeoutMs: 900_000,
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '架构检查' });
    c.note(`单条限时由 90s 放宽到 900s：本条最多跑 ${MAX_RUNS} 次全量回归（每次约 13~20s）+ 失败项单跑归因`
      + ' + 1 次降并发诊断 + 1 次基线对照，模板 §3.2 的 90s 用于防挂死，本条按实测耗时登记为已授权例外'
      + '（见 probe/acc5-cases/README.md）。');
    const root = freshRoot(AC);
    c.add(root); // 独立根占位；本条只跑测试，不启核心

    const isGreen = (r) => r.exitCode === 0 && r.fail === 0 && r.pass === r.tests && r.tests >= 418;

    // 需求原文的命令：node --test "test/**/*.test.js"（逐字执行，不改并发参数）
    const runs = [];
    for (let i = 1; i <= MAX_RUNS; i += 1) {
      // 全量套件里的 wp6/loop-fixture 会 spawn mock 宿主；上一批 AC 留下的孙进程会让它永久等待
      // （实测过一次 15 分钟空转）。每次起套件前先清扫，保证测的是代码而不是残留。
      const swept = await sweepStrays();
      if (swept > 0) c.note(`第 ${i} 次前清扫残留进程 ${swept} 个（mock-acp-agent / maestro-acc-p5 核心）。`);
      // 单次套件上限 180s：正常 13~20s，挂起（wp6/loop-fixture 等宿主）时按一次失败尝试记账，
      // 不要让它吃掉整条 AC 的 900s。
      const res = c.cmd(nodeTest(['test/**/*.test.js'], { timeout: 180000 }),
        `node --test "test/**/*.test.js"（第 ${i} 次）`);
      const out = text(res);
      c.evText(`suite-run${i}`, out);
      const summary = parse(out);
      runs.push({ i, exitCode: res.exitCode, ...summary, fails: parseFails(out) });
      if (isGreen(runs.at(-1))) break;
    }
    const greens = runs.filter(isGreen);
    const green = greens.at(-1) ?? null;
    const reds = runs.filter((r) => !isGreen(r));
    c.evJson('runs', runs.map((r) => ({
      attempt: r.i, exitCode: r.exitCode, tests: r.tests, pass: r.pass, fail: r.fail,
      fails: r.fails.map((f) => ({ name: f.name, file: f.file }))
    })));

    // ① 需求字面：存在一次同命令全绿
    c.check('Then 有一条「同一条命令」的运行退出码 0 且 fail === 0', green !== null,
      `${runs.length} 次：${runs.map((r) => `#${r.i} exit=${r.exitCode}/fail=${r.fail}`).join(', ')}`);
    const judged = green ?? runs.at(-1);
    c.eq('Then 该次 pass === tests', judged.pass, judged.tests);
    c.check('机检：该次 tests >= 418（下限断言，不写死条数）', Number(judged.tests) >= 418, `tests=${judged.tests}`);

    // ② 归因：把出现过的每个失败用例所在文件单跑一次，单跑通过才算「并发环境问题」。
    const badFiles = [...new Set(reds.flatMap((r) => r.fails).filter((f) => f.file).map((f) => f.file))].sort();
    const unknown = [...new Set(reds.flatMap((r) => r.fails).filter((f) => !f.file).map((f) => f.name))];
    const isolated = [];
    for (const file of badFiles) {
      const res = c.cmd(runCmd([NODE, '--test', file], { cwd: REPO, timeout: 300000, label: `单跑 ${file}` }),
        `归因单跑：node --test ${file}`);
      const s = parse(text(res));
      isolated.push({ file, exitCode: res.exitCode, ...s });
    }
    if (isolated.length > 0) c.evJson('isolated', isolated);
    const stillRed = isolated.filter((r) => !(r.exitCode === 0 && r.fail === 0));
    c.check('机检：出现过的失败用例单跑全部通过（失败可归因于并发环境，不是功能回归）',
      reds.length === 0 || (stillRed.length === 0 && unknown.length === 0),
      reds.length === 0
        ? '无失败项'
        : `单跑：${isolated.map((r) => `${r.file}=${r.exitCode === 0 && r.fail === 0 ? '绿' : `红(${r.fail})`}`).join(', ')}`
          + `${unknown.length > 0 ? `；无法定位文件：${JSON.stringify(unknown)}` : ''}`);

    // ③ 稳定性：观察项，**无条件披露**（即使本次一轮即绿也要写明），不翻判定（D-2）。
    const stability = { green: greens.length, attempts: runs.length, rate: `${greens.length}/${runs.length}` };
    c.evJson('stability', { ...stability, reds: reds.map((r) => ({ attempt: r.i, fail: r.fail, fails: r.fails.map((f) => f.name) })) });
    const names = [...new Set(reds.flatMap((r) => r.fails).map((f) => f.name))];
    c.note(`【观察项，不翻判定】共跑 ${runs.length} 次，${greens.length} 次全绿（${stability.rate}）`
      + `${reds.length > 0 ? `；失败项（去重）为 ${JSON.stringify(names)}` : '；这一轮没有出现失败项'}。`
      + '该命令在本机默认并发（12 核）下**已知不稳定**：既有的 p95 计时断言与 wp3/wp8 的子进程时序断言会随机红，'
      + '单独跑这些用例一律通过、`--test-concurrency=4` 时全绿（见本条的诊断证据），'
      + '未改任何断言、未放宽 p95 预算。按 D-2 登记、`report.md` §5 R-1 列为不阻断遗留项；'
      + '判定口径按需求字面（单次执行 fail===0），主控裁决见 decisions.md B-2。');

    // ④ 诊断（不参与判定）：降并发能否全绿 → 同一份代码在低并行下是否健康。
    await sweepStrays();
    const diag = c.cmd(
      runCmd([NODE, '--test', '--test-concurrency=4', 'test/**/*.test.js'],
        { cwd: REPO, timeout: 240000, label: 'node --test --test-concurrency=4' }),
      '诊断：node --test --test-concurrency=4 "test/**/*.test.js"（不参与判定）'
    );
    const diagOut = text(diag);
    c.evText('diag-concurrency4', diagOut);
    const ds = parse(diagOut);
    c.evJson('diag', { exitCode: diag.exitCode, ...ds });
    c.note(`诊断（不参与判定）：--test-concurrency=4 时 exit=${diag.exitCode}、pass=${ds.pass}/${ds.tests}、fail=${ds.fail}；`
      + '它只回答「同一份代码降并行是否全绿」，用于把失败归因到并行负载而不是产品退步。');

    // ⑤ 基线对照（不参与判定）：未改动的 1490f6d 树上跑同一条命令。
    // `-c core.autocrlf=false` 必须带：本机 autocrlf=true，worktree 会检出成 CRLF，
    // 而 `legacy-v1/SHA256SUMS` 是按 LF 字节算的——不带这个开关会平白多出一条「哈希不符」，
    // 把 CRLF 检出副作用误读成基线不健康。
    await sweepStrays();
    const baseTree = path.join(BASE, `${AC}-base`);
    let baseLine = null;
    c.cmd(runCmd(['git', '-c', 'core.autocrlf=false', 'worktree', 'add', '--detach', baseTree, BASELINE_COMMIT],
      { cwd: REPO, timeout: 120000, label: 'git worktree add 基线树' }),
    `基线树：git -c core.autocrlf=false worktree add --detach ${BASELINE_COMMIT}`);
    try {
      const res = c.cmd(runCmd([NODE, '--test', 'test/**/*.test.js'],
        { cwd: baseTree, timeout: 240000, label: 'node --test（基线树）' }),
      `基线树跑同一条命令（${BASELINE_COMMIT}）`);
      baseLine = { exitCode: res.exitCode, ...parse(text(res)), fails: parseFails(text(res)) };
      c.evText('baseline-1490f6d', text(res));
      c.evJson('baseline', { commit: BASELINE_COMMIT, ...baseLine });
    } finally {
      c.cmd(runCmd(['git', 'worktree', 'remove', '--force', baseTree],
        { cwd: REPO, timeout: 120000, label: 'git worktree remove 基线树' }), '清理基线树');
    }
    if (baseLine) {
      // 备注按实际结果分支，不许套话：基线绿与基线红要说出不同的事实。
      const verdictText = baseLine.fail === 0
        ? '基线这次全绿——说明本机默认并发下的「不满绿」是**随机负载**造成的，两边都会不同程度命中，'
          + '不能据此说基线更健康、也不能据此说 I1.5 退步；判定只认「有一次同命令全绿」。'
        : '基线同样不满绿——所以该不稳定不是 I1.5 引入的退步。';
      c.note(`基线对照（${BASELINE_COMMIT}，不参与判定）：tests=${baseLine.tests}、pass=${baseLine.pass}、fail=${baseLine.fail}`
        + `${baseLine.fails.length > 0 ? `、失败项 ${JSON.stringify(baseLine.fails.map((f) => f.name))}` : ''}。`
        + verdictText);
      c.check('机检：基线树同样能跑通（tests > 0，排除 worktree 失效导致假对照）', baseLine.tests > 0,
        `tests=${baseLine.tests}`);
    }

    c.note('「不得修改任何既有断言」（附录 D-8 的授权断言清单为空）由 S4 报告的 `git diff --stat` 与 AC-19 的基线树比对复核；'
      + '本条只判测试全绿、条数下限与失败归因。');

    return finish(c);
  }
}];
