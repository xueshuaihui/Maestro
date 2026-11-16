// AC-30 · 文案唯一来源/界面零中文/31 词双目录 purity/零依赖（静态机检面，自定义用例跑 node -p + 两条 purity）
import {
  makeCase, finish, requirementTitle, freshRoot, coreStop, runNodeTest, checkF16,
  renderArchFrame, runCmd, runBash, WORDS_31, NODE, REPO, PURITY_CHECK
} from '../acc10b-f-common.mjs';

function purityRun(dirs) {
  return runCmd([NODE, PURITY_CHECK, '--dirs', dirs, '--forbid', WORDS_31], {
    cwd: REPO, label: `purity-check --dirs ${dirs} --forbid <31 词>`,
  });
}

export const cases = [{
  ac: 'AC-30',
  title: requirementTitle('AC-30'),
  face: 'mock 实测（静态机检面）',
  async run() {
    const ac = 'AC-30';
    const c = makeCase(ac, { title: requirementTitle(ac), face: 'mock 实测（静态机检面）' });
    const root = freshRoot(ac);
    c.add(root);
    c.noteFixture('独立项目根（%TEMP%，NODE_ENV=test）；本 AC 为仓库静态检查，不读写 %TEMP% 业务数据', root);

    // 1) 机检 F-16：labels-drill.test.js（新增键齐全/既有键值不变/CJK 零命中）
    const t = runNodeTest('labels-drill.test.js', { label: 'node --test test/wp14/labels-drill.test.js' });
    c.cmd(t.res, t.res.label);
    checkF16(c, t, '机检 F-16（test/wp14/labels-drill.test.js）');
    c.frame('tests.stdout', 'txt', t.res.stdout + (t.res.stderr ? `\n--- stderr ---\n${t.res.stderr}` : ''));
    c.frame('test.source', 'txt', t.src);
    for (const lit of [
      "const CJK_PATTERN = /[\\u3000-\\u303F\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF\\uFF00-\\uFFEF]/",
      "test('AC-30：desktop/ui 与 desktop/harness 的 CJK 命中数为 0（子目录缺失按 0 命中）'",
      'EXPECTED_DRILL_KEYS',
      'DESKTOP_LABEL_KEYS',
      'UI_LABEL_KEYS',
    ]) c.includes(`机检源码锚点：${lit}`, t.src, lit);

    // 2) 零依赖红线：node -p 输出 0
    const deps = runCmd([NODE, '-p', "Object.keys(require('./package.json').dependencies||{}).length"], {
      cwd: REPO, label: 'node -p dependencies length',
    });
    c.cmd(deps);
    c.eq('dependencies 恰为 {}（键数 0）', deps.stdout.trim(), '0');
    c.frame('deps.stdout', 'txt', `exit=${deps.exitCode}\n${deps.stdout}\n${deps.stderr}`);

    // 3) 架构检查两条：31 词双目录 purity，各 exit 0
    const p1 = purityRun('src/core,src/daemon');
    const p2 = purityRun('desktop/ui,desktop/harness');
    c.cmd(p1); c.cmd(p2);
    c.check('架构① src/core,src/daemon 31 词 purity exit 0（31 词全量字面）', p1.exitCode === 0, `exit=${p1.exitCode}\n${p1.stdout}\n${p1.stderr}`.slice(0, 2000));
    c.check('架构② desktop/ui,desktop/harness 31 词 purity exit 0（31 词全量字面）', p2.exitCode === 0, `exit=${p2.exitCode}\n${p2.stdout}\n${p2.stderr}`.slice(0, 2000));
    c.eq('禁词表恰好 31 词（不全写"同一词表"）', WORDS_31.split(',').length, 31);
    const archFrame = renderArchFrame([
      { label: '架构① src/core,src/daemon purity', cmd: `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>`, expect: 'exit 0', exitCode: p1.exitCode, hits: 0, ok: p1.exitCode === 0, lines: p1.stdout.split('\n').filter(Boolean) },
      { label: '架构② desktop/ui,desktop/harness purity', cmd: `node test/fixtures/purity-check.mjs --dirs desktop/ui,desktop/harness --forbid <31 词>`, expect: 'exit 0', exitCode: p2.exitCode, hits: 0, ok: p2.exitCode === 0, lines: p2.stdout.split('\n').filter(Boolean) },
    ], '架构检查（AC-30 原文两条，--forbid 全 31 词字面）');
    c.frame('arch.stdout', 'txt', archFrame);

    // 4) 收尾原始帧
    const stop = coreStop(root);
    c.cmd(stop);
    c.frame('corestop', 'txt', `exit=${stop.exitCode}\n${stop.stdout}\n${stop.stderr}`);
    c.frame('state', 'json', JSON.stringify({ __note: '本 AC 走仓库静态机检面；依赖/文案键/CJK/purity 指纹见 test.source 与 tests.stdout', ac, NODE_ENV: 'test' }, null, 2));
    c.frame('events', 'jsonl', JSON.stringify({ __note: '静态机检面无落盘事件帧', ac }) + '\n');

    c.note('Then 逐字：dependencies==={}（node -p 输出 0）；desktop/ui+desktop/harness 无中文字面量（CJK 命中 0，由 labels-drill 机检核对）；新增文案键经文案表下发（A-10 63 键齐全、既有键值不变）；31 词双目录 purity 零命中；回归失败集合差集 0（口径见 §3.3/裁决 G，由 AC-34 回归门禁承担）。');
    c.note('回归差集口径由裁决 G 三段式承载，不在本 AC 写死单一失败数字；本 AC 只判静态四面（依赖/中文/文案键/禁词）。');
    return finish(c);
  },
}];
