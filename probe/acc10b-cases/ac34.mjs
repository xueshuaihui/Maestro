// AC-34 · 回归门禁（非功能）：机检 F-16 + 全量四步（取数/差集/逐文件/新红复核）
// 取证纪律：只认需求 Then（requirement.md:805-810）与裁决 G；不比单次失败绝对值，
//           比 tests≥1425 + 差集=0 + 集合外 # fail 0 + 新红独占复核。
import fs from 'node:fs';
import path from 'node:path';
import { makeCase, finish, requirementTitle, freshRoot, coreStop, runNodeTest,
  checkF16, grepCheck, renderArchFrame, checkArch, runBash } from '../acc10b-f-common.mjs';

// 全量实跑原始帧（2026-11-17，NODE_ENV=test --test-concurrency=1 --test-timeout=120000 --test-force-exit）
// 原始 TAP 从 Git-Bash /tmp 落盘到仓库内 evidence（Node 原生进程读不到 Git-Bash 的 /tmp）。
const FULL_LOG = 'docs/iterations/iteration-10b/evidence/AC-34.fullrun.tap.txt';
const FRAME_DIR = 'docs/iterations/iteration-10b/flake-frames';

// 差集失败的两条 → 独占复跑原始帧（两次，均仍失败）
const DIFF_FRAMES = [
  'handoff-schema-20261117-013251.log',
  'instance-list-20261117-013251.log',
  'handoff-schema-confirm-20261117-013259.log',
  'instance-list-confirm-20261117-013259.log',
];

function tapSummary(txt) {
  const num = (re) => { const m = txt.match(re); return m ? Number(m[1]) : 0; };
  return {
    tests: num(/^# tests\s+(\d+)/m),
    pass: num(/^# pass\s+(\d+)/m),
    fail: num(/^# fail\s+(\d+)/m),
    skipped: num(/^# skipped\s+(\d+)/m),
  };
}

export const cases = [{
  ac: 'AC-34',
  title: requirementTitle('AC-34'),
  face: 'mock 实测',
  async run() {
    const c = makeCase('AC-34', { title: requirementTitle('AC-34'), face: 'mock 实测' });
    const root = freshRoot('AC-34');
    c.add(root);
    c.noteFixture('独立项目根（%TEMP%，NODE_ENV=test，mock 宿主）', root);

    // 1) 机检 F-16：regression-drill.test.js（静态面：主链/格式/USAGE_LINES/命令表 + 口径函数）
    const t = runNodeTest('regression-drill.test.js', { label: 'node --test test/wp14/regression-drill.test.js' });
    c.cmd(t.res, t.res.label);
    checkF16(c, t, '机检 F-16（test/wp14/regression-drill.test.js）');
    c.frame('tests.stdout', 'txt', t.res.stdout + (t.res.stderr ? `\n--- stderr ---\n${t.res.stderr}` : ''));
    c.frame('test.source', 'txt', t.src);
    c.includes('Then 逐字：USAGE_LINES 25 行冻结', t.src, 'assert.equal(USAGE_LINES.length, 25');
    c.includes('Then 逐字：零依赖断言', t.src, 'assert.deepEqual(pkg.dependencies ?? {}, {}');
    c.includes('Then 逐字：31 词禁表冻结', t.src, 'assert.equal(WORDS_31.length, 31');

    // 2) 架构检查（requirement.md:812）：git diff --stat 仅允许只读投影 import / 无改动
    const diff = runBash('git diff --stat HEAD -- src/cli/main.js src/core/state-machine.js src/core/orchestrator.js',
      { label: 'git diff --stat HEAD -- 主链三文件' });
    c.cmd(diff);
    const arch = [{
      label: '主链三文件无产品改动（git diff --stat 空）',
      cmd: diff.cmd, expect: 'zero', exitCode: diff.exitCode,
      hits: diff.stdout.split('\n').filter((l) => l.trim()).length,
      lines: diff.stdout.split('\n').filter((l) => l.trim()),
      ok: diff.stdout.trim() === '',
      stdout: diff.stdout, stderr: diff.stderr,
    }];
    checkArch(c, arch);
    c.frame('arch.stdout', 'txt', renderArchFrame(arch));

    // 3) 全量四步（真实原始帧）
    const fullTxt = fs.existsSync(FULL_LOG) ? fs.readFileSync(FULL_LOG, 'utf8') : '';
    const sum = tapSummary(fullTxt);
    const notOk = fullTxt.split('\n').filter((l) => /^not ok\s+\d+\s+-/.test(l)).map((l) => l.replace(/^not ok\s+\d+\s+-\s*/, ''));

    // Step 1 取数：tests ≥ 1425
    c.check(`全量取数：tests ≥ 1425（实测 ${sum.tests}）`, sum.tests >= 1425,
      `tests=${sum.tests} pass=${sum.pass} fail=${sum.fail} skipped=${sum.skipped}`);
    c.frame('fullrun.tap', 'txt', fullTxt.length ? fullTxt : '（全量 TAP 帧缺失）');

    // Step 2 差集：observedFail ∖ allowed = 0
    // allowed = win32 16 条登记项（逐字取自 baseline-failures-win32.txt）
    const allowed = [
      'developer.yaml matches the documented sample byte for byte',
      'code-change/SKILL.md matches the documented sample byte for byte',
      '两份 legacy 夹具的 state/events sha256 与 SHA256SUMS 一致',
      'resolveEvidenceRef 纯路径判定（越界 / artifacts / policy）',
      '可注入 fs：stat 结果决定通过，且不产生任何写',
      'the desktop port listens on loopback only (lsof shows 127.0.0.1)',
      'AC-27：读操作不写实例、四组状态不变、仅回环监听、数据面无凭据 401',
      '--host-error 早返回（-32603）也在返回前写 attempts=1（AC-63）',
      'promptFailures:2 -> attempts 依次 1/2/3，前 2 次 -32603 第 3 次 end_turn',
      'newState 只追加 health 与 traceId 两个字段、既有初始字段与顺序不动；缺 health 按 30000 缺省且不批量回填',
      'execution.summary 每会话恰一条，成功/失败/取消三种收尾都有，缺项为 null',
      '--fail-tool 合并四项；--fail-tool-no-refs 缺项为 null 且 command 不被工具名冒充',
      '--stop-after 3 冻结窗口恰 3 条跨度、7 字段、无 handoff_ids、HO-002 读取时推导',
      'grep -c "object: \'session\'" ≤ 13；会话级新增事件类型只有 execution.summary',
      'single / code-loop / task-loop 三主链运行期输出不出现健康度 / 追踪新行',
      'S-07: thirteen directly written role files are read by the registry (--host mock)',
    ];
    const inAllowed = (name) => allowed.some((a) => name === a || name.includes(a) || a.includes(name));
    const diffSet = notOk.filter((n) => !inAllowed(n));
    c.check(`全量差集：observedFail(${notOk.length}) ∖ allowed(${allowed.length}) = ${diffSet.length}（应为 0）`,
      diffSet.length === 0,
      diffSet.length ? `差集（新增失败）：${diffSet.join(' | ')}` : '差集为空');
    c.frame('diffset', 'txt', [
      `observedFail (${notOk.length}):`, ...notOk.map((n) => `  - ${n}`),
      '', `allowed win32 (${allowed.length}):`, ...allowed.map((a) => `  - ${a}`),
      '', `diff = observedFail ∖ allowed (${diffSet.length}):`, ...diffSet.map((n) => `  - ${n}`),
    ].join('\n'));

    // Step 3 逐文件：点名清单 36 文件逐个 # fail；集合外必须 # fail 0。
    // 实测：差集两条落 handoff-schema(test/wp11) 与 instance-list(test/wp13)，均为集合外红。
    c.check('逐文件：集合外文件 # fail 0（本机实测差集两条，见新红复核）',
      diffSet.length === 0,
      '集合外红：test/wp11/handoff-schema.test.js(HANDOFF_EVIDENCE_ESCAPE:符号链接绕过)、test/wp13/instance-list.test.js(AC-04:空态…新实例2秒内…)；其余点名文件失败项均在允许集合内');
    c.check('逐文件：ls test/wp13/*.test.js | wc -l = 36（仅核清单完整，不作判据）',
      fs.readdirSync('test/wp13').filter((f) => f.endsWith('.test.js')).length === 36,
      `实点 ${fs.readdirSync('test/wp13').filter((f) => f.endsWith('.test.js')).length}`);

    // Step 4 新红复核：差集两条独占复跑确认（失败→判红，非 flake）
    let confirmedRed = 0;
    let logTexts = [];
    for (const f of DIFF_FRAMES) {
      const p = path.join(FRAME_DIR, f);
      if (fs.existsSync(p)) {
        const txt = fs.readFileSync(p, 'utf8');
        const s = tapSummary(txt);
        const stillFail = /not ok.*(符号链接绕过|空态、不可读行)/.test(txt);
        if (stillFail) confirmedRed += 1;
        logTexts.push(`===== ${f} =====\n${txt}`);
        c.cmd({ label: `独占复核 ${f}`, argv: [`(frame) ${f}`], cwd: FRAME_DIR,
          exitCode: stillFail ? 1 : 0, durationMs: 0, stdout: txt.slice(0, 2000), stderr: '' });
      }
    }
    c.frame('newred-recheck', 'txt', logTexts.length ? logTexts.join('\n\n') : '（独占复核帧缺失）');
    c.check('新红复核：差集失败经独占复跑通过（flake）或差集已为 0',
      diffSet.length === 0,
      `两次独占复跑均仍红（确认红 ${confirmedRed} 帧 / 共 ${DIFF_FRAMES.length} 帧）：HANDOFF_EVIDENCE_ESCAPE:符号链接绕过、AC-04:空态… 均非 flake → 按裁决 G 判红`);

    // 收尾
    const stop = coreStop(root);
    c.cmd(stop);
    c.frame('corestop', 'txt', `exit=${stop.exitCode}\n${stop.stdout}\n${stop.stderr}`);
    c.frame('state', 'json', JSON.stringify({ __note: 'AC-34 为仓库静态/全量门禁面，无业务实例 state', ac: 'AC-34', NODE_ENV: 'test' }, null, 2));
    c.frame('events', 'jsonl', JSON.stringify({ __note: 'AC-34 无落盘事件帧', ac: 'AC-34' }) + '\n');
    c.note('三条主链 / 两种格式 / USAGE_LINES=25 / 命令表 / 零依赖 / 31 词表由机检 F-16（regression-drill.test.js 8/8）承载。');
    c.note('全量四步：取数 tests=1524≥1425 ✓；差集=2（HANDOFF_EVIDENCE_ESCAPE:符号链接绕过、AC-04:空态…新实例2秒内…）≠0 ✗；两条独占复跑两次均仍红（非 flake）→ 按裁决 G 判红。');
    c.note('允许集合严格按 requirement.md:805 / 裁决 G：win32 16 条 ∪ 隔离复跑通过的 flake；两条差集失败不在 16 条内、亦非 flake。regression-drill.test.js 注释把二者列为允许集合，与需求 Then 冲突——以需求为准（铁律1）。');
    return finish(c);
  },
}];
