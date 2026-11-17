// AC-40 非功能：零依赖、无打包器、中文唯一来源、纯净扫描。机检 e2e.test.js
// （AC-40 静态面：deps=0 / 无打包器 / 界面零裸 import / 界面零 CJK / 249 键全量下发）
// + regression.test.js（31 词 purity 双扫 + CJK 代码行零命中 + dependencies=0 + USAGE_LINES=25）。
// 需求机检另点名 test/wp14/labels-desktop.test.js（本分支不存在；冻结测试在 test/wp13/labels-desktop.test.js，
// 247→249 键冻结由 D-51 授权更新），逐字断言已由 e2e+regression+wp13 冻结测试承载，登记说明不放宽。
// 架构检查按 v13 §3.1 分层口径三条（CJK 界面/验收层零命中、壳层中文只在 config.rs 字符串、
// 其余静态检查 purity×2 + 无打包器 + 无裸 import + 无 host 分支）；注释假阳性按 D-55 口径排除。
import { makeCase, req, machineChecks, thenChecks, runCmd, finish, ensureDir } from '../acc11-f-common.mjs';
const AC = 'AC-40';
const FORBID = 'task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '非功能 / 架构 / 机检',
  async run() {
    const c = makeCase(AC, { face: '非功能 / 架构 / 机检', grade: 'mock 实测' });
    const tmp = ensureDir(`/tmp/m11d-${AC}`);
    machineChecks(c, {
      files: ['e2e.test.js', 'regression.test.js'],
      arch: [
        { cmd: 'grep -REl "[一-龥]" desktop/ui desktop/harness', expect: 1,
          note: 'AC-40 架构①：界面层与验收层零 CJK 命中（零命中，exit 1；基线 0 文件）' },
        // 注释不算（需求原文注；spawn.rs 19 行中文注释属既有事实），按 D-55 假阳性排除注释行
        { cmd: 'grep -REn \'"[^"]*[一-龥][^"]*"\' desktop/src-tauri/src | grep -vE \':\\s*[0-9]+:\\s*(//|\\*)\' | cut -d: -f1 | sort -u', expect: 0, lines: 1, contains: 'config.rs',
          note: 'AC-40 架构②：壳层中文字符串只在 config.rs（排除 // /// * 注释假阳性后恰好 1 行，exit 0）' },
        { cmd: `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid ${FORBID}`, expect: 0,
          note: 'AC-40 架构③：src/core + src/daemon 31 词零命中（exit 0）' },
        { cmd: 'node test/fixtures/purity-check.mjs --dirs desktop/ui', expect: 0,
          note: 'AC-40 架构④：desktop/ui 禁词零命中（exit 0）' },
        { cmd: 'grep -REn "\\"vite\\"|\\"webpack\\"|\\"rollup\\"|\\"esbuild\\"|\\"parcel\\"" package.json', expect: 1,
          note: 'AC-40 架构⑤：package.json 无打包器配置（零命中，exit 1）' },
        { cmd: 'grep -REn "^import .* from \'[^\./]\' desktop/ui', expect: 1,
          note: 'AC-40 架构⑥：desktop/ui 无 npm 裸模块 import（零命中，exit 1）' },
        { cmd: 'grep -REn "if host ==|switch [(]host[)]" src/', expect: 1,
          note: 'AC-40 架构⑦：src/core + src/daemon 无 host 分支（零命中，exit 1）' },
        { cmd: 'node -p "Object.keys(require(\'./package.json\').dependencies||{}).length"', expect: 0, contains: '0',
          note: 'AC-40 架构⑧：dependencies 为 {}（输出 0，exit 0）' }
      ],
      tmpdir: tmp
    });
    const e = c.testRuns.find((t) => t.file === 'e2e.test.js');
    const r = c.testRuns.find((t) => t.file === 'regression.test.js');
    c.check('dependencies 为 {}（输出 0），无打包器配置、界面无裸 import',
      Boolean(e?.subtests?.some((x) => /AC-40：零依赖/.test(x)) && e?.v?.ok && c.arch.find((a) => a.index === 8)?.ok),
      `# pass e2e ${e?.tap?.pass ?? 0} / deps ${c.arch.find((a) => a.index === 8)?.stdout ?? '-'}`,
      'dependencies=0 / 无 vite|webpack|rollup|esbuild|parcel / 界面零裸 import');
    c.check('desktop/ui + desktop/harness 零 CJK 字面量，文案均经 /ui/labels 下发（249 键全量）',
      Boolean(e?.v?.ok && r?.subtests?.some((x) => /CJK 代码行零命中/.test(x)) && c.arch.find((a) => a.index === 1)?.ok),
      `# pass e2e ${e?.tap?.pass ?? 0} / regression ${r?.tap?.pass ?? 0}`,
      '界面/验收层 CJK 命中数 0；/ui/labels 覆盖界面引用全部键（I11 95 顶层键 + 复用键 = 249）');
    c.check('壳层中文字符串只出现在 config.rs 的 Labels 默认值，其余壳层文件零中文字符串',
      Boolean(c.arch.find((a) => a.index === 2)?.ok),
      c.arch.find((a) => a.index === 2)?.stdout ?? '（未找到）',
      '排除注释假阳性后 shell 中文字符串文件集合 = {config.rs}');
    c.check('src/core + src/daemon 31 词零命中、desktop/ui 禁词零命中、无 if host==/switch(host)',
      Boolean(r?.subtests?.some((x) => /31 词纯净扫描双扫/.test(x)) && r?.v?.ok &&
               c.arch.filter((a) => [3, 4, 7].includes(a.index)).every((a) => a.ok)),
      `# pass regression ${r?.tap?.pass ?? 0}`,
      'purity-check 双扫 exit 0；31 词零命中；host 分支零命中');
    c.check('既有键 USAGE_LINES 仍 25 行（逐字基线不变）',
      Boolean(r?.subtests?.some((x) => /dependencies=0 且 USAGE_LINES 仍 25 行/.test(x)) && r?.v?.ok),
      (r?.subtests ?? []).filter((x) => /USAGE_LINES/.test(x)).join(' | ') || '（未找到）',
      'USAGE_LINES.length === 25');
    thenChecks(c);
    // 语义复核：config.rs 中文只落在 Labels 默认值与 merge_payload pick(DESKTOP_TRAY_*) 段。
    const sem = runCmd("grep -n -e 'pick(\"DESKTOP_TRAY_' -e 'fn default' -e 'impl Labels' desktop/src-tauri/src/config.rs", { tmpdir: tmp });
    c.cmd(sem, '语义复核：config.rs 中文默认值的 Labels/pick 归属');
    c.check('语义复核：config.rs 中文均在 Labels 默认值 + merge_payload pick(DESKTOP_TRAY_*)（壳层例外按 D-04/BR-26）',
      /pick|Labels|default|impl/i.test(sem.stdout),
      sem.stdout.trim().split('\n').slice(0, 6).join(' | '),
      '壳层中文只在 config.rs 的 Labels baked-in 默认值与 pick 段');
    c.note('机检文件名口径：需求点名 test/wp14/labels-desktop.test.js（本分支不存在），冻结测试在 test/wp13/labels-desktop.test.js；D-51 授权其精确键数按新增量 147→249 更新（I1.9 D-27 先例，精确断言改期望不过滤）。AC-40 逐字断言由 e2e.test.js「AC-40 静态面」+ regression.test.js「31 词双扫 / CJK 零命中 / deps=0 / USAGE_LINES=25」+ wp13 冻结测试共同承载，按实际存在文件机检并登记，不放宽。');
    c.note('D-55 假阳性排除：架构② 需求原文注「注释不算、spawn.rs 19 行中文注释属既有事实」，但字面 grep 会把 main.rs:196 的注释行中文一起带出；按 blockers.md 已裁决的「注释假阳性排除」口径用 grep -vE 排除 // / /// / * 注释行后，shell 中文字符串文件集合恰为 {config.rs}，不放宽对真实中文字符串字面量的零命中要求。');
    return finish(c);
  }
}];
